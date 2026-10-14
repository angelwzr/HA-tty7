"""Private, bounded configuration; diagnostics never contain credential values."""

from dataclasses import dataclass, field
import math
import os
from pathlib import Path
import re
import stat
import tomllib
from urllib.parse import urlsplit

from .protocol import PayloadError, build_error


class ConfigError(ValueError):
    def __init__(self) -> None:
        super().__init__("invalid_config")


@dataclass(frozen=True)
class CollectorConfig:
    host_id: str
    tty7_path: Path
    webhook_url: str = field(repr=False)
    tty7_config_dir: Path | None = None
    ca_file: Path | None = None
    poll_seconds: float = 2
    heartbeat_seconds: float = 15


def _private_text(path: Path, limit: int) -> str:
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ConfigError()
        if info.st_size > limit:
            raise ConfigError()
        with os.fdopen(fd, "rb", closefd=False) as stream:
            content = stream.read(limit + 1)
        if len(content) > limit:
            raise ConfigError()
        return content.decode("utf-8")
    finally:
        os.close(fd)


def _path(value: object, base: Path) -> Path:
    if not isinstance(value, str) or not value or "\x00" in value:
        raise ConfigError()
    path = Path(value).expanduser()
    return path if path.is_absolute() else base / path


def _interval(value: object) -> float:
    if type(value) not in (int, float) or not math.isfinite(value) or not 0.1 <= value <= 3600:
        raise ConfigError()
    return float(value)


def _url(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment
            or re.fullmatch(r"/api/webhook/[A-Za-z0-9_-]+", parsed.path) is None
            or any(character.isspace() for character in value)):
        raise ConfigError()
    # Accessing port validates malformed values without retaining the URL in errors.
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ConfigError()
    return value


def load_config(path: Path) -> CollectorConfig:
    """Load a private TOML file and a separate private HTTPS URL secret file."""
    try:
        path = Path(path).expanduser().absolute()
        raw = tomllib.loads(_private_text(path, 64 * 1024))
        allowed = {"host_id", "tty7_path", "webhook_url_file", "tty7_config_dir",
                   "ca_file", "poll_seconds", "heartbeat_seconds"}
        if raw.keys() - allowed or not {"host_id", "tty7_path", "webhook_url_file"} <= raw.keys():
            raise ConfigError()
        host_id = raw["host_id"]
        build_error(host_id, "invalid_payload")
        tty7_path = _path(raw["tty7_path"], path.parent)
        if not Path(raw["tty7_path"]).expanduser().is_absolute():
            raise ConfigError()
        url_file = _path(raw["webhook_url_file"], path.parent)
        webhook_url = _url(_private_text(url_file, 4096).strip())
        config_dir = _path(raw["tty7_config_dir"], path.parent) if "tty7_config_dir" in raw else None
        ca_file = _path(raw["ca_file"], path.parent) if "ca_file" in raw else None
        poll = _interval(raw.get("poll_seconds", 2))
        heartbeat = _interval(raw.get("heartbeat_seconds", 15))
        if heartbeat < poll:
            raise ConfigError()
        if ca_file is not None and not ca_file.is_file():
            raise ConfigError()
        return CollectorConfig(host_id, tty7_path, webhook_url, config_dir, ca_file, poll, heartbeat)
    except (OSError, ValueError, TypeError, PayloadError, OverflowError):
        raise ConfigError() from None
