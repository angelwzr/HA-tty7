# Native integration acceptance

Use an isolated environment: Python **3.14**, Home Assistant Core **2026.10.0**, `pytest-homeassistant-custom-component==0.13.371`.

Build/copy the bundled frontend, then run from the repository root:

```sh
PYTHONPATH=. pytest -v integration-tests
```

These fixtures load real HA components, config/options flows, registries, webhook/diagnostics APIs, native storage and notifications. They require no household token, collector or HA service process. They do not prove HACS download, browser UI or Android delivery. Never replace HA imports with fake runtime modules.

## Fixture setup

Set up the first host/frontend/static route before opening `hass_client()`: aiohttp freezes the app. The helper uses the fixture HA implicitly; its optional argument is an access token, not a HA object. Reloads reuse the static route. Setup and native loader behavior are documented in `conftest.py`.

## Isolated live acceptance

1. **Pair hosts.** Configure distinct `host_id`, `label`, verified HTTPS `base_url`, safe notification destination/toggles, local `dashboard_path` and `retain_inventory=false`. Copy generated pairing URLs privately; finish pairing before posting. Readding a removed host must generate a new credential.
2. **Discover roles.** Use native entity/device registries, not guessed IDs. Pair integration-owned `translation_key=roster` and `connectivity` under one device/config entry. Extra summary sensors and user-renamed entity IDs must not hide or mispair the host.
3. **Exercise ingestion.** Valid empty roster is online with zero rows; read failure is error, never empty success. Validate malformed UTF-8/JSON, duplicate keys, unknown fields, wrong host binding and payloads over **256 KiB**. Optional inventory/source failures are scoped; valid old collector records remain accepted.
4. **Verify freshness/privacy.** HA receipt time controls health. Cached inventory `sample_id` cannot refresh or recover observation health. New samples reconfirm it. Inventory/name opt-out must prune live labels even when inventory or roster reads fail. Retention is separate consent.
5. **Exercise UI and lifecycle.** Save title/appearance/grouping/filter settings in the real visual editor; inspect phone-width native light/dark/custom themes and English/Russian labels. Verify split agent/status pairing, filtered headings, detected-only unknowns, empty effort and missing models. Reload/remove only disposable hosts.

### Entities and storage

Roster attributes include existing counts/health/receipt data plus provenance summaries, independently fresh inventory and allowlisted source diagnostics. Scalar status counts are **confirmed structured-hook counts**; reported/inferred/weak/unknown-origin totals remain separate. Inventory and source entities have independent availability; failures never become misleading zero.

The roster is a plain `SensorEntity`, not `RestoreEntity`. A private per-entry native `Store` writes only consent-filtered restoration data. By default no inventory is persisted, including through `core.restore_state`. Explicit retention restores last-known inventory **unconfirmed**, not healthy; cached pre-restart sample IDs cannot reconfirm it. Revoking retention must scrub storage even if the entry is unloaded. Entry removal deletes its store.

Test actual storage content using fresh `Store` readers. The matched plugin's `mock_storage` can cache a reader instance's prior data; reusing it across writes by another Store does not prove current persistence contents.

### Notifications and APIs

Use config/options flow APIs for UI-equivalent automation, then finish the authenticated pairing step. Keep responses private: they contain bearer URLs. Read `/api/states/<entity_id>` and `/api/diagnostics/config_entry/<entry_id>` only on the disposable instance.

Notifications must follow state publication and preserve initial/recovery baseline suppression. Test waiting, confirmed working→done, repeated reports, replacement identities, unknown/inferred/explicit weak states, errors and stale/reload recovery. Inspect persistent notifications via authenticated WebSocket `persistent_notification/get`; fixture success does not prove physical Companion delivery.

HA evaluates silent expiry on the five-second tick after 45 seconds. The card must use HA health, not a phone clock. Remove hosts to verify credential revocation, timers/subscriptions/store cleanup and frontend extra-module removal. HA 2026.10 has no static-route unregister API: the public no-host-data bundle route can remain until restart. Its versioned URL follows the integration version, not a hardcoded old tag.

## Webhook log privacy

Core webhook/auth/serving/access loggers can expose bearer paths and unknown-body prefixes. The integration narrowly redacts known project credential digests while preserving unrelated warnings/errors, exception traces and unrelated webhook DEBUG records. Tests exercise actual native loggers and diagnostics downloads, not only helper output.

Digest retention is bounded at 4096 with no eviction during the process lifetime; registration fails safely at capacity until HA restarts. Reverse-proxy/access-log redaction is an independent deployment requirement. Never log/persist raw collector payloads, real names/paths/session IDs or test credentials as public evidence.
