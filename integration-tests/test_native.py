"""Exercise the real HA loader/UI flows, webhook, restore and entity registries.

Run with the pytest-homeassistant-custom-component release matching Core
2026.10.0 and this repository on PYTHONPATH, after the parent builds the bundle.
No household instance, credentials, service or network dependency is used.
"""
from datetime import timedelta
import asyncio
import logging
import json

from itertools import count
import pytest

from homeassistant.components import frontend
from homeassistant.components.persistent_notification import SIGNAL_PERSISTENT_NOTIFICATIONS_UPDATED
from homeassistant.core import callback
from homeassistant.config_entries import SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util

from custom_components.ha_tty7.const import DOMAIN, MODULE_URL
from custom_components.ha_tty7.protocol import build_error, build_snapshot, encode_report

pytestmark = pytest.mark.asyncio


_REQUEST_IDS = count(1)


def record(status="working", pane=1, session="synthetic-session", name="codex"):
    return dict(pane_id=pane, session_id=session, agent=name, status=status,
                activity=None, turns=None, model=None, effort=None, permission_mode=None)


def native_record(status="working", *, run="synthetic-run", outcome="completed", input_id="synthetic-request",
                  pane=1, session="synthetic-session", **metadata):
    return record(status, pane, session, "OhMyPi") | dict(
        rich=True, omp=dict(state="ready", run_id=run, background_jobs=0,
                            outcome=outcome if status == "done" else None,
                            input_id=input_id if status == "waiting" else None), **metadata)


def inputs(host="desktop_demo", **changes):
    return dict(host_id=host, label="Desktop" if host == "desktop_demo" else "Laptop",
                base_url="https://ha.example", notify_destination="persistent_notification.create",
                notify_waiting=True, notify_completion=True, dashboard_path="/lovelace/agents") | changes


async def add_host(hass, host="desktop_demo", **changes):
    # Finish native dependency/route setup before creating the HTTP TestClient:
    # the pinned plugin does not bootstrap HTTP, and aiohttp freezes its app.
    await async_setup_component(hass, "persistent_notification", {})
    flow = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    pairing = await hass.config_entries.flow.async_configure(flow["flow_id"], inputs(host, **changes))
    assert pairing["step_id"] == "pairing"
    assert pairing["description_placeholders"]["webhook_url"].startswith("https://ha.example/api/webhook/")
    result = await hass.config_entries.flow.async_configure(flow["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    return result["result"]


def entity_ids(hass, entry):
    registry = er.async_get(hass)
    host = entry.data["host_id"]
    return (registry.async_get_entity_id("sensor", DOMAIN, f"{host}_roster"),
            registry.async_get_entity_id("binary_sensor", DOMAIN, f"{host}_connectivity"))


async def post(client, entry, agents=None, *, body=None):
    if body is None:
        body = encode_report(build_snapshot(entry.data["host_id"], agents or []))
    response = await client.post(f"/api/webhook/{entry.data['webhook_id']}", data=body,
                                 headers={"Content-Type": "application/json"})
    await response.read()
    return response

async def notifications(ws):
    await ws.send_json({"id": next(_REQUEST_IDS), "type": "persistent_notification/get"})
    result = await ws.receive_json()
    assert result["success"]
    return result["result"]


async def test_ui_flow_rejects_insecure_and_arbitrary_destinations(hass):
    await async_setup_component(hass, "persistent_notification", {})
    flow = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    rejected = await hass.config_entries.flow.async_configure(flow["flow_id"], inputs(base_url="http://ha.example"))
    assert rejected["errors"] == {"base_url": "invalid_base_url"}
    rejected = await hass.config_entries.flow.async_configure(flow["flow_id"], inputs(dashboard_path="//attacker.example"))
    assert rejected["errors"] == {"dashboard_path": "invalid_dashboard"}
    # The selector schema itself rejects a service that was not offered.
    from custom_components.ha_tty7.config_flow import _errors, valid_base_url
    assert _errors(hass, inputs(notify_destination="script.run"), user=True)["notify_destination"] == "invalid_destination"
    assert not valid_base_url("https://user:password@ha.example")
    assert not valid_base_url("https://ha.example?credential=excluded")
    pairing = await hass.config_entries.flow.async_configure(flow["flow_id"], inputs())
    secret = pairing["description_placeholders"]["webhook_url"].rsplit("/", 1)[-1]
    assert len(secret) == 64 and int(secret, 16) >= 0
    result = await hass.config_entries.flow.async_configure(flow["flow_id"], {})
    entry = result["result"]
    await hass.async_block_till_done()
    assert entry.unique_id == "desktop_demo"
    second = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    duplicate = await hass.config_entries.flow.async_configure(second["flow_id"], inputs())
    assert duplicate["reason"] == "already_configured"
    assert secret not in json.dumps([state.as_dict() for state in hass.states.async_all()])


async def test_two_hosts_native_registry_malformed_isolation_and_health(hass, hass_client):
    desktop = await add_host(hass)
    laptop = await add_host(hass, "laptop_demo")
    client = await hass_client()
    roster_id, connectivity_id = entity_ids(hass, desktop)
    laptop_roster, _ = entity_ids(hass, laptop)
    assert hass.states.get(roster_id).state == "unconfirmed"
    assert hass.states.get(connectivity_id).state == "off"
    registry = er.async_get(hass)
    roster_entry = registry.async_get(roster_id)
    connection_entry = registry.async_get(connectivity_id)
    assert roster_entry.platform == DOMAIN
    assert roster_entry.device_id == connection_entry.device_id
    assert roster_entry.config_entry_id == connection_entry.config_entry_id == desktop.entry_id
    device = dr.async_get(hass).async_get(roster_entry.device_id)
    assert (DOMAIN, "desktop_demo") in device.identifiers
    assert MODULE_URL in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls
    assert len(hass.data[DOMAIN]["entries"]) == 2
    assert (await post(client, desktop, [record()])).status == 204
    assert hass.states.get(roster_id).state == "1"
    assert hass.states.get(connectivity_id).state == "on"
    before = hass.states.get(roster_id)
    forbidden = build_snapshot("desktop_demo", [record()])
    forbidden["agents"][0]["launch_argv"] = "excluded"
    invalid = [b"not-json", b'\xff', b'{"schema_version":1,"schema_version":1}',
               json.dumps(forbidden).encode(), b" " * (256 * 1024 + 1),
               encode_report(build_snapshot("laptop_demo", [record("done")]))]
    for body in invalid:
        assert (await post(client, desktop, body=body)).status in (400, 413)
        assert hass.states.get(roster_id) == before
    assert hass.states.get(laptop_roster).state == "unconfirmed"
    error_body = encode_report(build_error("desktop_demo", "cli_failed"))
    assert (await post(client, desktop, body=error_body)).status == 204
    failed = hass.states.get(roster_id)
    assert failed.state == "error" and failed.attributes["agents"] == before.attributes["agents"]
    assert hass.states.get(connectivity_id).state == "off"
    runtime = desktop.runtime_data
    runtime.tick(dt_util.utcnow() + timedelta(seconds=46))
    assert hass.states.get(roster_id).state == "stale"
    assert hass.states.get(roster_id).attributes["error_code"] == "cli_failed"
    assert (await post(client, desktop, [])).status == 204
    assert hass.states.get(roster_id).state == "0"
    assert hass.states.get(connectivity_id).state == "on"
    all_states = json.dumps([state.as_dict() for state in hass.states.async_all()])
    assert desktop.data["webhook_id"] not in all_states and laptop.data["webhook_id"] not in all_states
    assert "ha.example" not in all_states
    assert (await client.get("/ha_tty7/ha-tty7-card.js?v=0.2.0")).status == 200


async def test_notifications_are_after_publish_and_restore_options_revoke(hass, hass_client, hass_ws_client):
    entry = await add_host(hass, notification_message_template="{model}")
    client = await hass_client()
    ws = await hass_ws_client()
    roster_id, _ = entity_ids(hass, entry)
    observed_statuses = []

    @callback
    def observe_notification(update_type, updates):
        observed_statuses.append(hass.states.get(roster_id).attributes["agents"][0]["status"])

    unsubscribe = async_dispatcher_connect(hass, SIGNAL_PERSISTENT_NOTIFICATIONS_UPDATED, observe_notification)
    await post(client, entry, [native_record("done", run="baseline-run")])
    assert await notifications(ws) == []
    await post(client, entry, [native_record()])
    await post(client, entry, [native_record("done", model="`\r\n<a>&[x]")])
    alerts = await notifications(ws)
    assert len(alerts) == 1
    assert "`" * 65 in alerts[0]["message"]
    assert "\r" not in alerts[0]["message"] and "\n" not in alerts[0]["message"]
    assert hass.states.get(roster_id).attributes["agents"][0]["status"] == "done"
    await hass.async_block_till_done()
    assert observed_statuses == ["done"]
    unsubscribe()
    await hass.services.async_call("persistent_notification", "dismiss_all", {}, blocking=True)
    before = hass.states.get(roster_id)
    old_runtime = entry.runtime_data
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    restored = hass.states.get(roster_id)
    assert restored.state == "unconfirmed"
    assert restored.attributes["baseline_ready"] is False
    assert restored.attributes["agents"] == before.attributes["agents"]
    assert restored.attributes["last_success"] == before.attributes["last_success"]
    assert old_runtime.closed and old_runtime.cancel_timer is None
    await post(client, entry, [native_record("waiting", run="after-reload")])
    assert await notifications(ws) == []
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    changed = inputs(label="Renamed", notify_waiting=False, notify_completion=False, dashboard_path="/dashboard-agents/main")
    changed.pop("host_id")
    pairing = await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    assert pairing["step_id"] == "pairing"
    original_secret = entry.data["webhook_id"]
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    assert entry.data["webhook_id"] == original_secret
    assert entry.data["label"] == "Renamed" and entry.options["notify_waiting"] is False
    await post(client, entry, [native_record(run="disabled-run")])
    await post(client, entry, [native_record("done", run="disabled-run")])
    assert await notifications(ws) == []
    runtime = entry.runtime_data
    result = await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert result["require_restart"] is False
    assert runtime.closed and runtime.cancel_timer is None
    assert hass.states.get(roster_id) is None
    await post(client, entry, [record("waiting")])  # Unknown webhooks may deliberately return 200.
    assert hass.states.get(roster_id) is None
    assert MODULE_URL not in hass.data[frontend.DATA_EXTRA_MODULE_URL].urls
    assert await notifications(ws) == []


async def test_bounded_stream_timeout_does_not_refresh(hass, hass_client):
    entry = await add_host(hass)
    client = await hass_client()
    roster_id, _ = entity_ids(hass, entry)
    await post(client, entry, [record()])
    before = hass.states.get(roster_id)
    never = asyncio.Event()

    async def stalled_body():
        yield b"{"
        await never.wait()

    response = await client.post(f"/api/webhook/{entry.data['webhook_id']}", data=stalled_body())
    assert response.status == 408
    await response.read()
    assert hass.states.get(roster_id) == before


async def test_real_builtin_logs_redact_live_and_revoked_credentials_only(hass, hass_client, caplog):
    entry = await add_host(hass)
    client = await hass_client()
    secret = entry.data["webhook_id"]
    from custom_components.ha_tty7.log_redaction import HTTP_LOGGERS
    for logger_name in HTTP_LOGGERS:
        caplog.set_level(logging.DEBUG, logger=logger_name)
    caplog.clear()
    response = await client.get(f"/api/webhook/{secret}")
    assert response.status == 405
    assert "[ha_tty7_credential_redacted]" in caplog.text
    assert secret not in caplog.text
    assert any(record.levelno == logging.WARNING for record in caplog.records)
    for logger_name in HTTP_LOGGERS:
        assert any(record.name == logger_name and "[ha_tty7_credential_redacted]" in record.getMessage()
                   for record in caplog.records)
    await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    caplog.clear()
    private_body = b"synthetic-private-body-that-must-not-be-logged"
    response = await client.post(f"/api/webhook/{secret}", data=private_body)
    assert response.status == 200  # HA intentionally conceals unknown IDs.
    assert secret not in caplog.text and private_body.decode() not in caplog.text
    assert "ha_tty7_payload_redacted" in caplog.text
    assert any(record.levelno == logging.INFO for record in caplog.records)
    caplog.clear()
    unrelated = b"unrelated-debug-observation"
    response = await client.post("/api/webhook/unrelated_test_hook", data=unrelated)
    assert response.status == 200
    assert "unrelated_test_hook" in caplog.text and unrelated.decode() in caplog.text


async def test_notification_toggles_are_independent(hass, hass_client, hass_ws_client):
    entry = await add_host(hass)
    client = await hass_client()
    ws = await hass_ws_client()
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    changed = inputs(notify_waiting=False, notify_completion=True)
    changed.pop("host_id")
    await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    await post(client, entry, [native_record()])
    await post(client, entry, [native_record("waiting")])
    assert await notifications(ws) == []
    await post(client, entry, [native_record()])
    await post(client, entry, [native_record("done")])
    assert len(await notifications(ws)) == 1
    await hass.services.async_call("persistent_notification", "dismiss_all", {}, blocking=True)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    changed = inputs(notify_waiting=True, notify_completion=False)
    changed.pop("host_id")
    await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    await post(client, entry, [native_record(run="completion-disabled")])
    await post(client, entry, [native_record("done", run="completion-disabled")])
    assert await notifications(ws) == []
    await post(client, entry, [native_record(run="input-enabled")])
    await post(client, entry, [native_record("waiting", run="input-enabled")])
    assert len(await notifications(ws)) == 1


def extended_body(entry, *, sample="sample-one", inventory_enabled=True, inventory_error=False,
                  source_available=True):
    from test_controller import inventory
    report = build_snapshot(entry.data["host_id"], [record()])
    if inventory_enabled:
        report["inventory"] = ({"kind": "error", "error_code": "cli_failed"} if inventory_error
                               else inventory(sample))
    report["source"] = {"state": "available" if source_available else "unavailable",
                        "collector_version": "0.4.0", "tty7_build": "stock-build" if source_available else None,
                        "control_version": 3 if source_available else None,
                        "protocol_version": 1 if source_available else None,
                        "uptime_secs": 123 if source_available else None}
    return json.dumps(report).encode()


def role_entity(hass, entry, role):
    registry = er.async_get(hass)
    matches = [entity for entity in er.async_entries_for_config_entry(registry, entry.entry_id)
               if entity.translation_key == role]
    assert len(matches) == 1, f"Expected one integration-owned {role} role"
    return matches[0]


async def test_native_summary_roles_and_independent_inventory_source_health(hass, hass_client):
    entry = await add_host(hass)
    client = await hass_client()
    roster = role_entity(hass, entry, "roster")
    connectivity = role_entity(hass, entry, "connectivity")
    reported = role_entity(hass, entry, "reported_agents")
    workspaces = role_entity(hass, entry, "workspaces")
    health = role_entity(hass, entry, "health")
    build = role_entity(hass, entry, "tty7_build")
    for role in ("working_agents", "waiting_agents", "done_agents", "idle_agents", "unknown_agents",
                 "inferred_agents", "weak_reports", "unknown_origin_agents", "last_contact",
                 "last_success", "tabs", "panes", "live_panes", "hibernated_tabs", "orphan_panes",
                 "collector_version", "control_version", "protocol_version", "uptime"):
        assert role_entity(hass, entry, role).device_id == roster.device_id
    assert len({entity.device_id for entity in (roster, connectivity, reported, workspaces, build)}) == 1
    assert hass.states.get(reported.entity_id).state == "unavailable"
    assert hass.states.get(workspaces.entity_id).state == "unavailable"
    assert hass.states.get(health.entity_id).state == "unconfirmed"
    assert (await post(client, entry, body=extended_body(entry))).status == 204
    assert hass.states.get(reported.entity_id).state == "1"
    assert hass.states.get(workspaces.entity_id).state == "1"
    assert hass.states.get(role_entity(hass, entry, "unknown_origin_agents").entity_id).state == "1"
    assert hass.states.get(role_entity(hass, entry, "weak_reports").entity_id).state == "0"
    assert hass.states.get(role_entity(hass, entry, "inferred_agents").entity_id).state == "0"
    assert hass.states.get(build.entity_id).state == "stock-build"
    assert "agents" not in hass.states.get(reported.entity_id).attributes
    assert "inventory" not in hass.states.get(workspaces.entity_id).attributes
    first_success = hass.states.get(roster.entity_id).attributes["inventory_last_success"]
    future = dt_util.utcnow() + timedelta(seconds=46)
    entry.runtime_data.controller.accept(
        json.loads(extended_body(entry)), future)
    entry.runtime_data.publish()
    assert hass.states.get(reported.entity_id).state == "1"
    assert hass.states.get(workspaces.entity_id).state == "unavailable"
    assert hass.states.get(roster.entity_id).attributes["inventory_state"] == "stale"
    assert hass.states.get(roster.entity_id).attributes["inventory_last_success"] == first_success
    assert (await post(client, entry, body=extended_body(entry, inventory_error=True,
                                                       source_available=False))).status == 204
    assert hass.states.get(roster.entity_id).attributes["inventory"]["tabs"][0]["name"] == "Private tab"
    assert hass.states.get(workspaces.entity_id).state == "unavailable"
    assert hass.states.get(reported.entity_id).state == "1"
    assert hass.states.get(build.entity_id).state == "unavailable"
    revoked = json.loads(extended_body(entry, inventory_error=True))
    revoked["inventory"].update(names_included=False, derived_labels_included=False)
    assert (await post(client, entry, body=json.dumps(revoked).encode())).status == 204
    private_inventory = hass.states.get(roster.entity_id).attributes["inventory"]
    assert private_inventory["tabs"][0]["name"] is None
    assert private_inventory["tabs"][0]["label"] is None
    assert private_inventory["workspaces"][0]["name"] is None
    assert hass.states.get(roster.entity_id).attributes["inventory_last_success"] == first_success
    assert (await post(client, entry, body=extended_body(entry, sample="sample-two"))).status == 204
    assert hass.states.get(workspaces.entity_id).state == "1"
    assert (await post(client, entry, body=extended_body(entry, inventory_enabled=False))).status == 204
    assert hass.states.get(roster.entity_id).attributes["inventory"] is None
    assert hass.states.get(workspaces.entity_id).state == "unavailable"
    assert (await post(client, entry, body=encode_report(build_error("desktop_demo", "cli_failed")))).status == 204
    assert hass.states.get(reported.entity_id).state == "unavailable"
    assert hass.states.get(health.entity_id).state == "error"


async def test_native_inventory_restore_retention_consent_and_diagnostics_privacy(hass, hass_client):
    entry = await add_host(hass)
    assert entry.options.get("retain_inventory") is False
    await async_setup_component(hass, "diagnostics", {})
    client = await hass_client()
    assert (await post(client, entry, body=extended_body(entry))).status == 204
    roster_id, _ = entity_ids(hass, entry)
    response = await client.get(f"/api/diagnostics/config_entry/{entry.entry_id}")
    assert response.status == 200
    download = await response.json()
    diagnostics = download["data"]
    serialized = json.dumps(download)
    for private in ("Private workspace", "Private tab", "Private group", "Private derived label",
                    "private-workspace-id", "private-tab-id", "private-group-id", "synthetic-session",
                    entry.data["webhook_id"], "ha.example", "/lovelace/agents"):
        assert private not in serialized
    assert diagnostics["inventory"]["workspace_count"] == 1
    assert diagnostics["source"]["tty7_build"] == "stock-build"
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get(roster_id).attributes["inventory"] is None
    assert (await post(client, entry, body=extended_body(entry, sample="sample-retain"))).status == 204
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    changed = inputs(retain_inventory=True)
    changed.pop("host_id")
    pairing = await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    assert pairing["step_id"] == "pairing"
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    # Consent permits future storage, not resurrection of a previously discarded snapshot.
    assert (await post(client, entry, body=extended_body(entry, sample="sample-retained-new"))).status == 204
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    from homeassistant.helpers.storage import Store
    assert (await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_load())["inventory"]["tabs"][0]["name"] == "Private tab"
    restored = hass.states.get(roster_id)
    assert restored.attributes["inventory"]["tabs"][0]["name"] == "Private tab"
    assert restored.attributes["inventory_state"] == "unconfirmed"
    assert hass.states.get(role_entity(hass, entry, "tabs").entity_id).state == "unavailable"
    assert (await post(client, entry, body=extended_body(entry, sample="sample-retained-new"))).status == 204
    assert hass.states.get(roster_id).attributes["inventory_state"] == "unconfirmed"
    assert (await post(client, entry, body=extended_body(entry, sample="sample-after-restart"))).status == 204
    assert hass.states.get(role_entity(hass, entry, "tabs").entity_id).state == "1"
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert (await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_load())["inventory"]["tabs"][0]["name"] == "Private tab"
    changed["retain_inventory"] = False
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    confirmation = await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    assert confirmation["type"] is FlowResultType.FORM
    assert confirmation["step_id"] == "pairing"
    committed = await hass.config_entries.options.async_configure(flow["flow_id"], {})
    assert committed["type"] is FlowResultType.CREATE_ENTRY
    assert entry.options["retain_inventory"] is False
    await hass.async_block_till_done()
    assert (await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_load())["inventory"] is None
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get(roster_id).attributes["inventory"] is None


async def test_native_default_restore_storage_never_persists_inventory(hass, hass_client):
    from homeassistant.helpers.restore_state import async_get
    from homeassistant.helpers.storage import Store
    entry = await add_host(hass)
    client = await hass_client()
    assert (await post(client, entry, body=extended_body(entry))).status == 204
    assert entry.options["retain_inventory"] is False
    roster_id, _ = entity_ids(hass, entry)
    assert hass.states.get(roster_id).attributes["inventory"]["tabs"][0]["name"] == "Private tab"
    stored = async_get(hass).async_get_stored_states()
    for item in stored:
        if item.state.entity_id == roster_id:
            assert item.state.attributes.get("inventory") is None
            assert item.extra_data.as_dict().get("inventory") is None
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    data = await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_load()
    assert data is not None
    assert data["inventory"] is None
    assert "Private tab" not in json.dumps(data)


async def test_native_status_summaries_count_only_confirmed_hooks(hass, hass_client):
    entry = await add_host(hass)
    client = await hass_client()
    rows = [
        record(pane=1) | {"rich": True},
        record(pane=2) | {"rich": False},
        record(pane=3) | {"rich": True, "inferred": True},
        record(pane=4),
        record("waiting", pane=5) | {"rich": True},
        record("waiting", pane=6) | {"rich": False},
        record("done", pane=7) | {"rich": True},
        record("done", pane=8) | {"inferred": True},
        record("idle", pane=9) | {"rich": True},
        record("idle", pane=10),
        record("unknown", pane=11) | {"rich": True},
        record("unknown", pane=12) | {"rich": False},
    ]
    assert (await post(client, entry, rows)).status == 204
    assert hass.states.get(role_entity(hass, entry, "reported_agents").entity_id).state == "12"
    for role in ("working_agents", "waiting_agents", "done_agents", "idle_agents", "unknown_agents"):
        assert hass.states.get(role_entity(hass, entry, role).entity_id).state == "1"
    assert hass.states.get(role_entity(hass, entry, "inferred_agents").entity_id).state == "2"
    assert hass.states.get(role_entity(hass, entry, "weak_reports").entity_id).state == "3"
    assert hass.states.get(role_entity(hass, entry, "unknown_origin_agents").entity_id).state == "2"


async def test_native_roster_errors_revoke_private_inventory_and_retention(hass, hass_client):
    from homeassistant.helpers.storage import Store
    entry = await add_host(hass)
    changed = inputs(retain_inventory=True)
    changed.pop("host_id")
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    client = await hass_client()
    assert (await post(client, entry, body=extended_body(entry))).status == 204
    roster_id, _ = entity_ids(hass, entry)
    last_success = hass.states.get(roster_id).attributes["inventory_last_success"]
    error = build_error(entry.data["host_id"], "cli_failed")
    error["inventory_privacy"] = {
        "enabled": True, "names_included": False, "derived_labels_included": False}
    assert (await post(client, entry, body=json.dumps(error).encode())).status == 204
    state = hass.states.get(roster_id)
    assert state.state == "error"
    assert state.attributes["inventory"]["tabs"][0]["name"] is None
    assert state.attributes["inventory"]["tabs"][0]["group_name"] is None
    assert state.attributes["inventory"]["tabs"][0]["label"] is None
    assert state.attributes["inventory"]["workspaces"][0]["name"] is None
    assert state.attributes["inventory_last_success"] == last_success
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    stored = await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_load()
    assert stored["inventory"]["tabs"][0]["name"] is None
    assert "Private" not in json.dumps(stored["inventory"])
    error["inventory_privacy"]["enabled"] = False
    assert (await post(client, entry, body=json.dumps(error).encode())).status == 204
    assert hass.states.get(roster_id).attributes["inventory"] is None
    assert hass.states.get(roster_id).attributes["inventory_state"] == "disabled"
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    stored = await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_load()
    assert stored["inventory"] is None


@pytest.mark.parametrize("field", ["notification_title_template", "notification_message_template"])
@pytest.mark.parametrize("template", [
    "{unknown}", "{agent.__class__}", "{agent[0]}", "{agent!r}", "{agent:>10}",
    "{agent:}", "{agent", "agent}", "{}", "{0}", "{states(sensor.secret)}",
    "{% if agent %}", "x" * 1025,
])
async def test_notification_templates_reject_unsafe_formatting_in_native_flows(hass, field, template):
    await async_setup_component(hass, "persistent_notification", {})
    flow = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert field in flow["data_schema"].schema
    rejected = await hass.config_entries.flow.async_configure(flow["flow_id"], inputs(**{field: template}))
    assert rejected["type"] is FlowResultType.FORM
    assert rejected["errors"] == {field: "invalid_notification_template"}
    entry = await add_host(hass)
    options = await hass.config_entries.options.async_init(entry.entry_id)
    changed = inputs(**{field: template})
    changed.pop("host_id")
    rejected = await hass.config_entries.options.async_configure(options["flow_id"], changed)
    assert rejected["errors"] == {field: "invalid_notification_template"}


async def test_notification_templates_persist_reload_and_reach_native_sinks(hass, hass_client, hass_ws_client):
    await async_setup_component(hass, "persistent_notification", {})
    initial = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert "notification_title_template" in initial["data_schema"].schema
    title = "{{tty7}} {host_label} {event_type}\n{model}"
    message = "**Trusted text** {model}|{effort}|{permission_mode}|{session_id}"
    entry = await add_host(hass, notification_title_template=title, notification_message_template=message)
    assert entry.options["notification_title_template"] == title
    client = await hass_client()
    ws = await hass_ws_client()
    attack = "[x](https://evil.example)<b>&`\nnext"
    await post(client, entry, [native_record()])
    await post(client, entry, [native_record("done", model=attack)])
    alerts = await notifications(ws)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert["title"] == "{tty7} Desktop completed [x](https://evil.example)<b>&` next"
    fence = "`" * 65
    assert f"{fence} [x](https://evil.example)<b>&` next {fence}" in alert["message"]
    assert alert["message"].startswith("**Trusted text** ")
    assert "|||" in alert["message"]  # unavailable model and effort are both empty
    assert f"{fence} synthetic-session {fence}" in alert["message"]
    assert alert["message"].endswith("[Open agent dashboard](/lovelace/agents)")
    original_identity = alert["notification_id"]
    await hass.services.async_call("persistent_notification", "dismiss_all", {}, blocking=True)
    delivered = []

    @callback
    def receive_mobile(call):
        delivered.append(call.data)

    hass.services.async_register("notify", "mobile_app_synthetic_templates", receive_mobile)
    options = await hass.config_entries.options.async_init(entry.entry_id)
    updated_title = "{host_id}/{status}/{event}/{pane_id}"
    updated_message = "<b>Trusted</b> {model}|{effort}|{permission_mode}|{agent}"
    changed = inputs(notify_destination="notify.mobile_app_synthetic_templates",
                     notification_title_template=updated_title, notification_message_template=updated_message)
    changed.pop("host_id")
    await hass.config_entries.options.async_configure(options["flow_id"], changed)
    await hass.config_entries.options.async_configure(options["flow_id"], {})
    await hass.async_block_till_done()
    assert entry.options["notification_message_template"] == updated_message
    assert entry.options["notification_title_template"] == updated_title
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    await post(client, entry, [native_record("done", model=attack)])
    assert delivered == []  # reload re-establishes baseline; never replays completion
    await post(client, entry, [native_record(run="after-reload")])
    row = native_record("done", run="after-reload", model=attack, effort="", permission_mode="[p](x)")
    await post(client, entry, [row])
    assert len(delivered) == 1
    assert delivered[0]["title"] == "desktop_demo/done/completed/1"
    assert delivered[0]["message"] == "<b>Trusted</b> [x](https://evil.example)&lt;b&gt;&amp;` next|None|[p](x)|OhMyPi"
    assert delivered[0]["data"] == {"tag": original_identity, "clickAction": "/lovelace/agents"}


async def test_missing_template_options_inherit_approved_defaults(hass, hass_client, hass_ws_client):
    entry = await add_host(hass)
    old_options = {key: value for key, value in entry.options.items()
                   if key not in ("notification_title_template", "notification_message_template")}
    hass.config_entries.async_update_entry(entry, options=old_options)
    await hass.async_block_till_done()
    client = await hass_client()
    ws = await hass_ws_client()
    await post(client, entry, [native_record()])
    await post(client, entry, [native_record("waiting")])
    alert, = await notifications(ws)
    assert alert["title"] == "Unnamed session"
    assert alert["message"] == "Needs your input. [Open agent dashboard](/lovelace/agents)"


async def test_notification_templates_native_inventory_names_use_only_approved_join(hass, hass_client, hass_ws_client):
    from test_controller import inventory
    await async_setup_component(hass, "persistent_notification", {})
    flow = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert "notification_message_template" in flow["data_schema"].schema
    entry = await add_host(hass, notification_title_template="{workspace_name}|{tab_name}",
                           notification_message_template="{host_label}/{tab_name}/{workspace_name}")
    client = await hass_client()
    ws = await hass_ws_client()
    for status in ("working", "done"):
        body = encode_report(build_snapshot("desktop_demo", [native_record(status)], inventory=inventory()))
        assert (await post(client, entry, body=body)).status == 204
    alert, = await notifications(ws)
    assert alert["title"] == "Private workspace|Private tab"
    assert "Private tab" in alert["message"] and "Private workspace" in alert["message"]
    await hass.services.async_call("persistent_notification", "dismiss_all", {}, blocking=True)
    inconsistent = inventory("sample-inconsistent") | {"consistent": False}
    for status in ("working", "done"):
        body = encode_report(build_snapshot("desktop_demo", [native_record(status, run="next-run")], inventory=inconsistent))
        assert (await post(client, entry, body=body)).status == 204
    alert, = await notifications(ws)
    assert alert["title"] == "|"
    assert "Private tab" not in alert["message"] and "Private workspace" not in alert["message"]


@pytest.mark.parametrize("title,message,expected_title,expected_message", [
    ("{host_label}: {event}", "{host_label}: {agent} pane {pane_id} {event}.", "{session_name}", "{event_message}"),
    ("Custom {host_label}", "{host_label}: {agent} pane {pane_id} {event}.", "Custom {host_label}", "{event_message}"),
    ("{host_label}: {event}", "Custom {event_type}", "{session_name}", "Custom {event_type}"),
    ("{host_label}: {event} ", " {host_label}: {agent} pane {pane_id} {event}.",
     "{host_label}: {event} ", " {host_label}: {agent} pane {pane_id} {event}."),
    (None, None, None, None),
])
@pytest.mark.parametrize("destination", ["none", "persistent_notification.create", "notify.mobile_app_migrated"])
async def test_native_minor_migration_only_replaces_exact_builtins_once(
    hass, hass_ws_client, title, message, expected_title, expected_message, destination,
):
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    await async_setup_component(hass, "persistent_notification", {})
    delivered = []

    @callback
    def receive_mobile(call):
        delivered.append(call.data)

    hass.services.async_register("notify", "mobile_app_migrated", receive_mobile)
    data = dict(host_id="migration_host", label="Custom host", base_url="https://ha.example",
                webhook_id="f" * 64, preserved_data="unchanged")
    options = dict(notify_destination=destination, notify_waiting=False, notify_completion=False,
                   dashboard_path="/custom/agents", retain_inventory=False, preserved_option="unchanged")
    if title is not None:
        options["notification_title_template"] = title
    if message is not None:
        options["notification_message_template"] = message
    expected = dict(options)
    if expected_title is not None:
        expected["notification_title_template"] = expected_title
    if expected_message is not None:
        expected["notification_message_template"] = expected_message
    entry = MockConfigEntry(domain=DOMAIN, version=1, minor_version=1, title=data["label"],
                            unique_id=data["host_id"], data=data, options=options)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert (entry.version, entry.minor_version) == (1, 2)
    assert entry.data == data
    assert entry.options == expected
    runtime = entry.runtime_data
    assert runtime.controller.accept(build_snapshot("migration_host", [native_record("done")]), dt_util.utcnow()) == []
    await runtime.notify(native_record("done", outcome="failed") | {"kind": "failed"})
    await runtime.notify(native_record("waiting") | {"kind": "needs_input"})
    assert delivered == []  # disabled toggles remain disabled for failures and inputs
    ws = await hass_ws_client()
    assert await notifications(ws) == []
    # A user can deliberately choose old-looking custom text after migration.
    deliberate = dict(entry.options) | {"notification_title_template": "{host_label}: {event}"}
    hass.config_entries.async_update_entry(entry, options=deliberate)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.options == deliberate
    assert entry.data == data
    assert entry.runtime_data.controller.baseline_ready is False


@pytest.mark.parametrize("destination", ["persistent_notification.create", "notify.mobile_app_real_events"])
async def test_real_event_delivery_preserves_defaults_failure_routing_and_input_identity(
    hass, hass_client, hass_ws_client, destination,
):
    from test_controller import inventory
    delivered = []

    @callback
    def receive_mobile(call):
        delivered.append(call.data)

    hass.services.async_register("notify", "mobile_app_real_events", receive_mobile)
    entry = await add_host(hass, notify_destination=destination, dashboard_path="/custom/agents")
    client = await hass_client()
    ws = await hass_ws_client()
    updates = []

    @callback
    def observe_notification(update_type, changes):
        updates.append(update_type)

    unsubscribe = async_dispatcher_connect(hass, SIGNAL_PERSISTENT_NOTIFICATIONS_UPDATED, observe_notification)
    await post(client, entry, [native_record()])
    for input_id in ("question-one", "question-one", "approval-two"):
        row = native_record("waiting", input_id=input_id)
        assert (await post(client, entry, [row])).status == 204
        await post(client, entry, [native_record()])
    if destination.startswith("notify."):
        assert [alert["message"] for alert in delivered] == ["Needs your input.", "Needs your input."]
    else:
        await hass.async_block_till_done()
        assert len(updates) == 2
    # Distinct proof, not a guessed done status, selects the failure message.
    body = encode_report(build_snapshot("desktop_demo", [native_record("done", outcome="failed")],
                                        inventory=inventory()))
    assert (await post(client, entry, body=body)).status == 204
    alert = delivered[-1] if destination.startswith("notify.") else (await notifications(ws))[0]
    assert alert["title"] == "Private tab"
    assert alert["message"] == ("Failed." if destination.startswith("notify.")
                                else "Failed. [Open agent dashboard](/custom/agents)")
    if destination.startswith("notify."):
        assert alert["data"]["clickAction"] == "/custom/agents"
        assert len(delivered) == 3
    # Neither cancellation nor stock/legacy terminal rows may reach either sink.
    await hass.async_block_till_done()
    before = len(delivered) if destination.startswith("notify.") else len(updates)
    for run, outcome in (("cancelled-run", "cancelled"), ("missing-outcome", None)):
        await post(client, entry, [native_record(run=run)])
        assert (await post(client, entry, [native_record("done", run=run, outcome=outcome)])).status == 204
    await post(client, entry, [record()])
    await post(client, entry, [record("waiting")])
    await post(client, entry, [record("done")])
    await hass.async_block_till_done()
    assert (len(delivered) if destination.startswith("notify.") else len(updates)) == before
    unsubscribe()
