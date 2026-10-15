# HA-tty7

Your tty7 agent sessions in Home Assistant. Read-only: no terminal access or remote controls.

> **0.4.2:** native OMP status is automatic. Update HA first, then the host reporter; restart existing OMP processes once their work is finished. [Release notes](CHANGELOG.md#042---2026-10-15) · [Downloads](https://github.com/angelwzr/HA-tty7/releases/tag/v0.4.2)

## Install

1. Add `https://github.com/angelwzr/HA-tty7` to **HACS → Custom repositories → Integration**. Install and restart HA.
2. Add **HA-tty7** under **Settings → Devices & services**. Create a host and keep its pairing URL private.
3. Run the [reporter installer](#install-the-host-reporter) in that host's terminal.
4. Add the **HA-tty7** dashboard card and select your host.

HACS installs the HA side only. Each monitored Linux user/host needs a collector and pairing URL.

### Install the host reporter

Linux with Python 3.11+, util-linux `flock` and stock tty7:

```sh
curl --fail --show-error --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/angelwzr/HA-tty7/v0.4.2/install.py \
  --output install-ha-tty7.py
python3 install-ha-tty7.py
```

Review the downloaded script before running it. It prompts for the host ID and a **hidden** pairing URL, preserves existing settings, and verifies delivery before starting the user service. No sudo or HA account token. [Installer details](docs/install.md#linux-collector)

## Display

| Surface | Shows |
| --- | --- |
| Card | Host, tab/session title and status by default; extra information is opt-in |
| Host entities | Provenance-aware counts, health and HA receipt timestamps |
| Inventory | Optional workspace/tab/pane totals, liveness, hibernation and orphans |
| Alerts | Optional waiting/completion notifications through HA or Android Companion |

Edit the card title and display options visually. **Home Assistant** appearance follows your theme; date/time follows your HA profile.

Hosts sort by name; unknown-status rows stay hidden unless selected. Diagnostics belong to HA's diagnostic entities/download, not the card. Notification title/message templates are editable under **HA-tty7 → Configure**. [Template fields](docs/install.md#notification-templates)

## Oh My Pi status

**Native OMP reporting is the default for every OhMyPi pane.** The host installer registers one managed extension; there is no per-pane toggle.

- New OMP processes pick it up automatically. In existing OMP 18.10.3 sessions, run `/restart` only after foreground/background work finishes; `/reload-plugins` does not import new extensions.
- Only the main session owns pane status. Child agents cannot overwrite it; pending continuations/background work keep it Working.
- Missing, stale or conflicting native reports become **Unknown**, with a card warning—not guessed Idle/Done.
- Completion means the observed main activity ended, not that the entire task succeeded. Each run alerts at most once.

This changes HA reporting, not tty7's own GUI hooks. [Setup and source limits](docs/install.md#oh-my-pi-native-status)

## Show tab names

In the collector's private TOML file:

```toml
collect_inventory = true
include_names = true
```

Restart only the collector. The main rows use approved tab names; workspace/tab grouping is optional.

Names are private and off by default. Derived fallback labels need separate consent: `include_derived_labels = true`. They can contain terminal prose or directory names. HA restart retention is another opt-in: **Configure → Retain inventory**.

[Privacy and collection settings](docs/install.md#optional-names-and-inventory) · [Card options](card/README.md)

## Source limits

- **Unmodified tty7, public OMP APIs.** OhMyPi status uses the managed native source; other agents use stock tty7. No terminal/config/session scraping or guessed models.
- Collapsed rows hide missing metadata. Expanded details explain **Not reported** values; empty effort explicitly means no level applies.
- Inferred and weak reports are labelled separately from structured hooks; they are not confirmed completion.
- Session/turn timers and token/cost metrics are unavailable through the current roster. Contact time is not session age.

Terminal contents, conversations, messages, paths, arguments, process/port data, Git data and raw logs/events are excluded. Pairing URLs are bearer secrets: keep them out of chat, Git and logs. Collectors use verified outbound HTTPS and open no inbound listener.

## Update

1. Update/restart the **HA integration first**.
2. Run the matching host reporter installer; it preserves pairing and updates the managed OMP extension.
3. In each already-running OMP session, use `/restart` after its work finishes. The installer never injects input or stops active jobs.

[Upgrade details](docs/install.md#updates-and-removal) · [Changelog](CHANGELOG.md)

## Develop and release

[Installation/build checks](docs/install.md) · [Native HA tests](integration-tests/README.md) · [Release checklist](docs/install.md#release-preparation)

Release notes come from the changelog's versioned Markdown section and use `--notes-file`, not a flattened paragraph. Local builds do not publish or deploy anything.

MIT project code; bundled Lit retains its BSD-3-Clause notices.
