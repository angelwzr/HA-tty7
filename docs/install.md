# Install HA-tty7

> Use matching 0.4.3 integration and collector versions. Update/restart HA first, then run the reporter installer. Existing OMP processes need `/restart` after their work finishes. A release does not authorize deployment to a household instance.

## Home Assistant

1. Add `https://github.com/angelwzr/HA-tty7` to **HACS → Custom repositories → Integration**. Install and restart HA.
2. Open **Settings → Devices & services → Add integration → HA-tty7**. Enter a unique source ID, display label and verified HTTPS HA base URL.
3. Choose optional waiting/completion notifications. Use an existing Companion action or HA persistent notifications.
4. Finish pairing. Keep the generated URL private; it is a bearer credential. **Configure** can show it again.
5. Add the **HA-tty7** card and select your host. No YAML/resource copying is needed.

HACS installs only the HA side. Each Linux user/host needs its own collector and pairing URL. Removing a host revokes its credential and monitoring entities.

## Linux collector

Requirements: Linux, Python 3.11+, util-linux `flock`, stock tty7 CLI at a stable absolute path, verified HTTPS access to HA. The installer reports missing dependencies; it never installs system packages or uses sudo.

Download the pinned installer, review it, then run it:

```sh
curl --fail --show-error --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/angelwzr/HA-tty7/v0.4.3/install.py \
  --output install-ha-tty7.py
python3 install-ha-tty7.py
```

New setup prompts for the HA host ID and a hidden pairing URL. Existing private pairing/settings are preserved without prompts. The script installs the pinned reporter wheel and managed global OMP extension, validates stock tty7 and verified HTTPS delivery, then enables/restarts only the user reporter service. It never needs sudo, an HA account token, lingering or a TLS bypass. Existing custom units are preserved with a review warning.

| Installer option | Purpose |
| --- | --- |
| `--tty7 PATH` | Use the stock CLI at this path; ephemeral AppImage CLIs are copied unchanged to a stable managed location |
| `--tty7-config-dir PATH` | Nondefault stock server directory for a new setup |
| `--ca-file PATH` | Trusted PEM CA for new pairing |
| `--wheel PATH` | Explicit matching local wheel; package installation can be offline, delivery is still verified |
| `--no-service` | Manual/container installation: no unit file or systemctl action |

Conflicting overrides to existing settings are refused rather than silently changing them. Managed paths must be owned and safe; symlink/public-secret paths are rejected.

### Manual source installation

From a matching downloaded source checkout:

```sh
install -d -m 700 ~/.local/share/ha-tty7
python3 -m venv ~/.local/share/ha-tty7/venv
~/.local/share/ha-tty7/venv/bin/python -m pip install .
~/.local/share/ha-tty7/venv/bin/python -I -m ha_tty7.omp_install
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

## Oh My Pi native status

The managed reporter is the default for **every OhMyPi pane**. There is no status-source opt-in or per-pane configuration. Other agent types keep stock tty7 reporting.

The host installer registers `~/.omp/agent/extensions/ha-tty7-status/index.ts`. New OMP processes load it through normal extension discovery. Existing OMP 18.10.3 sessions require `/restart` after foreground and background work finishes. `/reload-plugins` refreshes other resources but does not import newly installed extension modules; session-data reload is not extension reload either. There is no supported external non-disruptive hot-load API. The installer sends no terminal input, stops no OMP work, and never changes tty7's generated hook. Disabling OMP extension discovery also disables native reporting.

| Native observation | HA behavior |
| --- | --- |
| Main session, queued continuation, running owner jobs or pending result delivery | Working |
| Explicit ask/approval awaiting input | Waiting |
| Initial main session with no observed activity | Idle, not completion |
| Observed main activity ended with no pending work | Done; not proof of overall task success |
| Missing, stale, unsupported, invalid or conflicting reporter | Unknown with a concise card warning; no tty7 status fallback |

Child sessions never own pane status or metadata. Completion notifications are bounded/deduplicated per main session/run; reconnection and source recovery establish silent baselines. Source health and owner background count are in expanded details only. Native activity/turn counters remain unavailable instead of retaining tty7's child-contaminated counts. Permission mode remains stock-supplied only, never inferred.

The selected model (`provider/id`) and thinking level come from public `ctx.model` and `pi.getThinkingLevel()` on every native sample. Model and thinking-only changes refresh in place without a new run or notification. Literal `off` remains `off`; missing/throwing/invalid metadata getters produce null without breaking healthy status. Native values, including null, never fall back to another agent's stock metadata. Older status-only native records remain valid but cannot supply these new fields until the OMP process restarts with the updated extension.

The credential-free OMP extension writes exact scalar records into `~/.local/share/ha-tty7/omp-status/`: directory 0700, files 0600, atomic publication, two-second heartbeat and ten-second freshness. A permanent private lock coordinates publication and expired-record cleanup; it is not a network listener. No messages, tool arguments/results, command lines or job labels are written. The Python collector alone holds the pairing URL and sends the existing verified HTTPS reports.

Public OMP APIs are verified against 18.10.3; unavailable APIs report Unknown. This does not repair tty7's own GUI status/desktop notification hooks. To avoid duplicate phone pushes, choose either HA Companion notifications or forwarded OMP/tty7 desktop notifications—not both. Installation does not silently rewrite OS notification settings.

Manual wheel/source users must run `python -I -m ha_tty7.omp_install` from the reporter virtual environment once after upgrading; the normal installer runs it automatically.


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

The default is host-first sorting with only host, tab/session title and status. Unknown-status rows are hidden; selecting Unknown in the status filter explicitly opts in. All auxiliary receipts, counts, metadata and annotations have independent off-by-default card settings. Editor text/select/boolean controls and buttons use native HA components. Explicit saved settings remain honored.

Choose native HA or tty7 appearance and optional workspace/tab grouping. Multiple hosts are supported and sorted by display label with a stable roster-ID tie-break. Local filters affect only the view—not counts or alert baselines. English/Russian labels follow HA language; other languages fall back to English. Date/time follows HA profile preferences.

Grouping uses full source/workspace/tab IDs, not mutable names or ordinals. Split summaries keep agent and state from the same reported pane. Tab detection without lifecycle data stays **Unknown / Not reported**; it is not assigned to guessed panes. Orphans, hibernation and liveness remain separate from work state.

Fixed host entities expose roster/connectivity, provenance-aware counts, health, HA receipt times, optional inventory totals and source diagnostics. Counts become unavailable on the corresponding failure/staleness, never misleading zero. Device version is the integration version; tty7 and collector versions are separate diagnostics.

Stock tty7 may not report a model. Missing metadata is hidden in collapsed rows and explained as **Not reported** in expanded details, never guessed or supplied by a terminal patch. `effort = ""` explicitly means no level applies. Source diagnostics are not part of the card; use native diagnostic entities or the integration diagnostics download. Missing Codex sessions require a genuine enabled/trusted hook session; inspect Codex `/hooks` and start a fresh session if needed. This integration never trusts hooks or emits synthetic events.

Session/turn timestamps, token/context/cost values and GUI-local unread state are not in the current agent roster. No timer is derived from receipts, uptime, activity or turns.

## Notification templates

Open **Settings → Devices & services → HA-tty7 → Configure**. Edit **Notification title template** and **Notification message template**, then finish the settings flow.

Example title: `{tab_name}: {event}`. Example message: `{host_label} · {agent} · Pane {pane_id} · {event}`.

| Placeholders | Meaning |
| --- | --- |
| `{host_label}`, `{host_id}` | Configured source label/identity |
| `{agent}`, `{pane_id}`, `{session_id}`, `{status}` | Actual event metadata |
| `{event}`, `{event_type}` | Readable “needs input” / “completed”; fixed `needs_input` / `completed` kind |
| `{model}`, `{effort}`, `{permission_mode}` | Reported metadata; missing values empty, explicit empty effort is `None` |
| `{tab_name}`, `{workspace_name}` | Approved names only from fresh, consistent inventory with an exact unambiguous pane join; otherwise empty |

Each template allows up to 1024 characters. Use plain `{name}` placeholders and `{{` / `}}` for literal braces. Expressions/Jinja, attribute/index access, conversions, format specifications and unknown fields are rejected. User text is trusted; source values are escaped for Markdown/HTML before insertion. Titles flatten line breaks.

Templates change notification text only. Existing notification toggles, baseline suppression, hashed tags and fixed dashboard destination remain unchanged. Persistent notifications append the dashboard link; Companion notifications keep its click action. No credential, arbitrary URL or command placeholders exist.

## Updates and removal

1. Update/restart the HA integration **first**.
2. Run the matching host installer, preserving its existing virtual environment, private TOML and pairing URL.
3. In each already-running OMP process, use `/restart` only after its foreground and background work finishes. A new process/runtime is required to import the extension; do not use signals or session-file reload as a substitute.

New HA accepts older collector records. Older HA rejects the new native metadata: update HA before the host reporter. A missing native report is deliberately Unknown, not an older collector's guessed status. Scalar summaries from older missing-provenance records remain honest about unknown origin.

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
