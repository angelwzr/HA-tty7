"""One sanitized restorable roster per configured host, not per session."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import ExtraStoredData, RestoreEntity

from .const import CONF_HOST_ID, CONF_LABEL, DOMAIN, VERSION
from . import HostRuntime

DESCRIPTION = SensorEntityDescription(key="roster", name="Roster", icon="mdi:console")


class RosterRestoreData(ExtraStoredData):
    def __init__(self, attributes: dict[str, Any]) -> None:
        self.attributes = attributes

    def as_dict(self) -> dict[str, Any]:
        return self.attributes


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HATty7Roster(entry)])


class HATty7Roster(RestoreEntity, SensorEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True
    # Supported entity-level recorder hook; restore uses its own native storage.
    _unrecorded_attributes = frozenset({"schema_version", "agents", "counts", "collector_ok",
                                       "error_code", "last_contact", "last_success", "baseline_ready"})
    entity_description = DESCRIPTION

    def __init__(self, entry: ConfigEntry) -> None:
        self.runtime: HostRuntime = entry.runtime_data
        self._attr_unique_id = f"{entry.data[CONF_HOST_ID]}_roster"
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, entry.data[CONF_HOST_ID])},
                                           name=entry.data[CONF_LABEL], manufacturer="HA-tty7",
                                           model="Read-only tty7 collector", sw_version=VERSION)

    @property
    def native_value(self) -> int | str:
        return self.runtime.controller.state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return self.runtime.controller.attributes

    @property
    def extra_restore_state_data(self) -> ExtraStoredData:
        return RosterRestoreData(self.runtime.controller.attributes)

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        if (extra := await self.async_get_last_extra_data()) is not None:
            self.runtime.controller.restore(extra.as_dict())
        elif (last := await self.async_get_last_state()) is not None:
            self.runtime.controller.restore(dict(last.attributes))
        self.async_on_remove(self.runtime.subscribe(self.async_write_ha_state))
        self.runtime.publish()
