"""Allowlisted tty7 normalization and bounded, deterministic wire reports.

Source data may contain private fields. Never serialize it directly. Outbound
reports are validated again at encoding because callers can mutate dictionaries.
"""

from __future__ import annotations

import json
import re
from typing import Literal, NotRequired, TypedDict, cast


Status = Literal["idle", "working", "waiting", "done", "unknown"]
ErrorCode = Literal[
    "cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"
]

MAX_AGENTS = 256
MAX_BODY_BYTES = 64 * 1024
MAX_SAFE_INTEGER = (1 << 53) - 1

_STATUSES = frozenset({"idle", "working", "waiting", "done", "unknown"})
_ERROR_CODES = frozenset({
    "cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"
})
_HOST_ID = re.compile(r"[a-z0-9][a-z0-9_-]{0,63}")
_AGENT_FIELDS = frozenset({
    "pane_id", "session_id", "agent", "status", "activity", "turns",
    "model", "effort", "permission_mode",
})
_COMMON_FIELDS = frozenset({"schema_version", "host_id", "kind"})


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


class Snapshot(TypedDict):
    schema_version: Literal[1]
    host_id: str
    kind: Literal["snapshot"]
    agents: list[AgentRecord]


class ErrorReport(TypedDict):
    schema_version: Literal[1]
    host_id: str
    kind: Literal["error"]
    error_code: ErrorCode


class PayloadError(ValueError):
    """Fixed diagnostic code only; no input values appear in diagnostic text."""

    def __init__(self, code: ErrorCode = "invalid_payload") -> None:
        self.code = code
        super().__init__(code)


def _text(value: object, limit: int, *, nullable: bool = False) -> str | None:
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not 1 <= len(value) <= limit:
        raise PayloadError()
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise PayloadError() from None
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
        effort=_text(readout.get("effort"), 128, nullable=True),
        permission_mode=_text(readout.get("permission_mode"), 128, nullable=True),
    )
    if "inferred" in state:
        if type(state["inferred"]) is not bool:
            raise PayloadError()
        if state["inferred"]:
            record["inferred"] = True
    return record


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
            if item.keys() - {"inferred"} != _AGENT_FIELDS:
                raise PayloadError()
            state = readout = item
        record = _record_fields(item.get("pane_id"), item.get("agent"), state, readout, source=source)
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


def build_snapshot(host_id: str, agents: list[AgentRecord]) -> Snapshot:
    """Validate and copy a complete flat roster; never partially accept records."""
    return Snapshot(schema_version=1, host_id=_host_id(host_id), kind="snapshot",
                    agents=_roster(agents, source=False))


def build_error(host_id: str, code: ErrorCode) -> ErrorReport:
    """Distinguish read failures from successful empty rosters without free text."""
    return ErrorReport(schema_version=1, host_id=_host_id(host_id), kind="error",
                       error_code=_error_code(code))


def validate_report(report: object) -> Snapshot | ErrorReport:
    """Validate and reconstruct a strict wire envelope, without source fields."""
    if not isinstance(report, dict) or type(report.get("schema_version")) is not int:
        raise PayloadError()
    if report.get("schema_version") != 1:
        raise PayloadError()
    kind = report.get("kind")
    if kind == "snapshot" and report.keys() == _COMMON_FIELDS | {"agents"}:
        clean: Snapshot | ErrorReport = build_snapshot(report["host_id"], report["agents"])
    elif kind == "error" and report.keys() == _COMMON_FIELDS | {"error_code"}:
        clean = build_error(report["host_id"], report["error_code"])
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
