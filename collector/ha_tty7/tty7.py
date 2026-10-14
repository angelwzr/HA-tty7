"""Read only the agent roster, with a bounded pipe and a hard process deadline."""

import json
import os
import selectors
import subprocess
import time

from .config import CollectorConfig
from .protocol import AgentRecord, ErrorCode, PayloadError, normalize_agents

CLI_TIMEOUT_SECONDS = 3
MAX_STDOUT_BYTES = 1024 * 1024


class CollectorError(RuntimeError):
    def __init__(self, code: ErrorCode) -> None:
        self.code = code
        super().__init__(code)


def read_agents(config: CollectorConfig) -> list[AgentRecord]:
    environment = os.environ.copy()
    if config.tty7_config_dir is not None:
        environment["TTY7_CONFIG_DIR"] = str(config.tty7_config_dir)
    try:
        process = subprocess.Popen([str(config.tty7_path), "--json", "agents"],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            env=environment, bufsize=0)
    except OSError:
        raise CollectorError("cli_unavailable") from None
    output = bytearray()
    deadline = time.monotonic() + CLI_TIMEOUT_SECONDS
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
            return normalize_agents(json.loads(output))
        except PayloadError as error:
            raise CollectorError(error.code) from None
        except (ValueError, UnicodeError, RecursionError):
            raise CollectorError("invalid_payload") from None
    except OSError:
        raise CollectorError("cli_failed") from None
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
        if process.stdout is not None:
            process.stdout.close()
