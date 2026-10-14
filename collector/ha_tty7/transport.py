"""Verified HTTPS delivery. Do not follow redirects or retain secret diagnostics."""

import json
import ssl
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

from .config import CollectorConfig
from .protocol import MAX_BODY_BYTES

HTTP_TIMEOUT_SECONDS = 5


class DeliveryError(RuntimeError):
    def __init__(self) -> None:
        super().__init__("delivery_failed")


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _send(url: str, ca_file: str | None, body: bytes) -> None:
    if urlsplit(url).scheme != "https" or len(body) > MAX_BODY_BYTES:
        raise DeliveryError()
    try:
        context = ssl.create_default_context(cafile=ca_file)
        opener = build_opener(_NoRedirect(), HTTPSHandler(context=context))
        request = Request(url, data=body,
                          headers={"Content-Type": "application/json", "Accept": "application/json"},
                          method="POST")
        with opener.open(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            if not 200 <= response.status < 300:
                raise DeliveryError()
    except HTTPError as error:
        error.close()
        raise DeliveryError() from None
    except (URLError, OSError, ValueError):
        raise DeliveryError() from None


def post_report(config: CollectorConfig, body: bytes) -> None:
    """Bound the whole DNS/TLS/HTTP attempt, not just individual socket reads.

    A short-lived worker allows a stuck resolver or trickled headers to be killed
    and reaped. Credentials travel on its private stdin, never in argv or logs.
    """
    if len(body) > MAX_BODY_BYTES:
        raise DeliveryError()
    try:
        packet = json.dumps({
            "url": config.webhook_url,
            "ca_file": str(config.ca_file) if config.ca_file is not None else None,
            "body": body.decode("utf-8"),
        }, ensure_ascii=False).encode("utf-8")
        result = subprocess.run(
            [sys.executable, "-m", "ha_tty7.transport"], input=packet,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=HTTP_TIMEOUT_SECONDS, check=False,
        )
        if result.returncode:
            raise DeliveryError()
    except (OSError, ValueError, UnicodeError, subprocess.TimeoutExpired):
        raise DeliveryError() from None


def _worker() -> int:
    try:
        data = sys.stdin.buffer.read(2 * MAX_BODY_BYTES + 16385)
        if len(data) > 2 * MAX_BODY_BYTES + 16384:
            return 1
        packet = json.loads(data)
        if not isinstance(packet, dict) or packet.keys() != {"url", "ca_file", "body"}:
            return 1
        if not isinstance(packet["url"], str) or not isinstance(packet["body"], str):
            return 1
        if packet["ca_file"] is not None and not isinstance(packet["ca_file"], str):
            return 1
        _send(packet["url"], packet["ca_file"], packet["body"].encode("utf-8"))
        return 0
    except (DeliveryError, OSError, ValueError, TypeError, KeyError, RecursionError):
        return 1


if __name__ == "__main__":
    raise SystemExit(_worker())
