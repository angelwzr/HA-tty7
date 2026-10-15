"""Allowlisted tty7 normalization and bounded, deterministic wire reports.

Source data may contain private fields. Never serialize it directly. Outbound
reports are validated again at encoding because callers can mutate dictionaries.
"""

from __future__ import annotations

import json
import re
from typing import Literal, NotRequired, TypedDict, cast


Status = Literal["idle", "working", "waiting", "done", "unknown"]
OmpState = Literal["ready", "missing", "stale", "invalid", "conflict", "unsupported"]
ErrorCode = Literal[
    "cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"
]

MAX_AGENTS = 256
MAX_BODY_BYTES = 256 * 1024
FRESHNESS_SECONDS = 45
MAX_WORKSPACES = 64
MAX_TABS = 256
MAX_PANES = 512
MAX_SAFE_INTEGER = (1 << 53) - 1

_STATUSES = frozenset({"idle", "working", "waiting", "done", "unknown"})
_OMP_STATES = frozenset({"ready", "missing", "stale", "invalid", "conflict", "unsupported"})
_ERROR_CODES = frozenset({
    "cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"
})
_HOST_ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,63}")
_AGENT_FIELDS = frozenset({
    "pane_id", "session_id", "agent", "status", "activity", "turns",
    "model", "effort", "permission_mode",
})
_COMMON_FIELDS = frozenset({"schema_version", "host_id", "kind"})


class OmpStatus(TypedDict):
    state: OmpState
    run_id: str | None
    background_jobs: int | None


class AgentRecord(TypedDict):
    pane_id: int
    session_id: str | None
    agent: str
    status: Status
    activity: int | None
    turns: int | None
    model: str | None
    effort: str | None
    permission_mode: str | None
    inferred: NotRequired[bool]
    rich: NotRequired[bool]
    omp: NotRequired[OmpStatus]


class WorkspaceRecord(TypedDict):
    workspace_id: str
    name: str | None
    tab_count: int
    pane_count: int


class TabRecord(TypedDict):
    workspace_id: str
    tab_id: str
    ordinal: int | None
    name: str | None
    label: str | None
    detected_agent: str | None
    pane_ids: list[int]
    group_id: str | None
    group_name: str | None
    hibernated: bool


class PaneRecord(TypedDict):
    pane_id: int
    workspace_id: str | None
    tab_id: str | None
    live: bool | None
    hibernated: bool
    orphan: bool


class InventorySnapshot(TypedDict):
    kind: Literal["snapshot"]
    sample_id: str
    workspaces: list[WorkspaceRecord]
    tabs: list[TabRecord]
    panes: list[PaneRecord]
    consistent: bool
    names_included: bool
    derived_labels_included: bool


class InventoryError(TypedDict):
    kind: Literal["error"]
    error_code: ErrorCode
    names_included: NotRequired[bool]
    derived_labels_included: NotRequired[bool]


InventoryReport = InventorySnapshot | InventoryError


class SourceInfo(TypedDict):
    state: Literal["available", "unavailable"]
    collector_version: str
    tty7_build: str | None
    control_version: int | None
    protocol_version: int | None
    uptime_secs: int | None


class Snapshot(TypedDict):
    schema_version: Literal[1]
    host_id: str
    kind: Literal["snapshot"]
    agents: list[AgentRecord]
    inventory: NotRequired[InventoryReport]
    source: NotRequired[SourceInfo]


class InventoryPrivacy(TypedDict):
    enabled: bool
    names_included: bool
    derived_labels_included: bool


class ErrorReport(TypedDict):
    schema_version: Literal[1]
    host_id: str
    kind: Literal["error"]
    error_code: ErrorCode
    inventory_privacy: NotRequired[InventoryPrivacy]


class PayloadError(ValueError):
    """Fixed diagnostic code only; no input values appear in diagnostic text."""

    def __init__(self, code: ErrorCode = "invalid_payload") -> None:
        self.code = code
        super().__init__(code)


def _text(
    value: object, limit: int, *, nullable: bool = False, empty: bool = False,
    display: bool = False,
) -> str | None:
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not (0 if empty else 1) <= len(value) <= limit:
        raise PayloadError()
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise PayloadError() from None
    if display and any(ord(char) < 32 or 127 <= ord(char) <= 159 for char in value):
        raise PayloadError()
    return value


def _integer(value: object, *, nullable: bool = False, positive: bool = False) -> int | None:
    if value is None and nullable:
        return None
    if type(value) is not int or not (1 if positive else 0) <= value <= MAX_SAFE_INTEGER:
        raise PayloadError()
    return value


def _host_id(value: object) -> str:
    if not isinstance(value, str) or _HOST_ID.fullmatch(value) is None:
        raise PayloadError()
    return value


def _error_code(value: object) -> ErrorCode:
    if not isinstance(value, str) or value not in _ERROR_CODES:
        raise PayloadError()
    return cast(ErrorCode, value)


def _status(value: object, *, source: bool) -> Status:
    if value is None and source:
        return "unknown"
    if not isinstance(value, str):
        raise PayloadError()
    if value not in _STATUSES:
        if source:
            return "unknown"
        raise PayloadError()
    return cast(Status, value)


def _record_fields(
    pane_id: object, agent: object, state: dict, readout: dict, *, source: bool
) -> AgentRecord:
    record = AgentRecord(
        pane_id=cast(int, _integer(pane_id, positive=True)),
        agent=cast(str, _text(agent, 64)),
        session_id=_text(state.get("session_id"), 128, nullable=True),
        status=_status(state.get("status"), source=source),
        activity=_integer(state.get("activity"), nullable=True),
        turns=_integer(state.get("turns"), nullable=True),
        model=_text(readout.get("model"), 128, nullable=True),
        effort=_text(readout.get("effort"), 128, nullable=True, empty=True),
        permission_mode=_text(readout.get("permission_mode"), 128, nullable=True),
    )
    if "inferred" in state:
        if type(state["inferred"]) is not bool:
            raise PayloadError()
        if state["inferred"]:
            record["inferred"] = True
    if "rich" in state:
        record["rich"] = _boolean(state["rich"])
    return record


def _omp_status(value: object, record: AgentRecord) -> OmpStatus:
    data = _object(value, {"state", "run_id", "background_jobs"})
    state = data["state"]
    if not isinstance(state, str) or state not in _OMP_STATES:
        raise PayloadError()
    result = OmpStatus(
        state=cast(OmpState, state),
        run_id=_text(data["run_id"], 128, nullable=True),
        background_jobs=_integer(data["background_jobs"], nullable=True),
    )
    if (record["agent"] != "OhMyPi" or record["activity"] is not None
            or record["turns"] is not None or record.get("inferred", False)):
        raise PayloadError()
    if state == "ready":
        if (record.get("rich") is not True or record["session_id"] is None
                or result["background_jobs"] is None):
            raise PayloadError()
    elif (record["status"] != "unknown" or record["session_id"] is not None
            or record.get("rich") is not False or result["run_id"] is not None
            or result["background_jobs"] is not None):
        raise PayloadError()
    return result


def _roster(value: object, *, source: bool) -> list[AgentRecord]:
    if not isinstance(value, list):
        raise PayloadError()
    if len(value) > MAX_AGENTS:
        raise PayloadError("payload_too_large")
    agents: list[AgentRecord] = []
    panes: set[int] = set()
    for item in value:
        if not isinstance(item, dict):
            raise PayloadError()
        if source:
            state = item.get("state")
            if not isinstance(state, dict):
                raise PayloadError()
            readout = state.get("readout")
            if readout is None:
                readout = {}
            elif not isinstance(readout, dict):
                raise PayloadError()
        else:
            if item.keys() - {"inferred", "rich", "omp"} != _AGENT_FIELDS:
                raise PayloadError()
            state = readout = item
        record = _record_fields(item.get("pane_id"), item.get("agent"), state, readout, source=source)
        if not source and "omp" in item:
            record["omp"] = _omp_status(item["omp"], record)
        pane = record["pane_id"]
        if pane in panes:
            raise PayloadError()
        panes.add(pane)
        agents.append(record)
    agents.sort(key=lambda record: record["pane_id"])
    return agents


def normalize_agents(raw: object) -> list[AgentRecord]:
    """Read tty7's source shape and return new, explicitly allowlisted records."""
    if not isinstance(raw, dict):
        raise PayloadError()
    return _roster(raw.get("agents"), source=True)


def _boolean(value: object, *, nullable: bool = False) -> bool | None:
    if value is None and nullable:
        return None
    if type(value) is not bool:
        raise PayloadError()
    return value


def _object(value: object, fields: set[str]) -> dict:
    if not isinstance(value, dict) or value.keys() != fields:
        raise PayloadError()
    return value


def _display(value: object, *, nullable: bool = False, limit: int = 128) -> str | None:
    return _text(value, limit, nullable=nullable, empty=nullable, display=True)


def _records(value: object, limit: int) -> list:
    if not isinstance(value, list):
        raise PayloadError()
    if len(value) > limit:
        raise PayloadError("payload_too_large")
    return value


def validate_source(value: object) -> SourceInfo:
    """Reconstruct the exact safe status projection, never raw diagnostics."""
    row = _object(value, {"state", "collector_version", "tty7_build",
                          "control_version", "protocol_version", "uptime_secs"})
    if row["state"] not in ("available", "unavailable"):
        raise PayloadError()
    result = SourceInfo(
        state=row["state"], collector_version=cast(str, _display(row["collector_version"])),
        tty7_build=_display(row["tty7_build"], nullable=True),
        control_version=_integer(row["control_version"], nullable=True),
        protocol_version=_integer(row["protocol_version"], nullable=True),
        uptime_secs=_integer(row["uptime_secs"], nullable=True),
    )
    if result["state"] == "unavailable" and any(
        result[key] is not None for key in ("tty7_build", "control_version", "protocol_version", "uptime_secs")
    ):
        raise PayloadError()
    return result


def validate_inventory(value: object) -> InventoryReport:
    """Validate bounded structural records, including explicit privacy consent."""
    if isinstance(value, dict) and value.get("kind") == "error":
        fields = {"kind", "error_code"}
        privacy = {"names_included", "derived_labels_included"}
        if value.keys() != fields and value.keys() != fields | privacy:
            raise PayloadError()
        result_error = InventoryError(kind="error", error_code=_error_code(value["error_code"]))
        if privacy <= value.keys():
            names = cast(bool, _boolean(value["names_included"]))
            labels = cast(bool, _boolean(value["derived_labels_included"]))
            if labels and not names:
                raise PayloadError()
            result_error["names_included"] = names
            result_error["derived_labels_included"] = labels
        return result_error
    row = _object(value, {"kind", "sample_id", "workspaces", "tabs", "panes",
                          "consistent", "names_included", "derived_labels_included"})
    if row["kind"] != "snapshot":
        raise PayloadError()
    names = cast(bool, _boolean(row["names_included"]))
    labels = cast(bool, _boolean(row["derived_labels_included"]))
    if labels and not names:
        raise PayloadError()
    result = InventorySnapshot(
        kind="snapshot", sample_id=cast(str, _display(row["sample_id"])),
        consistent=cast(bool, _boolean(row["consistent"])), names_included=names,
        derived_labels_included=labels, workspaces=[], tabs=[], panes=[],
    )
    workspace_ids: set[str] = set()
    for item in _records(row["workspaces"], MAX_WORKSPACES):
        item = _object(item, {"workspace_id", "name", "tab_count", "pane_count"})
        workspace = WorkspaceRecord(
            workspace_id=cast(str, _display(item["workspace_id"])),
            name=_display(item["name"], nullable=True),
            tab_count=cast(int, _integer(item["tab_count"])),
            pane_count=cast(int, _integer(item["pane_count"])),
        )
        if workspace["workspace_id"] in workspace_ids or not names and workspace["name"] is not None:
            raise PayloadError()
        workspace_ids.add(workspace["workspace_id"])
        result["workspaces"].append(workspace)
    tab_ids: set[str] = set()
    for item in _records(row["tabs"], MAX_TABS):
        item = _object(item, {"workspace_id", "tab_id", "ordinal", "name", "label",
                              "detected_agent", "pane_ids", "group_id", "group_name", "hibernated"})
        pane_ids = [cast(int, _integer(pane, positive=True)) for pane in _records(item["pane_ids"], MAX_PANES)]
        tab = TabRecord(
            workspace_id=cast(str, _display(item["workspace_id"])),
            tab_id=cast(str, _display(item["tab_id"])),
            ordinal=_integer(item["ordinal"], nullable=True),
            name=_display(item["name"], nullable=True), label=_display(item["label"], nullable=True),
            detected_agent=_display(item["detected_agent"], nullable=True, limit=64),
            pane_ids=sorted(pane_ids), group_id=_display(item["group_id"], nullable=True),
            group_name=_display(item["group_name"], nullable=True),
            hibernated=cast(bool, _boolean(item["hibernated"])),
        )
        if (tab["tab_id"] in tab_ids or len(set(pane_ids)) != len(pane_ids)
                or not names and (tab["name"] is not None or tab["group_name"] is not None)
                or not labels and tab["label"] is not None):
            raise PayloadError()
        # Nullable IDs are still nonempty identities, not display strings.
        if tab["group_id"] == "":
            raise PayloadError()
        tab_ids.add(tab["tab_id"])
        result["tabs"].append(tab)
    pane_ids_seen: set[int] = set()
    for item in _records(row["panes"], MAX_PANES):
        item = _object(item, {"pane_id", "workspace_id", "tab_id", "live", "hibernated", "orphan"})
        pane = PaneRecord(
            pane_id=cast(int, _integer(item["pane_id"], positive=True)),
            workspace_id=_display(item["workspace_id"], nullable=True),
            tab_id=_display(item["tab_id"], nullable=True),
            live=_boolean(item["live"], nullable=True),
            hibernated=cast(bool, _boolean(item["hibernated"])),
            orphan=cast(bool, _boolean(item["orphan"])),
        )
        if pane["pane_id"] in pane_ids_seen or pane["workspace_id"] == "" or pane["tab_id"] == "":
            raise PayloadError()
        pane_ids_seen.add(pane["pane_id"])
        result["panes"].append(pane)
    result["workspaces"].sort(key=lambda item: item["workspace_id"])
    result["tabs"].sort(key=lambda item: (item["workspace_id"], item["tab_id"]))
    result["panes"].sort(key=lambda item: item["pane_id"])
    return result


def build_snapshot(
    host_id: str, agents: list[AgentRecord], *,
    inventory: InventoryReport | None = None, source: SourceInfo | None = None,
) -> Snapshot:
    """Validate complete allowlisted sections; omitted sections stay omitted."""
    report = Snapshot(schema_version=1, host_id=_host_id(host_id), kind="snapshot",
                      agents=_roster(agents, source=False))
    if inventory is not None:
        report["inventory"] = validate_inventory(inventory)
    if source is not None:
        report["source"] = validate_source(source)
    return report


def validate_inventory_privacy(value: object) -> InventoryPrivacy:
    """Validate consent independently of collection success or observation time."""
    row = _object(value, {"enabled", "names_included", "derived_labels_included"})
    policy = InventoryPrivacy(
        enabled=cast(bool, _boolean(row["enabled"])),
        names_included=cast(bool, _boolean(row["names_included"])),
        derived_labels_included=cast(bool, _boolean(row["derived_labels_included"])),
    )
    if (policy["names_included"] and not policy["enabled"]
            or policy["derived_labels_included"] and not policy["names_included"]):
        raise PayloadError()
    return policy


def build_error(
    host_id: str, code: ErrorCode, *, inventory_privacy: InventoryPrivacy | None = None,
) -> ErrorReport:
    """Distinguish failed reads while carrying optional immediate privacy policy."""
    report = ErrorReport(schema_version=1, host_id=_host_id(host_id), kind="error",
                         error_code=_error_code(code))
    if inventory_privacy is not None:
        report["inventory_privacy"] = validate_inventory_privacy(inventory_privacy)
    return report


def validate_report(report: object) -> Snapshot | ErrorReport:
    """Validate and reconstruct a strict wire envelope, without source fields."""
    if not isinstance(report, dict) or type(report.get("schema_version")) is not int:
        raise PayloadError()
    if report.get("schema_version") != 1:
        raise PayloadError()
    kind = report.get("kind")
    if (kind == "snapshot" and report.keys() - {"inventory", "source"} == _COMMON_FIELDS | {"agents"}):
        if ("inventory" in report and report["inventory"] is None
                or "source" in report and report["source"] is None):
            raise PayloadError()
        clean: Snapshot | ErrorReport = build_snapshot(
            report["host_id"], report["agents"],
            inventory=report.get("inventory"), source=report.get("source"))
    elif kind == "error" and report.keys() - {"inventory_privacy"} == _COMMON_FIELDS | {"error_code"}:
        if "inventory_privacy" in report and report["inventory_privacy"] is None:
            raise PayloadError()
        clean = build_error(report["host_id"], report["error_code"],
                            inventory_privacy=report.get("inventory_privacy"))
    else:
        raise PayloadError()
    return clean


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise PayloadError()
        result[key] = value
    return result


def decode_report(body: bytes, expected_host_id: str) -> Snapshot | ErrorReport:
    """Decode bounded UTF-8 JSON and bind it to a configured host, not a sender ID."""
    if not isinstance(body, bytes):
        raise PayloadError()
    if len(body) > MAX_BODY_BYTES:
        raise PayloadError("payload_too_large")
    expected = _host_id(expected_host_id)
    try:
        report = validate_report(json.loads(body.decode("utf-8"), object_pairs_hook=_unique_object))
    except PayloadError:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise PayloadError() from None
    if report["host_id"] != expected:
        raise PayloadError()
    return report


def encode_report(report: Snapshot | ErrorReport) -> bytes:
    """Revalidate before serialization and reject oversized bodies, not truncate."""
    clean = validate_report(report)
    body = json.dumps(clean, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")
    if len(body) > MAX_BODY_BYTES:
        raise PayloadError("payload_too_large")
    return body
