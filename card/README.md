# tty7 status card

A read-only Lovelace card and visual editor for the v1 HA-tty7 roster/connectivity contract. The single module bundles Lit locally; it makes no collector requests, loads no external assets, and exposes no tty7 controls.

## Build and local checks

Use Node.js 22.12 or newer. Generate the npm lockfile through npm when initially integrating this package; do not hand-author it. With the committed lockfile:

```sh
npm ci
npm run test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run build` generates one module, `dist/ha-tty7-card.js`. The development HTML and synthetic fixtures are not included in the library build. `npm run dev` opens the development surface at the URL reported by Vite. It uses only sanitized synthetic data and does not connect to HA or tty7.

Vitest exercises validation, native-registry discovery, editor configuration events and presentation-setting persistence, privacy projection, freshness/error states, empty-vs-failed rosters, host filtering, escaped titles/values, and stable expansion. Playwright covers 360×800 touch and desktop views, keyboard editing/details, noncolor labels, long/hostile text, reduced motion, overflow, HA profile date/time/timezone changes, and native-mode consumer theme styling. The theme test supplies the inner card's surface styles to check that this card does not override them; it is not a replacement for testing the actual HA `ha-card`. Open `/?editor` on the development surface for the editor fixture, or `/?editor&integration=missing` for missing-integration setup. Its development-only native-control adapter implements the HA selector event boundary; it does not reproduce HA's selector implementation. These are local consumer tests, **not evidence of real HA, HACS, or Companion app compatibility**. The integration owner runs the commands and records exercised evidence.

## Add the bundled card in Home Assistant

Install the HA-tty7 integration through HACS, restart HA as required, and add hosts under **Settings > Devices & services**. The integration serves and registers the bundled module automatically. In a dashboard's **Add card** picker, select **tty7 agents**; use the visual editor to change the card title and appearance, select host pairs, change dashboard labels, and add or remove host rows. No JavaScript copying, manual resource registration, or host YAML is required.

New-card suggestions use only HA entity-registry entries with platform `ha_tty7` on an enabled device with a native `ha_tty7` identifier and config-entry membership. A device must have exactly one roster sensor and one connectivity binary sensor; ambiguous pairs are not guessed, and entity IDs may be renamed. Saved explicit host mappings remain authoritative even when registry discovery is unavailable. No state-attribute scan or config-entry options are used. When no hosts are installed, the card/editor show actionable setup guidance and an empty host list rather than invented IDs. Incomplete editor rows stay local until complete and valid.

The explicit configuration shape remains available for existing manually configured cards:

```yaml
type: custom:ha-tty7-card
hosts:
  - name: Desktop
    roster_entity: sensor.ha_tty7_desktop_demo_roster
    connectivity_entity: binary_sensor.ha_tty7_desktop_demo_connectivity
  - name: Laptop
    roster_entity: sensor.ha_tty7_laptop_demo_roster
    connectivity_entity: binary_sensor.ha_tty7_laptop_demo_connectivity
```

Only `type`, `hosts`, optional `title`, optional `appearance`, and the three listed host properties are accepted. Existing configs need no changes: the title defaults to `tty7 agents`, appearance to `tty7`. A provided title must be non-blank text of at most 128 Unicode characters; it is trimmed and rendered as escaped text, never markup. Clear the title in the editor to restore its default. `appearance` accepts only `tty7` or `home-assistant`; the latter leaves background, border, shadow and radius to HA's real `ha-card` and uses HA semantic text/accent/success/warning/error variables. It follows the active HA theme without setting a second palette or changing the global theme. For example, add `title: My agents` and `appearance: home-assistant` alongside `hosts` in the YAML above.

Names and entity mappings must be unique; roster IDs must be `sensor.*`, connectivity IDs `binary_sensor.*`. Configuration contains no URLs, credentials, actions, or commands. Select a host to filter local presentation only. Open a row to read its complete permitted identifiers and metadata; unavailable fields are explicit and activity/turns retain their reported values without invented units.

HACS integration updates provide the new bundled card with integration-owned resource cache versioning. Removing a card placement does not remove the integration or revoke host pairing. Verify actual Add card/editor behavior, entity updates, restart confirmation, Android rendering, and caching in an authorized isolated HA installation before claiming integration compatibility.

## Display behavior

Home Assistant is authoritative for receipt freshness: its roster state explicitly reports `stale` after expiry and `unconfirmed` after startup/reload, and its connectivity entity establishes online health. The card never compares HA receipt timestamps with the viewer's clock or invents freshness expiry from browser time. Receipt and last-success timestamps use HA profile language, numeric date ordering (language/system/DMY/MDY/YMD), and time preference (language/system/12/24). HA's configured timezone is used unless the profile selects the browser's local timezone and it is resolvable; an unresolved browser zone falls back to HA's zone. Both timestamps reformat on HA preference updates even when entity data is unchanged; the original timezone-aware timestamp stays in the `<time datetime>` attribute. There is no local-relative age counter. Collector errors, stale, offline, unconfirmed-after-restart, and HA-disconnected states retain valid last-known rows with a non-live notice. Malformed or missing entity data never becomes a healthy empty roster. Only a confirmed healthy empty snapshot displays “No reported agents.” Error messages are fixed labels, never incoming diagnostics.

Formatting semantics were checked against frontend 20260930.2's [numeric date/time helper](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_date_time.ts), [numeric date ordering](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_date.ts), [time formatting](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_time.ts), [time preference resolver](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/use_am_pm.ts), and [timezone preference resolver](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/resolve-time-zone.ts). HA does not publish these as a custom-card API, so the bundled formatter implements these profile semantics locally without importing HA's private modules.

The view-model interface is `deriveHostView(config, states, connected)`; it has no viewer-time input. Clock-skew consumer tests change the browser clock while keeping HA fixture receipt timestamps fixed and assert retained rows and open details.

The visual editor uses HA's supported `ha-selector` select/text components and emits standard bubbling/composed `config-changed` events with only `type`, `hosts: [{name, roster_entity, connectivity_entity}]`, and the optional `title`/`appearance` settings. Runtime card validation rejects unknown fields; the editor projects partial drafts onto the same allowlist. An empty host list is a valid unconfigured state, not a healthy empty roster. Core 2026.10.0 pins frontend 20260930.2; the checked APIs are [entity registry display entries](https://github.com/home-assistant/frontend/blob/20260930.2/src/data/entity/entity_registry.ts), [device registry](https://github.com/home-assistant/frontend/blob/20260930.2/src/data/device/device_registry.ts), and [HA selector](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-selector/ha-selector.ts). Selector loading uses HA's `loadCardHelpers` and built-in entities-card editor, which imports HA's form/selector components.

HA's [index bootstrap](https://github.com/home-assistant/frontend/blob/20260930.2/src/html/index.html.template) imports extra modules concurrently with [app startup](https://github.com/home-assistant/frontend/blob/20260930.2/src/entrypoints/app.ts), which installs the scoped custom-element registry. When the parsed HA root is present, the bundled module waits for `home-assistant` to be defined before registering either editor or card. This prevents definitions from being stranded in the earlier native registry. Local fixtures without an HA root register immediately; no polling, duplicate registrations, or manual resource setup is used.

Agent rows use host roster entity + session ID + pane ID as stable identity. Details survive heartbeats, roster reorder, and host filtering. A replacement session does not inherit expansion. Text is rendered through Lit escaping; unknown attributes are reconstructed away before rendering. Heartbeats do not animate, and screen-reader status regions do not contain ticking timestamps.

An optional boolean `inferred` marks a status guessed by tty7 instead of directly reported by its agent hooks. Only a source-marked `true` adds `(inferred)` to the visible row, accessible button label and expanded Status detail. The card preserves the source status (for example, `Idle (inferred)` stays idle, not working) and never derives provenance from elapsed time or missing metadata. Absent/false flags leave existing status labels unchanged. A present non-boolean flag makes the complete roster malformed rather than silently dropping or presenting that record as confirmed.

## Visual references and assets

Inspected upstream tty7 commit `8c5ea523b34a08362da54221ffb6246f43cebfc5` on 2026-10-14:

- [src/ui/presets.rs](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/presets.rs): default light `#fcfcfb` / `#1c1c1e`, dark `#18181a` / `#ececed`, rail 3% tint, restrained hover surfaces, blue accent, green/amber/red semantic roles.
- [src/ui/tab_sidebar.rs](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/tab_sidebar.rs): compact icon/title/secondary-line rows, 0.875rem title and 0.75rem metadata hierarchy, elided text with a full-detail surface.
- [src/ui/theme.rs](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/theme.rs): interface system-font default and independent terminal-font role.
- [LICENSE](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/LICENSE): Apache-2.0, copyright 2026 l0ng-ai. Brand trademark permissions are not implied by the source license.

CSS and the consistent generic robot glyph were independently written; no upstream logo, icon, font, or source code was copied. Agent-specific assets have no separately verified licensing here, so every agent uses the same local fallback rather than a remote lookup or invented brand logo. In `tty7` mode, light/dark tokens are scoped to this card and selected from HA's `themes.darkMode`; the global HA theme is unchanged. `home-assistant` mode uses the active HA theme's semantic colors and the native [ha-card](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-card.ts) surface. The tty7 mode is source-grounded visual adaptation, not a claim of pixel-identical rendering against the installed tty7 version.
