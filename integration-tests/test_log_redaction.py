"""Real log emissions and bounded retention; HTTP scoping is in test_native."""
import logging

import pytest

from custom_components.ha_tty7.log_redaction import MAX_REMEMBERED_CREDENTIALS, WebhookLogRedactor


def test_redaction_preserves_warning_and_exception_evidence(caplog):
    redactor = WebhookLogRedactor()
    secret = "1" * 64  # Deliberately synthetic; not a fixture credential.
    redactor.remember(secret)
    logger = logging.getLogger("homeassistant.components.webhook")
    logger.addFilter(redactor)
    caplog.set_level(logging.DEBUG, logger=logger.name)
    try:
        logger.warning("Rejected webhook %s method %s", secret, "GET")
        assert "Rejected webhook [ha_tty7_credential_redacted] method GET" in caplog.text
        assert caplog.records[-1].levelno == logging.WARNING
        try:
            raise RuntimeError("fixed-safe-error")
        except RuntimeError:
            logger.exception("Error processing webhook %s", secret)
        assert "RuntimeError: fixed-safe-error" in caplog.text
        assert caplog.records[-1].exc_info is not None
        assert secret not in caplog.text
        logger.warning("Rejected webhook %s method %s", "unrelated", "GET")
        assert "Rejected webhook unrelated method GET" in caplog.text
    finally:
        logger.removeFilter(redactor)


def test_retention_is_bounded_without_eviction():
    redactor = WebhookLogRedactor()
    for index in range(MAX_REMEMBERED_CREDENTIALS):
        redactor.remember(f"{index:064x}")
    # Repeated registration/reload does not consume extra capacity.
    redactor.remember("0" * 64)
    with pytest.raises(ValueError, match="^credential_redaction_capacity$"):
        redactor.remember(f"{MAX_REMEMBERED_CREDENTIALS:064x}")
    record = logging.LogRecord("homeassistant.components.webhook", logging.INFO, __file__, 0,
                               "Revoked webhook %s", ("0" * 64,), None)
    assert redactor.filter(record)
    assert record.getMessage() == "Revoked webhook [ha_tty7_credential_redacted]"


@pytest.mark.parametrize("logger_name", [
    "homeassistant.components.webhook",
    "homeassistant.components.http.auth",
    "homeassistant.helpers.http",
    "aiohttp.access",
])
@pytest.mark.parametrize("format_style", ["positional", "mapping", "rendered"])
def test_path_bearing_log_emissions_redact_only_known_credentials(caplog, logger_name, format_style):
    redactor = WebhookLogRedactor()
    secret = "2" * 64
    unrelated_id = "3" * 64
    redactor.remember(secret)
    logger = logging.getLogger(logger_name)
    logger.addFilter(redactor)
    caplog.set_level(logging.DEBUG, logger=logger_name)
    path = f"/api/webhook/{secret}"
    try:
        if format_style == "positional":
            logger.warning("Serving %s to %s", path, "127.0.0.1")
        elif format_style == "mapping":
            logger.warning('Request "%(request)s" status %(status)s', {"request": f"GET {path} HTTP/1.1", "status": 405})
        else:
            logger.warning(f"GET {path} HTTP/1.1 405")
        assert secret not in caplog.text
        assert "/api/webhook/[ha_tty7_credential_redacted]" in caplog.text
        assert caplog.records[-1].levelno == logging.WARNING
        caplog.clear()
        logger.info("Serving %s to %s", f"/api/webhook/{unrelated_id}", "127.0.0.1")
        assert caplog.records[-1].getMessage() == f"Serving /api/webhook/{unrelated_id} to 127.0.0.1"
    finally:
        logger.removeFilter(redactor)
