"""Host connectivity is confirmed receipt health, never agent completion."""
from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity, BinarySensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import HostRuntime
from .const import CONF_HOST_ID, CONF_LABEL, DOMAIN, VERSION

DESCRIPTION = BinarySensorEntityDescription(key="connectivity", translation_key="connectivity",
                                            device_class=BinarySensorDeviceClass.CONNECTIVITY)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    async_add_entities([HATty7Connectivity(entry)])


class HATty7Connectivity(BinarySensorEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True
    entity_description = DESCRIPTION

    def __init__(self, entry: ConfigEntry) -> None:
        self.runtime: HostRuntime = entry.runtime_data
        self._attr_unique_id = f"{entry.data[CONF_HOST_ID]}_connectivity"
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, entry.data[CONF_HOST_ID])},
                                           name=entry.data[CONF_LABEL], manufacturer="HA-tty7",
                                           model="Read-only tty7 collector", sw_version=VERSION)

    @property
    def is_on(self) -> bool:
        return self.runtime.controller.online

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(self.runtime.subscribe(self.async_write_ha_state))
