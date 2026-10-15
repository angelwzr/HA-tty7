# Install HA-tty7

> Use matching 0.4.0 integration and collector versions. Update/restart HA first, then the collector. A release does not authorize deployment to a household instance.

## Home Assistant

1. Add `https://github.com/angelwzr/HA-tty7` to **HACS → Custom repositories → Integration**. Install and restart HA.
2. Open **Settings → Devices & services → Add integration → HA-tty7**. Enter a unique source ID, display label and verified HTTPS HA base URL.
3. Choose optional waiting/completion notifications. Use an existing Companion action or HA persistent notifications.
4. Finish pairing. Keep the generated URL private; it is a bearer credential. **Configure** can show it again.
5. Add the **HA-tty7** card and select your host. No YAML/resource copying is needed.

HACS installs only the HA side. Each Linux user/host needs its own collector and pairing URL. Removing a host revokes its credential and monitoring entities.

## Linux collector

Requirements: Python 3.11+, stock tty7 CLI at a stable absolute path, verified HTTPS access to HA.

From a matching downloaded source checkout:

```sh
python3 -m venv ~/.local/share/ha-tty7/venv
~/.local/share/ha-tty7/venv/bin/python -m pip install .
install -d -m 700 ~/.config/ha-tty7
install -m 600 examples/collector.toml ~/.config/ha-tty7/collector.toml
```

Edit `~/.config/ha-tty7/collector.toml` locally:

| Setting | Value |
| --- | --- |
| `host_id` | Same source ID used in HA |
| `tty7_path` | Stable stock CLI path—not an AppImage `/tmp/.mount_*` path |
| `tty7_config_dir` | Set only for a nondefault server directory |
| `webhook_url_file` | Private file containing only the pairing URL; relative to TOML |
| `ca_file` | Optional local PEM CA for a private certificate authority |

Create the URL file in a local editor, then set mode 600. Both configuration and URL must be privately owned regular files, not symlinks or group/world-readable files. Never put the URL in chat, Git, shell arguments, screenshots or logs. No HA account token belongs here.

Test a single delivery:

```sh
~/.local/share/ha-tty7/venv/bin/ha-tty7 --config ~/.config/ha-tty7/collector.toml --once
```

Exit 0 proves successful HTTP delivery of a valid roster; inspect HA's roster entity to confirm ingestion. Exit 1 means collection/validation/delivery failed. Exit 2 means invalid/private configuration. Logs contain fixed codes only.

## Optional names and inventory

Defaults: agent polling every 2 seconds, heartbeat every 15 seconds, inventory off, names off, safe source diagnostics on.

```toml
collect_inventory = true
include_names = true
include_derived_labels = false
collect_source = true
```

- `collect_inventory`: enables stock workspace/tab/pane readers and separate inventory health.
- `include_names`: shares explicit workspace/tab/pinned-group names. Requires inventory.
- `include_derived_labels`: separately shares fallback tab labels, which can contain terminal prose or directory basenames. Requires name consent.
- `collect_source`: shares build/dialects and last-sampled uptime, not PID/socket/path information.

Restart the collector after changing its file. Inventory/source sampling follows heartbeat cadence; cached inventory cannot refresh HA observation time. Failed reads keep explicitly last-known inventory, not empty success. Revoked name consent removes retained live labels even if the next read fails.

HA **Configure → Retain inventory** is a separate storage opt-in. Default storage excludes inventory; enabling it permits private labels to survive restart. Recorder exclusion is not the same as restore retention. Diagnostics exclude names, IDs, private paths and raw rosters regardless.

Bounds: 1 MiB raw command output; 256 KiB wire report; 256 agents; 64 workspaces, 256 tabs and 512 inventory panes. Inventory has one overall three-second transaction deadline. Agent/source reads are bounded; HTTPS has a five-second overall deadline. Unsafe poll/heartbeat budgets are rejected against HA's 45-second freshness window.

## Start automatically

After successful delivery and HA ingestion:

```sh
install -d ~/.config/systemd/user
install -m 644 deploy/ha-tty7.service ~/.config/systemd/user/ha-tty7.service
systemctl --user daemon-reload
systemctl --user enable --now ha-tty7.service
```

The user service uses the paths above, umask 0077 and no new privileges. It opens no inbound listener. User lingering is optional; enable it only if monitoring must survive logout and tty7 itself remains available.

## Card and entity behavior

Choose native HA or tty7 appearance, title, summary/model/effort/ID visibility, host/workspace/tab grouping, status/type filters and inferred-row inclusion in the visual editor. Filters affect only the view—not counts or alert baselines. English/Russian labels follow HA language; other languages fall back to English. Date/time follows HA profile preferences.

Grouping uses full source/workspace/tab IDs, not mutable names or ordinals. Split summaries keep agent and state from the same reported pane. Tab detection without lifecycle data stays **Unknown / Not reported**; it is not assigned to guessed panes. Orphans, hibernation and liveness remain separate from work state.

Fixed host entities expose roster/connectivity, provenance-aware counts, health, HA receipt times, optional inventory totals and source diagnostics. Counts become unavailable on the corresponding failure/staleness, never misleading zero. Device version is the integration version; tty7 and collector versions are separate diagnostics.

Stock tty7 may not report a model. The card shows **Not reported** rather than guessing or requiring a terminal patch. `effort = ""` explicitly means no level applies. Missing Codex sessions require a genuine enabled/trusted hook session; inspect Codex `/hooks` and start a fresh session if needed. This integration never trusts hooks or emits synthetic events.

Session/turn timestamps, token/context/cost values and GUI-local unread state are not in the current agent roster. No timer is derived from receipts, uptime, activity or turns.

## Updates and removal

1. Update/restart the HA integration **first**.
2. Reinstall the matching collector in its existing virtual environment.
3. Restart only `ha-tty7.service`. Keep its private TOML and pairing URL.

New HA accepts older collector records. Older HA versions reject new optional inventory/source sections and larger reports. Scalar summaries from older missing-provenance records remain honest about unknown origin.

To stop/remove a collector:

```sh
systemctl --user disable --now ha-tty7.service
rm ~/.config/systemd/user/ha-tty7.service
systemctl --user daemon-reload
```

Remove the corresponding HA host to revoke its credential. Delete private configuration only when no longer needed. These actions do not control tty7 sessions. HA may retain the harmless public static card route until restart.

## Release preparation

1. Finish and verify the **Unreleased** section in `CHANGELOG.md`.
2. For an actual release, move it to a version/date heading and align package/manifest/frontend cache versions.
3. Build the card, complete native HA/browser/privacy checks, then build the integration ZIP and collector wheel.
4. Generate Markdown notes with the release version and publish using a notes file—not a one-line `--notes` argument.

Local draft only:

```sh
python3 tools/release_notes.py --version Unreleased --output dist/RELEASE_NOTES.md
python3 tools/build_release.py
```

After a release section exists, replace `Unreleased` with that exact version. Publish with `--notes-file dist/RELEASE_NOTES.md` only when publication is authorized; otherwise keep artifacts local.

## Security and acceptance

Use local-only HA webhooks and verified HTTPS. Verify proxy/VPN source handling instead of disabling protections. Redact webhook paths in reverse-proxy/access logs. Notification destinations are existing persistent/Companion actions, never household controls.

No terminal/conversation/message, directory, launch-argument, process/port, Git, raw-event or log content is exported. No stock tty7 patch, private-wire reporter or model/config scraping is installed.

Native fixtures, live CLI/TLS ingestion, real HA UI and physical Android notification delivery are separate checks. Use isolated HA for acceptance/restart tests. Local verification does not imply household deployment or Android-delivery proof.
