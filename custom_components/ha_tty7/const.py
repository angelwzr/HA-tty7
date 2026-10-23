"""Native integration constants; no credentials or environment defaults."""
from homeassistant.const import Platform

from .template import DEFAULT_MESSAGE_TEMPLATE, DEFAULT_TITLE_TEMPLATE

DOMAIN = "ha_tty7"
VERSION = "0.4.7"
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
CONF_TITLE_TEMPLATE = "notification_title_template"
CONF_MESSAGE_TEMPLATE = "notification_message_template"
DEFAULT_OPTIONS = {
    CONF_NOTIFY: "none",
    CONF_WAITING: True,
    CONF_COMPLETION: True,
    CONF_DASHBOARD: "/lovelace/agents",
    CONF_RETAIN_INVENTORY: False,
    CONF_TITLE_TEMPLATE: DEFAULT_TITLE_TEMPLATE,
    CONF_MESSAGE_TEMPLATE: DEFAULT_MESSAGE_TEMPLATE,
}
STATIC_URL = "/ha_tty7/ha-tty7-card.js"
MODULE_URL = f"{STATIC_URL}?v={VERSION}"
