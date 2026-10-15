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


def test_inferred_completion_does_not_notify_and_retains_provenance():
    controller = HostController("desktop_demo")
    snapshot(controller, [agent()], 0)
    guessed = agent("done") | {"inferred": True}
    assert snapshot(controller, [guessed], 1) == []
    assert controller.attributes["agents"] == [guessed]
    assert snapshot(controller, [agent()], 2) == []
    assert [event["kind"] for event in snapshot(controller, [agent("done")], 3)] == ["completed"]
    assert snapshot(controller, [agent() | {"inferred": True}], 4) == []
    assert snapshot(controller, [agent("done")], 5) == []


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


def inventory(sample_id="sample-one"):
    return {
        "kind": "snapshot", "sample_id": sample_id,
        "workspaces": [{"workspace_id": "private-workspace-id", "name": "Private workspace",
                        "tab_count": 1, "pane_count": 1}],
        "tabs": [{"workspace_id": "private-workspace-id", "tab_id": "private-tab-id",
                  "ordinal": 1, "name": "Private tab", "label": "Private derived label",
                  "detected_agent": "codex", "pane_ids": [1], "group_id": "private-group-id",
                  "group_name": "Private group", "hibernated": False}],
        "panes": [{"pane_id": 1, "workspace_id": "private-workspace-id",
                   "tab_id": "private-tab-id", "live": True, "hibernated": False, "orphan": False}],
        "consistent": True, "names_included": True, "derived_labels_included": True,
    }


def test_provenance_counts_are_disjoint_and_weak_completion_is_not_confirmed():
    controller = HostController("desktop_demo")
    rows = [agent(pane=1) | {"rich": True}, agent(pane=2) | {"rich": False},
            agent(pane=3) | {"rich": True, "inferred": True}, agent(pane=4)]
    controller.accept({"kind": "snapshot", "agents": rows}, NOW)
    attrs = controller.attributes
    assert attrs.get("confirmed_counts") == dict(idle=0, working=1, waiting=0, done=0, unknown=0)
    assert (attrs["inferred_count"], attrs["weak_count"], attrs["unknown_origin_count"]) == (1, 1, 1)
    done = [row | {"status": "done"} for row in rows]
    events = controller.accept({"kind": "snapshot", "agents": done}, NOW + timedelta(seconds=1))
    assert [event["pane_id"] for event in events] == [1, 4]
    controller.accept({"kind": "snapshot", "agents": [agent() | {"rich": False}]}, NOW + timedelta(seconds=2))
    assert controller.accept({"kind": "snapshot", "agents": [agent("done") | {"rich": True}]},
                             NOW + timedelta(seconds=3)) == []


def test_inventory_cache_cannot_refresh_observation_and_errors_keep_last_known():
    controller = HostController("desktop_demo")
    report = {"kind": "snapshot", "agents": [], "inventory": inventory()}
    controller.accept(report, NOW)
    assert controller.attributes.get("inventory_state") == "healthy"
    controller.accept(report, NOW + timedelta(seconds=30))
    assert controller.attributes["inventory_last_success"] == NOW.isoformat()
    assert controller.attributes["inventory_last_contact"] == NOW.isoformat()
    controller.accept(report, NOW + timedelta(seconds=46))
    assert controller.online
    assert controller.attributes["inventory_state"] == "stale"
    controller.accept(report | {"inventory": {"kind": "error", "error_code": "cli_failed"}},
                      NOW + timedelta(seconds=47))
    assert controller.attributes["inventory_state"] == "error"
    assert controller.attributes["inventory"] == inventory()
    assert controller.attributes["inventory_last_success"] == NOW.isoformat()
    controller.accept(report, NOW + timedelta(seconds=48))
    assert controller.attributes["inventory_state"] == "error"
    controller.accept(report | {"inventory": inventory("sample-two")}, NOW + timedelta(seconds=49))
    assert controller.attributes["inventory_state"] == "healthy"
    controller.accept({"kind": "snapshot", "agents": []}, NOW + timedelta(seconds=50))
    assert controller.attributes["inventory"] is None
    assert controller.attributes["inventory_state"] == "disabled"
    assert controller.attributes["inventory_last_success"] is None


def test_restore_inventory_requires_consent_and_never_restores_health():
    original = HostController("desktop_demo")
    original.accept({"kind": "snapshot", "agents": [agent()], "inventory": inventory()}, NOW)
    restored = HostController("desktop_demo")
    restored.restore(original.attributes)
    assert restored.attributes.get("inventory_state") == "disabled"
    assert restored.attributes["inventory"] is None
    retained = HostController("desktop_demo")
    retained.restore(original.attributes, retain_inventory=True)
    assert retained.attributes["inventory"] == inventory()
    assert retained.attributes["inventory_state"] == "unconfirmed"
    assert retained.state == "unconfirmed"
    retained.accept({"kind": "snapshot", "agents": [], "inventory": inventory()}, NOW + timedelta(seconds=1))
    assert retained.attributes["inventory_state"] == "unconfirmed"
    retained.accept({"kind": "snapshot", "agents": [], "inventory": inventory("sample-new")},
                    NOW + timedelta(seconds=2))
    assert retained.attributes["inventory_state"] == "healthy"
    malformed = HostController("desktop_demo")
    malformed.restore(original.attributes | {"inventory": inventory() | {"raw_output": "excluded"}},
                      retain_inventory=True)
    assert malformed.attributes["inventory"] is None


def test_inventory_name_consent_revocation_prunes_last_known_even_on_read_error():
    controller = HostController("desktop_demo")
    controller.accept({"kind": "snapshot", "agents": [], "inventory": inventory()}, NOW)
    controller.accept({"kind": "snapshot", "agents": [], "inventory": {
        "kind": "error", "error_code": "cli_failed", "names_included": False,
        "derived_labels_included": False}}, NOW + timedelta(seconds=1))
    attrs = controller.attributes
    assert attrs["inventory"]["workspaces"][0]["name"] is None
    assert attrs["inventory"]["tabs"][0]["name"] is None
    assert attrs["inventory"]["tabs"][0]["group_name"] is None
    assert attrs["inventory"]["tabs"][0]["label"] is None
    assert attrs["inventory"]["names_included"] is False
    assert attrs["inventory"]["derived_labels_included"] is False
    assert attrs["inventory_last_success"] == NOW.isoformat()
    assert attrs["inventory_state"] == "error"
    assert controller.restore_attributes(retain_inventory=False)["inventory"] is None


def test_roster_read_errors_apply_privacy_without_refreshing_inventory():
    controller = HostController("desktop_demo")
    controller.accept({"kind": "snapshot", "agents": [], "inventory": inventory()}, NOW)
    controller.accept(build_error("desktop_demo", "cli_failed"), NOW)
    assert controller.attributes["inventory"]["tabs"][0]["name"] == "Private tab"
    labels_only = {"enabled": True, "names_included": True, "derived_labels_included": False}
    controller.accept(build_error("desktop_demo", "cli_failed") | {"inventory_privacy": labels_only}, NOW)
    assert controller.attributes["inventory"]["tabs"][0]["label"] is None
    assert controller.attributes["inventory"]["tabs"][0]["name"] == "Private tab"
    privacy = {"enabled": True, "names_included": False, "derived_labels_included": False}
    controller.accept(build_error("desktop_demo", "cli_failed") | {"inventory_privacy": privacy},
                      NOW + timedelta(seconds=1))
    attributes = controller.attributes
    assert attributes["inventory"]["workspaces"][0]["name"] is None
    assert attributes["inventory"]["tabs"][0]["name"] is None
    assert attributes["inventory"]["tabs"][0]["group_name"] is None
    assert attributes["inventory"]["tabs"][0]["label"] is None
    assert attributes["inventory_last_success"] == NOW.isoformat()
    assert attributes["inventory_last_contact"] == NOW.isoformat()
    assert controller.state == "error"
    assert "Private" not in str(controller.restore_attributes(retain_inventory=True)["inventory"])
    privacy = {"enabled": False, "names_included": False, "derived_labels_included": False}
    controller.accept(build_error("desktop_demo", "cli_failed") | {"inventory_privacy": privacy},
                      NOW + timedelta(seconds=2))
    assert controller.attributes["inventory"] is None
    assert controller.attributes["inventory_state"] == "disabled"
    assert controller.attributes["inventory_last_success"] is None
