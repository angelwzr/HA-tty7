"""Native main-run notification boundaries, using synthetic controller input."""
from datetime import UTC, datetime, timedelta

import pytest

from custom_components.ha_tty7.controller import HostController
from custom_components.ha_tty7.protocol import build_error

NOW = datetime(2026, 10, 15, tzinfo=UTC)


def native(status="working", *, state="ready", run="main-run", pane=1, session="main-session",
           outcome="completed", input_id="opaque-request-one"):
    return dict(pane_id=pane, session_id=session if state == "ready" else None,
                agent="OhMyPi", status=status if state == "ready" else "unknown",
                rich=state == "ready", activity=None, turns=None, model=None,
                effort=None, permission_mode=None,
                omp=dict(state=state, run_id=run if state == "ready" else None,
                         background_jobs=0 if state == "ready" else None,
                         outcome=outcome if state == "ready" and status == "done" and run is not None else None,
                         input_id=input_id if state == "ready" and status == "waiting" and run is not None else None))


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
    assert [event["kind"] for event in accept(
        controller, native("waiting", input_id="opaque-request-two"), second=5)] == ["needs_input"]


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


@pytest.mark.parametrize("outcome,expected", [
    ("completed", ["completed"]), ("failed", ["failed"]), ("cancelled", []), (None, []),
])
def test_only_explicit_normal_or_failed_main_outcomes_notify(outcome, expected):
    controller = HostController("synthetic_host")
    working = native()
    working["omp"].update(outcome=None, input_id=None)
    accept(controller, working)
    terminal = native("done")
    terminal["omp"].update(outcome=outcome, input_id=None)
    assert [event["kind"] for event in accept(controller, terminal, second=1)] == expected
    assert accept(controller, terminal, second=2) == []


def test_stock_only_status_changes_cannot_prove_a_real_finish_or_input_request():
    controller = HostController("synthetic_host")
    row = {key: value for key, value in native().items() if key != "omp"}
    row["agent"] = "Claude"
    assert accept(controller, row) == []
    assert accept(controller, row | {"status": "waiting"}, second=1) == []
    assert accept(controller, row | {"status": "working"}, second=2) == []
    assert accept(controller, row | {"status": "done"}, second=3) == []


def test_same_input_identity_is_not_replayed_after_a_working_status_flap():
    controller = HostController("synthetic_host")
    working = native()
    working["omp"].update(outcome=None, input_id=None)
    accept(controller, working)
    waiting = native("waiting")
    waiting["omp"].update(outcome=None, input_id="opaque-question-one")
    assert [event["kind"] for event in accept(controller, waiting, second=1)] == ["needs_input"]
    assert accept(controller, working, second=2) == []
    assert accept(controller, waiting, second=3) == []
    next_wait = native("waiting")
    next_wait["omp"].update(outcome=None, input_id="opaque-question-two")
    assert [event["kind"] for event in accept(controller, next_wait, second=4)] == ["needs_input"]


def test_legacy_native_rows_without_proof_remain_silent():
    controller = HostController("synthetic_host")
    for second, status in enumerate(("working", "waiting", "working", "done")):
        row = native(status)
        row["omp"].pop("outcome")
        row["omp"].pop("input_id")
        assert accept(controller, row, second=second) == []


@pytest.mark.parametrize("changes,native_changes", [
    ({"status": "working"}, {"outcome": "completed"}),
    ({"status": "waiting"}, {"outcome": "failed", "input_id": None}),
    ({}, {"outcome": "completed", "background_jobs": 1}),
    ({}, {"outcome": "failed", "background_jobs": True}),
    ({}, {"outcome": "completed", "run_id": None}),
    ({}, {"outcome": "completed", "input_id": "conflicting-request"}),
    ({}, {"outcome": "unknown"}),
    ({"rich": False}, {}),
    ({"inferred": True}, {}),
    ({"agent": "stock-child"}, {}),
    ({"status": "waiting"}, {"outcome": None, "input_id": ""}),
    ({"status": "waiting"}, {"outcome": None, "input_id": "x" * 129}),
    ({"status": "waiting"}, {"outcome": None, "input_id": "\ud800"}),
    ({"status": "working"}, {"outcome": None, "input_id": "not-waiting"}),
    ({"status": "waiting"}, {"outcome": None, "input_id": "no-run", "run_id": None}),
])
def test_controller_defensively_rejects_inconsistent_notification_proof(changes, native_changes):
    controller = HostController("synthetic_host")
    accept(controller, native())
    polluted = native("done") | changes
    polluted["omp"].update(native_changes)
    assert accept(controller, polluted, second=1) == []


@pytest.mark.parametrize("flap", ["source", "roster", "error", "stale", "restore"])
def test_input_baselines_and_consumed_identities_survive_recovery(flap):
    controller = HostController("synthetic_host")
    assert accept(controller, native("waiting")) == []
    assert accept(controller, native(), second=1) == []
    assert accept(controller, native("waiting"), second=2) == []
    if flap == "source":
        assert accept(controller, native(state="missing"), second=3) == []
    elif flap == "roster":
        assert accept(controller, second=3) == []
    elif flap == "error":
        controller.accept(build_error(controller.host_id, "cli_failed"), NOW + timedelta(seconds=3))
    elif flap == "stale":
        controller.expire(NOW + timedelta(seconds=50))
    else:
        restored = HostController(controller.host_id)
        restored.restore(controller.attributes)
        controller = restored
    assert accept(controller, native("waiting", input_id="recovered-request"), second=51) == []
    assert accept(controller, native(), second=52) == []
    assert accept(controller, native("waiting", input_id="recovered-request"), second=53) == []
    assert accept(controller, native("waiting"), second=54) == []
    assert [event["kind"] for event in accept(
        controller, native("waiting", input_id="new-request"), second=55)] == ["needs_input"]


@pytest.mark.parametrize("outcome", ["completed", "failed", "cancelled"])
def test_all_terminal_baselines_consume_the_main_run(outcome):
    controller = HostController("synthetic_host")
    assert accept(controller, native("done", outcome=outcome)) == []
    assert accept(controller, native(), second=1) == []
    assert accept(controller, native("done", outcome="completed"), second=2) == []
    assert accept(controller, native("waiting", input_id="late-input"), second=3) == []


def test_pending_background_work_does_not_prove_completion():
    controller = HostController("synthetic_host")
    accept(controller, native())
    pending = native()
    pending["omp"]["background_jobs"] = 2
    assert accept(controller, pending, second=1) == []
    assert [event["kind"] for event in accept(controller, native("done"), second=2)] == ["completed"]


def test_input_history_is_bounded_and_fails_closed_instead_of_replaying():
    from custom_components.ha_tty7.controller import MAX_INPUT_IDENTITIES
    controller = HostController("synthetic_host")
    accept(controller, native())
    for index in range(MAX_INPUT_IDENTITIES):
        assert [event["kind"] for event in accept(
            controller, native("waiting", input_id=f"request-{index}"), second=index + 1)] == ["needs_input"]
    marker = controller._native_runs[1]
    assert len(marker.inputs) == MAX_INPUT_IDENTITIES
    assert accept(controller, native("waiting", input_id="over-limit"), second=300) == []
    assert accept(controller, native("waiting", input_id="request-0"), second=301) == []
    assert len(marker.inputs) == MAX_INPUT_IDENTITIES
    assert [event["kind"] for event in accept(controller, native("done"), second=302)] == ["completed"]


def test_max_roster_input_identities_survive_roster_and_source_flaps():
    controller = HostController("synthetic_host")
    panes = range(1, 257)
    assert accept(controller, *(native("waiting", pane=pane) for pane in panes)) == []
    assert accept(controller, *(native(state="stale", pane=pane) for pane in panes), second=1) == []
    assert accept(controller, second=2) == []
    assert accept(controller, *(native(pane=pane) for pane in panes), second=3) == []
    assert accept(controller, *(native("waiting", pane=pane) for pane in panes), second=4) == []
    rows = [native("waiting", pane=pane,
                   input_id="new-approval" if pane == 256 else "opaque-request-one") for pane in panes]
    assert [event["pane_id"] for event in accept(controller, *rows, second=5)] == [256]
    assert len(controller._native_runs) == 256
    assert all(len(marker.inputs) <= 2 for marker in controller._native_runs.values())
