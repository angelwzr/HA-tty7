# tty7 status card

Read-only Lovelace card for HA-tty7. It bundles Lit locally, makes no collector requests, loads no external assets, and exposes no tty7 controls. It works with the original v1 roster, optional stock-CLI inventory and default OMP-native status metadata. Source versions/diagnostics stay in Home Assistant entities/diagnostics, not in this card.

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
# All auxiliary show_* options default to false.
# show_model: true
# show_effort: true
# show_last_contact: true
include_inferred: true
# Omitted statuses show known states only; opt into unknown explicitly:
# statuses: [working, waiting, done, idle, unknown]
# agent_types: [OhMyPi, ClaudeCode]
```

| Setting | Default when omitted | Meaning |
| --- | --- | --- |
| `title` | Localized “tty7 agents” | Nonblank, escaped text, at most 128 Unicode characters; clear it in the editor to restore the default |
| `appearance` | `tty7` for existing saved configs | `tty7` or `home-assistant`; new suggestions explicitly use the latter |
| `group_by` | `host` | `host`, `workspace`, or `tab`; structural grouping requires approved inventory |
| `show_last_contact` / `show_last_success` | `false` each | Show the host’s HA receipt / successful-snapshot timestamp when available |
| `show_summary` | `false` | Show unfiltered reported/confirmed/inferred/weak/unknown-origin totals |
| `show_inventory_summary` | `false` | Show unfiltered workspace/tab/pane counts |
| `show_filtered_count` | `false` | Show filtered / total reported count |
| `show_inventory_status` | `false` | Show optional inventory informational state; errors, stale data and inconsistent-membership safety notices remain visible |
| `show_inventory_last_contact` / `show_inventory_last_success` | `false` each | Show inventory HA receipt / successful-snapshot timestamp when available |
| `show_agent_type` / `show_pane_id` / `show_session_id` | `false` each | Show individual row identity fields; redundant agent type is omitted when already the primary title |
| `show_model` | `false` | Show model on compact rows only when a meaningful value was reported |
| `show_effort` | `false` | Show reported effort on compact rows; explicit empty effort means no level applies |
| `show_derived_label` | `false` | Annotate separately approved derived labels |
| `show_lifecycle` | `false` | Show hibernation, orphan and known pane-liveness annotations |
| `show_group_name` | `false` | Show approved group names in tab headings |
| `statuses` | `idle`, `working`, `waiting`, `done` | Local status selection; `[]` hides all rows. Include `unknown` explicitly to show unknown reports, detected-only/plain tabs and unreported orphans |
| `agent_types` | All types | Exact, case-sensitive reported agent types; omitted or `[]` means all |
| `include_inferred` | `true` | Include reports explicitly marked inferred |

Host entity mappings must be unique; display labels may repeat. Rosters must be `sensor.*`; connectivity must be `binary_sensor.*`. Only the documented settings and host properties are accepted. There are no URL, credential, action, or command settings.

The editor uses native HA `ha-selector` controls throughout: text for title/labels, single-select dropdowns for appearance/hosts/grouping, boolean selectors for independent information flags and inferred reports, a multi-select status list, and a custom-value multi-select for exact agent types. Add/Remove use native `ha-button`. It emits standard bubbling/composed `config-changed` events, preserves focused drafts through HA config echoes, and never copies integration secrets/options. An empty host list is an unconfigured state, not a healthy empty roster.

## Reading the card

The default is compact: card title, outer host headings and health, session/tab name and status. Hosts are always outer groups, ordered by display label then roster entity ID (fixed English collation); workspace/tab grouping is an explicit within-host choice. No auxiliary lines or empty metadata gaps appear until individually enabled.

- **Reported** means roster membership, not confirmed hook coverage. **Confirmed** requires `rich=true` and not inferred. `rich=false` is a weak report; absent `rich` has unknown origin. Explicit inferred status stays inferred; it does not become a confirmed completion.
- **OhMyPi uses native main-session status, model and thinking level by default.** Child sessions cannot overwrite them. Missing/stale/unsupported/invalid/conflicting native reports are Unknown; their essential source warning remains visible even when Unknown rows are filtered out. Healthy native rows add no collapsed strings unless model/effort are explicitly enabled. Expanded details show actual model/thinking metadata, native source health and owner-scoped background jobs; native activity/turn counters are unavailable. Done describes an observed main activity ending, not task success.
- **Filters are local.** Filtered / total reported counts and unfiltered summaries are independently opt-in. Filters never change HA summary counts, alerts, or baselines. Inventory-only detections are not added to the reported-agent denominator. Unknown reports, plain tabs, detections without a report and unreported orphans are hidden unless `statuses` includes `unknown`.
- **Hide missing compact metadata.** Null/blank model, unreported effort and absent session IDs do not create collapsed placeholders or empty metadata lines. Details show each actual value or Not reported, without guessing capability from versions. Native thinking `off` stays literal; stock effort `""` means None applicable. Stock activity counts reported tool completions; turns count reported settles, including interruption inference—not successful tasks or elapsed time.
- **Names require collector consent.** Explicit tab names take precedence over the ready native OMP session name, then the stock derived label. Both automatic sources require names/derived consent and a sound inventory join. Full native names avoid tty7's 40-character CLI truncation; stock fallback labels may already contain an ellipsis. Existing OMP processes must load the 0.4.6 extension to supply full names. No terminal capture, configuration/session-file scraping, Git or log lookup fills missing names.
- **Inventory is separate from roster health.** Optional informational state and receipt lines are hidden by default. Failed/stale inventory safety and inconsistent membership remain visible; retained inventory is last-known, not a new observation. Missing/disabled inventory revokes labels. HA owns receipt timestamps. Collection errors do not manufacture successful empty inventory.
- **Grouping is structural, not identity by text.** Source + workspace/tab IDs identify groups; names and ordinals may change. Pane joins require agreement between direct pane membership and tab membership. Ambiguity stays ungrouped, with pending reconciliation shown for inconsistent samples.
- **Split parents pair type and status.** Both come from the same most-urgent visible reported pane (waiting, working, done, unknown, idle); the optional type comes from that same representative after filtering. Tab detection never creates per-pane agents. Detected-only/plain tabs and unreported orphans appear only with explicit unknown opt-in. Hibernation and liveness are separate from agent work state and their labels are opt-in.
- **Expand to read the full session name.** Tap or click a row, or focus it and press Enter/Space. Its title wraps across as many lines as needed, including long names without spaces; collapsing restores the compact ellipsis. Details retain identifiers and provenance. Stable source/session/pane identities preserve expansion through heartbeat reorder and host filtering; replacement sessions do not inherit it. All incoming text is escaped.

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

Regression coverage includes compact omitted defaults, each independent informational option, explicit unknown rows, stable multi-host sorting and cross-host expansion isolation, native editor contract persistence, registry roles and renamed IDs, rich/empty-effort semantics, safe names and consent flags, filtered split representatives, tab-only detections, optional-section failure isolation, provenance, and live locale updates. Browser consumers exercise mobile/desktop keyboard/touch details, inert hostile text, overflow, reduced motion, HA-profile timestamps, and the native-surface boundary. Synthetic local native-control adapters are test-only and are not HA compatibility proof. Actual HA `ha-card`, selectors/buttons, registry/editor interactions, integration options, diagnostics and cache behavior require authorized isolated HA browser verification.

The module waits for the parsed `home-assistant` root to be defined before registering custom elements, so HA’s startup scoped-registry replacement does not strand early card/editor definitions. Local fixtures without that root register immediately; no polling or duplicate registrations are used.

## API and visual references

The frontend formatter follows pinned frontend 20260930.2’s [date/time helper](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_date_time.ts), [date ordering](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/format_date.ts), [time preference](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/use_am_pm.ts), and [timezone resolver](https://github.com/home-assistant/frontend/blob/20260930.2/src/common/datetime/resolve-time-zone.ts). Registry/editor references: [entity registry](https://github.com/home-assistant/frontend/blob/20260930.2/src/data/entity/entity_registry.ts), [device registry](https://github.com/home-assistant/frontend/blob/20260930.2/src/data/device/device_registry.ts), [HA selector](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-selector/ha-selector.ts), and [native ha-card](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-card.ts).

Native editor contracts use the same pinned frontend’s [select selector](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-selector/ha-selector-select.ts) (`multiple`, `custom_value`, `mode`, `options`) and [HA button](https://github.com/home-assistant/frontend/blob/20260930.2/src/components/ha-button.ts) (`size`, `appearance`, `variant`, `disabled`). Button appearance and controls remain owned by HA rather than custom input CSS.

The existing `tty7` palette and compact rows were independently adapted from upstream commit `8c5ea523b34a08362da54221ffb6246f43cebfc5`: [presets](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/presets.rs), [sidebar](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/tab_sidebar.rs), and [theme](https://github.com/l0ng-ai/tty7/blob/8c5ea523b34a08362da54221ffb6246f43cebfc5/src/ui/theme.rs). CSS and the generic local robot glyph are original; no upstream source, logos, fonts, or artwork were copied. No agent-specific icon lookup is attempted. This is not a pixel-parity claim about the installed tty7 GUI.
