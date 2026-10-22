"""Read private, bounded OMP main-reporter metadata without trusting tty7 state."""

from __future__ import annotations

from dataclasses import dataclass
import fcntl
import json
import os
from pathlib import Path
import stat
import time
from typing import cast
from uuid import UUID

from .protocol import AgentRecord, MAX_AGENTS, MAX_SAFE_INTEGER, OmpOutcome, OmpState, OmpStatus, Status

_MAX_RECORD_BYTES = 4096
_MAX_DIRECTORY_ENTRIES = 1024
_FRESH_MS = 10_000
_PRUNE_MS = 60_000
_REQUIRED_FIELDS = frozenset({
    "schema_version", "reporter_id", "pane_id", "session_id", "updated_at_ms",
    "status", "run_id", "background_jobs", "health",
})
_FIELDS = _REQUIRED_FIELDS | {"model", "effort", "outcome", "input_id"}
_STATUSES = frozenset({"idle", "working", "waiting", "done", "unknown"})
_DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
_FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC


@dataclass(frozen=True)
class _NativeRecord:
    pane_id: int
    session_id: str
    updated_at_ms: int
    status: Status
    run_id: str | None
    background_jobs: int
    health: str
    model: str | None
    effort: str | None
    outcome: OmpOutcome | None
    input_id: str | None


def _integer(value: object, *, positive: bool = False) -> int:
    if type(value) is not int or not (1 if positive else 0) <= value <= MAX_SAFE_INTEGER:
        raise ValueError("invalid native record")
    return value


def _identifier(value: object) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= 128:
        raise ValueError("invalid native record")
    value.encode("utf-8")
    return value


def _metadata(value: object) -> str | None:
    if value is None:
        return None
    text = _identifier(value)
    if not text.strip():
        raise ValueError("invalid native record")
    return text


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result: dict = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("invalid native record")
        result[key] = value
    return result


def _parse(body: bytes, reporter_id: str) -> _NativeRecord:
    data = json.loads(body.decode("utf-8"), object_pairs_hook=_unique_object)
    if (not isinstance(data, dict) or not _REQUIRED_FIELDS <= data.keys() <= _FIELDS
            or type(data["schema_version"]) is not int or data["schema_version"] != 1
            or data["reporter_id"] != reporter_id):
        raise ValueError("invalid native record")
    status = data["status"]
    health = data["health"]
    if (not isinstance(status, str) or status not in _STATUSES
            or not isinstance(health, str) or health not in {"ready", "unsupported"}):
        raise ValueError("invalid native record")
    run_id = None if data["run_id"] is None else _identifier(data["run_id"])
    background_jobs = _integer(data["background_jobs"])
    outcome = data.get("outcome")
    input_id = None if data.get("input_id") is None else _identifier(data["input_id"])
    if outcome is not None and (
            not isinstance(outcome, str) or outcome not in {"completed", "failed", "cancelled"}
            or health != "ready" or status != "done" or run_id is None
            or background_jobs != 0 or input_id is not None):
        raise ValueError("invalid native record")
    if input_id is not None and (health != "ready" or status != "waiting" or run_id is None):
        raise ValueError("invalid native record")
    return _NativeRecord(
        pane_id=_integer(data["pane_id"], positive=True),
        session_id=_identifier(data["session_id"]),
        updated_at_ms=_integer(data["updated_at_ms"]),
        status=cast(Status, status),
        run_id=run_id,
        background_jobs=background_jobs,
        health=health,
        model=_metadata(data.get("model")),
        effort=_metadata(data.get("effort")),
        outcome=cast(OmpOutcome | None, outcome),
        input_id=input_id,
    )


def _open_directory(directory: Path) -> int:
    """Pin the real directory and refuse symlinks in every path component."""
    parts = directory.absolute().parts
    fd = os.open(parts[0], _DIRECTORY_FLAGS)
    try:
        for component in parts[1:]:
            child = os.open(component, _DIRECTORY_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError("invalid native directory")
        return fd
    except BaseException:
        os.close(fd)
        raise


def _safe_record(info: os.stat_result) -> bool:
    return (stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid()
            and stat.S_IMODE(info.st_mode) == 0o600 and info.st_size <= _MAX_RECORD_BYTES)


def _read_record(fd: int, name: str) -> tuple[_NativeRecord, os.stat_result]:
    reporter = name[:-5]
    if str(UUID(reporter)) != reporter:
        raise ValueError("invalid native filename")
    file_fd = os.open(name, _FILE_FLAGS, dir_fd=fd)
    try:
        info = os.fstat(file_fd)
        if not _safe_record(info):
            raise ValueError("invalid native file")
        with os.fdopen(file_fd, "rb", closefd=False) as stream:
            body = stream.read(_MAX_RECORD_BYTES + 1)
        if len(body) > _MAX_RECORD_BYTES:
            raise ValueError("invalid native file")
        return _parse(body, reporter), info
    finally:
        os.close(file_fd)


def _prune(
    fd: int, name: str, original: os.stat_result, *, now_ms: int | None = None,
) -> None:
    """Revalidate and prune under the persistent publication lock, never waiting."""
    try:
        lock_fd = os.open(
            ".publish.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC,
            0o600, dir_fd=fd,
        )
    except OSError:
        return
    try:
        lock_info = os.fstat(lock_fd)
        if (not stat.S_ISREG(lock_info.st_mode) or lock_info.st_uid != os.getuid()
                or stat.S_IMODE(lock_info.st_mode) != 0o600 or lock_info.st_nlink != 1):
            return
        # Reporters hold this same inode shared during publication/shutdown.
        # Closing this descriptor releases our exclusive flock, including errors.
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        record, current = _read_record(fd, name)
        observed_ms = int(time.time() * 1000) if now_ms is None else now_ms
        if (observed_ms - record.updated_at_ms >= _PRUNE_MS
                and (current.st_dev, current.st_ino, current.st_mtime_ns, current.st_size)
                == (original.st_dev, original.st_ino, original.st_mtime_ns, original.st_size)):
            os.unlink(name, dir_fd=fd)
    except (OSError, ValueError, UnicodeError, RecursionError):
        # Contention, an unsafe lock, or a changed candidate only skips cleanup.
        pass
    finally:
        os.close(lock_fd)


def _load(directory: Path, now_ms: int | None) -> tuple[OmpState, dict[int, list[_NativeRecord]], set[int]]:
    try:
        fd = _open_directory(directory)
    except FileNotFoundError:
        return "missing", {}, set()
    except (OSError, ValueError):
        return "invalid", {}, set()
    fresh: dict[int, list[_NativeRecord]] = {}
    stale: set[int] = set()
    invalid = False
    count = 0
    try:
        with os.scandir(fd) as entries:
            for index, entry in enumerate(entries):
                if index >= _MAX_DIRECTORY_ENTRIES:
                    invalid = True
                    break
                # Atomic reporter temporary files are not published records.
                if not entry.name.endswith(".json"):
                    continue
                try:
                    record, info = _read_record(fd, entry.name)
                    observed_ms = int(time.time() * 1000) if now_ms is None else now_ms
                    age = observed_ms - record.updated_at_ms
                    if age < 0:
                        raise ValueError("invalid native timestamp")
                    if age > _FRESH_MS:
                        stale.add(record.pane_id)
                        if age >= _PRUNE_MS:
                            _prune(fd, entry.name, info, now_ms=now_ms)
                        continue
                    count += 1
                    if count > MAX_AGENTS:
                        invalid = True
                        break
                    fresh.setdefault(record.pane_id, []).append(record)
                except FileNotFoundError:
                    # A reporter may atomically replace or remove a record during a poll.
                    continue
                except (OSError, ValueError, UnicodeError, RecursionError):
                    invalid = True
    except OSError:
        invalid = True
    finally:
        os.close(fd)
    if invalid:
        return "invalid", {}, set()
    return "missing", fresh, stale


def _overlay(row: AgentRecord, state: OmpState, native: _NativeRecord | None) -> AgentRecord:
    result = row.copy()
    # Stock sessions/status/counters/metadata can belong to a child, never a fallback.
    result.pop("inferred", None)
    result.update(session_id=None, status="unknown", activity=None, turns=None,
                  model=None, effort=None, rich=False)
    result["omp"] = OmpStatus(state=state, run_id=None, background_jobs=None,
                              outcome=None, input_id=None)
    if state == "ready" and native is not None:
        result.update(session_id=native.session_id, status=native.status,
                      model=native.model, effort=native.effort, rich=True)
        result["omp"] = OmpStatus(state="ready", run_id=native.run_id,
                                  background_jobs=native.background_jobs,
                                  outcome=native.outcome, input_id=native.input_id)
    return result


def apply_native_status(
    agents: list[AgentRecord], *, directory: Path | None = None, now_ms: int | None = None,
) -> list[AgentRecord]:
    """Overlay every OMP pane each poll; no opt-in or stock-state fallback.

    Exact native main-report pane IDs may join the stock roster. Tab representative
    detections are deliberately not ownership evidence, even for split panes.
    """
    if directory is None:
        directory = Path.home() / ".local" / "share" / "ha-tty7" / "omp-status"
    default, fresh, stale = _load(directory, now_ms)
    stock_panes = {row["pane_id"] for row in agents}
    rows = list(agents)
    for pane in sorted(fresh.keys() - stock_panes):
        rows.append(AgentRecord(pane_id=pane, agent="OhMyPi", session_id=None, status="unknown",
                                activity=None, turns=None, model=None, effort=None, permission_mode=None))
    result: list[AgentRecord] = []
    for row in rows:
        if row["agent"] != "OhMyPi":
            result.append(row)
            continue
        candidates = fresh.get(row["pane_id"], [])
        native = candidates[0] if len(candidates) == 1 else None
        if len(candidates) > 1:
            state: OmpState = "conflict"
        elif native is not None:
            state = "ready" if native.health == "ready" else "unsupported"
        else:
            state = "stale" if row["pane_id"] in stale else default
        result.append(_overlay(row, state, native))
    result.sort(key=lambda row: row["pane_id"])
    return result
