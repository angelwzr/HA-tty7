"""Native integration constants; no credentials or environment defaults."""
from homeassistant.const import Platform

DOMAIN = "ha_tty7"
VERSION = "0.4.0"
PLATFORMS = (Platform.SENSOR, Platform.BINARY_SENSOR)
CONF_HOST_ID = "host_id"
CONF_LABEL = "label"
CONF_BASE_URL = "base_url"
CONF_WEBHOOK_ID = "webhook_id"
CONF_NOTIFY = "notify_destination"
CONF_WAITING = "notify_waiting"
CONF_COMPLETION = "notify_completion"
CONF_DASHBOARD = "dashboard_path"
CONF_RETAIN_INVENTORY = "retain_inventory"
DEFAULT_OPTIONS = {
    CONF_NOTIFY: "none",
    CONF_WAITING: True,
    CONF_COMPLETION: True,
    CONF_DASHBOARD: "/lovelace/agents",
    CONF_RETAIN_INVENTORY: False,
}
STATIC_URL = "/ha_tty7/ha-tty7-card.js"
MODULE_URL = f"{STATIC_URL}?v={VERSION}"
