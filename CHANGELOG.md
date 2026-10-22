# Changelog

Changes are grouped by release. **Unreleased** describes local work, not a published package.

## [Unreleased]

## [0.4.5] - 2026-10-22

### Fixed

- Expanded session rows now show their full names across multiple lines on mobile and desktop. Long unbroken names wrap without overlapping status or creating horizontal scrolling.
- Collapsed rows retain their compact ellipsis; existing tap, click, Enter and Space interactions reveal or hide the full title. No hover-only control or extra setting is required.

### Unchanged

- Notification templates, event filtering, name privacy settings and the OMP extension are unchanged. This card-only fix does not require restarting OMP sessions.


### Documentation

- Reworked the README with a product overview, data-flow diagram, agent/notification support matrix, installation walkthrough and privacy boundaries.
- Added a screenshot of the actual card using synthetic session data, included in the public source export.
- Corrected the installation guide's pinned installer URL to v0.4.4.

## [0.4.4] - 2026-10-22

### Changed

- Default notifications use the approved session/tab name, falling back to `Unnamed session`, without host, agent type, pane number or session ID.
- Messages are `Finished.`, `Needs your input.`, and `Failed.`. Existing exact built-in templates migrate automatically and independently; custom templates, routes and disabled toggles are preserved.
- Only authoritative main-run outcomes and actual blocking questions/approvals can notify. Stock-only and older proof-less native reports remain visible but silent.

### Fixed

- Cancellation, unknown outcomes, child/advisor activity, retries, compaction and reconnects no longer masquerade as normal finishes or new input requests.
- Native terminal proof waits for owner quiescence; repeated finish/failure/input events are deduplicated without startup or recovery replay.
- Cancelled compaction remains cancelled through trailing pre-recovery errors. Main-call ownership and provider-composite tool IDs are handled without exporting source correlation IDs.

### Security

- Only bounded scalar outcome and opaque input identity metadata are added. Message content, error text, tool arguments/results and credentials remain excluded.
- Name collection and derived-label consent are unchanged; unsafe or unavailable names cannot fall back to host/agent/ID text.

### Upgrade requirements

- Update/restart HA first, then run the 0.4.4 reporter installer. Existing OMP sessions require `/restart` after foreground/background work finishes; no active session is restarted automatically.
- Native reporters without outcome/input proof and stock-only agent statuses cannot trigger notifications. OMP's public failed-or-cancelled retry ambiguity remains silent rather than guessing.


## [0.4.3] - 2026-10-15

### Fixed

- Default native OMP reporting now includes the main session's selected provider/model ID and thinking level instead of depending on tty7's empty OMP readout.
- Model and thinking-only changes refresh on the existing heartbeat without resetting status, main identity, run deduplication or notification baselines.
- Native null/unavailable metadata no longer falls back to child-polluted tty7 values.
- Removed the duplicate Model/Capability unknown detail row; partial metadata keeps the known model and honestly marks only the missing thinking level.
- Installer messages now correctly require `/restart` after work finishes to load updated OMP extensions.

### Security

- Only bounded nullable model/thinking strings are exported. Raw model objects, credentials, endpoints, messages and tool data stay excluded.
- Metadata getter failures do not disable otherwise healthy native status. Existing source validation, private files, publication locks and freshness protections remain intact.

### Upgrade requirements

- Update HA first, then run the 0.4.3 host installer. Existing OMP sessions need `/restart` after foreground/background work finishes to load the richer reporter.
- Older native status-only records remain readable with null model/thinking values. No extra source opt-in is needed; collapsed model/effort display flags remain off unless selected.
- Permission mode and activity/turn counts are not fabricated; unsupported values remain unavailable.


## [0.4.2] - 2026-10-15

### Added

- Managed OMP-native status reporting, installed automatically for every Oh My Pi main session in tty7; no per-pane opt-in.
- Explicit native-source health and owner-scoped background-job count, with compact missing-source warnings and expanded details.

### Changed

- Native OMP status takes precedence over tty7's generic OMP hooks. Other agents keep their existing stock sources.
- Child agents, queued continuations and pending background deliveries cannot declare their parent pane finished.
- A completion means an observed main activity stretch ended, not that the user's entire task succeeded.

### Fixed

- Reopening the same native run no longer generates repeated completion notifications; initial/reconnected/recovered sources establish silent baselines.
- Legitimate distro Python aliases and non-writable legacy venv roots under the private managed directory no longer block installation.

### Security

- OMP writes only bounded scalar status metadata into private, atomic local records; pairing credentials remain solely in the HTTPS collector.
- Missing, stale, unsupported, malformed or conflicting native reports become Unknown, never a guessed tty7 Idle/Done fallback.
- No tty7 patch, private wire protocol, terminal scraping, tool arguments/results or conversation export.

### Upgrade requirements

- Update/restart HA first, then run the matching host reporter installer. New OMP processes use the native reporter automatically.
- Existing OMP 18.10.3 processes need `/restart` after foreground/background work finishes; `/reload-plugins` cannot import new extension modules. No terminal input is injected and active sessions are not stopped.
- Native OMP activity/turn counters stay unavailable rather than retaining tty7's child-contaminated counters. Model/effort metadata collection is unchanged.
- Independent desktop-to-phone forwarding remains an OS setting; use one phone-alert route to avoid duplicate OMP/tty7 and HA pushes.

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

[Unreleased]: https://github.com/angelwzr/HA-tty7/compare/v0.4.5...HEAD
[0.4.5]: https://github.com/angelwzr/HA-tty7/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/angelwzr/HA-tty7/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/angelwzr/HA-tty7/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/angelwzr/HA-tty7/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/angelwzr/HA-tty7/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/angelwzr/HA-tty7/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/angelwzr/HA-tty7/releases/tag/v0.3.0
[0.2.1]: https://github.com/angelwzr/HA-tty7/releases/tag/v0.2.1
[0.2.0]: https://github.com/angelwzr/HA-tty7/releases/tag/v0.2.0
