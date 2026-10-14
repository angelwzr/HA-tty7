"""Serial polling and delivery; a failed transport never creates a stale backlog."""

import argparse
from dataclasses import dataclass, field
import logging
from pathlib import Path
import time

from .config import CollectorConfig, ConfigError, load_config
from .protocol import ErrorReport, PayloadError, Snapshot, build_error, build_snapshot, encode_report
from .transport import DeliveryError, post_report
from .tty7 import CollectorError, read_agents

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


def collect_report(config: CollectorConfig) -> Snapshot | ErrorReport:
    """Return a complete fresh snapshot, or a fixed failure without a roster."""
    try:
        report = build_snapshot(config.host_id, read_agents(config))
        # Check encoded size here so oversize becomes a deliverable error report.
        encode_report(report)
        return report
    except (CollectorError, PayloadError) as error:
        return build_error(config.host_id, error.code)


def run(config: CollectorConfig, *, once: bool = False) -> int:
    state = DeliveryState(config.heartbeat_seconds, config.poll_seconds)
    last_health: str | None = None
    try:
        while True:
            started = time.monotonic()
            report = collect_report(config)
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
