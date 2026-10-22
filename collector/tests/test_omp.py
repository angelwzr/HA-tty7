"""Native main-agent observations at real collector and canonical wire boundaries."""

import copy
from dataclasses import replace
import fcntl
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import UUID

from ha_tty7.config import CollectorConfig
from ha_tty7.main import Sampler, collect_report
from ha_tty7.protocol import (
    PayloadError, build_snapshot, decode_report, encode_report, normalize_agents,
)


NOW = 1_800_000_000_000
REPORTER = "11111111-1111-4111-8111-111111111111"
OTHER_REPORTER = "22222222-2222-4222-8222-222222222222"


def stock(pane=7, agent="OhMyPi"):
    return {
        "pane_id": pane, "agent": agent,
        "state": {"session_id": "polluted-child", "status": "done", "activity": 4,
                  "turns": 9, "inferred": True, "rich": True,
                  "readout": {"model": "wrong-stock-child", "effort": "high", "permission_mode": "ask"}},
    }


def native(**updates):
    return {
        "schema_version": 1, "reporter_id": REPORTER, "pane_id": 7,
        "session_id": "real-main", "updated_at_ms": NOW, "status": "working",
        "run_id": "run-1", "background_jobs": 2, "health": "ready",
        "model": "openai/native-main", "effort": "low",
    } | updates


def ready_row():
    return {
        "pane_id": 7, "agent": "OhMyPi", "session_id": "real-main", "status": "working",
        "activity": None, "turns": None, "model": "openai/native-main", "effort": "low",
        "permission_mode": "ask", "rich": True,
        "omp": {"state": "ready", "run_id": "run-1", "background_jobs": 2,
                "outcome": None, "input_id": None},
    }


class NativeCollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.directory = self.home / ".local/share/ha-tty7/omp-status"
        self.directory.mkdir(parents=True, mode=0o700)
        for replacement in (
            patch("pathlib.Path.home", return_value=self.home),
            patch("time.time", return_value=NOW / 1000),
        ):
            replacement.start()
            self.addCleanup(replacement.stop)
        self.cli = self.home / "tty7-fixture"
        self.config = CollectorConfig(host_id="host", tty7_path=self.cli,
            webhook_url="https://localhost/api/webhook/fixture", collect_source=False)
        self.cli_rows([stock()])

    def cli_rows(self, rows):
        self.cli.write_text("#!/usr/bin/env python3\nimport json,sys\n"
            "assert sys.argv[1:] == ['--json', 'agents']\n"
            f"print({json.dumps(json.dumps({'agents': rows}))})\n")
        self.cli.chmod(0o700)

    def write_record(self, data=None, *, filename=None):
        data = native() if data is None else data
        path = self.directory / (filename or data["reporter_id"] + ".json")
        path.write_text(json.dumps(data))
        path.chmod(0o600)
        return path

    def overlay(self, rows=None, *, now=NOW, **options):
        from ha_tty7.omp import apply_native_status
        return apply_native_status(normalize_agents({"agents": [stock()] if rows is None else rows}),
                                   directory=self.directory, now_ms=now, **options)

    def assert_unavailable(self, row, state):
        self.assertEqual(row["status"], "unknown")
        self.assertIsNone(row["session_id"])
        self.assertIsNone(row["activity"])
        self.assertIsNone(row["turns"])
        self.assertIsNone(row["model"])
        self.assertIsNone(row["effort"])
        self.assertIs(row["rich"], False)
        self.assertNotIn("inferred", row)
        self.assertEqual(row["omp"], {"state": state, "run_id": None, "background_jobs": None,
                                     "outcome": None, "input_id": None})

    def test_session_name_defaults_private_and_grant_revocation_is_immediate(self):
        title = "Synthetic complete session title beyond forty characters — 😀"
        self.write_record(native(session_name=title))
        self.assertEqual(self.overlay()[0], ready_row())
        marker = self.directory / ".names-enabled"
        self.assertFalse(marker.exists())
        row = self.overlay(include_session_names=True)[0]
        self.assertEqual(row["omp"]["session_name"], title)
        self.assertEqual(marker.read_bytes(), b"1\n")
        self.assertEqual(marker.stat().st_mode & 0o7777, 0o600)
        before = marker.stat()
        self.overlay(include_session_names=True)
        self.assertEqual((marker.stat().st_ino, marker.stat().st_mtime_ns),
                         (before.st_ino, before.st_mtime_ns))
        self.assertEqual(decode_report(encode_report(build_snapshot("host", [row])), "host")["agents"], [row])
        self.assertEqual(self.overlay()[0], ready_row())
        self.assertFalse(marker.exists())
        self.assertEqual(self.overlay(include_session_names=True, now=NOW + 10001)[0]["omp"].get("session_name"), None)

    def test_name_policy_refuses_unsafe_markers_without_breaking_status(self):
        self.write_record(native(session_name="PRIVATE"))
        marker = self.directory / ".names-enabled"
        target = self.home / "target"
        target.write_bytes(b"1\n")
        target.chmod(0o600)
        for kind in ("symlink", "hardlink", "public", "invalid", "directory"):
            with self.subTest(kind=kind):
                if kind == "symlink":
                    marker.symlink_to(target)
                elif kind == "hardlink":
                    os.link(target, marker)
                elif kind == "directory":
                    marker.mkdir()
                else:
                    marker.write_bytes(b"bad" if kind == "invalid" else b"1\n")
                    marker.chmod(0o644 if kind == "public" else 0o600)
                try:
                    self.assertEqual(self.overlay(include_session_names=True)[0], ready_row())
                    self.assertEqual(self.overlay()[0], ready_row())
                    self.assertTrue(marker.exists())
                finally:
                    if kind == "directory":
                        marker.rmdir()
                    else:
                        marker.unlink()
        self.assertEqual(target.read_bytes(), b"1\n")

    def test_policy_write_failure_and_lock_contention_suppress_name_not_status(self):
        self.write_record(native(session_name="PRIVATE"))
        with patch("ha_tty7.omp.os.replace", side_effect=PermissionError):
            self.assertEqual(self.overlay(include_session_names=True)[0], ready_row())
        self.assertFalse(list(self.directory.glob("*.tmp")))
        self.overlay(include_session_names=True)
        with patch("ha_tty7.omp.os.unlink", side_effect=PermissionError):
            self.assertEqual(self.overlay()[0], ready_row())
        self.assertTrue((self.directory / ".names-enabled").exists())
        lock = os.open(self.directory / ".publish.lock", os.O_RDWR)
        self.addCleanup(os.close, lock)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.assertEqual(self.overlay()[0], ready_row())
        self.assertEqual(self.overlay(include_session_names=True)[0], ready_row())

    def test_missing_directory_is_not_created_for_consent_and_next_poll_grants(self):
        self.directory.rmdir()
        row = self.overlay(include_session_names=True)[0]
        self.assert_unavailable(row, "missing")
        self.assertFalse(self.directory.exists())
        self.directory.mkdir(mode=0o700)
        self.write_record(native(session_name="Full synthetic session title beyond forty characters"))
        row = self.overlay(include_session_names=True)[0]
        self.assertEqual(row["omp"]["session_name"], "Full synthetic session title beyond forty characters")

    def test_invalid_optional_native_names_do_not_poison_healthy_status(self):
        for name in (None, "", " ", [], {}, 1, "x" * 257, "\ud800", "a\nb", "a\x7fb", "a\x85b"):
            with self.subTest(name=name):
                self.write_record(native(session_name=name))
                row = self.overlay(include_session_names=True)[0]
                self.assertEqual(row["omp"].get("session_name"), None)
                self.assertEqual(row["status"], "working")
                self.assertEqual(row["omp"]["run_id"], "run-1")
        self.write_record(native(session_name="😀" * 256))
        self.assertEqual(self.overlay(include_session_names=True)[0]["omp"]["session_name"], "😀" * 256)

    def test_main_passes_exact_consent_even_when_inventory_fails(self):
        self.write_record(native(session_name="Full synthetic session title beyond forty characters"))
        for enabled, names, derived in ((False, True, True), (True, False, True),
                                        (True, True, False), (True, True, True)):
            config = replace(self.config, collect_inventory=enabled, include_names=names,
                             include_derived_labels=derived)
            with patch("ha_tty7.main.read_inventory", side_effect=PayloadError()):
                report = collect_report(config)
            self.assertEqual(report["kind"], "snapshot")
            self.assertEqual(report["agents"][0]["omp"].get("session_name") is not None,
                             enabled and names and derived)

    def test_optout_revokes_local_grant_even_when_roster_read_fails(self):
        self.write_record(native(session_name="PRIVATE"))
        self.overlay(include_session_names=True)
        marker = self.directory / ".names-enabled"
        self.assertTrue(marker.exists())
        with patch("ha_tty7.main.read_agents", side_effect=PayloadError()):
            report = collect_report(self.config)
        self.assertEqual(report["kind"], "error")
        self.assertFalse(marker.exists())

    def test_pruning_named_records_keeps_malformed_optional_name_files(self):
        expired = self.write_record(native(session_name="Full synthetic session name",
                                           updated_at_ms=NOW - 60000))
        malformed = self.write_record(native(reporter_id=OTHER_REPORTER,
            session_name={"custom": "not a generated scalar"}, updated_at_ms=NOW - 60000))
        self.overlay()
        self.assertFalse(expired.exists())
        self.assertTrue(malformed.exists())

    def test_notification_proof_roundtrips_and_unavailable_overlay_clears_it(self):
        for outcome in ("completed", "failed", "cancelled"):
            self.write_record(native(status="done", background_jobs=0, outcome=outcome, input_id=None))
            row = self.overlay()[0]
            self.assertEqual(row["omp"]["outcome"], outcome)
            self.assertIsNone(row["omp"]["input_id"])
            self.assertEqual(decode_report(encode_report(build_snapshot("host", [row])), "host")["agents"], [row])
        self.write_record(native(status="waiting", input_id="opaque-request", outcome=None))
        self.assertEqual(self.overlay()[0]["omp"]["input_id"], "opaque-request")
        self.assert_unavailable(self.overlay(now=NOW + 10001)[0], "stale")

    def test_legacy_done_record_remains_readable_without_notification_proof(self):
        self.write_record(native(status="done", background_jobs=0))
        row = self.overlay()[0]
        self.assertEqual(row["status"], "done")
        self.assertIsNone(row["omp"]["outcome"])
        self.assertIsNone(row["omp"]["input_id"])
        self.assertEqual(decode_report(encode_report(build_snapshot("host", [row])), "host")["agents"], [row])

    def test_native_notification_proof_rejects_contradictory_or_untrusted_fields(self):
        for fields in (
            {"outcome": "completed"}, {"outcome": "failed", "status": "waiting"},
            {"outcome": "cancelled", "status": "done", "background_jobs": 1},
            {"outcome": "completed", "status": "done", "background_jobs": 0, "run_id": None},
            {"outcome": "completed", "status": "done", "background_jobs": 0, "input_id": "request"},
            {"outcome": []}, {"outcome": "error"}, {"input_id": "request"},
            {"status": "waiting", "input_id": ""},
            {"status": "waiting", "input_id": "\ud800"},
            {"status": "waiting", "input_id": "x" * 129},
            {"status": "waiting", "input_id": {"private": "value"}},
            {"status": "waiting", "input_id": "request", "run_id": None},
            {"status": "waiting", "input_id": "request", "health": "unsupported"},
        ):
            with self.subTest(fields=fields):
                self.write_record(native(**fields))
                self.assert_unavailable(self.overlay()[0], "invalid")

    def test_default_missing_native_source_never_uses_stock_child_state(self):
        self.directory.rmdir()
        self.cli_rows([stock(), stock(8), stock(9, "ClaudeCode")])
        report = collect_report(self.config)
        self.assertEqual(report["kind"], "snapshot")
        for row in report["agents"][:2]:
            self.assert_unavailable(row, "missing")
        self.assertEqual(report["agents"][2], normalize_agents({"agents": [stock(9, "ClaudeCode")]})[0])

    def test_default_native_ready_overrides_child_polluted_stock_and_roundtrips_privately(self):
        self.write_record()
        report = collect_report(self.config)
        self.assertEqual(report["agents"], [ready_row()])
        self.assertEqual((report["agents"][0]["model"], report["agents"][0]["effort"]),
                         ("openai/native-main", "low"))
        body = encode_report(report)
        self.assertEqual(decode_report(body, "host"), report)
        for excluded in (REPORTER.encode(), b"updated_at_ms", b"reporter_id", b"polluted-child"):
            self.assertNotIn(excluded, body)

    def test_nullable_and_omitted_native_metadata_never_resurrects_stock_child(self):
        for fields, expected in (
            ({"model": None, "effort": None}, (None, None)),
            ({}, (None, None)),
            ({"model": "anthropic/native-main"}, ("anthropic/native-main", None)),
            ({"effort": "off"}, (None, "off")),
            ({"model": None, "effort": "medium"}, (None, "medium")),
            ({"model": "openai/native-main", "effort": None}, ("openai/native-main", None)),
        ):
            with self.subTest(fields=fields):
                data = native()
                del data["model"], data["effort"]
                self.write_record(data | fields)
                report = collect_report(self.config)
                row = report["agents"][0]
                self.assertEqual((row["model"], row["effort"]), expected)
                self.assertEqual((row["session_id"], row["status"], row["omp"]),
                    ("real-main", "working", ready_row()["omp"]))
                body = encode_report(report)
                self.assertEqual(decode_report(body, "host"), report)
                for excluded in (b"wrong-stock-child", REPORTER.encode(), b"updated_at_ms", b"reporter_id"):
                    self.assertNotIn(excluded, body)

    def test_metadata_changes_refresh_existing_main_session_run_and_status(self):
        sampler = Sampler()
        for poll, fields in enumerate((
            {"model": "openai/native-main", "effort": "low"},
            {"model": "anthropic/changed-main", "effort": "low"},
            {"model": "anthropic/changed-main", "effort": "off"},
            {"model": None, "effort": None},
        )):
            with self.subTest(fields=fields):
                self.write_record(native(**fields))
                row = collect_report(self.config, sampler=sampler, now=poll)["agents"][0]
                self.assertEqual((row["model"], row["effort"]), (fields["model"], fields["effort"]))
                self.assertEqual((row["session_id"], row["status"], row["omp"]),
                    ("real-main", "working", ready_row()["omp"]))

    def test_native_metadata_accepts_utf8_codepoint_boundary_and_literal_off(self):
        self.write_record(native(model="界" * 128, effort="off"))
        report = collect_report(self.config)
        self.assertEqual((report["agents"][0]["model"], report["agents"][0]["effort"]),
                         ("界" * 128, "off"))
        self.assertEqual(decode_report(encode_report(report), "host"), report)
        self.write_record(native(model="openai/native-main", effort="é" * 128))
        self.assertEqual(collect_report(self.config)["agents"][0]["effort"], "é" * 128)

    def test_invalid_native_metadata_rejects_entire_record_without_forwarding_private_data(self):
        for field in ("model", "effort"):
            for value in ("", " \t\n", "x" * 129, "界" * 129, "\ud800", True, 1,
                          [], {"prompt": "PRIVATE_INJECTION"}):
                with self.subTest(field=field, value=value):
                    self.write_record(native(**{field: value}))
                    report = collect_report(self.config)
                    self.assert_unavailable(report["agents"][0], "invalid")
                    self.assertNotIn(b"PRIVATE", encode_report(report))
        for extra in ("prompt", "provider", "model_name", "api_key", "baseURL"):
            with self.subTest(extra=extra):
                self.write_record(native(**{extra: "PRIVATE_INJECTION"}))
                report = collect_report(self.config)
                self.assert_unavailable(report["agents"][0], "invalid")
                self.assertNotIn(b"PRIVATE", encode_report(report))
        path = self.write_record()
        path.write_bytes(json.dumps(native()).encode().replace(b"openai/native-main", b"\xff"))
        self.assert_unavailable(collect_report(self.config)["agents"][0], "invalid")
        path.write_text(json.dumps(native())[:-1] + ',"model":"PRIVATE_DUPLICATE"}')
        report = collect_report(self.config)
        self.assert_unavailable(report["agents"][0], "invalid")
        self.assertNotIn(b"PRIVATE", encode_report(report))

    def test_every_poll_observes_background_status_and_source_recovery(self):
        path = self.write_record()
        sampler = Sampler()
        first = collect_report(self.config, sampler=sampler, now=0)
        self.assertEqual(first["agents"][0]["omp"]["background_jobs"], 2)
        self.write_record(native(status="waiting", background_jobs=1))
        waiting = collect_report(self.config, sampler=sampler, now=1)
        self.assertEqual(waiting["agents"][0]["status"], "waiting")
        self.assertEqual(waiting["agents"][0]["omp"]["background_jobs"], 1)
        path.unlink()
        self.assert_unavailable(collect_report(self.config, sampler=sampler, now=2)["agents"][0], "missing")
        self.write_record(native(status="working", background_jobs=1))
        recovered = collect_report(self.config, sampler=sampler, now=3)["agents"][0]
        self.assertEqual((recovered["status"], recovered["session_id"], recovered["omp"]["run_id"]),
                         ("working", "real-main", "run-1"))
        self.write_record(native(status="done", background_jobs=0))
        completed = collect_report(self.config, sampler=sampler, now=4)["agents"][0]
        self.assertEqual((completed["status"], completed["omp"]["background_jobs"]), ("done", 0))

    def test_native_main_can_join_empty_stock_roster_without_synthetic_session(self):
        self.cli_rows([])
        self.write_record(native(pane_id=11))
        row = collect_report(self.config)["agents"][0]
        self.assertEqual((row["pane_id"], row["agent"], row["session_id"]), (11, "OhMyPi", "real-main"))
        self.assertEqual((row["model"], row["effort"]), ("openai/native-main", "low"))
        self.assertEqual(row["omp"]["state"], "ready")

    def test_native_source_does_not_turn_a_cli_failure_into_a_snapshot(self):
        self.write_record()
        self.cli.write_text("#!/usr/bin/env python3\nraise SystemExit(2)\n")
        report = collect_report(self.config)
        self.assertEqual((report["kind"], report["error_code"]), ("error", "cli_failed"))
        self.assertNotIn("agents", report)

    def test_other_agents_are_unchanged_even_when_native_claims_their_pane(self):
        rows = [stock(7, "ClaudeCode"), stock(8)]
        original = normalize_agents({"agents": rows})
        self.write_record()
        result = self.overlay(rows)
        self.assertEqual(result[0], original[0])
        self.assert_unavailable(result[1], "missing")
        self.assertEqual(original, normalize_agents({"agents": rows}))

    def test_stale_future_unsupported_and_conflicting_reporters_fail_closed(self):
        for data, state in (
            (native(updated_at_ms=NOW - 10001), "stale"),
            (native(updated_at_ms=NOW + 1), "invalid"),
            (native(health="unsupported"), "unsupported"),
        ):
            with self.subTest(state=state):
                self.write_record(data)
                self.assert_unavailable(self.overlay()[0], state)
        self.write_record()
        self.write_record(native(reporter_id=OTHER_REPORTER, session_id="other-main"))
        self.assert_unavailable(self.overlay()[0], "conflict")

    def test_freshness_boundary_and_old_reporter_do_not_conflict_with_fresh_owner(self):
        self.write_record(native(updated_at_ms=NOW - 10000))
        self.assertEqual(self.overlay()[0]["omp"]["state"], "ready")
        self.write_record(native(updated_at_ms=NOW - 10001))
        self.write_record(native(reporter_id=OTHER_REPORTER, session_id="new-main"))
        row = self.overlay()[0]
        self.assertEqual((row["session_id"], row["omp"]["state"]), ("new-main", "ready"))

    def test_unsafe_directory_and_record_types_never_follow_links_or_trust_stock(self):
        path = self.write_record()
        self.directory.chmod(0o755)
        self.assert_unavailable(self.overlay()[0], "invalid")
        self.directory.chmod(0o700)
        path.chmod(0o644)
        self.assert_unavailable(self.overlay()[0], "invalid")
        path.unlink()
        outside = self.home / "outside.json"
        outside.write_text(json.dumps(native()))
        outside.chmod(0o600)
        path.symlink_to(outside)
        self.assert_unavailable(self.overlay()[0], "invalid")
        self.assertTrue(outside.exists())
        path.unlink()
        os.mkfifo(path, 0o600)
        self.assert_unavailable(self.overlay()[0], "invalid")
        path.unlink()
        self.directory.rename(self.directory.with_name("real-status"))
        self.directory.symlink_to(self.directory.with_name("real-status"), target_is_directory=True)
        self.assert_unavailable(self.overlay()[0], "invalid")

    def test_invalid_injected_oversized_or_filename_mismatched_records_fail_closed(self):
        cases = (
            native(message="PRIVATE_INJECTION"), native(schema_version=True),
            native(schema_version=2), native(pane_id=True), native(background_jobs=True),
            native(background_jobs=-1), native(background_jobs=9007199254740992),
            native(session_id=""), native(session_id="x" * 129), native(run_id=""),
            native(run_id="x" * 129), native(updated_at_ms=True),
            native(status="PRIVATE_STATUS"), native(health="PRIVATE_HEALTH"),
        )
        for data in cases:
            with self.subTest(data=data):
                self.write_record(data)
                row = self.overlay()[0]
                self.assert_unavailable(row, "invalid")
                self.assertNotIn(b"PRIVATE", encode_report(build_snapshot("host", [row])))
        self.write_record(native(reporter_id=OTHER_REPORTER), filename=REPORTER + ".json")
        self.assert_unavailable(self.overlay()[0], "invalid")
        path = self.write_record()
        path.write_bytes(b" " * 4097)
        self.assert_unavailable(self.overlay()[0], "invalid")
        path.write_text(json.dumps(native())[:-1] + ',"pane_id":8}')
        self.assert_unavailable(self.overlay()[0], "invalid")

    def test_excess_live_reporters_fail_closed_without_partial_native_roster(self):
        for number in range(1, 258):
            self.write_record(native(reporter_id=str(UUID(int=number)), pane_id=number))
        rows = self.overlay()
        self.assertEqual(len(rows), 1)
        self.assert_unavailable(rows[0], "invalid")

    def test_heartbeat_published_during_scan_is_evaluated_at_read_time(self):
        from ha_tty7 import omp
        self.write_record()
        original_read = omp._read_record
        observed_time = [NOW]

        def publish_before_read(fd, name):
            observed_time[0] += 1
            self.write_record(native(updated_at_ms=observed_time[0]))
            return original_read(fd, name)

        with patch("ha_tty7.omp._read_record", side_effect=publish_before_read), \
                patch("time.time", side_effect=lambda: observed_time[0] / 1000):
            report = collect_report(self.config)
        self.assertEqual(report["agents"], [ready_row()])

    def test_atomic_replacement_between_path_lookup_and_open_remains_ready(self):
        self.write_record()
        real_open = os.open
        replaced = False

        def replacing_open(path, flags, *args, **kwargs):
            nonlocal replaced
            if path == REPORTER + ".json" and not replaced:
                replacement = self.write_record(native(session_id="replacement-main"),
                                                filename="publication.tmp")
                replacement.replace(self.directory / (REPORTER + ".json"))
                replaced = True
            return real_open(path, flags, *args, **kwargs)

        with patch("ha_tty7.omp.os.open", side_effect=replacing_open):
            row = self.overlay()[0]
        self.assertEqual((row["omp"]["state"], row["session_id"]), ("ready", "replacement-main"))

    def test_shared_publication_prevents_pruning_a_replaced_live_record(self):
        from ha_tty7 import omp
        path = self.write_record(native(updated_at_ms=NOW - 60000))
        lock_path = self.directory / ".publish.lock"
        lock_fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
        self.addCleanup(os.close, lock_fd)
        fcntl.flock(lock_fd, fcntl.LOCK_SH)
        original_prune = omp._prune
        real_stat = os.stat
        pruning = False
        published = False

        def publish():
            nonlocal published
            replacement = self.write_record(native(session_id="fresh-main"), filename="publication.tmp")
            replacement.replace(path)
            published = True

        def publishing_stat(name, *args, **kwargs):
            info = real_stat(name, *args, **kwargs)
            # Deterministically publish in the old check->unlink window. A correct
            # collector cannot enter that window while the writer holds LOCK_SH.
            if pruning and name == REPORTER + ".json" and not published:
                publish()
            return info

        def coordinated_prune(*args, **kwargs):
            nonlocal pruning
            pruning = True
            try:
                return original_prune(*args, **kwargs)
            finally:
                pruning = False

        with patch("ha_tty7.omp._prune", side_effect=coordinated_prune), \
                patch("ha_tty7.omp.os.stat", side_effect=publishing_stat):
            self.overlay()
        self.assertTrue(path.exists(), "collector deleted a record during shared publication")
        if not published:
            publish()
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        row = self.overlay()[0]
        self.assertEqual((row["omp"]["state"], row["session_id"]), ("ready", "fresh-main"))
        self.assertTrue(lock_path.exists())

    def test_busy_prune_lock_never_invalidates_other_fresh_native_rows(self):
        expired = self.write_record(native(updated_at_ms=NOW - 60000))
        self.write_record(native(reporter_id=OTHER_REPORTER, pane_id=8))
        lock_path = self.directory / ".publish.lock"
        lock_fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
        self.addCleanup(os.close, lock_fd)
        fcntl.flock(lock_fd, fcntl.LOCK_SH)
        rows = self.overlay([stock(), stock(8)])
        self.assertTrue(expired.exists())
        self.assertEqual(rows[1]["omp"]["state"], "ready")
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        self.overlay()
        self.assertFalse(expired.exists())
        self.assertTrue(lock_path.exists())

    def test_unsafe_prune_locks_are_not_followed_or_used_for_deletion(self):
        expired = self.write_record(native(updated_at_ms=NOW - 60000))
        outside = self.home / "unrelated"
        outside.write_text("preserve")
        outside.chmod(0o600)
        lock_path = self.directory / ".publish.lock"
        lock_path.symlink_to(outside)
        self.assert_unavailable(self.overlay()[0], "stale")
        self.assertTrue(expired.exists())
        self.assertEqual(outside.read_text(), "preserve")
        lock_path.unlink()
        os.link(outside, lock_path)
        self.overlay()
        self.assertTrue(expired.exists())
        self.assertEqual(outside.read_text(), "preserve")
        lock_path.unlink()
        lock_path.write_text("")
        lock_path.chmod(0o644)
        self.overlay()
        self.assertTrue(expired.exists())

    def test_prunes_only_owned_expired_generated_records_not_arbitrary_files(self):
        expired = self.write_record(native(updated_at_ms=NOW - 60000))
        stale = self.write_record(native(reporter_id=OTHER_REPORTER, updated_at_ms=NOW - 59999))
        arbitrary = self.directory / "do-not-delete.json"
        arbitrary.write_text(json.dumps(native(updated_at_ms=NOW - 60000)))
        arbitrary.chmod(0o600)
        self.overlay()
        self.assertFalse(expired.exists())
        self.assertTrue(stale.exists())
        self.assertTrue(arbitrary.exists())


class NativeWireTests(unittest.TestCase):
    def test_session_name_wire_is_optional_nullable_exact_and_ready_only(self):
        for name in (None, "Full synthetic session title beyond forty characters 😀", "😀" * 256):
            row = ready_row()
            row["omp"]["session_name"] = name
            self.assertEqual(decode_report(encode_report(build_snapshot("host", [row])), "host")["agents"], [row])
        for name in ("", " ", {}, [], 1, "x" * 257, "\ud800", "a\nb", "a\x7fb", "a\x85b"):
            row = ready_row()
            row["omp"]["session_name"] = name
            with self.subTest(name=name), self.assertRaises(PayloadError):
                build_snapshot("host", [row])
        for state in ("missing", "stale", "invalid", "conflict", "unsupported"):
            row = ready_row() | {"session_id": None, "status": "unknown", "rich": False,
                "omp": {"state": state, "run_id": None, "background_jobs": None, "session_name": "PRIVATE"}}
            with self.subTest(state=state), self.assertRaises(PayloadError):
                build_snapshot("host", [row])
            row["omp"]["session_name"] = None
            self.assertEqual(build_snapshot("host", [row])["agents"], [row])

    def test_exact_native_projection_roundtrips_and_old_records_remain_compatible(self):
        row = ready_row()
        report = build_snapshot("host", [row])
        self.assertEqual(decode_report(encode_report(report), "host")["agents"], [row])
        old = normalize_agents({"agents": [stock()]})
        self.assertEqual(decode_report(encode_report(build_snapshot("host", old)), "host")["agents"], old)
        for state in ("missing", "stale", "invalid", "conflict", "unsupported"):
            unavailable = row | {"session_id": None, "status": "unknown", "rich": False,
                "omp": {"state": state, "run_id": None, "background_jobs": None}}
            self.assertEqual(build_snapshot("host", [unavailable])["agents"], [unavailable])

    def test_notification_fields_are_optional_bounded_and_consistent(self):
        for fields, status in (
            ({}, "done"), ({"outcome": None, "input_id": None}, "done"),
            ({"outcome": "completed", "input_id": None}, "done"),
            ({"outcome": "failed"}, "done"), ({"outcome": "cancelled"}, "done"),
            ({"input_id": "😀" * 128}, "waiting"),
        ):
            row = ready_row() | {"status": status}
            row["omp"] = {key: value for key, value in row["omp"].items()
                          if key not in {"outcome", "input_id"}} | {"background_jobs": 0} | fields
            self.assertEqual(decode_report(encode_report(build_snapshot("host", [row])), "host")["agents"], [row])
        base = ready_row() | {"status": "done"}
        base["omp"] = base["omp"] | {"background_jobs": 0}
        for fields in (
            {"outcome": {}}, {"outcome": "error"}, {"outcome": True},
            {"outcome": "completed", "input_id": "request"},
            {"outcome": "completed", "run_id": None},
            {"outcome": "completed", "background_jobs": 1},
            {"input_id": "request"}, {"input_id": ""}, {"input_id": "\ud800"},
            {"input_id": "x" * 129}, {"input_id": ["request"]},
        ):
            with self.subTest(fields=fields), self.assertRaises(PayloadError):
                build_snapshot("host", [base | {"omp": base["omp"] | fields}])
        for status in ("idle", "working", "waiting", "unknown"):
            with self.subTest(status=status), self.assertRaises(PayloadError):
                build_snapshot("host", [base | {"status": status, "omp": base["omp"] | {"outcome": "completed"}}])
        for state in ("missing", "stale", "invalid", "conflict", "unsupported"):
            row = base | {"session_id": None, "status": "unknown", "rich": False,
                          "omp": {"state": state, "run_id": None, "background_jobs": None, "outcome": "completed"}}
            with self.subTest(state=state), self.assertRaises(PayloadError):
                build_snapshot("host", [row])

    def test_native_wire_rejects_invalid_invariants_other_agents_and_private_fields(self):
        row = ready_row()
        invalid = [
            row | {"agent": "ClaudeCode"}, row | {"rich": False}, row | {"inferred": True},
            row | {"session_id": None}, row | {"activity": 1}, row | {"turns": 1},
            row | {"omp": None}, row | {"omp": {"state": "ready", "run_id": None}},
            row | {"omp": row["omp"] | {"state": "PRIVATE_STATE"}},
            row | {"omp": row["omp"] | {"run_id": ""}},
            row | {"omp": row["omp"] | {"run_id": "x" * 129}},
            row | {"omp": row["omp"] | {"background_jobs": True}},
            row | {"omp": row["omp"] | {"background_jobs": None}},
            row | {"omp": row["omp"] | {"reporter_id": "PRIVATE_REPORTER"}},
            row | {"omp": {"state": "missing", "run_id": None, "background_jobs": None}},
        ]
        unavailable = row | {"session_id": None, "status": "unknown", "rich": False,
            "omp": {"state": "missing", "run_id": None, "background_jobs": None}}
        invalid.extend(unavailable | change for change in (
            {"activity": 1}, {"turns": 1}, {"session_id": "stock"}, {"status": "done"},
            {"rich": True}, {"omp": unavailable["omp"] | {"run_id": "run"}},
            {"omp": unavailable["omp"] | {"background_jobs": 0}},
        ))
        for data in invalid:
            with self.subTest(data=data):
                with self.assertRaises(PayloadError):
                    build_snapshot("host", [data])
                body = json.dumps({"schema_version": 1, "host_id": "host", "kind": "snapshot", "agents": [data]}).encode()
                with self.assertRaises(PayloadError):
                    decode_report(body, "host")

    def test_stock_shape_cannot_smuggle_an_omp_projection_into_normalization(self):
        data = stock()
        data["omp"] = {"state": "ready", "run_id": "PRIVATE_RUN", "background_jobs": 0}
        data["state"]["omp"] = copy.deepcopy(data["omp"])
        rows = normalize_agents({"agents": [data]})
        self.assertNotIn("omp", rows[0])
        self.assertNotIn(b"PRIVATE_RUN", encode_report(build_snapshot("host", rows)))
