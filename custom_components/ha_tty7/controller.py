"""Pure receipt-time health, sanitized restoration and session transitions."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
import hashlib
import json
from typing import Any

from .protocol import (
    FRESHNESS_SECONDS, AgentRecord, ErrorReport, InventoryReport, PayloadError,
    Snapshot, SourceInfo, TabRecord, WorkspaceRecord, build_error, build_snapshot,
)
from .template import DEFAULT_MESSAGE_TEMPLATE, DEFAULT_TITLE_TEMPLATE, TEMPLATE_FIELDS, format_notification
STATUSES = ("idle", "working", "waiting", "done", "unknown")
MAX_NATIVE_PANES = 256
MAX_INPUT_IDENTITIES = 256


@dataclass
class _NativeRun:
    session: str
    run: str
    terminal: bool = False
    inputs: set[str] = field(default_factory=set)


def _authoritative(agent: AgentRecord | None) -> bool:
    """Recheck alert evidence even for callers bypassing the wire validator."""
    if agent is None:
        return False
    native = agent.get("omp")
    if (native is None or native.get("state") != "ready" or agent.get("rich") is not True
            or agent.get("inferred", False) or not agent.get("session_id")
            or agent.get("agent") != "OhMyPi" or agent.get("activity") is not None
            or agent.get("turns") is not None
            or agent["status"] not in ("idle", "working", "waiting", "done")):
        return False
    run, outcome, input_id = native.get("run_id"), native.get("outcome"), native.get("input_id")
    background = native.get("background_jobs")
    if (type(background) is not int or background < 0
            or (run is not None and (not isinstance(run, str) or not run))):
        return False
    if outcome is not None and (
        outcome not in ("completed", "failed", "cancelled") or agent["status"] != "done"
        or run is None or background != 0 or input_id is not None
    ):
        return False
    if input_id is not None:
        if (not isinstance(input_id, str) or not 1 <= len(input_id) <= 128
                or any(0xD800 <= ord(char) <= 0xDFFF for char in input_id)
                or agent["status"] != "waiting" or run is None or outcome is not None):
            return False
    return True


def _native_session_name(agent: AgentRecord) -> str | None:
    native = agent.get("omp")
    name = native.get("session_name") if native is not None else None
    if (not _authoritative(agent) or not isinstance(name, str) or not name.strip()
            or len(name) > 256 or any(ord(char) < 32 or 127 <= ord(char) <= 159
                                    or 0xD800 <= ord(char) <= 0xDFFF for char in name)):
        return None
    return name


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
        # One current main run per pane; retain consumed baselines through flaps.
        self._native_runs: dict[int, _NativeRun] = {}

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
        attributes["agents"] = self._private_name_projection(self.agents, retain_names=retain_inventory)
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
        self.agents = self._private_name_projection(agents, retain_names=False)
        for agent in agents:
            if "omp" in agent:
                self._native_transition(agent, None, False)
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
            self.agents = self._private_name_projection(agents)

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
        names_revoked = names_included is False
        labels_revoked = names_revoked or derived_labels_included is False
        if labels_revoked:
            self.agents = self._private_name_projection(self.agents, retain_names=False)
        if self.inventory is None or self.inventory["kind"] != "snapshot":
            return
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
        if report is not None and report["kind"] == "snapshot":
            self._revoke_inventory_fields(names_included=report["names_included"],
                                          derived_labels_included=report["derived_labels_included"])
        if report is None:
            self.agents = self._private_name_projection(self.agents, retain_names=False)
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

    def _name_membership(self, agent: AgentRecord) -> tuple[TabRecord, WorkspaceRecord] | None:
        """Share the same approved unique join for naming and private storage."""
        inventory = self.inventory
        if (inventory is None or inventory["kind"] != "snapshot"
                or not inventory["consistent"] or not inventory["names_included"]):
            return None
        pane_id = agent["pane_id"]
        panes = [pane for pane in inventory["panes"] if pane["pane_id"] == pane_id]
        tabs = [tab for tab in inventory["tabs"] if pane_id in tab["pane_ids"]]
        if len(panes) != 1 or len(tabs) != 1:
            return None
        pane, tab = panes[0], tabs[0]
        if (pane["orphan"] or pane["workspace_id"] != tab["workspace_id"]
                or pane["tab_id"] != tab["tab_id"]):
            return None
        workspaces = [workspace for workspace in inventory["workspaces"]
                      if workspace["workspace_id"] == tab["workspace_id"]]
        if len(workspaces) != 1:
            return None
        return tab, workspaces[0]

    def _private_name_projection(
        self, agents: list[AgentRecord], *, retain_names: bool = True,
    ) -> list[AgentRecord]:
        """Copy only private fields being scrubbed; never mutate live or stored inputs."""
        return [
            {**agent, "omp": {**agent["omp"], "session_name": None}}
            if agent.get("omp", {}).get("session_name") is not None and not (
                retain_names and self._name_membership(agent) is not None
                and self.inventory["derived_labels_included"] and _native_session_name(agent) is not None
            ) else agent
            for agent in agents
        ]

    def _notification_names(self, agent: AgentRecord) -> dict[str, str | None]:
        """Use names only from a fresh approved, mutually agreeing unique join."""
        if self.inventory_state != "healthy" or (membership := self._name_membership(agent)) is None:
            return {}
        tab, workspace = membership
        derived = self.inventory["derived_labels_included"]
        label = tab["label"] if derived else None
        native_name = _native_session_name(agent) if derived else None
        session_name = next((name for name in (tab["name"], native_name, label)
                             if name and name.strip()), "Unnamed session")
        return {"tab_name": tab["name"], "workspace_name": workspace["name"],
                "session_name": session_name}

    def _native_transition(
        self, agent: AgentRecord, previous: AgentRecord | None, was_ready: bool,
    ) -> str | None:
        """Consume terminal/input baselines, including suppressed recovery reports."""
        if not _authoritative(agent):
            return None
        native = agent["omp"]
        pane, session, run = agent["pane_id"], agent["session_id"], native["run_id"]
        if run is None:
            return None
        marker = self._native_runs.get(pane)
        if marker is None or (marker.session, marker.run) != (session, run):
            marker = _NativeRun(session, run)
        prior_native = previous.get("omp") if previous is not None else None
        same_run = (_authoritative(previous) and previous["session_id"] == session
                    and prior_native["run_id"] == run)
        kind = None
        input_id, outcome = native.get("input_id"), native.get("outcome")
        if was_ready and same_run and not marker.terminal:
            if (input_id is not None and input_id not in marker.inputs
                    and len(marker.inputs) < MAX_INPUT_IDENTITIES):
                kind = "needs_input"
            elif outcome in ("completed", "failed") and previous["status"] in ("working", "waiting"):
                kind = outcome
        if input_id is not None and len(marker.inputs) < MAX_INPUT_IDENTITIES:
            marker.inputs.add(input_id)
        # Fail closed once the bounded input history fills; never evict identities
        # and accidentally replay an old question within this main run.
        marker.terminal |= agent["status"] == "done"
        self._native_runs.pop(pane, None)
        self._native_runs[pane] = marker
        return kind

    def accept(self, report: Snapshot | ErrorReport, now: datetime) -> list[dict[str, Any]]:
        """Consume a shared-protocol-validated, host-bound report."""
        self.expire(now)
        was_ready = self.online
        previous_agents = {agent["pane_id"]: agent for agent in self.agents}
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
        self.agents = self._private_name_projection(report["agents"])
        self.collector_ok = self.baseline_ready = True
        self.error_code = None
        self.last_success = now
        self._state = len(self.agents)
        current_native = {agent["pane_id"] for agent in self.agents if "omp" in agent}
        absent = [pane for pane in self._native_runs if pane not in current_native]
        spare = max(0, MAX_NATIVE_PANES - len(current_native))
        for pane in absent[:max(0, len(absent) - spare)]:
            del self._native_runs[pane]
        for agent in self.agents:
            if "omp" in agent:
                kind = self._native_transition(agent, previous_agents.get(agent["pane_id"]), was_ready)
                if kind is not None:
                    events.append(dict(agent, kind=kind, **self._notification_names(agent)))
        return events


def notification_payload(
    host_id: str, label: str, event: dict[str, Any], dashboard: str, *, mobile: bool,
    title_template: str = DEFAULT_TITLE_TEMPLATE, message_template: str = DEFAULT_MESSAGE_TEMPLATE,
) -> dict[str, Any]:
    """Encode untrusted text for its exact sink; identity does not reveal sessions."""
    identity = json.dumps([event["session_id"], event["pane_id"]], ensure_ascii=False, separators=(",", ":"))
    tag = f"ha_tty7_{host_id}_" + hashlib.sha256(identity.encode()).hexdigest()
    kind = event["kind"]
    action = "needs input" if kind == "needs_input" else kind
    values = {key: "" if event.get(key) is None else str(event[key]) for key in TEMPLATE_FIELDS}
    values.update(host_id=host_id, host_label=label, event=action, event_type=kind,
                  session_name=event.get("session_name") or "Unnamed session",
                  event_message={"completed": "Finished.", "needs_input": "Needs your input.",
                                 "failed": "Failed."}[kind])
    if event.get("effort") == "":
        values["effort"] = "None"
    title = format_notification(title_template, values, sink="plain")
    message = format_notification(message_template, values, sink="html" if mobile else "markdown")
    if mobile:
        return {"title": title, "message": message,
                "data": {"tag": tag, "clickAction": dashboard}}
    return {"title": title, "message": f"{message} [Open agent dashboard]({dashboard})", "notification_id": tag}
