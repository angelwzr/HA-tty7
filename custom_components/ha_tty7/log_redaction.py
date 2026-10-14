"""Keep native HTTP/webhook diagnostics useful without project credentials.

HA logs webhook IDs both directly and inside HTTP paths/request lines. Its
unknown-hook DEBUG body record contains no ID, so scope that record using HA's
actual HTTP request ContextVar. Unrelated records remain untouched.
"""
from __future__ import annotations

import hashlib
import logging
import re

from homeassistant.helpers.http import current_request

MAX_REMEMBERED_CREDENTIALS = 4096
HTTP_LOGGERS = (
    "homeassistant.components.webhook",
    "homeassistant.components.http.auth",
    "homeassistant.helpers.http",
    "aiohttp.access",
)
_CREDENTIAL_TOKEN = re.compile(r"(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])")
_REDACTED = "[ha_tty7_credential_redacted]"


class WebhookLogRedactor(logging.Filter):
    """Remember only fixed-size credential digests until process exit.

    A removed credential still needs redaction. Do not evict digests; refusing
    additional registrations at the bound is safer than leaking a revoked ID.
    This uses at most 4096 SHA-256 digests, not payloads or bearer credentials.
    """

    def __init__(self) -> None:
        super().__init__()
        self._digests: set[bytes] = set()

    def remember(self, credential: str) -> None:
        digest = hashlib.sha256(credential.encode()).digest()
        if digest not in self._digests and len(self._digests) >= MAX_REMEMBERED_CREDENTIALS:
            raise ValueError("credential_redaction_capacity")
        self._digests.add(digest)

    def _known(self, value: object) -> bool:
        return (isinstance(value, str) and len(value) == 64
                and all(character in "0123456789abcdef" for character in value)
                and hashlib.sha256(value.encode("ascii")).digest() in self._digests)

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name not in HTTP_LOGGERS:
            return True
        request = current_request.get()
        scoped = request is not None and self._known(request.match_info.get("webhook_id"))
        # The builtin unknown-hook body debug line is literally a single %s
        # with bytes. Only a known project webhook's request can redact it.
        if (record.name == "homeassistant.components.webhook" and scoped
                and record.msg == "%s" and isinstance(record.args, tuple) and len(record.args) == 1):
            record.msg = "ha_tty7_payload_redacted"
            record.args = ()
            return True
        message = record.getMessage()
        redacted = _CREDENTIAL_TOKEN.sub(
            lambda match: _REDACTED if self._known(match.group()) else match.group(), message
        )
        if redacted != message:
            # Handle tuple args, mapping args and already-rendered access lines
            # without changing severity, exception evidence or unrelated logs.
            record.msg = redacted
            record.args = ()
        return True


def install_redactor() -> WebhookLogRedactor:
    """One filter per process, retained through unload/removal for revoked IDs."""
    webhook_logger = logging.getLogger(HTTP_LOGGERS[0])
    redactor = next((existing for existing in webhook_logger.filters
                     if isinstance(existing, WebhookLogRedactor)), None)
    if redactor is None:
        redactor = WebhookLogRedactor()
    for name in HTTP_LOGGERS:
        logger = logging.getLogger(name)
        if redactor not in logger.filters:
            logger.addFilter(redactor)
    return redactor
