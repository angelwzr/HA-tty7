"""UI-configured host-bound read-only tty7 monitoring."""
from __future__ import annotations

import asyncio
from datetime import timedelta
from pathlib import Path
from typing import Any

from aiohttp import web
from homeassistant.components import frontend, webhook
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import (CONF_COMPLETION, CONF_HOST_ID, CONF_LABEL, CONF_NOTIFY, CONF_WAITING,
                    CONF_WEBHOOK_ID, DEFAULT_OPTIONS, DOMAIN, MODULE_URL, PLATFORMS, STATIC_URL)
from .controller import HostController, notification_payload
from .protocol import MAX_BODY_BYTES, PayloadError, decode_report
from .log_redaction import install_redactor


class HostRuntime:
    """Own one entry's controller, subscribers, webhook and freshness timer."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.controller = HostController(entry.data[CONF_HOST_ID])
        self.listeners: set[Any] = set()
        self.cancel_timer: Any = None
        self.closed = False
        self.lock = asyncio.Lock()

    @callback
    def publish(self) -> None:
        for listener in tuple(self.listeners):
            listener()

    @callback
    def subscribe(self, listener: Any) -> Any:
        self.listeners.add(listener)
        return lambda: self.listeners.discard(listener)

    @callback
    def tick(self, now: Any) -> None:
        if not self.closed and self.controller.expire(now):
            self.publish()

    async def handle_webhook(self, hass: HomeAssistant, webhook_id: str, request: web.Request) -> web.Response:
        """Never parse an unbounded body, refresh invalid input, or echo it."""
        if self.closed:
            return web.Response(status=410)
        if request.content_length is not None and request.content_length > MAX_BODY_BYTES:
            return web.Response(status=413)
        try:
            async with asyncio.timeout(5):
                body = bytearray()
                while True:
                    chunk = await request.content.read(min(8192, MAX_BODY_BYTES + 1 - len(body)))
                    if not chunk:
                        break
                    body.extend(chunk)
                    if len(body) > MAX_BODY_BYTES:
                        return web.Response(status=413)
            report = decode_report(bytes(body), self.controller.host_id)
        except TimeoutError:
            return web.Response(status=408)
        except PayloadError:
            return web.Response(status=400)
        except (ConnectionError, OSError):
            return web.Response(status=400)
        async with self.lock:
            if self.closed:
                return web.Response(status=410)
            events = self.controller.accept(report, dt_util.utcnow())
            # Both native entities are synchronously written before any action.
            self.publish()
            for event in events:
                await self.notify(event)
        return web.Response(status=204)

    async def notify(self, event: dict[str, Any]) -> None:
        if self.closed:
            return
        options = DEFAULT_OPTIONS | self.entry.options
        enabled = options[CONF_WAITING] if event["kind"] == "needs_input" else options[CONF_COMPLETION]
        destination = options[CONF_NOTIFY]
        if not enabled or destination == "none":
            return
        from .config_flow import valid_dashboard, supported_destinations
        if destination not in supported_destinations(self.hass) or not valid_dashboard(options["dashboard_path"]):
            return
        domain, service = destination.split(".", 1)
        payload = notification_payload(self.controller.host_id, self.entry.data[CONF_LABEL], event,
                                       options["dashboard_path"], mobile=domain == "notify")
        try:
            await self.hass.services.async_call(domain, service, payload, blocking=True)
        except HomeAssistantError:
            # Delivery failure must not undo accepted health or expose input/secrets.
            pass


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    hass.data.setdefault(DOMAIN, {"frontend_lock": asyncio.Lock(), "static_registered": False,
                                  "module_registered": False, "entries": set()})
    redactor = install_redactor()
    try:
        for entry in hass.config_entries.async_entries(DOMAIN):
            redactor.remember(entry.data[CONF_WEBHOOK_ID])
    except ValueError:
        return False
    return True


async def _setup_frontend(hass: HomeAssistant, entry_id: str) -> None:
    data = hass.data[DOMAIN]
    async with data["frontend_lock"]:
        if not data["static_registered"]:
            await hass.http.async_register_static_paths([
                StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend" / "ha-tty7-card.js"), True)
            ])
            data["static_registered"] = True
        if not data["module_registered"]:
            frontend.add_extra_js_url(hass, MODULE_URL)
            data["module_registered"] = True
        data["entries"].add(entry_id)


async def _release_frontend(hass: HomeAssistant, entry_id: str) -> None:
    data = hass.data.get(DOMAIN)
    if data is None:
        return
    async with data["frontend_lock"]:
        data["entries"].discard(entry_id)
        if not data["entries"] and data["module_registered"]:
            frontend.remove_extra_js_url(hass, MODULE_URL)
            data["module_registered"] = False
        # HA 2026.10 has no static-route unregister API. Keep the single public
        # bundle path registered for a later reload; it carries no host data.


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    try:
        install_redactor().remember(entry.data[CONF_WEBHOOK_ID])
    except ValueError:
        raise ConfigEntryNotReady("credential_redaction_capacity") from None
    await _setup_frontend(hass, entry.entry_id)
    runtime = HostRuntime(hass, entry)
    entry.runtime_data = runtime
    webhook.async_register(hass, DOMAIN, "HA-tty7 host", entry.data[CONF_WEBHOOK_ID],
                           runtime.handle_webhook, local_only=True, allowed_methods=("POST",))
    try:
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    except Exception:
        runtime.closed = True
        webhook.async_unregister(hass, entry.data[CONF_WEBHOOK_ID])
        await _release_frontend(hass, entry.entry_id)
        raise
    runtime.cancel_timer = async_track_time_interval(hass, runtime.tick, timedelta(seconds=5))
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    runtime: HostRuntime = entry.runtime_data
    runtime.closed = True
    webhook.async_unregister(hass, entry.data[CONF_WEBHOOK_ID])
    if runtime.cancel_timer is not None:
        runtime.cancel_timer()
        runtime.cancel_timer = None
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        runtime.closed = False
        webhook.async_register(hass, DOMAIN, "HA-tty7 host", entry.data[CONF_WEBHOOK_ID],
                               runtime.handle_webhook, local_only=True, allowed_methods=("POST",))
        runtime.cancel_timer = async_track_time_interval(hass, runtime.tick, timedelta(seconds=5))
        return False
    await _release_frontend(hass, entry.entry_id)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Revocation is immediate even if an entry was not currently loaded."""
    webhook.async_unregister(hass, entry.data[CONF_WEBHOOK_ID])
    if (runtime := getattr(entry, "runtime_data", None)) is not None:
        runtime.closed = True
        if runtime.cancel_timer is not None:
            runtime.cancel_timer()
            runtime.cancel_timer = None
    await _release_frontend(hass, entry.entry_id)
