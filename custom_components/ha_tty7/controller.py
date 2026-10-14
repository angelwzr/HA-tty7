"""Pure receipt-time health, sanitized restoration and session transitions."""
from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import html
import json
from typing import Any

from .protocol import AgentRecord, ErrorReport, PayloadError, Snapshot, build_error, build_snapshot

FRESHNESS_SECONDS = 45
STATUSES = ("idle", "working", "waiting", "done", "unknown")


def _timestamp(value: object) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("invalid timestamp")
    result = datetime.fromisoformat(value)
    if result.tzinfo is None:
        raise ValueError("invalid timestamp")
    return result.astimezone(UTC)


class HostController:
    """No clocks, HA dependencies, secrets or unvalidated inbound data."""

    def __init__(self, host_id: str) -> None:
        self.host_id = host_id
        self.agents: list[AgentRecord] = []
        self.collector_ok = False
        self.error_code: str | None = None
        self.last_contact: datetime | None = None
        self.last_success: datetime | None = None
        self.baseline_ready = False
        self._state: int | str = "unconfirmed"

    @property
    def state(self) -> int | str:
        return self._state

    @property
    def online(self) -> bool:
        return self.collector_ok and self.baseline_ready and isinstance(self._state, int)

    @property
    def attributes(self) -> dict[str, Any]:
        counts = dict.fromkeys(STATUSES, 0)
        for agent in self.agents:
            counts[agent["status"]] += 1
        return {
            "schema_version": 1,
            "agents": self.agents,
            "counts": counts,
            "collector_ok": self.collector_ok,
            "error_code": self.error_code,
            "last_contact": self.last_contact.isoformat() if self.last_contact else None,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "baseline_ready": self.baseline_ready,
        }

    def restore(self, attributes: dict[str, Any]) -> None:
        """Restore only a complete valid allowlisted roster and receipt metadata."""
        if self.last_contact is not None:
            return  # A live report always wins over asynchronously loaded storage.
        try:
            if type(attributes.get("schema_version")) is not int or attributes["schema_version"] != 1:
                return
            agents = build_snapshot(self.host_id, attributes["agents"])["agents"]
            contact = _timestamp(attributes["last_contact"])
            success = _timestamp(attributes["last_success"])
            if success is not None and (contact is None or success > contact):
                return
            ok = attributes["collector_ok"]
            if type(ok) is not bool:
                return
            code = attributes["error_code"]
            if code is not None:
                code = build_error(self.host_id, code)["error_code"]
            if ok and code is not None:
                return
        except (KeyError, ValueError, TypeError, PayloadError):
            return
        self.agents = agents
        self.collector_ok = ok
        self.error_code = code
        self.last_contact = contact
        self.last_success = success
        # Storage can retain last-known data, but never health or alert baselines.
        self.baseline_ready = False
        self._state = "unconfirmed"

    def expire(self, now: datetime) -> bool:
        """Expire both healthy and explicitly failed collectors after silence."""
        if self._state in ("stale", "unconfirmed") or self.last_contact is None:
            return False
        age = (now - self.last_contact).total_seconds()
        if 0 <= age <= FRESHNESS_SECONDS:
            return False
        self._state = "stale"
        self.baseline_ready = False
        return True

    def accept(self, report: Snapshot | ErrorReport, now: datetime) -> list[dict[str, Any]]:
        """Consume a shared-protocol-validated, host-bound report."""
        self.expire(now)
        was_ready = self.online
        previous = {(agent["session_id"], agent["pane_id"]): agent["status"] for agent in self.agents}
        events: list[dict[str, Any]] = []
        self.last_contact = now
        if report["kind"] == "error":
            self.collector_ok = self.baseline_ready = False
            self.error_code = report["error_code"]
            self._state = "error"
            return events
        self.agents = report["agents"]
        self.collector_ok = self.baseline_ready = True
        self.error_code = None
        self.last_success = now
        self._state = len(self.agents)
        if not was_ready:
            return events
        for agent in self.agents:
            prior = previous.get((agent["session_id"], agent["pane_id"]))
            kind = None
            if agent["status"] == "waiting" and prior in (None, "idle", "working", "done"):
                kind = "needs_input"
            elif agent["status"] == "done" and prior == "working":
                kind = "completed"
            if kind is not None:
                events.append(dict(agent, kind=kind))
        return events


def notification_payload(host_id: str, label: str, event: dict[str, Any], dashboard: str, *, mobile: bool) -> dict[str, Any]:
    """Encode untrusted text for its exact sink; identity does not reveal sessions."""
    identity = json.dumps([event["session_id"], event["pane_id"]], ensure_ascii=False, separators=(",", ":"))
    tag = f"ha_tty7_{host_id}_" + hashlib.sha256(identity.encode()).hexdigest()
    action = "needs input" if event["kind"] == "needs_input" else "completed"
    if mobile:
        message = f"{html.escape(label, quote=False)}: {html.escape(event['agent'], quote=False)} pane {event['pane_id']} {action}."
        return {"title": f"{label}: {action}", "message": message,
                "data": {"tag": tag, "clickAction": dashboard}}
    fence = "`" * 65
    name = event["agent"].replace("\r", " ").replace("\n", " ")
    safe_label = label.replace("\r", " ").replace("\n", " ")
    message = f"{fence} {safe_label} {fence}: {fence} {name} {fence} pane {event['pane_id']} {action}. [Open agent dashboard]({dashboard})"
    return {"title": f"{label}: {action}", "message": message, "notification_id": tag}
