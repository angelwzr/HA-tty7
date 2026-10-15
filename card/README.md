# tty7 status card

Read-only Lovelace card for HA-tty7. It bundles Lit locally, makes no collector requests, loads no external assets, and exposes no tty7 controls. It works with the original v1 roster and the optional stock-CLI inventory/source extensions.

## Add it in Home Assistant

1. Install HA-tty7 through HACS and add hosts in **Settings → Devices & services**.
2. Add **HA-tty7** to a dashboard. Choose host pairs in its visual editor.
3. Optionally choose grouping, metadata, and local filters.

The integration serves and registers the bundled module. No manual JavaScript copying or resource registration is needed. Integration updates version the resource cache. Removing a dashboard card does not revoke pairing or remove the integration.

New suggestions use the integration-owned device and exact entity-registry `translation_key` roles: `roster` and `connectivity`. Extra summary sensors do not become rosters. Renamed entity IDs work; ambiguous role duplicates, disabled devices, unrelated integrations, and unbound devices are not guessed. No state-attribute scanning or config-entry options are used. Saved manual pairs remain authoritative even if registry discovery is unavailable. Incomplete editor rows remain local until valid.

New card suggestions explicitly choose `appearance: home-assistant`. Existing saved configurations without `appearance` retain `tty7` styling. Native appearance leaves the actual HA `ha-card` header, background, border, shadow, and radius to HA; it uses the active theme’s semantic colors without changing the global theme.

## Configuration

```yaml
type: custom:ha-tty7-card
appearance: home-assistant
title: My agents
hosts:
  - name: Desktop
    roster_entity: sensor.my_roster
    connectivity_entity: binary_sensor.my_connectivity
group_by: host
show_summary: true
show_model: true
show_effort: true
show_session_id: false
include_inferred: true
# Omit statuses and agent_types to show all reports.
# statuses: [working, waiting, done, idle, unknown]
# agent_types: [OhMyPi, ClaudeCode]
```

| Setting | Default when omitted | Meaning |
| --- | --- | --- |
| `title` | Localized “tty7 agents” | Nonblank, escaped text, at most 128 Unicode characters; clear it in the editor to restore the default |
| `appearance` | `tty7` for existing saved configs | `tty7` or `home-assistant`; new suggestions explicitly use the latter |
| `group_by` | `host` | `host`, `workspace`, or `tab`; structural grouping requires approved inventory |
| `show_summary` | `true` | Show unfiltered reported/confirmed/inferred/weak/unknown-origin and inventory totals |
| `show_model` | `true` | Show model on compact rows only when a meaningful value was reported |
| `show_effort` | `true` | Show reported effort on compact rows; explicit empty effort means no level applies |
| `show_session_id` | `false` | Show full session ID on compact rows only when present; details explain missing IDs |
| `statuses` | All statuses | Local status selection; `[]` hides reported rows |
| `agent_types` | All types | Exact, case-sensitive reported agent types; omitted or `[]` means all |
| `include_inferred` | `true` | Include reports explicitly marked inferred |

Host labels and entity mappings must be unique. Rosters must be `sensor.*`; connectivity must be `binary_sensor.*`. Only the documented settings and host properties are accepted. There are no URL, credential, action, or command settings.

The editor exposes these settings, uses HA `ha-selector` for title/appearance/host labels and pairs, and emits standard bubbling/composed `config-changed` events. It projects partial drafts onto the same allowlist and never copies integration secrets/options. Agent types are entered one per line. An empty host list is an unconfigured state, not a healthy empty roster.

## Reading the card

- **Reported** means roster membership, not confirmed hook coverage. **Confirmed** requires `rich=true` and not inferred. `rich=false` is a weak report; absent `rich` has unknown origin. Explicit inferred status stays inferred; it does not become a confirmed completion.
- **Filters are local.** The card shows filtered / total reported counts. Filters never change HA summary counts, alerts, or baselines. Inventory-only detections are not added to the reported-agent denominator.
- **Hide missing compact metadata.** Null/blank model, unreported effort and absent session IDs do not create collapsed placeholders or empty metadata lines. Details explain Not reported / Capability unknown; source versions never prove capability. Explicit effort `""` is a reported None applicable value, not missing data. Activity counts reported tool completions; turns count reported settles, including interruption inference—not successful tasks or elapsed time.
- **Names require collector consent.** Only approved inventory names are used. Explicit tab names take precedence; separately approved derived labels are marked as derived. Agent type remains visible. No terminal, process title, path, Git, configuration, conversation, or log lookup fills missing names/models.
- **Inventory is separate from roster health.** Disabled, unconfirmed, current, failed, and stale inventory are distinct. Failed/stale inventory is last-known, not a new observation; missing/disabled inventory revokes labels. HA owns its receipt timestamps. Collection errors do not manufacture a successful empty inventory.
- **Grouping is structural, not identity by text.** Source + workspace/tab IDs identify groups; names and ordinals may change. Pane joins require agreement between direct pane membership and tab membership. Ambiguity stays ungrouped, with pending reconciliation shown for inconsistent samples.
- **Split parents pair type and status.** Both come from the same most-urgent reported pane (waiting, working, done, unknown, idle). Representative detection from a tab never creates per-pane agents. A detected-only tab stays Unknown / unreported. Orphans stay visible without invented tab ownership. Hibernation and liveness are independent of agent work state.
- **Open details for identifiers and provenance.** Stable source/session/pane identities preserve expansion through heartbeat reorder and host filtering. Replacement sessions do not inherit expansion. All incoming text is escaped and only allowlisted fields reach rendering.
- **Source diagnostics are sampled.** Collector version, tty7 build, control/protocol versions, and sampled uptime are distinct fields. Missing values stay Not reported; no version implies hook activation, unsupported metadata, or patched tty7.

English and Russian card/editor/notices/accessibility messages follow HA profile language on every update; other languages fall back to English. Agent names and identifiers are not translated.

HA is authoritative for roster freshness: it publishes `stale` after expiry and `unconfirmed` after startup/reload. The card never uses viewer time to invent freshness. Receipt/last-success timestamps retain the existing HA-profile formatter for language, numeric date ordering, 12/24-hour preference, and server/local timezone. Preference updates reformat timestamps without changing entity data; timezone-aware source strings remain in `<time datetime>`.

## Development and verification

Node.js 22.12 or newer:

```sh
npm ci
npm run test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The build emits one `dist/ha-tty7-card.js` module. Development fixtures are not included in the library. `npm run dev` serves sanitized synthetic data only; it does not contact HA or tty7. Use `/?editor` for the editor, `/?editor&integration=missing` for setup guidance, and `/?scenario=inventory` for structural fixtures. These local fixtures are not proof of real HA integration compatibility.

Regression coverage includes registry roles with renamed IDs and extra sensors, strict optional presentation settings, old roster compatibility, rich/empty-effort semantics, safe names and consent flags, split type/status pairing, tab-only detections, identity/filtering, optional-section failure isolation, provenance, and live locale updates. Browser consumers exercise mobile/desktop keyboard/touch details, inert hostile text, overflow, reduced motion, HA-profile timestamps, and the native-surface boundary. Actual HA `ha-card`, registry/editor selectors, integration options, diagnostics, and cache behavior require authorized isolated HA browser verification.

The module waits for the parsed `home-assistant` root to be defined before registering custom elements, so HA’s startup scoped-registry replacement does not strand early card/editor definitions. Local fixtures without that root register immediately; no polling or duplicate registrations are used.

## API and visual references

The frontend formatter follows pinned frontend 20260930.2’s [date/time helper](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_date_time.ts), [date ordering](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_date.ts), [time preference](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/use_am_pm.ts), and [timezone resolver](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/resolve-time-zone.ts). Registry/editor references: [entity registry](https://github.com/home-assistant/frontend/blob/20260930.2/src/data/entity/entity_registry.ts), [device registry](https://github.com/home-assistant/frontend/blob/20260930.2/src/data/device/device_registry.ts), [HA selector](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-selector/ha-selector.ts), and [native ha-card](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-card.ts).

The existing `tty7` palette and compact rows were independently adapted from upstream commit `8c5ea523b34a08362da54221ffb6246f43cebfc5`: [presets](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/presets.rs), [sidebar](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/tab_sidebar.rs), and [theme](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/theme.rs). CSS and the generic local robot glyph are original; no upstream source, logos, fonts, or artwork were copied. No agent-specific icon lookup is attempted. This is not a pixel-parity claim about the installed tty7 GUI.
