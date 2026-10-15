# HA-tty7

Your tty7 agent sessions in Home Assistant. Read-only: no terminal access or remote controls.

> **0.4.0:** update the HA integration first, then the collector. [Release notes](CHANGELOG.md#040---2026-10-15) · [Downloads](https://github.com/angelwzr/HA-tty7/releases/tag/v0.4.0)

## Install

1. Add `https://github.com/angelwzr/HA-tty7` to **HACS → Custom repositories → Integration**. Install and restart HA.
2. Add **HA-tty7** under **Settings → Devices & services**. Create a host and keep its pairing URL private.
3. Follow the [Linux collector setup](docs/install.md#linux-collector) on that tty7 host.
4. Add the **HA-tty7** dashboard card and select your host.

HACS installs the HA side only. Each monitored Linux user/host needs a collector and pairing URL.

## Display

| Surface | Shows |
| --- | --- |
| Card | Status, reported model/effort, optional tab names/grouping and local filters |
| Host entities | Provenance-aware counts, health and HA receipt timestamps |
| Inventory | Optional workspace/tab/pane totals, liveness, hibernation and orphans |
| Alerts | Optional waiting/completion notifications through HA or Android Companion |

Edit the card title and display options visually. **Home Assistant** appearance follows your theme; date/time follows your HA profile.

## Show tab names

In the collector's private TOML file:

```toml
collect_inventory = true
include_names = true
```

Restart only the collector. Choose **Workspace** or **Tab** grouping in the card editor.

Names are private and off by default. Derived fallback labels need separate consent: `include_derived_labels = true`. They can contain terminal prose or directory names. HA restart retention is another opt-in: **Configure → Retain inventory**.

[Privacy and collection settings](docs/install.md#optional-names-and-inventory) · [Card options](card/README.md)

## Source limits

- **Stock tty7 only.** No patches, private-wire bypasses, terminal/config scraping or guessed models.
- Collapsed rows hide missing metadata. Expanded details explain **Not reported** values; empty effort explicitly means no level applies.
- Inferred and weak reports are labelled separately from structured hooks; they are not confirmed completion.
- Session/turn timers and token/cost metrics are unavailable through the current roster. Contact time is not session age.

Terminal contents, conversations, messages, paths, arguments, process/port data, Git data and raw logs/events are excluded. Pairing URLs are bearer secrets: keep them out of chat, Git and logs. Collectors use verified outbound HTTPS and open no inbound listener.

## Update

1. Update/restart the **HA integration first**.
2. Update the collector in its existing virtual environment.
3. Restart only `ha-tty7.service`; keep its configuration and pairing URL.

[Upgrade details](docs/install.md#updates-and-removal) · [Changelog](CHANGELOG.md)

## Develop and release

[Installation/build checks](docs/install.md) · [Native HA tests](integration-tests/README.md) · [Release checklist](docs/install.md#release-preparation)

Release notes come from the changelog's versioned Markdown section and use `--notes-file`, not a flattened paragraph. Local builds do not publish or deploy anything.

MIT project code; bundled Lit retains its BSD-3-Clause notices.
