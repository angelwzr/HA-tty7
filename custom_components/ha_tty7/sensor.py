"""One private roster and fixed scalar monitoring roles per source host."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_HOST_ID, CONF_LABEL, DOMAIN, VERSION
from . import HostRuntime

DESCRIPTION = SensorEntityDescription(key="roster", translation_key="roster", icon="mdi:console")
ROSTER_COUNTS = {
    "working_agents": "working", "waiting_agents": "waiting", "done_agents": "done",
    "idle_agents": "idle", "unknown_agents": "unknown",
}
PROVENANCE_COUNTS = {
    "inferred_agents": "inferred_count", "weak_reports": "weak_count",
    "unknown_origin_agents": "unknown_origin_count",
}
INVENTORY_COUNTS = ("workspaces", "tabs", "panes", "live_panes", "hibernated_tabs", "orphan_panes")
SOURCE_VALUES = ("tty7_build", "collector_version", "control_version", "protocol_version", "uptime")
SCALAR_DESCRIPTIONS = (
    *(SensorEntityDescription(key=key, translation_key=key, icon="mdi:counter")
      for key in ("reported_agents", *ROSTER_COUNTS, *PROVENANCE_COUNTS, *INVENTORY_COUNTS)),
    SensorEntityDescription(key="health", translation_key="health", device_class=SensorDeviceClass.ENUM,
                            options=["healthy", "unconfirmed", "error", "stale"]),
    *(SensorEntityDescription(key=key, translation_key=key, device_class=SensorDeviceClass.TIMESTAMP)
      for key in ("last_contact", "last_success")),
    *(SensorEntityDescription(key=key, translation_key=key, entity_category=EntityCategory.DIAGNOSTIC)
      for key in SOURCE_VALUES if key != "uptime"),
    SensorEntityDescription(key="uptime", translation_key="uptime", entity_category=EntityCategory.DIAGNOSTIC,
                            device_class=SensorDeviceClass.DURATION, native_unit_of_measurement=UnitOfTime.SECONDS),
)


def _device(entry: ConfigEntry) -> DeviceInfo:
    return DeviceInfo(identifiers={(DOMAIN, entry.data[CONF_HOST_ID])}, name=entry.data[CONF_LABEL],
                      manufacturer="HA-tty7", model="Read-only tty7 collector", sw_version=VERSION)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HATty7Roster(entry), *(HATty7Summary(entry, description) for description in SCALAR_DESCRIPTIONS)])


class HATty7Roster(SensorEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True
    _unrecorded_attributes = frozenset({
        "schema_version", "agents", "counts", "confirmed_counts", "inferred_count", "weak_count",
        "unknown_origin_count", "collector_ok", "error_code", "last_contact", "last_success", "baseline_ready",
        "inventory", "inventory_state", "inventory_last_contact", "inventory_last_success",
        "inventory_error_code", "source",
    })
    entity_description = DESCRIPTION

    def __init__(self, entry: ConfigEntry) -> None:
        self.runtime: HostRuntime = entry.runtime_data
        self._attr_unique_id = f"{entry.data[CONF_HOST_ID]}_roster"
        self._attr_device_info = _device(entry)

    @property
    def native_value(self) -> int | str:
        return self.runtime.controller.state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return self.runtime.controller.attributes


    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(self.runtime.subscribe(self.async_write_ha_state))


class HATty7Summary(SensorEntity):
    """Stable scalar values only; transient session and inventory rows stay on the roster."""

    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(self, entry: ConfigEntry, description: SensorEntityDescription) -> None:
        self.runtime: HostRuntime = entry.runtime_data
        self.entity_description = description
        self._attr_unique_id = f"{entry.data[CONF_HOST_ID]}_{description.key}"
        self._attr_device_info = _device(entry)

    @property
    def available(self) -> bool:
        controller = self.runtime.controller
        key = self.entity_description.key
        if key == "health":
            return True
        if key in ("last_contact", "last_success"):
            return getattr(controller, key) is not None
        if key in INVENTORY_COUNTS:
            return controller.inventory_state == "healthy"
        if key in SOURCE_VALUES:
            return (controller.online and controller.source is not None
                    and controller.source["state"] == "available" and self.native_value is not None)
        return controller.online

    @property
    def native_value(self):
        controller = self.runtime.controller
        key = self.entity_description.key
        if key == "health":
            return "healthy" if controller.online else controller.state
        if key in ("last_contact", "last_success"):
            return getattr(controller, key)
        if key in SOURCE_VALUES:
            return controller.source.get("uptime_secs" if key == "uptime" else key) if controller.source else None
        if key in INVENTORY_COUNTS:
            inventory = controller.inventory
            if inventory is None or inventory["kind"] != "snapshot":
                return None
            if key in ("workspaces", "tabs", "panes"):
                return len(inventory[key])
            if key == "live_panes":
                return sum(pane["live"] is True for pane in inventory["panes"])
            if key == "hibernated_tabs":
                return sum(tab["hibernated"] for tab in inventory["tabs"])
            return sum(pane["orphan"] for pane in inventory["panes"])
        if key == "reported_agents":
            return len(controller.agents)
        attributes = controller.attributes
        if key in ROSTER_COUNTS:
            return attributes["confirmed_counts"][ROSTER_COUNTS[key]]
        return attributes[PROVENANCE_COUNTS[key]]

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(self.runtime.subscribe(self.async_write_ha_state))
