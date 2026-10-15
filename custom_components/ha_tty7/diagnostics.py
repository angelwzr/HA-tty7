"""Privacy-safe diagnostic download: aggregates and approved source facts only."""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_RETAIN_INVENTORY, VERSION


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict:
    """Never export entry settings, identity, labels, roster rows or private IDs."""
    controller = entry.runtime_data.controller
    attributes = controller.attributes
    inventory = controller.inventory
    inventory_counts = {"workspace_count": None, "tab_count": None, "pane_count": None}
    if inventory is not None and inventory["kind"] == "snapshot":
        inventory_counts = {"workspace_count": len(inventory["workspaces"]),
                            "tab_count": len(inventory["tabs"]), "pane_count": len(inventory["panes"])}
    # Do not return the complete source object either: make the download's
    # allowlist explicit so future protocol fields cannot accidentally escape.
    source = None
    if controller.source is not None:
        source = {key: controller.source[key] for key in (
            "state", "collector_version", "tty7_build", "control_version", "protocol_version", "uptime_secs")}
    return {
        "integration_version": VERSION,
        "roster": {"health": "healthy" if controller.online else controller.state,
                   "counts": attributes["counts"], "confirmed_counts": attributes["confirmed_counts"],
                   "inferred_count": attributes["inferred_count"], "weak_count": attributes["weak_count"],
                   "unknown_origin_count": attributes["unknown_origin_count"],
                   "last_contact": attributes["last_contact"], "last_success": attributes["last_success"],
                   "error_code": controller.error_code},
        "inventory": {"state": controller.inventory_state,
                      "last_contact": attributes["inventory_last_contact"],
                      "last_success": attributes["inventory_last_success"],
                      "error_code": controller.inventory_error_code,
                      "retention_enabled": entry.options.get(CONF_RETAIN_INVENTORY, False) is True,
                      **inventory_counts},
        "source": source,
    }
