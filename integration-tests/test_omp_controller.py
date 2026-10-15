"""Native main-run notification boundaries, using synthetic controller input."""
from datetime import UTC, datetime, timedelta

import pytest

from custom_components.ha_tty7.controller import HostController
from custom_components.ha_tty7.protocol import build_error

NOW = datetime(2026, 10, 15, tzinfo=UTC)


def native(status="working", *, state="ready", run="main-run", pane=1, session="main-session"):
    return dict(pane_id=pane, session_id=session if state == "ready" else None,
                agent="OhMyPi", status=status if state == "ready" else "unknown",
                rich=state == "ready", activity=None, turns=None, model=None,
                effort=None, permission_mode=None,
                omp=dict(state=state, run_id=run if state == "ready" else None,
                         background_jobs=0 if state == "ready" else None))


def accept(controller, *rows, second=0):
    return controller.accept({"kind": "snapshot", "agents": list(rows)}, NOW + timedelta(seconds=second))


def test_native_completion_once_per_main_run_despite_reopening_and_source_flaps():
    controller = HostController("synthetic_host")
    assert accept(controller, native()) == []
    assert [event["kind"] for event in accept(controller, native("done"), second=1)] == ["completed"]
    assert accept(controller, native(), second=2) == []
    assert accept(controller, native("done"), second=3) == []
    assert accept(controller, native(state="missing"), second=4) == []
    assert accept(controller, native(), second=5) == []
    assert accept(controller, native("done"), second=6) == []
    assert accept(controller, native(run="next-run"), second=7) == []
    assert [event["kind"] for event in accept(controller, native("done", run="next-run"), second=8)] == ["completed"]


@pytest.mark.parametrize("state", ["missing", "stale", "invalid", "conflict", "unsupported"])
def test_native_source_recovery_is_a_silent_baseline_and_waiting_requires_ready_transition(state):
    controller = HostController("synthetic_host")
    accept(controller, native(), second=0)
    assert accept(controller, native(state=state), second=1) == []
    assert accept(controller, native("waiting"), second=2) == []
    assert accept(controller, native("waiting"), second=3) == []
    assert accept(controller, native(), second=4) == []
    assert [event["kind"] for event in accept(controller, native("waiting"), second=5)] == ["needs_input"]


def test_native_completed_baselines_cannot_replay_after_initial_reconnect_or_restore():
    controller = HostController("synthetic_host")
    assert accept(controller, native("done")) == []
    assert accept(controller, native(), second=1) == []
    assert accept(controller, native("done"), second=2) == []
    controller.accept(build_error(controller.host_id, "cli_failed"), NOW + timedelta(seconds=3))
    assert accept(controller, native("done", run="offline-run"), second=4) == []
    assert accept(controller, native(run="offline-run"), second=5) == []
    assert accept(controller, native("done", run="offline-run"), second=6) == []
    restored = HostController(controller.host_id)
    restored.restore(controller.attributes)
    assert accept(restored, native("done", run="offline-run"), second=7) == []
    assert accept(restored, native(run="offline-run"), second=8) == []
    assert accept(restored, native("done", run="offline-run"), second=9) == []


def test_native_source_recovery_completion_is_consumed_not_replayed():
    controller = HostController("synthetic_host")
    accept(controller, native())
    assert accept(controller, native(state="stale"), second=1) == []
    assert accept(controller, native("done"), second=2) == []
    assert accept(controller, native(), second=3) == []
    assert accept(controller, native("done"), second=4) == []


def test_native_run_identity_is_host_pane_and_main_session_scoped():
    for host in ("first_host", "second_host"):
        controller = HostController(host)
        accept(controller, native(), native(pane=2))
        assert [event["pane_id"] for event in accept(controller, native("done"), native("done", pane=2), second=1)] == [1, 2]
        assert accept(controller, native(session="replacement"), second=2) == []
        events = accept(controller, native("done", session="replacement"), second=3)
        assert [event["kind"] for event in events] == ["completed"]


def test_native_run_change_does_not_inherit_previous_work_or_waiting_transition():
    controller = HostController("synthetic_host")
    accept(controller, native())
    assert accept(controller, native("done", run="unobserved-run"), second=1) == []
    assert accept(controller, native("waiting", run="another-run"), second=2) == []


def test_native_unavailable_cannot_promote_stock_child_done_or_waiting():
    controller = HostController("synthetic_host")
    accept(controller, native())
    # Defense at the alert boundary as well as protocol validation: never trust
    # a stock child status when the native source explicitly says unavailable.
    for index, status in enumerate(("done", "working", "waiting", "done"), 1):
        polluted = native(state="missing") | {"status": status, "rich": True, "session_id": "main-session"}
        assert accept(controller, polluted, second=index) == []


def test_native_completed_run_remains_consumed_through_empty_roster_and_restore_reopen():
    original = HostController("synthetic_host")
    accept(original, native("done"))
    assert accept(original, second=1) == []
    assert accept(original, native(), second=2) == []
    assert accept(original, native("done"), second=3) == []
    restored = HostController(original.host_id)
    restored.restore(original.attributes)
    assert accept(restored, native(), second=4) == []
    assert accept(restored, native("done"), second=5) == []
    assert "omp" in restored.attributes["agents"][0]
    assert set(restored.restore_attributes()) == set(original.restore_attributes())


def test_native_null_run_cannot_generate_completion():
    controller = HostController("synthetic_host")
    accept(controller, native("idle", run=None))
    assert accept(controller, native(run=None), second=1) == []
    assert accept(controller, native("done", run=None), second=2) == []


def test_native_dedup_stays_bounded_through_max_roster_recovery_and_pane_churn():
    controller = HostController("synthetic_host")
    panes = range(1, 257)
    assert accept(controller, *(native("done", pane=pane) for pane in panes)) == []
    assert accept(controller, *(native(state="stale", pane=pane) for pane in panes), second=1) == []
    assert accept(controller, second=2) == []
    controller.accept(build_error(controller.host_id, "cli_failed"), NOW + timedelta(seconds=3))
    assert accept(controller, *(native(pane=pane) for pane in panes), second=4) == []
    assert accept(controller, *(native("done", pane=pane) for pane in panes), second=5) == []
    # Resource-bound assertions intentionally inspect runtime-only ownership:
    # behavior above must not be implemented with an unbounded event archive.
    assert len(controller._native_runs) == 256
    assert accept(controller, native(pane=257), second=6) == []
    assert len(controller._native_runs) == 256
    assert [event["kind"] for event in accept(controller, native("done", pane=257), second=7)] == ["completed"]
    assert accept(controller, native(), native("done", pane=257), second=8) == []
    assert len(controller._native_runs) == 256
    assert "_native_runs" not in controller.restore_attributes()


def test_native_new_runs_replace_runtime_marker_instead_of_accumulating_history():
    controller = HostController("synthetic_host")
    accept(controller, native("idle", run=None))
    for index in range(300):
        run = f"synthetic-run-{index}"
        assert accept(controller, native(run=run), second=2 * index + 1) == []
        assert [event["kind"] for event in accept(controller, native("done", run=run), second=2 * index + 2)] == ["completed"]
        assert len(controller._native_runs) == 1


def test_roster_churn_does_not_evict_completions_for_panes_later_in_snapshot():
    controller = HostController("synthetic_host")
    assert accept(controller, *(native("done", pane=pane) for pane in range(2, 258))) == []
    assert accept(controller, *(native(pane=pane) for pane in range(1, 257)), second=1) == []
    events = accept(controller, *(native("done", pane=pane) for pane in range(1, 257)), second=2)
    assert [event["pane_id"] for event in events] == [1]
