"""Native main-agent observations at real collector and canonical wire boundaries."""

import copy
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
                  "readout": {"model": "safe-model", "effort": "high", "permission_mode": "ask"}},
    }


def native(**updates):
    return {
        "schema_version": 1, "reporter_id": REPORTER, "pane_id": 7,
        "session_id": "real-main", "updated_at_ms": NOW, "status": "working",
        "run_id": "run-1", "background_jobs": 2, "health": "ready",
    } | updates


def ready_row():
    return {
        "pane_id": 7, "agent": "OhMyPi", "session_id": "real-main", "status": "working",
        "activity": None, "turns": None, "model": "safe-model", "effort": "high",
        "permission_mode": "ask", "rich": True,
        "omp": {"state": "ready", "run_id": "run-1", "background_jobs": 2},
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

    def overlay(self, rows=None, *, now=NOW):
        from ha_tty7.omp import apply_native_status
        return apply_native_status(normalize_agents({"agents": [stock()] if rows is None else rows}),
                                   directory=self.directory, now_ms=now)

    def assert_unavailable(self, row, state):
        self.assertEqual(row["status"], "unknown")
        self.assertIsNone(row["session_id"])
        self.assertIsNone(row["activity"])
        self.assertIsNone(row["turns"])
        self.assertIs(row["rich"], False)
        self.assertNotIn("inferred", row)
        self.assertEqual(row["omp"], {"state": state, "run_id": None, "background_jobs": None})

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
        body = encode_report(report)
        self.assertEqual(decode_report(body, "host"), report)
        for excluded in (REPORTER.encode(), b"updated_at_ms", b"reporter_id", b"polluted-child"):
            self.assertNotIn(excluded, body)

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
        self.assertIsNone(row["model"])
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
