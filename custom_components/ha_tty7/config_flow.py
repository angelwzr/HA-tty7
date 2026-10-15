"""Authenticated host setup/options; pairing credentials never enter entities."""
from __future__ import annotations

import re
import secrets
from typing import Any
from urllib.parse import urlsplit

import probatio
from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector

from .const import (CONF_BASE_URL, CONF_COMPLETION, CONF_DASHBOARD, CONF_HOST_ID,
                    CONF_LABEL, CONF_MESSAGE_TEMPLATE, CONF_NOTIFY, CONF_RETAIN_INVENTORY,
                    CONF_TITLE_TEMPLATE, CONF_WAITING, CONF_WEBHOOK_ID,
                    DEFAULT_OPTIONS, DOMAIN)
from .log_redaction import install_redactor
from .template import valid_notification_template

_HOST = re.compile(r"[a-z0-9][a-z0-9_-]{0,63}")
_MOBILE = re.compile(r"mobile_app_[a-z0-9_]+")
_DASHBOARD = re.compile(r"/[a-zA-Z0-9_/-]+")


def supported_destinations(hass: HomeAssistant) -> list[str]:
    destinations = ["none"]
    if hass.services.has_service("persistent_notification", "create"):
        destinations.append("persistent_notification.create")
    destinations.extend(f"notify.{name}" for name in hass.services.async_services().get("notify", {})
                        if _MOBILE.fullmatch(name))
    return sorted(destinations)


def valid_dashboard(value: object) -> bool:
    return isinstance(value, str) and len(value) <= 256 and _DASHBOARD.fullmatch(value) is not None and not value.startswith("//")


def valid_base_url(value: object) -> bool:
    """Require HTTPS; collectors retain normal certificate/hostname verification."""
    if not isinstance(value, str) or not 1 <= len(value) <= 2048 or any(c.isspace() or ord(c) < 32 for c in value):
        return False
    try:
        url = urlsplit(value)
        return (url.scheme == "https" and bool(url.hostname) and url.username is None and url.password is None
                and not url.query and not url.fragment and "%" not in url.netloc
                and (url.port is None or 1 <= url.port <= 65535)
                and ".." not in url.path.split("/") and "\\" not in value)
    except ValueError:
        return False


def _errors(hass: HomeAssistant, data: dict[str, Any], *, user: bool) -> dict[str, str]:
    errors = {}
    if user and (not isinstance(data.get(CONF_HOST_ID), str) or not _HOST.fullmatch(data[CONF_HOST_ID])):
        errors[CONF_HOST_ID] = "invalid_host_id"
    label = data.get(CONF_LABEL)
    if not isinstance(label, str) or not 1 <= len(label.strip()) <= 64 or any(ord(c) < 32 for c in label):
        errors[CONF_LABEL] = "invalid_label"
    if not valid_base_url(data.get(CONF_BASE_URL)):
        errors[CONF_BASE_URL] = "invalid_base_url"
    if data.get(CONF_NOTIFY) not in supported_destinations(hass):
        errors[CONF_NOTIFY] = "invalid_destination"
    if not valid_dashboard(data.get(CONF_DASHBOARD)):
        errors[CONF_DASHBOARD] = "invalid_dashboard"
    for key in (CONF_TITLE_TEMPLATE, CONF_MESSAGE_TEMPLATE):
        if not valid_notification_template(data.get(key)):
            errors[key] = "invalid_notification_template"
    for key in (CONF_WAITING, CONF_COMPLETION, CONF_RETAIN_INVENTORY):
        if type(data.get(key)) is not bool:
            errors[key] = "invalid_toggle"
    return errors


def _schema(hass: HomeAssistant, defaults: dict[str, Any], *, user: bool) -> probatio.Schema:
    fields = {}
    if user:
        fields[probatio.Required(CONF_HOST_ID, default=defaults.get(CONF_HOST_ID, ""))] = selector.TextSelector()
    for key in (CONF_LABEL, CONF_BASE_URL, CONF_DASHBOARD):
        fields[probatio.Required(key, default=defaults.get(key, ""))] = selector.TextSelector()
    fields[probatio.Required(CONF_NOTIFY, default=defaults.get(CONF_NOTIFY, "none"))] = selector.SelectSelector(
        selector.SelectSelectorConfig(options=supported_destinations(hass), mode=selector.SelectSelectorMode.DROPDOWN))
    for key in (CONF_WAITING, CONF_COMPLETION):
        fields[probatio.Required(key, default=defaults.get(key, True))] = selector.BooleanSelector()
    for key in (CONF_TITLE_TEMPLATE, CONF_MESSAGE_TEMPLATE):
        fields[probatio.Required(key, default=defaults[key])] = selector.TextSelector(
            selector.TextSelectorConfig(multiline=key == CONF_MESSAGE_TEMPLATE))
    fields[probatio.Required(CONF_RETAIN_INVENTORY, default=defaults.get(CONF_RETAIN_INVENTORY, False))] = selector.BooleanSelector()
    return probatio.Schema(fields)


def _pairing(data: dict[str, Any]) -> dict[str, str]:
    return {"host_id": data[CONF_HOST_ID],
            "webhook_url": f"{data[CONF_BASE_URL].rstrip('/')}/api/webhook/{data[CONF_WEBHOOK_ID]}"}


class HATty7ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._options: dict[str, Any] = {}

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> HATty7OptionsFlow:
        return HATty7OptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        defaults = DEFAULT_OPTIONS | {CONF_LABEL: "", CONF_BASE_URL: ""}
        errors = {}
        if user_input is not None:
            values = defaults | user_input
            errors = _errors(self.hass, values, user=True)
            if not errors:
                await self.async_set_unique_id(values[CONF_HOST_ID])
                self._abort_if_unique_id_configured()
                self._data = {CONF_HOST_ID: values[CONF_HOST_ID], CONF_LABEL: values[CONF_LABEL].strip(),
                              CONF_BASE_URL: values[CONF_BASE_URL].rstrip('/'), CONF_WEBHOOK_ID: secrets.token_hex(32)}
                try:
                    install_redactor().remember(self._data[CONF_WEBHOOK_ID])
                except ValueError:
                    return self.async_abort(reason="credential_redaction_capacity")
                self._options = {key: values[key] for key in DEFAULT_OPTIONS}
                return await self.async_step_pairing()
            defaults = values
        return self.async_show_form(step_id="user", data_schema=_schema(self.hass, defaults, user=True), errors=errors)

    async def async_step_pairing(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(title=self._data[CONF_LABEL], data=self._data, options=self._options)
        return self.async_show_form(step_id="pairing", data_schema=probatio.Schema({}),
                                    description_placeholders=_pairing(self._data), last_step=True)


class HATty7OptionsFlow(config_entries.OptionsFlow):
    def __init__(self) -> None:
        self._data: dict[str, Any] = {}
        self._options: dict[str, Any] = {}

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        defaults = DEFAULT_OPTIONS | dict(self.config_entry.data) | dict(self.config_entry.options)
        errors = {}
        if user_input is not None:
            values = defaults | user_input
            errors = _errors(self.hass, values, user=False)
            if not errors:
                self._data = dict(self.config_entry.data) | {CONF_LABEL: values[CONF_LABEL].strip(),
                                                           CONF_BASE_URL: values[CONF_BASE_URL].rstrip('/')}
                self._options = {key: values[key] for key in DEFAULT_OPTIONS}
                return await self.async_step_pairing()
            defaults = values
        return self.async_show_form(step_id="init", data_schema=_schema(self.hass, defaults, user=False), errors=errors)

    async def async_step_pairing(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            # One atomic update, so label/base/options cause one reload. The
            # options manager's following equal-options write is a no-op.
            self.hass.config_entries.async_update_entry(self.config_entry, data=self._data,
                                                       title=self._data[CONF_LABEL], options=self._options)
            if self._options[CONF_RETAIN_INVENTORY] is False:
                from . import async_scrub_inventory_storage
                await async_scrub_inventory_storage(self.hass, self.config_entry)
            return self.async_create_entry(title="", data=self._options)
        return self.async_show_form(step_id="pairing", data_schema=probatio.Schema({}),
                                    description_placeholders=_pairing(self._data), last_step=True)
