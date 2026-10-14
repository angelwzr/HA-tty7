# HA-tty7

Read-only tty7 agent status in Home Assistant, with a tty7-style dashboard card and optional phone notifications. Install the HA side through HACS and configure hosts through Home Assistant's UI.

## Install in Home Assistant

1. In HACS, add `https://github.com/angelwzr/HA-tty7` as a custom repository of type **Integration**, then download HA-tty7. Restart HA if requested.
2. Open **Settings > Devices & services > Add integration > HA-tty7**. Add a host ID/label, your private verified HTTPS HA base URL, and optional notification settings. Finish pairing and keep the generated webhook URL private.
3. Install/pair the collector on that Linux host using [collector instructions](docs/install.md).
4. Open your dashboard editor and add the **HA-tty7** card. The visual editor discovers this integration's hosts; select the ones to show.

The integration bundles and loads the card. No per-host YAML, secrets.yaml editing, JavaScript copying, manual resource registration, MQTT broker, or separate dashboard server is needed. HACS installs only the HA side; it cannot install collectors on other machines.

[Open in HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=angelwzr&repository=HA-tty7&category=integration)

## What is shown

| Included | Not collected or exposed |
| --- | --- |
| Host label and HA-authoritative freshness | Terminal output or scrollback |
| Agent type and working/waiting/done/idle/unknown status | Prompts, conversations, or free-text status messages |
| Session/pane identity, activity and turns | Workspace/tab/layout, Git or directory data |
| Model, effort and permission metadata when populated | Launch arguments, process trees or ports |
| Optional waiting/completion alerts | Commands, approvals or tty7 controls |

Missing metadata stays unavailable. Expandable details and host filtering affect only the local dashboard. They never send input to tty7.

The visual editor includes **Card title** and **Appearance** (`tty7` or `Home Assistant`). Home Assistant appearance leaves the native card surface, borders, shadows and radius to HA and uses its theme colors. Receipt timestamps follow HA profile language, date/time format and timezone preferences.

tty7-reported `inferred` states are explicitly labeled; they are guesses after hook silence or interruption, not confirmed completion. They never trigger completion notifications.

### Reporting coverage

`tty7 --json agents` lists sessions that have reported lifecycle events, not every agent icon detected in tty7's sidebar. The sidebar aggregates a tab's panes; this card shows individual reported panes. For missing Codex sessions, review and trust the tty7 handlers in Codex's `/hooks` screen, then start a fresh session inside tty7. Installed hook files alone do not prove that a running Codex process loaded or trusted them.

tty7 26.10.0's OMP producer sends only session identity and its emitter discards OMP model/effort fields. HA cannot recover those missing values. The [supported upstream producer/emitter patch](upstream/tty7-26.10.0-omp-reporting.patch) applies to official tty7 v26.10.0 (`0a55c33b72571f6e9886546b376bd5db2c38be72`). It sends actual selected model/effort, preserves working state during automatic continuation, and reports genuine tool progress. It does not install a private-wire bridge or read conversations. Model values remain unavailable until patched tty7 is installed, its OMP integration refreshed, and OMP sessions reloaded.

Patch validation: pristine-base apply check, three actual-source emitter tests, and execution of the generated OMP bridge for metadata changes, tool progress, continuation and final stop. The full upstream workspace build remains unverified because its unrelated Zed dependency fetch did not complete. Build/install the patched terminal using tty7's upstream instructions; this repository does not ship a replacement terminal binary.

Session/turn timers are not derived from HA receipt time. OMP exposes session-header creation time and turn-start lifecycle timestamps, but tty7's current agent roster does not transmit them.

## Pairing and security

Each host has an independent cryptographically random webhook credential bound to its configured ID. Pairing information appears only in authenticated integration setup/options, never in entity attributes or card configuration. Removing a host revokes its credential.

Collectors make outbound verified HTTPS requests and have no inbound listener. The built-in HA webhook is POST-only and local-only. Use a private LAN/VPN route and verify reverse-proxy source handling. Private CA files are supported on collectors; disabling TLS/hostname verification is not.

Keep webhook URLs, HA/GitHub tokens and configuration secrets out of Git, chat, logs and screenshots. Collector hosts need their webhook URL, not an HA user token. Redact webhook URL paths in your existing reverse proxy/access logs.

The integration validates the complete bounded v1 schema before accepting data. Invalid requests never refresh contact. Whole snapshots reconcile rosters; errors retain last-known rows. Startup/reload is unconfirmed and missing contact becomes stale after 45 seconds. Phone/browser clock differences do not discard valid HA data.

## Notifications

Select an existing `notify.mobile_app_*` action or HA persistent notifications during setup/options. Waiting and completion are independently configurable. Alerts compare individual session identities, not counts, and do not replay old work on initial pairing, restart, error recovery or stale reconnection. Notification text is safely encoded for Markdown/HTML sinks.

Polling can miss transitions completed between samples. This is current-state monitoring, not a session archive.

## Requirements and development

Target baseline: Home Assistant Core 2026.10.0 and HACS 2.0.5. Collector: Linux/Python 3.11+, stable tty7 CLI and installed agent integrations. Frontend development: Node 22.12+ and npm.

The pure protocol has one source under `custom_components/ha_tty7/protocol/`. Collector packaging maps it into `ha_tty7.protocol`; the HA integration imports it locally. All HA runtime files are inside the integration directory.

Collector development/tests:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --editable .
.venv/bin/python -m unittest discover -s collector/tests -v
```

Card build/tests, from `card/`:

```sh
npm ci
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

Playwright needs installed Chromium; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing browser. Before release, copy the built card into `custom_components/ha_tty7/frontend/ha-tty7-card.js`, preserve dependency notices, then run `python3 tools/build_release.py`. It rejects incomplete runtime packages and produces `dist/ha_tty7.zip` for HACS.

Native HA fixtures require the HA-matched test plugin; see `integration-tests/README.md`. Real HACS download/update, UI pairing/card setup and collector HTTPS behavior must be exercised on an isolated instance. Local tests do not authorize household deployment or prove physical Android delivery.

## License

Project code is MIT licensed. The bundled Lit runtime retains its BSD-3-Clause notices; see the integration's third-party notices. Original agent glyph/brand artwork is local, not copied from third-party agent logos.

The separate tty7 upstream patch retains tty7's Apache-2.0 licensing; see [upstream license](upstream/TTY7_LICENSE.txt). It is not an official tty7 release.
