"""Bounded named notification fields, without state access or expression evaluation."""
from __future__ import annotations

import html
import re
from string import Formatter
from typing import Literal

DEFAULT_TITLE_TEMPLATE = "{session_name}"
DEFAULT_MESSAGE_TEMPLATE = "{event_message}"
MAX_TEMPLATE_LENGTH = 1024
TEMPLATE_FIELDS = frozenset({
    "host_label", "host_id", "agent", "pane_id", "session_id", "status", "event",
    "event_type", "event_message", "session_name", "model", "effort", "permission_mode",
    "tab_name", "workspace_name",
})
# A complete grammar, rather than Formatter's field traversal/format language.
_TEMPLATE = re.compile(r"(?:[^{}]|\{\{|\}\}|\{(?:" + "|".join(sorted(TEMPLATE_FIELDS)) + r")\})*")
_FORMATTER = Formatter()
# These fields are fixed enums, a validated host identifier, or a positive integer.
_PLAIN_FIELDS = frozenset({"host_id", "pane_id", "status", "event", "event_type", "event_message"})


def valid_notification_template(value: object) -> bool:
    """Accept literal text, doubled braces and exact allowlisted {name} fields."""
    return (isinstance(value, str) and len(value) <= MAX_TEMPLATE_LENGTH
            and _TEMPLATE.fullmatch(value) is not None)


def format_notification(template: str, values: dict[str, str], *, sink: Literal["plain", "html", "markdown"]) -> str:
    """Escape untrusted values before placing them inside trusted user text."""
    escaped = {}
    for key, value in values.items():
        value = " ".join(value.splitlines())
        if sink == "html":
            value = html.escape(value)
        elif sink == "markdown" and key not in _PLAIN_FIELDS and value:
            # Every metadata field is bounded by the protocol. A longer delimiter
            # also protects model/session/name fields containing long backtick runs.
            width = max(65, max((len(run) + 1 for run in re.findall(r"`+", value)), default=0))
            fence = "`" * width
            value = f"{fence} {value} {fence}"
        escaped[key] = value
    result = _FORMATTER.vformat(template, (), escaped)
    return " ".join(result.splitlines()) if sink == "plain" else result
