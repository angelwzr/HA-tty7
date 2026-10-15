"""Pure receipt-time health, sanitized restoration and session transitions."""
from __future__ import annotations

from datetime import UTC, datetime
import hashlib
import html
import json
from typing import Any

from .protocol import (
    FRESHNESS_SECONDS, AgentRecord, ErrorReport, InventoryReport, PayloadError,
    Snapshot, SourceInfo, build_error, build_snapshot,
)
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
    """Own HA receipt clocks, last-known data and notification baselines."""

    def __init__(self, host_id: str) -> None:
        self.host_id = host_id
        self.agents: list[AgentRecord] = []
        self.collector_ok = False
        self.error_code: str | None = None
        self.last_contact: datetime | None = None
        self.last_success: datetime | None = None
        self.baseline_ready = False
        self._state: int | str = "unconfirmed"
        self.inventory: InventoryReport | None = None
        self.inventory_state = "disabled"
        self.inventory_last_contact: datetime | None = None
        self.inventory_last_success: datetime | None = None
        self.inventory_error_code: str | None = None
        self.source: SourceInfo | None = None

    @property
    def state(self) -> int | str:
        return self._state

    @property
    def online(self) -> bool:
        return self.collector_ok and self.baseline_ready and isinstance(self._state, int)

    @property
    def attributes(self) -> dict[str, Any]:
        counts = dict.fromkeys(STATUSES, 0)
        confirmed = dict.fromkeys(STATUSES, 0)
        inferred = weak = unknown = 0
        for agent in self.agents:
            counts[agent["status"]] += 1
            if agent.get("inferred", False):
                inferred += 1
            elif agent.get("rich") is True:
                confirmed[agent["status"]] += 1
            elif agent.get("rich") is False:
                weak += 1
            else:
                unknown += 1
        return {
            "schema_version": 1, "agents": self.agents, "counts": counts,
            "confirmed_counts": confirmed, "inferred_count": inferred,
            "weak_count": weak, "unknown_origin_count": unknown,
            "collector_ok": self.collector_ok, "error_code": self.error_code,
            "last_contact": self.last_contact.isoformat() if self.last_contact else None,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "baseline_ready": self.baseline_ready,
            "inventory": self.inventory, "inventory_state": self.inventory_state,
            "inventory_last_contact": self.inventory_last_contact.isoformat() if self.inventory_last_contact else None,
            "inventory_last_success": self.inventory_last_success.isoformat() if self.inventory_last_success else None,
            "inventory_error_code": self.inventory_error_code, "source": self.source,
        }

    def restore_attributes(self, *, retain_inventory: bool = False) -> dict[str, Any]:
        """Privacy consent applies to storage, not live inventory display."""
        attributes = self.attributes
        if not retain_inventory:
            attributes.update(inventory=None, inventory_state="disabled", inventory_last_contact=None,
                              inventory_last_success=None, inventory_error_code=None)
        return attributes

    def restore(self, attributes: dict[str, Any], *, retain_inventory: bool = False) -> None:
        """Restore validated last-known data, never health or alert baselines."""
        if self.last_contact is not None:
            return
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
        self.baseline_ready = False
        self._state = "unconfirmed"
        try:
            source = attributes.get("source")
            if source is not None:
                self.source = build_snapshot(self.host_id, [], source=source)["source"]
        except (ValueError, TypeError, PayloadError):
            pass
        if retain_inventory and attributes.get("inventory") is not None:
            try:
                inventory = build_snapshot(self.host_id, [], inventory=attributes["inventory"])["inventory"]
                if inventory["kind"] != "snapshot":
                    return
                inventory_contact = _timestamp(attributes.get("inventory_last_contact"))
                inventory_success = _timestamp(attributes.get("inventory_last_success"))
                if inventory_success is not None and (inventory_contact is None or inventory_success > inventory_contact):
                    return
            except (KeyError, ValueError, TypeError, PayloadError):
                return
            self.inventory = inventory
            self.inventory_last_contact = inventory_contact
            self.inventory_last_success = inventory_success
            self.inventory_state = "unconfirmed"

    def expire(self, now: datetime) -> bool:
        """Independently expire roster and inventory on HA receipt clocks."""
        changed = False
        if self._state not in ("stale", "unconfirmed") and self.last_contact is not None:
            age = (now - self.last_contact).total_seconds()
            if not 0 <= age <= FRESHNESS_SECONDS:
                self._state = "stale"
                self.baseline_ready = False
                changed = True
        if self.inventory_state in ("healthy", "error") and self.inventory_last_contact is not None:
            age = (now - self.inventory_last_contact).total_seconds()
            if not 0 <= age <= FRESHNESS_SECONDS:
                self.inventory_state = "stale"
                changed = True
        return changed

    def _revoke_inventory_fields(
        self, *, names_included: bool | None, derived_labels_included: bool | None,
    ) -> None:
        """Apply consent revocation without claiming another observation."""
        if self.inventory is None or self.inventory["kind"] != "snapshot":
            return
        names_revoked = names_included is False
        labels_revoked = names_revoked or derived_labels_included is False
        if not names_revoked and not labels_revoked:
            return
        self.inventory = {
            **self.inventory,
            "names_included": False if names_revoked else self.inventory["names_included"],
            "derived_labels_included": False if labels_revoked else self.inventory["derived_labels_included"],
            "workspaces": [{**workspace, "name": None} if names_revoked else workspace
                           for workspace in self.inventory["workspaces"]],
            "tabs": [{**tab, **({"name": None, "group_name": None} if names_revoked else {}),
                      **({"label": None} if labels_revoked else {})}
                     for tab in self.inventory["tabs"]],
        }

    def _accept_inventory(self, report: InventoryReport | None, now: datetime) -> None:
        if report is None:
            self.inventory = None
            self.inventory_state = "disabled"
            self.inventory_last_contact = self.inventory_last_success = None
            self.inventory_error_code = None
        elif report["kind"] == "error":
            self._revoke_inventory_fields(names_included=report.get("names_included"),
                                          derived_labels_included=report.get("derived_labels_included"))
            # Repeated cached errors, like cached successes, are not new reads.
            if self.inventory_error_code != report["error_code"]:
                self.inventory_last_contact = now
                self.inventory_state = "error"
                self.inventory_error_code = report["error_code"]
        elif self.inventory is None or report["sample_id"] != self.inventory["sample_id"]:
            self.inventory = report
            self.inventory_state = "healthy"
            self.inventory_last_contact = self.inventory_last_success = now
            self.inventory_error_code = None

    def accept(self, report: Snapshot | ErrorReport, now: datetime) -> list[dict[str, Any]]:
        """Consume a shared-protocol-validated, host-bound report."""
        self.expire(now)
        was_ready = self.online
        previous = {(agent["session_id"], agent["pane_id"]):
                    "unknown" if agent.get("inferred", False) or agent.get("rich") is False else agent["status"]
                    for agent in self.agents}
        events: list[dict[str, Any]] = []
        self.last_contact = now
        if report["kind"] == "error":
            if (privacy := report.get("inventory_privacy")) is not None:
                if not privacy["enabled"]:
                    self._accept_inventory(None, now)
                else:
                    self._revoke_inventory_fields(names_included=privacy["names_included"],
                                                  derived_labels_included=privacy["derived_labels_included"])
            self.collector_ok = self.baseline_ready = False
            self.error_code = report["error_code"]
            self._state = "error"
            return events
        self._accept_inventory(report.get("inventory"), now)
        self.source = report.get("source")
        self.agents = report["agents"]
        self.collector_ok = self.baseline_ready = True
        self.error_code = None
        self.last_success = now
        self._state = len(self.agents)
        if not was_ready:
            return events
        for agent in self.agents:
            if agent.get("inferred", False) or agent.get("rich") is False:
                continue
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
