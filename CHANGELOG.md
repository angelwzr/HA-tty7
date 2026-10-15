# Changelog

Changes are grouped by release. **Unreleased** describes local work, not a published package.

## [Unreleased]

## [0.4.1] - 2026-10-15

### Added

- GitHub-hosted terminal installer for the Linux reporter, preserving private pairing/settings and supporting manual/no-service installation.
- Editable notification title/message templates in integration settings, with documented safe metadata placeholders.

### Changed

- Default card view is compact: host, tab/session title and status only. Auxiliary information is individually opt-in.
- Unknown-status reported, detected-only and plain inventory rows are hidden unless explicitly selected.
- Host grouping remains the default; multiple hosts sort by display name with stable source identity.
- Card editor controls use native Home Assistant selectors and buttons consistently.
- Source diagnostics are removed from the card; native integration diagnostics and diagnostic entities remain available.

### Security

- Installer never needs sudo or an HA account token, preserves existing pairing and private opt-ins, and refuses unsafe secret paths.
- Notification templates alter text only; routing, hashed notification identities and lifecycle/baseline protections remain unchanged.

### Upgrade requirements

- This is patch version **0.4.1**. Update/restart HA to load card/editor/template changes; existing collector protocol remains compatible.
- Explicit card settings remain honored. Omitted information flags use the new minimal defaults.
- Notification template variables are escaped for their delivery sink. Model/effort values are never invented.

## [0.4.0] - 2026-10-15

### Added

- Opt-in workspace, tab and pane inventory through stock tty7 CLI readers.
- Separate consent for explicit names, derived labels and HA inventory retention.
- Stable host summary, health, receipt-time, inventory and source entities with redacted integration diagnostics.
- Workspace/tab card grouping, local status/type filters and compact model/effort display.
- English and Russian card, editor and accessibility labels with English fallback.

### Changed

- Host discovery uses explicit registry roles, so extra sensors and renamed entity IDs do not hide hosts.
- Structured-hook, inferred, weak and unknown-origin reports are distinguished in summaries and details.
- Inventory freshness advances only after a genuinely new sample; cached sections cannot keep it healthy.
- Model values come only from stock tty7 metadata. Missing model/effort/IDs are hidden on collapsed rows and explained in expanded details.
- Large inventory is excluded from recorder history and omitted from restore storage unless explicitly retained.

### Fixed

- Valid empty effort means “no level applies” rather than rejecting the whole roster.
- Unsafe heartbeat/poll timing is rejected before it can cause repeated stale-state transitions.
- Revoking name consent removes retained live labels even when the next inventory read fails.
- Roster read failures still propagate privacy revocation; stale data cannot keep names exposed after consent is withdrawn.
- Split-tab summaries keep the selected agent and its status together; detection-only evidence remains tab-level and unknown.

### Security

- Terminal patches and private-wire bypass artifacts are removed from the current source/package.
- Raw terminal text, conversations, free-text messages, directories, arguments, processes, ports, Git data and logs/events remain excluded.
- Inventory and source errors do not erase a valid agent roster or fabricate empty success.

### Upgrade requirements

- Update and restart the HA integration **before** upgrading the collector.
- Previous collector records remain readable. Older integrations reject the new optional sections.
- Inventory and names stay off until enabled in the collector; retention needs separate HA consent.
- Session/turn timers and missing source model data are not fabricated. No household deployment or publication is implied by local builds.

## [0.3.0] - 2026-10-14

### Added

- Editable card title and optional native Home Assistant appearance/header.
- HA-profile date, time and timezone formatting.
- Explicit inferred-state labels and protection against guessed completion alerts.

### Changed

- Removed the “Read-only status” subtitle.
- Added a separate optional upstream reporting patch at that time; the current Unreleased policy removes it. Historical release assets are unchanged.

### Upgrade requirements

- Update HA first, then the collector, to accept inferred provenance.

## [0.2.1] - 2026-10-14

### Fixed

- Delayed bundled-card registration until HA's startup registry is ready.
- Aligned the card picker name with HA-tty7.

## [0.2.0] - 2026-10-14

### Added

- HACS-installed native integration with UI-configured host pairing.
- Bundled card, visual editor and automatic frontend loading.
- Host-bound HTTPS ingestion, freshness handling, restoration and optional notifications.

[Unreleased]: https://github.com/angelwzr/HA-tty7/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/angelwzr/HA-tty7/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/angelwzr/HA-tty7/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/angelwzr/HA-tty7/releases/tag/v0.3.0
[0.2.1]: https://github.com/angelwzr/HA-tty7/releases/tag/v0.2.1
[0.2.0]: https://github.com/angelwzr/HA-tty7/releases/tag/v0.2.0
