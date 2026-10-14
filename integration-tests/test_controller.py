"""Real controller behavior, without transport or clock mocks."""
from datetime import UTC, datetime, timedelta

from custom_components.ha_tty7.controller import HostController, notification_payload
from custom_components.ha_tty7.protocol import build_error, build_snapshot

NOW = datetime(2026, 10, 14, tzinfo=UTC)


def agent(status="working", pane=1, session="synthetic-session", name="codex"):
    return dict(pane_id=pane, session_id=session, agent=name, status=status,
                activity=None, turns=None, model=None, effort=None, permission_mode=None)


def snapshot(controller, agents, seconds=0):
    return controller.accept(build_snapshot(controller.host_id, agents), NOW + timedelta(seconds=seconds))


def test_baselines_identity_and_transitions():
    controller = HostController("desktop_demo")
    assert controller.state == "unconfirmed"
    assert snapshot(controller, [agent("done"), agent("waiting", 2)]) == []
    assert snapshot(controller, [agent(), agent("idle", 2)], 1) == []
    events = snapshot(controller, [agent("done"), agent("waiting", 2)], 2)
    assert [event["kind"] for event in events] == ["completed", "needs_input"]
    assert snapshot(controller, [agent("done"), agent("waiting", 2)], 3) == []
    assert snapshot(controller, [agent("done", session="replacement"), agent("unknown", 2)], 4) == []
    assert snapshot(controller, [agent("done", session="replacement"), agent("done", 2)], 5) == []
    assert [event["kind"] for event in snapshot(controller, [agent("waiting", 3)], 6)] == ["needs_input"]
    assert snapshot(controller, [], 7) == []
    assert controller.state == 0
    assert controller.online


def test_error_silence_and_reconnection_preserve_rows():
    controller = HostController("desktop_demo")
    snapshot(controller, [agent()], 0)
    controller.accept(build_error("desktop_demo", "cli_failed"), NOW + timedelta(seconds=1))
    assert controller.state == "error" and not controller.online
    before = controller.attributes
    assert not controller.expire(NOW + timedelta(seconds=46))
    assert controller.expire(NOW + timedelta(seconds=47))
    assert controller.state == "stale"
    for key in ("agents", "counts", "last_contact", "last_success", "error_code", "collector_ok"):
        assert controller.attributes[key] == before[key]
    assert snapshot(controller, [agent("done")], 48) == []
    assert controller.online
    assert not controller.expire(NOW + timedelta(seconds=93))
    assert controller.expire(NOW + timedelta(seconds=94))
    assert snapshot(controller, [agent("waiting")], 95) == []


def test_restore_sanitizes_and_never_restores_confirmation():
    original = HostController("desktop_demo")
    snapshot(original, [agent()], 0)
    attrs = original.attributes | {"webhook_id": "excluded", "raw_output": "excluded"}
    restored = HostController("desktop_demo")
    restored.restore(attrs)
    assert restored.state == "unconfirmed" and not restored.online
    assert restored.attributes["agents"] == original.attributes["agents"]
    assert restored.attributes["last_success"] == original.attributes["last_success"]
    assert "excluded" not in str(restored.attributes)
    assert snapshot(restored, [agent("done")], 2) == []
    malformed = HostController("desktop_demo")
    malformed.restore(attrs | {"agents": [agent() | {"launch_argv": "excluded"}]})
    assert malformed.attributes["agents"] == []
    assert malformed.attributes["last_contact"] is None
    malformed.restore(attrs | {"last_success": "not-a-date"})
    assert malformed.attributes["agents"] == []


def test_sink_encoding_and_session_routing():
    event = agent("waiting", name="`\r\n<a>&[x]") | {"kind": "needs_input"}
    persistent = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents", mobile=False)
    assert "`" * 65 in persistent["message"]
    assert "\r" not in persistent["message"] and "\n" not in persistent["message"]
    mobile = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents", mobile=True)
    assert "&lt;a&gt;&amp;" in mobile["message"]
    assert mobile["data"]["clickAction"] == "/lovelace/agents"
    assert mobile["data"]["tag"] == persistent["notification_id"]
    second_pane = notification_payload("desktop_demo", "Desktop", event | {"pane_id": 2}, "/lovelace/agents", mobile=False)
    second_host = notification_payload("laptop_demo", "Laptop", event, "/lovelace/agents", mobile=False)
    assert len({persistent["notification_id"], second_pane["notification_id"], second_host["notification_id"]}) == 3
