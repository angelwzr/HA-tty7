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


def inputs(host="desktop_demo", **changes):
    return dict(host_id=host, label="Desktop" if host == "desktop_demo" else "Laptop",
                base_url="https://ha.example", notify_destination="persistent_notification.create",
                notify_waiting=True, notify_completion=True, dashboard_path="/lovelace/agents") | changes


async def add_host(hass, host="desktop_demo"):
    # Finish native dependency/route setup before creating the HTTP TestClient:
    # the pinned plugin does not bootstrap HTTP, and aiohttp freezes its app.
    await async_setup_component(hass, "persistent_notification", {})
    flow = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    pairing = await hass.config_entries.flow.async_configure(flow["flow_id"], inputs(host))
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
               json.dumps(forbidden).encode(), b" " * (64 * 1024 + 1),
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
    entry = await add_host(hass)
    client = await hass_client()
    ws = await hass_ws_client()
    roster_id, _ = entity_ids(hass, entry)
    observed_statuses = []

    @callback
    def observe_notification(update_type, updates):
        observed_statuses.append(hass.states.get(roster_id).attributes["agents"][0]["status"])

    unsubscribe = async_dispatcher_connect(hass, SIGNAL_PERSISTENT_NOTIFICATIONS_UPDATED, observe_notification)
    await post(client, entry, [record("done")])
    assert await notifications(ws) == []
    await post(client, entry, [record()])
    await post(client, entry, [record("done", name="`\r\n<a>&[x]")])
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
    await post(client, entry, [record("waiting")])
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
    await post(client, entry, [record()])
    await post(client, entry, [record("done")])
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
    await post(client, entry, [record()])
    await post(client, entry, [record("waiting")])
    assert await notifications(ws) == []
    await post(client, entry, [record()])
    await post(client, entry, [record("done")])
    assert len(await notifications(ws)) == 1
    await hass.services.async_call("persistent_notification", "dismiss_all", {}, blocking=True)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    changed = inputs(notify_waiting=True, notify_completion=False)
    changed.pop("host_id")
    await hass.config_entries.options.async_configure(flow["flow_id"], changed)
    await hass.config_entries.options.async_configure(flow["flow_id"], {})
    await hass.async_block_till_done()
    await post(client, entry, [record()])
    await post(client, entry, [record("done")])
    assert await notifications(ws) == []
    await post(client, entry, [record("waiting")])
    assert len(await notifications(ws)) == 1
