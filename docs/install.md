# Install HA-tty7

## Home Assistant: HACS and UI setup

1. In HACS, open **Custom repositories**, add `https://github.com/angelwzr/HA-tty7`, and choose **Integration**. Download HA-tty7; restart if HACS asks.
2. Open **Settings > Devices & services > Add integration > HA-tty7**. Enter a unique host ID, display label, and the private verified HTTPS base URL used by that host to reach HA.
3. Choose optional waiting/completion notifications and an existing destination. The safe desktop destination is HA persistent notifications; Android uses the actual installed Companion notify action.
4. Complete the pairing step. Keep its generated HTTPS webhook URL private; it is that host's bearer credential. Options > Configure can show pairing information again. Removing the host revokes it.
5. In your dashboard editor choose **Add card > HA-tty7**. The visual editor discovers only this integration's hosts and lets you select/label them. No host YAML, secrets.yaml changes or JavaScript/resource copying is required.

HACS installs the HA side only. Install a collector for each Linux user/host running tty7. Multiple users on one machine use separate host IDs and pairing credentials.

## Linux collector

Requirements: Python 3.11+, installed tty7 CLI at a stable absolute path, working agent integrations, and verified HTTPS access to HA.

From the downloaded project/source checkout:

```sh
python3 -m venv ~/.local/share/ha-tty7/venv
~/.local/share/ha-tty7/venv/bin/python -m pip install .
install -d -m 700 ~/.config/ha-tty7
install -m 600 examples/collector.toml ~/.config/ha-tty7/collector.toml
```

Edit the private TOML file with the same host ID used in HA and the stable absolute tty7 executable path. The example uses `webhook_url_file = "webhook-url"`, resolved relative to the TOML file. Set `tty7_config_dir` if needed to reach that user's tty7 server.

Create `~/.config/ha-tty7/webhook-url` in your local editor with the generated pairing URL; set mode 600. Never paste it into chat, Git, shell arguments, screenshots or logs. Both files must be regular privately owned files, not symlinks or group/world-readable files.

Use tty7's supplied CLI installed at a stable user/system path, not an AppImage `/tmp/.mount_*` location. Check that the stable CLI can report the same agents before enabling a service.

For a private CA not trusted by the system, configure `ca_file` with the local PEM CA certificate. TLS certificate and hostname verification remain mandatory. No HA user or GitHub token belongs in collector settings.

Test one delivery:

```sh
~/.local/share/ha-tty7/venv/bin/ha-tty7 --config ~/.config/ha-tty7/collector.toml --once
```

Exit 0 means a valid snapshot was sent with successful HTTP delivery; observe HA's roster entity to verify acceptance. Exit 1 means CLI/read/payload/delivery failure. Structured read failures are reported as fixed error codes, never empty successful rosters. Exit 2 means invalid/private configuration. Logs contain fixed diagnostic codes only.

## Start the collector automatically

After successful once-mode acceptance:

```sh
install -d ~/.config/systemd/user
install -m 644 deploy/ha-tty7.service ~/.config/systemd/user/ha-tty7.service
systemctl --user daemon-reload
systemctl --user enable --now ha-tty7.service
```

The provided unit uses the virtual environment/configuration paths above, runs as the tty7 user, sets umask 0077 and no new privileges, and opens no inbound listener. Default polling is 2 seconds, heartbeat 15 seconds, CLI deadline 3 seconds, and overall DNS/TLS/HTTP deadline 5 seconds. A short-lived network worker is killed/reaped on timeout; credentials use its private stdin, never argv.

Bounds: 1 MiB raw CLI stdout, 256 agents, 64 KiB UTF-8 wire body. Poll/heartbeat settings must be finite and positive; keep heartbeat below HA's 45-second freshness interval. No durable old-message backlog is replayed after transport recovery.

The user service follows your user-manager lifetime. Enable user lingering only if you deliberately want monitoring after logout and understand tty7's own lifetime.

## Updates and removal

HACS handles HA integration updates; restart when requested. The bundled card URL is versioned, so normal updates load the new module without manual resource edits. Preserve host entries and private collector files.

For **0.3.0**, update/restart the HA integration **before** reinstalling the collector. New collectors preserve tty7's optional `inferred: true` provenance; older HA-tty7 validators reject that additional field. The 0.3.0 integration still accepts previous collector records. After updating HA, reinstall the collector in its existing virtual environment and restart only `ha-tty7.service`; preserve its private configuration and pairing URL.

In the card's visual editor, set **Card title** and choose **Home Assistant** appearance to follow native HA theme styling. Date/time display follows HA profile preferences and the selected local/server timezone.

If Codex is absent, use its `/hooks` screen to review/trust the tty7 handlers and start a fresh Codex session inside tty7. Hook installation does not activate an already-running or untrusted hook definition. Do not synthesize status events to make it appear.

On tty7 26.10.0, OMP model/effort reporting requires the separate supported upstream producer/emitter fix; updating this HA integration alone cannot populate fields tty7 never reports. Genuine session/turn timers are not available through the current tty7 roster.

Remove a host in HA to revoke its credential and remove its monitoring entities. Stop/remove only its collector service:

```sh
systemctl --user disable --now ha-tty7.service
rm ~/.config/systemd/user/ha-tty7.service
systemctl --user daemon-reload
```

These steps do not affect tty7 sessions or other services. Delete private files only when no longer needed. Unload/removal stops monitoring timers and unregisters project webhooks. HA may retain the harmless public bundled static-file route until restart; it serves no host data or credentials.

## Security and acceptance

Keep HA's webhook local-only policy and verified HTTPS; verify proxy/VPN source handling instead of disabling either. Redact webhook URL paths in existing reverse-proxy/access logs. Optional notifications accept only persistent notifications or installed Companion actions, never household control services.

The integration does not collect terminal/messages, workspace/Git/path/launch/process/port information or tty7 controls. Only the allowlisted structured fields reach HA/card. Entity attributes/diagnostics/card configuration never expose pairing credentials. HA owns freshness; phone clock differences do not invalidate valid rows.

Native fixtures, actual HACS download/update, real integration/card UI, collector TLS delivery and physical Android notification delivery are separate checks. Use an isolated HA instance for destructive lifecycle/restart tests; never point those fixtures at a household instance. No household deployment is implied by local acceptance.
