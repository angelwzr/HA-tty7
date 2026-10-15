"""Stock CLI privacy, consistency, cadence and strict optional wire extensions."""

import copy
from importlib.metadata import version
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from ha_tty7 import main
from ha_tty7.config import CollectorConfig, ConfigError, load_config
from ha_tty7.protocol import PayloadError, build_error, build_snapshot, decode_report, encode_report, normalize_agents
from test_contract import source_agent, wire_agent


def inventory():
    return {
        "kind": "snapshot", "sample_id": "sample-1", "consistent": True,
        "names_included": False, "derived_labels_included": False,
        "workspaces": [{"workspace_id": "ws-1", "name": None, "tab_count": 1, "pane_count": 1}],
        "tabs": [{"workspace_id": "ws-1", "tab_id": "tab-1", "ordinal": 1,
                  "name": None, "label": None, "detected_agent": "Oh My Pi", "pane_ids": [7],
                  "group_id": "group-1", "group_name": None, "hibernated": False}],
        "panes": [{"pane_id": 7, "workspace_id": "ws-1", "tab_id": "tab-1",
                   "live": True, "hibernated": False, "orphan": False}],
    }


def stock_outputs():
    return {
        "agents": {"agents": [source_agent(rich=False)]},
        "ws ls": {"workspaces": [{"id": "ws-1", "name": "PRIVATE_WS", "tabs": 1,
                                    "panes": 1, "attached": "PRIVATE_HOST"}]},
        "tab ls ws-1": {"workspace": "ws-1", "tabs": [{"id": "tab-1", "ordinal": 1,
            "name": "PRIVATE_TAB", "label": "PRIVATE_LABEL", "agent": "Oh My Pi", "panes": [7],
            "group": {"id": "group-1", "name": "PRIVATE_GROUP", "folder": "PRIVATE_PATH"},
            "hibernated": False}]},
        "pane ls": {"panes": [{"pane": 7, "workspace": "ws-1", "tab": "tab-1",
                                 "cwd": "PRIVATE_PATH", "live": True, "hibernated": False}]},
        "pane ls --all": {"panes": [{"pane": 7, "workspace": "ws-1", "owner": "PRIVATE_OWNER",
            "title": "PRIVATE_TITLE", "cwd": "PRIVATE_PATH", "live": True, "orphan": False}], "orphans": 0},
        "status": {"build": "26.10.0", "control_version": 12, "protocol_version": 6,
                   "uptime_secs": 123, "pid": 12345, "socket": "PRIVATE_SOCKET"},
    }


class ExtensionTests(unittest.TestCase):
    def test_empty_effort_and_both_rich_values_survive_round_trip(self):
        for rich in (True, False):
            agents = normalize_agents({"agents": [source_agent(rich=rich, readout={"effort": ""})]})
            decoded = decode_report(encode_report(build_snapshot("host", agents)), "host")
            self.assertEqual(decoded["agents"][0]["effort"], "")
            self.assertIs(decoded["agents"][0]["rich"], rich)
        for invalid in (None, 0, "false"):
            with self.assertRaises(PayloadError):
                build_snapshot("host", [wire_agent() | {"rich": invalid}])

    def test_optional_sections_round_trip_and_legacy_snapshot_still_works(self):
        source = {"state": "available", "collector_version": "0.4.0", "tty7_build": "26.10.0",
                  "control_version": 12, "protocol_version": 6, "uptime_secs": 123}
        report = build_snapshot("host", [], inventory=inventory(), source=source)
        self.assertEqual(decode_report(encode_report(report), "host")["inventory"], inventory())
        self.assertEqual(report["source"], source)
        self.assertNotIn("inventory", build_snapshot("host", []))

    def test_optional_sections_reject_injection_duplicates_unsafe_text_and_oversize(self):
        cases = []
        for key, value in (("private", "secret"), ("consistent", 1), ("sample_id", "")):
            bad = inventory(); bad[key] = value; cases.append(bad)
        for collection in ("workspaces", "tabs", "panes"):
            bad = inventory(); bad[collection].append(copy.deepcopy(bad[collection][0])); cases.append(bad)
            bad = inventory(); bad[collection][0]["cwd"] = "PRIVATE_PATH"; cases.append(bad)
        bad = inventory(); bad["tabs"][0]["pane_ids"] = [True]; cases.append(bad)
        bad = inventory(); bad["panes"][0]["pane_id"] = 2 ** 53; cases.append(bad)
        bad = inventory(); bad["names_included"] = True; bad["tabs"][0]["name"] = "bad\nname"; cases.append(bad)
        bad = inventory(); bad["tabs"][0]["label"] = "unconsented"; cases.append(bad)
        bad = inventory(); bad["tabs"] *= 257; cases.append(bad)
        for bad in cases:
            with self.subTest(bad=bad), self.assertRaises(PayloadError):
                build_snapshot("host", [], inventory=bad)
        source = {"state": "unavailable", "collector_version": "0.4.0", "tty7_build": None,
                  "control_version": None, "protocol_version": None, "uptime_secs": None}
        for patch_value in ({"pid": 1}, {"uptime_secs": True}, {"state": "private"}):
            with self.assertRaises(PayloadError):
                build_snapshot("host", [], source=source | patch_value)

    def test_inventory_error_is_scoped_and_new_unknown_envelope_keys_are_rejected(self):
        report = build_snapshot("host", [wire_agent()], inventory={"kind": "error", "error_code": "cli_timeout"})
        self.assertEqual(report["agents"], [wire_agent()])
        with self.assertRaises(PayloadError):
            encode_report(report | {"unknown_extension": {}})

    def test_larger_inventory_wire_can_cross_old_64k_limit_without_truncation(self):
        data = inventory()
        data["names_included"] = True
        data["tabs"] = [data["tabs"][0] | {"tab_id": f"tab-{n}", "name": "界" * 128, "pane_ids": []}
                        for n in range(200)]
        body = encode_report(build_snapshot("host", [], inventory=data))
        self.assertGreater(len(body), 65536)
        self.assertEqual(len(decode_report(body, "host")["inventory"]["tabs"]), 200)


class InventoryErrorConsentTests(unittest.TestCase):
    def test_error_carries_paired_privacy_revocation_without_a_new_sample(self):
        error = {"kind": "error", "error_code": "cli_failed",
                 "names_included": False, "derived_labels_included": False}
        report = build_snapshot("host", [], inventory=error)
        self.assertEqual(decode_report(encode_report(report), "host")["inventory"], error)
        self.assertNotIn("sample_id", report["inventory"])
        for bad in ({"names_included": False}, {"derived_labels_included": False},
                    {"names_included": False, "derived_labels_included": True},
                    {"names_included": 0, "derived_labels_included": False}):
            with self.assertRaises(PayloadError):
                build_snapshot("host", [], inventory={"kind": "error", "error_code": "cli_failed"} | bad)


class RosterErrorPrivacyWireTests(unittest.TestCase):
    def test_roster_error_privacy_policy_round_trips_without_observation_fields(self):
        policy = {"enabled": False, "names_included": False, "derived_labels_included": False}
        report = build_error("host", "cli_failed", inventory_privacy=policy)
        self.assertEqual(decode_report(encode_report(report), "host"), {
            "schema_version": 1, "host_id": "host", "kind": "error", "error_code": "cli_failed",
            "inventory_privacy": policy})
        self.assertEqual(build_error("host", "cli_failed"), {
            "schema_version": 1, "host_id": "host", "kind": "error", "error_code": "cli_failed"})
        for bad in ({"enabled": False}, policy | {"extra": "PRIVATE"},
                    policy | {"enabled": 0}, policy | {"names_included": True},
                    policy | {"enabled": True, "derived_labels_included": True}):
            with self.subTest(bad=bad), self.assertRaises(PayloadError):
                build_error("host", "cli_failed", inventory_privacy=bad)
        with self.assertRaises(PayloadError):
            encode_report(build_error("host", "cli_failed") | {"inventory_privacy": None})


class InventoryCollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def config(self, outputs=None, **options):
        executable = self.root / "tty7-test"
        data = stock_outputs() if outputs is None else outputs
        executable.write_text('#!/usr/bin/env python3\nimport json,sys,time\n'
            + 'outputs=' + repr(data) + '\n'
            + 'key=" ".join(sys.argv[2:])\n'
            + 'value=outputs[key]\n'
            + 'if value == "FAIL": sys.exit(2)\n'
            + 'if isinstance(value, list): time.sleep(value[0]); value=value[1]\n'
            + 'print(json.dumps(value))\n')
        executable.chmod(0o700)
        return CollectorConfig(host_id="host", tty7_path=executable,
            webhook_url="https://localhost/api/webhook/private", **options)

    def test_privacy_flags_remove_all_names_paths_and_source_private_fields(self):
        report = main.collect_report(self.config(collect_inventory=True))
        body = encode_report(report)
        self.assertNotIn(b"PRIVATE", body)
        self.assertEqual(report["inventory"] | {"sample_id": "sample-1"}, inventory())
        self.assertEqual(report["source"]["tty7_build"], "26.10.0")
        self.assertEqual(report["source"]["collector_version"], version("ha-tty7"))
        self.assertIs(report["agents"][0]["rich"], False)
        named = main.collect_report(self.config(collect_inventory=True, include_names=True))
        self.assertEqual(named["inventory"]["tabs"][0]["name"], "PRIVATE_TAB")
        self.assertIsNone(named["inventory"]["tabs"][0]["label"])
        derived = main.collect_report(self.config(collect_inventory=True, include_names=True, include_derived_labels=True))
        self.assertEqual(derived["inventory"]["tabs"][0]["label"], "PRIVATE_LABEL")
        self.assertNotIn(b"PRIVATE_PATH", encode_report(derived))

    def test_inventory_and_source_errors_do_not_erase_a_valid_roster(self):
        outputs = stock_outputs(); outputs["tab ls ws-1"] = "FAIL"; outputs["status"] = "FAIL"
        report = main.collect_report(self.config(outputs, collect_inventory=True))
        self.assertEqual(report["kind"], "snapshot")
        self.assertEqual(len(report["agents"]), 1)
        self.assertEqual(report["inventory"], {"kind": "error", "error_code": "cli_failed",
            "names_included": False, "derived_labels_included": False})
        self.assertEqual(report["source"]["state"], "unavailable")
        self.assertIsNone(report["source"]["tty7_build"])
        outputs["agents"] = "FAIL"
        self.assertEqual(main.collect_report(self.config(outputs))["kind"], "error")

    def test_orphans_survive_and_ambiguous_membership_is_never_guessed(self):
        outputs = stock_outputs()
        outputs["tab ls ws-1"]["tabs"].append(outputs["tab ls ws-1"]["tabs"][0] | {"id": "tab-2"})
        outputs["pane ls --all"]["panes"].append({"pane": 8, "workspace": None, "owner": "ws-1",
                                                    "orphan": True, "live": True})
        outputs["pane ls --all"]["orphans"] = 1
        report = main.collect_report(self.config(outputs, collect_inventory=True))
        data = report["inventory"]
        self.assertIs(data["consistent"], False)
        self.assertEqual(data["panes"][0]["tab_id"], None)
        self.assertEqual(data["panes"][1], {"pane_id": 8, "workspace_id": None,
            "tab_id": None, "live": True, "hibernated": False, "orphan": True})

    def test_ambiguous_hibernated_pane_keeps_observed_lifecycle(self):
        outputs = stock_outputs()
        outputs["tab ls ws-1"]["tabs"][0]["hibernated"] = True
        outputs["tab ls ws-1"]["tabs"].append(outputs["tab ls ws-1"]["tabs"][0] | {"id": "tab-2"})
        outputs["pane ls"]["panes"][0]["hibernated"] = True
        data = main.collect_report(self.config(outputs, collect_inventory=True))["inventory"]
        self.assertFalse(data["consistent"])
        self.assertIsNone(data["panes"][0]["tab_id"])
        self.assertIs(data["panes"][0]["hibernated"], True)

    def test_non_utf8_workspace_identifier_is_a_scoped_fixed_error(self):
        outputs = stock_outputs()
        outputs["ws ls"]["workspaces"][0]["id"] = "bad" + chr(0xD800)
        report = main.collect_report(self.config(outputs, collect_inventory=True))
        self.assertEqual(report["kind"], "snapshot")
        self.assertEqual(report["inventory"]["kind"], "error")
        self.assertEqual(report["inventory"]["error_code"], "invalid_payload")

    def test_inventory_has_one_deadline_for_the_whole_transaction(self):
        outputs = stock_outputs()
        outputs["ws ls"] = [0.12, outputs["ws ls"]]
        outputs["tab ls ws-1"] = [0.12, outputs["tab ls ws-1"]]
        started = time.monotonic()
        with patch("ha_tty7.tty7.CLI_TIMEOUT_SECONDS", 0.2):
            report = main.collect_report(self.config(outputs, collect_inventory=True, collect_source=False))
        self.assertEqual(report["inventory"], {"kind": "error", "error_code": "cli_timeout",
            "names_included": False, "derived_labels_included": False})
        self.assertLess(time.monotonic() - started, 0.5)

    def test_cached_inventory_keeps_sample_id_and_real_resample_changes_it(self):
        config = self.config(collect_inventory=True)
        sampler = main.Sampler()
        first = main.collect_report(config, sampler=sampler, now=0)
        # If either optional reader runs too early it would now fail, not replay the cached success.
        self.config({"agents": {"agents": []}})
        cached = main.collect_report(config, sampler=sampler, now=14)
        self.assertEqual(cached["inventory"], first["inventory"])
        self.assertEqual(cached["source"], first["source"])
        self.config()
        refreshed = main.collect_report(config, sampler=sampler, now=15)
        self.assertNotEqual(refreshed["inventory"]["sample_id"], first["inventory"]["sample_id"])

    def test_unsafe_heartbeat_budget_and_invalid_privacy_consent_are_rejected_safely(self):
        url = self.root / "url"; url.write_text("https://localhost/api/webhook/PRIVATE_SECRET"); url.chmod(0o600)
        config = self.root / "config.toml"; config.touch(mode=0o600)
        base = 'host_id="host"\ntty7_path="/usr/bin/tty7"\nwebhook_url_file="url"\n'
        for suffix in ('heartbeat_seconds=45\n', 'poll_seconds=40\nheartbeat_seconds=44\n',
                       'include_names=true\n', 'collect_inventory=true\ninclude_derived_labels=true\n',
                       'collect_inventory="true"\n'):
            config.write_text(base + suffix)
            with self.subTest(suffix=suffix):
                with self.assertRaises(ConfigError) as caught:
                    load_config(config)
                self.assertEqual(str(caught.exception), "invalid_config")

    def test_roster_error_forwards_current_inventory_privacy_without_optional_reads(self):
        sampler = main.Sampler()
        first = main.collect_report(self.config(collect_inventory=True, include_names=True,
            include_derived_labels=True), sampler=sampler, now=0)
        self.assertEqual(first["inventory"]["tabs"][0]["name"], "PRIVATE_TAB")
        for enabled, names, labels in ((False, False, False), (True, False, False),
                                      (True, True, False), (True, True, True)):
            for raw, code in (("FAIL", "cli_failed"), ({"agents": [None]}, "invalid_payload")):
                config = self.config({"agents": raw}, collect_inventory=enabled,
                    include_names=names, include_derived_labels=labels)
                report = main.collect_report(config, sampler=sampler, now=1)
                self.assertEqual(decode_report(encode_report(report), "host"), {
                    "schema_version": 1, "host_id": "host", "kind": "error", "error_code": code,
                    "inventory_privacy": {"enabled": enabled, "names_included": names,
                                          "derived_labels_included": labels}})
                self.assertEqual(sampler.last_sample, 0)

    def test_encoded_roster_failure_also_forwards_inventory_privacy(self):
        rows = [source_agent(pane, session_id="界" * 128, readout={
                    "model": "界" * 128, "effort": "界" * 128, "permission_mode": "界" * 128})
                for pane in range(1, 257)]
        report = main.collect_report(self.config({"agents": {"agents": rows}}, collect_source=False))
        self.assertEqual(decode_report(encode_report(report), "host"), {
            "schema_version": 1, "host_id": "host", "kind": "error",
            "error_code": "payload_too_large", "inventory_privacy": {
                "enabled": False, "names_included": False, "derived_labels_included": False}})
