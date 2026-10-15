"""Bounded official stock CLI readers; never publish a raw source response."""

import json
import os
import selectors
import subprocess
import time
import uuid
from importlib.metadata import version

from .config import CollectorConfig
from .protocol import (
    AgentRecord, ErrorCode, InventorySnapshot, MAX_PANES, MAX_SAFE_INTEGER,
    MAX_TABS, MAX_WORKSPACES, PaneRecord, PayloadError, SourceInfo, TabRecord,
    WorkspaceRecord, normalize_agents, validate_inventory, validate_source,
)

CLI_TIMEOUT_SECONDS = 3
MAX_STDOUT_BYTES = 1024 * 1024


class CollectorError(RuntimeError):
    def __init__(self, code: ErrorCode) -> None:
        self.code = code
        super().__init__(code)


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise CollectorError("invalid_payload")
        result[key] = value
    return result


def read_json_cli(config: CollectorConfig, arguments: tuple[str, ...], *, deadline: float | None = None) -> dict:
    """Bound output and the complete process lifetime, optionally sharing a deadline."""
    if deadline is None:
        deadline = time.monotonic() + CLI_TIMEOUT_SECONDS
    if time.monotonic() >= deadline:
        raise CollectorError("cli_timeout")
    environment = os.environ.copy()
    if config.tty7_config_dir is not None:
        environment["TTY7_CONFIG_DIR"] = str(config.tty7_config_dir)
    try:
        process = subprocess.Popen([str(config.tty7_path), "--json", *arguments],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            env=environment, bufsize=0)
    except OSError:
        raise CollectorError("cli_unavailable") from None
    output = bytearray()
    try:
        assert process.stdout is not None
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise CollectorError("cli_timeout")
                for key, _ in selector.select(remaining):
                    chunk = os.read(key.fd, min(65536, MAX_STDOUT_BYTES + 1 - len(output)))
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    output.extend(chunk)
                    if len(output) > MAX_STDOUT_BYTES:
                        raise CollectorError("payload_too_large")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise CollectorError("cli_timeout")
        try:
            exit_code = process.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            raise CollectorError("cli_timeout") from None
        if exit_code:
            raise CollectorError("cli_failed")
        try:
            result = json.loads(output, object_pairs_hook=_unique_object)
        except (ValueError, UnicodeError, RecursionError):
            raise CollectorError("invalid_payload") from None
        if not isinstance(result, dict):
            raise CollectorError("invalid_payload")
        return result
    except OSError:
        raise CollectorError("cli_failed") from None
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
        if process.stdout is not None:
            process.stdout.close()


def read_agents(config: CollectorConfig) -> list[AgentRecord]:
    try:
        return normalize_agents(read_json_cli(config, ("agents",)))
    except PayloadError as error:
        raise CollectorError(error.code) from None


def read_source(config: CollectorConfig) -> SourceInfo:
    """Version comes from installed distribution metadata, never a hardcoded label."""
    collector_version = version("ha-tty7")
    unavailable = SourceInfo(state="unavailable", collector_version=collector_version,
        tty7_build=None, control_version=None, protocol_version=None, uptime_secs=None)
    try:
        raw = read_json_cli(config, ("status",))
        return validate_source(SourceInfo(state="available", collector_version=collector_version,
            tty7_build=raw.get("build"), control_version=raw.get("control_version"),
            protocol_version=raw.get("protocol_version"), uptime_secs=raw.get("uptime_secs")))
    except (CollectorError, PayloadError):
        return unavailable


def _rows(raw: dict, key: str, limit: int) -> list[dict]:
    value = raw.get(key)
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise CollectorError("invalid_payload")
    if len(value) > limit:
        raise CollectorError("payload_too_large")
    return value


def _identifier(value: object, *, nullable: bool = False) -> str | None:
    if value is None and nullable:
        return None
    if (not isinstance(value, str) or not 1 <= len(value) <= 128
            or any(ord(char) < 32 or 127 <= ord(char) <= 159 for char in value)):
        raise CollectorError("invalid_payload")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise CollectorError("invalid_payload") from None
    return value


def _pane_id(value: object) -> int:
    if type(value) is not int or not 1 <= value <= MAX_SAFE_INTEGER:
        raise CollectorError("invalid_payload")
    return value


def _flag(value: object, *, nullable: bool = False) -> bool | None:
    if value is None and nullable:
        return None
    if type(value) is not bool:
        raise CollectorError("invalid_payload")
    return value


def _index(rows: list[dict]) -> dict[int, dict]:
    result: dict[int, dict] = {}
    for row in rows:
        pane_id = _pane_id(row.get("pane"))
        if pane_id in result:
            raise CollectorError("invalid_payload")
        result[pane_id] = row
    return result


def read_inventory(config: CollectorConfig) -> InventorySnapshot:
    """Project four stock relations under one deadline, retaining uncertain joins."""
    deadline = time.monotonic() + CLI_TIMEOUT_SECONDS
    workspaces: list[WorkspaceRecord] = []
    tabs: list[TabRecord] = []
    memberships: dict[int, list[TabRecord]] = {}
    workspace_ids: set[str] = set()
    consistent = True
    for row in _rows(read_json_cli(config, ("ws", "ls"), deadline=deadline), "workspaces", MAX_WORKSPACES):
        workspace_id = _identifier(row.get("id"))
        if workspace_id in workspace_ids or workspace_id.startswith("-"):
            raise CollectorError("invalid_payload")
        workspace_ids.add(workspace_id)
        workspaces.append(WorkspaceRecord(workspace_id=workspace_id,
            name=row.get("name") if config.include_names else None,
            tab_count=row.get("tabs"), pane_count=row.get("panes")))
        raw = read_json_cli(config, ("tab", "ls", workspace_id), deadline=deadline)
        if _identifier(raw.get("workspace")) != workspace_id:
            consistent = False
        for item in _rows(raw, "tabs", MAX_TABS):
            if len(tabs) >= MAX_TABS:
                raise CollectorError("payload_too_large")
            group = item.get("group")
            if group is not None and not isinstance(group, dict):
                raise CollectorError("invalid_payload")
            pane_ids = item.get("panes")
            if not isinstance(pane_ids, list):
                raise CollectorError("invalid_payload")
            if len(pane_ids) > MAX_PANES:
                raise CollectorError("payload_too_large")
            tab = TabRecord(workspace_id=_identifier(raw.get("workspace")),
                tab_id=_identifier(item.get("id")), ordinal=item.get("ordinal"),
                name=item.get("name") if config.include_names else None,
                label=item.get("label") if config.include_names and config.include_derived_labels else None,
                detected_agent=item.get("agent"), pane_ids=[_pane_id(pane) for pane in pane_ids],
                group_id=_identifier(group.get("id")) if group is not None else None,
                group_name=group.get("name") if group is not None and config.include_names else None,
                hibernated=_flag(item.get("hibernated")))
            tabs.append(tab)
            for pane in tab["pane_ids"]:
                memberships.setdefault(pane, []).append(tab)
    tree = _index(_rows(read_json_cli(config, ("pane", "ls"), deadline=deadline), "panes", MAX_PANES))
    raw_registry = read_json_cli(config, ("pane", "ls", "--all"), deadline=deadline)
    registry = _index(_rows(raw_registry, "panes", MAX_PANES))
    all_ids = set(tree) | set(registry) | set(memberships)
    if len(all_ids) > MAX_PANES:
        raise CollectorError("payload_too_large")
    panes: list[PaneRecord] = []
    for pane_id in sorted(all_ids):
        tree_row = tree.get(pane_id)
        registry_row = registry.get(pane_id)
        holders = memberships.get(pane_id, [])
        orphan = _flag(registry_row.get("orphan")) if registry_row is not None else False
        live = _flag(registry_row.get("live")) if registry_row is not None else (
            _flag(tree_row.get("live"), nullable=True) if tree_row is not None else None)
        workspace_id = tab_id = None
        hibernated = _flag(tree_row.get("hibernated")) if tree_row is not None else False
        if len(holders) == 1 and tree_row is not None and not orphan:
            holder = holders[0]
            tree_workspace = _identifier(tree_row.get("workspace"))
            tree_tab = _identifier(tree_row.get("tab"))
            tree_hibernated = _flag(tree_row.get("hibernated"))
            registry_workspace = _identifier(registry_row.get("workspace"), nullable=True) if registry_row else None
            if (tree_workspace == holder["workspace_id"] and tree_tab == holder["tab_id"]
                    and tree_workspace in workspace_ids and tree_hibernated == holder["hibernated"]
                    and (registry_row is None or registry_workspace == tree_workspace)):
                workspace_id, tab_id = tree_workspace, tree_tab
                hibernated = tree_hibernated
            else:
                consistent = False
        elif orphan and not holders and tree_row is None:
            if registry_row.get("workspace") is not None:
                consistent = False
        else:
            consistent = False
        if registry_row is None:
            consistent = False
        if tree_row is not None and registry_row is not None:
            if _flag(tree_row.get("live"), nullable=True) != live:
                consistent = False
        panes.append(PaneRecord(pane_id=pane_id, workspace_id=workspace_id, tab_id=tab_id,
            live=live, hibernated=hibernated, orphan=orphan))
    for workspace in workspaces:
        held_tabs = [tab for tab in tabs if tab["workspace_id"] == workspace["workspace_id"]]
        if (workspace["tab_count"] != len(held_tabs)
                or workspace["pane_count"] != sum(len(tab["pane_ids"]) for tab in held_tabs)):
            consistent = False
    if (type(raw_registry.get("orphans")) is not int
            or raw_registry["orphans"] != sum(pane["orphan"] for pane in panes)):
        consistent = False
    if time.monotonic() >= deadline:
        raise CollectorError("cli_timeout")
    try:
        result = validate_inventory(InventorySnapshot(kind="snapshot", sample_id=uuid.uuid4().hex,
            workspaces=workspaces, tabs=tabs, panes=panes, consistent=consistent,
            names_included=config.include_names,
            derived_labels_included=config.include_names and config.include_derived_labels))
    except PayloadError as error:
        raise CollectorError(error.code) from None
    assert result["kind"] == "snapshot"
    return result
