"""Serial polling and delivery; a failed transport never creates a stale backlog."""

import argparse
from dataclasses import dataclass, field
import logging
from pathlib import Path
import time

from .config import CollectorConfig, ConfigError, load_config
from .omp import apply_native_status
from .protocol import (
    ErrorReport, InventoryReport, PayloadError, Snapshot, SourceInfo,
    build_error, build_snapshot, encode_report,
)
from .transport import DeliveryError, post_report
from .tty7 import CollectorError, read_agents, read_inventory, read_source

_LOG = logging.getLogger("ha_tty7")


@dataclass
class DeliveryState:
    heartbeat_seconds: float
    poll_seconds: float
    last_report: bytes | None = field(default=None, repr=False)
    last_attempt: float | None = None
    failed: bool = False

    def due(self, report: bytes, now: float) -> bool:
        if self.last_attempt is None:
            return True
        elapsed = now - self.last_attempt
        if self.failed:
            return elapsed >= self.poll_seconds
        return report != self.last_report or elapsed >= self.heartbeat_seconds

    def attempted(self, report: bytes, now: float, *, success: bool) -> None:
        self.last_attempt = now
        self.failed = not success
        if success:
            self.last_report = report


@dataclass
class Sampler:
    """Cache optional observations, not fabricated new inventory observations."""

    config: CollectorConfig | None = field(default=None, repr=False)
    last_sample: float | None = None
    inventory: InventoryReport | None = field(default=None, repr=False)
    source: SourceInfo | None = field(default=None, repr=False)

    def sample(self, config: CollectorConfig, now: float) -> None:
        if self.config != config:
            self.config = config
            self.last_sample = None
            self.inventory = None
            self.source = None
        if self.last_sample is not None and now - self.last_sample < config.heartbeat_seconds:
            return
        self.last_sample = now
        if config.collect_inventory:
            try:
                self.inventory = read_inventory(config)
            except (CollectorError, PayloadError) as error:
                self.inventory = {
                    "kind": "error", "error_code": error.code,
                    "names_included": config.include_names,
                    "derived_labels_included": config.include_names and config.include_derived_labels,
                }
        if config.collect_source:
            self.source = read_source(config)


def collect_report(
    config: CollectorConfig, *, sampler: Sampler | None = None, now: float | None = None,
) -> Snapshot | ErrorReport:
    """Read a fresh roster, keeping optional failures scoped to their sections."""
    include_session_names = config.collect_inventory and config.include_names and config.include_derived_labels
    try:
        agents = apply_native_status(read_agents(config), include_session_names=include_session_names)
        if sampler is None:
            sampler = Sampler()
        sampler.sample(config, time.monotonic() if now is None else now)
        report = build_snapshot(config.host_id, agents,
                                inventory=sampler.inventory, source=sampler.source)
        # Size errors in optional inventory must not invalidate a healthy roster.
        try:
            encode_report(report)
        except PayloadError as error:
            if error.code != "payload_too_large" or "inventory" not in report:
                raise
            sampler.inventory = {
                "kind": "error", "error_code": error.code,
                "names_included": config.include_names,
                "derived_labels_included": config.include_names and config.include_derived_labels,
            }
            report = build_snapshot(config.host_id, agents,
                                    inventory=sampler.inventory, source=sampler.source)
            encode_report(report)
        return report
    except (CollectorError, PayloadError) as error:
        if not include_session_names:
            apply_native_status([], include_session_names=False)
        return build_error(config.host_id, error.code, inventory_privacy={
            "enabled": config.collect_inventory,
            "names_included": config.include_names,
            "derived_labels_included": config.include_derived_labels,
        })


def run(config: CollectorConfig, *, once: bool = False) -> int:
    state = DeliveryState(config.heartbeat_seconds, config.poll_seconds)
    sampler = Sampler()
    last_health: str | None = None
    try:
        while True:
            started = time.monotonic()
            report = collect_report(config, sampler=sampler)
            health = report.get("error_code", "snapshot")
            if health != last_health:
                _LOG.info("collector_state=%s", health)
                last_health = health
            body = encode_report(report)
            now = time.monotonic()
            delivered = False
            if state.due(body, now):
                try:
                    post_report(config, body)
                    delivered = True
                    if state.failed:
                        _LOG.info("delivery_recovered")
                except DeliveryError:
                    if not state.failed or once:
                        _LOG.warning("delivery_failed")
                state.attempted(body, time.monotonic(), success=delivered)
            if once:
                return 0 if delivered and report["kind"] == "snapshot" else 1
            time.sleep(max(0, config.poll_seconds - (time.monotonic() - started)))
    except KeyboardInterrupt:
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Push read-only tty7 agent status to Home Assistant")
    parser.add_argument("--config", type=Path, required=True, help="Private TOML configuration path")
    parser.add_argument("--once", action="store_true", help="Read and deliver once, exiting nonzero on failure")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        config = load_config(args.config)
    except ConfigError:
        _LOG.error("invalid_config")
        return 2
    return run(config, once=args.once)
