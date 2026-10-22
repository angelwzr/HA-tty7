"""Real controller behavior, without transport or clock mocks."""
from datetime import UTC, datetime, timedelta

import pytest

from test_omp_controller import native

from custom_components.ha_tty7.controller import HostController, notification_payload
from custom_components.ha_tty7.protocol import build_error, build_snapshot

NOW = datetime(2026, 10, 14, tzinfo=UTC)


def agent(status="working", pane=1, session="synthetic-session", name="codex"):
    return dict(pane_id=pane, session_id=session, agent=name, status=status,
                activity=None, turns=None, model=None, effort=None, permission_mode=None)


def snapshot(controller, agents, seconds=0):
    return controller.accept(build_snapshot(controller.host_id, agents), NOW + timedelta(seconds=seconds))


def test_stock_status_baselines_reconcile_without_notification_proof():
    controller = HostController("desktop_demo")
    assert controller.state == "unconfirmed"
    assert snapshot(controller, [agent("done"), agent("waiting", 2)]) == []
    assert snapshot(controller, [agent(), agent("idle", 2)], 1) == []
    events = snapshot(controller, [agent("done"), agent("waiting", 2)], 2)
    assert events == []
    assert snapshot(controller, [agent("done"), agent("waiting", 2)], 3) == []
    assert snapshot(controller, [agent("done", session="replacement"), agent("unknown", 2)], 4) == []
    assert snapshot(controller, [agent("done", session="replacement"), agent("done", 2)], 5) == []
    assert snapshot(controller, [agent("waiting", 3)], 6) == []
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
    assert snapshot(controller, [agent("done")], 3) == []
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
    persistent = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents",
                                      mobile=False, message_template="{agent}")
    assert "`" * 65 in persistent["message"]
    assert "\r" not in persistent["message"] and "\n" not in persistent["message"]
    mobile = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents",
                                  mobile=True, message_template="{agent}")
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
    assert events == []
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


def test_template_metadata_has_honest_missing_and_explicit_empty_effort():
    for effort, expected in [(None, ""), ("", "None"), ("high", "high")]:
        event = agent("done", session=None) | {"kind": "completed", "effort": effort}
        payload = notification_payload(
            "desktop_demo", "Desktop", event, "/lovelace/agents", mobile=True,
            title_template="{session_id}|{model}|{effort}|{permission_mode}|{tab_name}|{workspace_name}",
            message_template="{host_id}/{status}/{event_type}/{event}/{pane_id}")
        assert payload["title"] == f"||{expected}|||"
        assert payload["message"] == "desktop_demo/done/completed/completed/1"


def test_template_inventory_names_require_fresh_consistent_mutual_unambiguous_join():
    # All fixtures are synthetic, protocol-validated metadata. No extra reads.
    variants = [
        ("approved", inventory(), True),
        ("names-without-derived-labels", inventory() | {
            "derived_labels_included": False,
            "tabs": [inventory()["tabs"][0] | {"label": None}],
        }, True),
        ("derived-label-not-a-name", inventory() | {
            "workspaces": [inventory()["workspaces"][0] | {"name": None}],
            "tabs": [inventory()["tabs"][0] | {"name": None}],
        }, False),
        ("inconsistent", inventory() | {"consistent": False}, False),
        ("no-names", inventory() | {
            "names_included": False, "derived_labels_included": False,
            "workspaces": [inventory()["workspaces"][0] | {"name": None}],
            "tabs": [inventory()["tabs"][0] | {"name": None, "label": None, "group_name": None}],
        }, False),
        ("wrong-pane-tab", inventory() | {
            "panes": [inventory()["panes"][0] | {"tab_id": "other-tab"}],
        }, False),
        ("missing-tab-pane", inventory() | {"tabs": [inventory()["tabs"][0] | {"pane_ids": []}]}, False),
        ("ambiguous-tab", inventory() | {"tabs": [
            inventory()["tabs"][0],
            inventory()["tabs"][0] | {"tab_id": "second-tab", "name": "Other private tab"},
        ]}, False),
        ("orphan", inventory() | {"panes": [inventory()["panes"][0] | {"orphan": True}]}, False),
        ("workspace-disagrees", inventory() | {
            "panes": [inventory()["panes"][0] | {"workspace_id": "other-workspace"}],
        }, False),
        ("missing-workspace", inventory() | {"workspaces": []}, False),
        ("missing-pane", inventory() | {"panes": []}, False),
    ]
    for name, section, allowed in variants:
        controller = HostController("desktop_demo")
        controller.accept(build_snapshot("desktop_demo", [native()], inventory=section), NOW)
        events = controller.accept(build_snapshot("desktop_demo", [native("done")], inventory=section),
                                   NOW + timedelta(seconds=1))
        assert len(events) == 1, name
        payload = notification_payload("desktop_demo", "Desktop", events[0], "/lovelace/agents",
                                       mobile=True, title_template="{workspace_name}|{tab_name}")
        assert payload["title"] == ("Private workspace|Private tab" if allowed else "|"), name
    controller = HostController("desktop_demo")
    section = inventory()
    for second, status in [(0, "working"), (30, "working"), (46, "done")]:
        events = controller.accept(build_snapshot("desktop_demo", [native(status)], inventory=section),
                                   NOW + timedelta(seconds=second))
    assert controller.inventory_state == "stale" and len(events) == 1
    payload = notification_payload("desktop_demo", "Desktop", events[0], "/lovelace/agents",
                                   mobile=True, title_template="{workspace_name}|{tab_name}")
    assert payload["title"] == "|"


def test_template_names_withheld_after_inventory_read_error_and_restore():
    for restored in (False, True):
        controller = HostController("desktop_demo")
        controller.accept(build_snapshot("desktop_demo", [native()], inventory=inventory()), NOW)
        if restored:
            replacement = HostController("desktop_demo")
            replacement.restore(controller.restore_attributes(retain_inventory=True), retain_inventory=True)
            controller = replacement
            section = inventory()  # cached pre-restart sample cannot restore confirmation
            assert controller.accept(build_snapshot("desktop_demo", [native()], inventory=section),
                                     NOW + timedelta(seconds=1)) == []
        else:
            section = {"kind": "error", "error_code": "cli_failed"}
        events = controller.accept(build_snapshot("desktop_demo", [native("done")], inventory=section),
                                   NOW + timedelta(seconds=2))
        payload = notification_payload("desktop_demo", "Desktop", events[0], "/lovelace/agents",
                                       mobile=True, title_template="{workspace_name}|{tab_name}")
        assert payload["title"] == "|"


def test_template_sink_escaping_covers_long_backtick_runs_quotes_and_line_breaks():
    # Longer than the legacy 65-backtick delimiter; still valid model metadata.
    value = "`" * 70 + '<a href="x">[link](https://evil.example)</a>\nnext'
    event = agent("done") | {"kind": "completed", "model": value}
    persistent = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents",
                                       mobile=False, message_template="{model}")
    assert persistent["message"].startswith("`" * 71 + " " + "`" * 70)
    assert "\n" not in persistent["message"]
    assert '</a> next ' + "`" * 71 in persistent["message"]
    mobile = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents",
                                   mobile=True, message_template="{model}")
    assert '&lt;a href=&quot;x&quot;&gt;' in mobile["message"]
    assert "<a" not in mobile["message"] and "\n" not in mobile["message"]


def test_default_notification_uses_only_the_approved_name_and_terminal_message():
    event = agent("done", name="PRIVATE_AGENT") | {
        "kind": "failed", "tab_name": "Project Apollo", "session_name": "Project Apollo",
    }
    payload = notification_payload("private_host", "PRIVATE_HOST", event, "/lovelace/agents", mobile=True)
    assert payload["title"] == "Project Apollo"
    assert payload["message"] == "Failed."
    assert payload["data"]["clickAction"] == "/lovelace/agents"
    assert "PRIVATE" not in payload["title"] + payload["message"]


@pytest.mark.parametrize("kind,message", [
    ("completed", "Finished."), ("needs_input", "Needs your input."), ("failed", "Failed."),
])
def test_default_payload_has_safe_fallback_and_exact_approved_message(kind, message):
    event = agent("done") | {"kind": kind, "tab_name": "not-joined"}
    for mobile in (False, True):
        payload = notification_payload("private_host", "PRIVATE_HOST", event, "/lovelace/agents", mobile=mobile)
        assert payload["title"] == "Unnamed session"
        assert payload["message"] == (message if mobile else f"{message} [Open agent dashboard](/lovelace/agents)")
        assert "PRIVATE" not in payload["title"] + payload["message"]


@pytest.mark.parametrize("explicit,derived,consent,expected", [
    ("Private tab", "Approved label", True, "Private tab"),
    (None, "Approved label", True, "Approved label"),
    (None, None, True, "Unnamed session"),
    (None, "Unapproved label", False, "Unnamed session"),
    ("", "Approved label", True, "Approved label"),
])
def test_default_session_name_uses_only_joined_approved_name_or_derived_label(explicit, derived, consent, expected):
    controller = HostController("desktop_demo")
    section = inventory()
    section["tabs"][0].update(name=explicit, label=derived)
    section["derived_labels_included"] = consent
    # Defensively test consent at the use boundary, not only wire filtering.
    controller.accept({"kind": "snapshot", "agents": [native()], "inventory": section}, NOW)
    events = controller.accept({"kind": "snapshot", "agents": [native("done")], "inventory": section},
                               NOW + timedelta(seconds=1))
    payload = notification_payload("desktop_demo", "Desktop", events[0], "/lovelace/agents", mobile=True)
    assert payload["title"] == expected
    assert events[0]["tab_name"] == explicit  # custom placeholder never becomes a derived label
    assert events[0]["workspace_name"] == "Private workspace"


@pytest.mark.parametrize("mutation", ["stale", "unconfirmed", "inconsistent", "names-disabled",
                                      "duplicate-pane", "duplicate-workspace", "ambiguous-tab", "orphan"])
def test_default_session_name_hides_inventory_names_when_join_is_untrusted(mutation):
    controller = HostController("desktop_demo")
    section = inventory()
    if mutation == "inconsistent":
        section["consistent"] = False
    elif mutation == "names-disabled":
        section["names_included"] = False
    elif mutation == "duplicate-pane":
        section["panes"].append(dict(section["panes"][0]))
    elif mutation == "duplicate-workspace":
        section["workspaces"].append(dict(section["workspaces"][0]))
    elif mutation == "ambiguous-tab":
        section["tabs"].append(section["tabs"][0] | {"tab_id": "other"})
    elif mutation == "orphan":
        section["panes"][0]["orphan"] = True
    controller.accept({"kind": "snapshot", "agents": [native()], "inventory": section}, NOW)
    if mutation in ("stale", "unconfirmed"):
        controller.inventory_state = mutation
    events = controller.accept({"kind": "snapshot", "agents": [native("done")], "inventory": section},
                               NOW + timedelta(seconds=1))
    payload = notification_payload("desktop_demo", "Desktop", events[0], "/lovelace/agents", mobile=True)
    assert payload["title"] == "Unnamed session"


def test_custom_failed_event_and_new_fields_keep_sink_escaping_and_literal_braces():
    event = native("done", outcome="failed") | {"kind": "failed", "session_name": "<b>Session</b>\nnext"}
    payload = notification_payload(
        "desktop_demo", "Desktop", event, "/dashboard/agents", mobile=True,
        title_template="{{name}} {session_name}", message_template="{event}|{event_type}|{event_message}|{session_name}")
    assert payload["title"] == "{name} <b>Session</b> next"
    assert payload["message"] == "failed|failed|Failed.|&lt;b&gt;Session&lt;/b&gt; next"


def test_blank_approved_names_use_the_safe_session_fallback():
    controller = HostController("desktop_demo")
    section = inventory()
    section["tabs"][0].update(name=" \n ", label=" \t ")
    controller.accept({"kind": "snapshot", "agents": [native()], "inventory": section}, NOW)
    event, = controller.accept({"kind": "snapshot", "agents": [native("done")], "inventory": section},
                               NOW + timedelta(seconds=1))
    payload = notification_payload("desktop_demo", "Desktop", event, "/lovelace/agents", mobile=True)
    assert payload["title"] == "Unnamed session"
