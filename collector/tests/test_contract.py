"""Consumer-visible privacy, validation, and wire-format boundaries."""

import copy
import json
import unittest

from ha_tty7.protocol import (
    PayloadError,
    build_error,
    build_snapshot,
    encode_report,
    normalize_agents,
)


def source_agent(pane_id=7, **state_updates):
    state = {
        "status": "working",
        "session_id": "demo-session",
        "activity": 0,
        "turns": 2,
        "readout": {"model": "demo-model", "effort": None, "permission_mode": None},
    }
    state.update(state_updates)
    return {"pane_id": pane_id, "agent": "OhMyPi", "state": state}


def wire_agent(pane_id=7):
    return {
        "pane_id": pane_id,
        "agent": "OhMyPi",
        "session_id": "demo-session",
        "status": "working",
        "activity": 0,
        "turns": 2,
        "model": "demo-model",
        "effort": None,
        "permission_mode": None,
    }


class ContractTests(unittest.TestCase):
    def test_inferred_source_status_survives_wire_revalidation(self):
        record = wire_agent()
        record["inferred"] = True
        normalized = normalize_agents({"agents": [source_agent(inferred=True)]})
        self.assertEqual(normalized, [record])
        self.assertEqual(json.loads(encode_report(build_snapshot("host", normalized)))["agents"], [record])
        self.assertEqual(normalize_agents({"agents": [source_agent(inferred=False)]}), [wire_agent()])

    def test_invalid_inferred_provenance_rejects_the_whole_roster(self):
        for value in (None, 0, 1, "false", [], {}):
            with self.subTest(value=value):
                self.assert_payload_error("invalid_payload", normalize_agents,
                    {"agents": [source_agent(1), source_agent(2, inferred=value)]})
                self.assert_payload_error("invalid_payload", build_snapshot,
                    "host", [wire_agent(1), wire_agent(2) | {"inferred": value}])

    def assert_payload_error(self, code, function, *args):
        with self.assertRaises(PayloadError) as caught:
            function(*args)
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def test_private_source_fields_never_reach_the_wire(self):
        record = source_agent(message="PRIVATE_MESSAGE", cwd="PRIVATE_DIRECTORY")
        record["launch_argv"] = ["omp", "PRIVATE_ARGUMENT"]
        record["workspace"] = "PRIVATE_WORKSPACE"
        record["state"]["readout"]["extra"] = "PRIVATE_READOUT"
        raw = {"agents": [record], "diagnostics": "PRIVATE_DIAGNOSTIC"}
        original = copy.deepcopy(raw)
        agents = normalize_agents(raw)
        self.assertEqual(agents, [wire_agent()])
        report = build_snapshot("desktop_demo", agents)
        body = encode_report(report)
        self.assertEqual(json.loads(body), {
            "schema_version": 1, "host_id": "desktop_demo", "kind": "snapshot",
            "agents": [wire_agent()],
        })
        for marker in (b"PRIVATE_MESSAGE", b"PRIVATE_DIRECTORY", b"PRIVATE_ARGUMENT",
                       b"PRIVATE_WORKSPACE", b"PRIVATE_READOUT", b"PRIVATE_DIAGNOSTIC"):
            self.assertNotIn(marker, body)
        self.assertEqual(raw, original)

    def test_missing_optional_metadata_is_unavailable(self):
        raw = {"agents": [{"pane_id": 1, "agent": "OhMyPi", "state": {}}]}
        self.assertEqual(normalize_agents(raw), [{
            "pane_id": 1, "agent": "OhMyPi", "session_id": None,
            "status": "unknown", "activity": None, "turns": None,
            "model": None, "effort": None, "permission_mode": None,
        }])

    def test_null_readout_and_metadata_are_unavailable(self):
        agents = normalize_agents({"agents": [source_agent(
            session_id=None, activity=None, turns=None, readout=None)]})
        self.assertEqual(agents[0], {
            "pane_id": 7, "agent": "OhMyPi", "session_id": None,
            "status": "working", "activity": None, "turns": None,
            "model": None, "effort": None, "permission_mode": None,
        })

    def test_known_statuses_survive_and_unknown_text_does_not(self):
        for status, expected in (("idle", "idle"), ("working", "working"),
                                 ("waiting", "waiting"), ("done", "done"),
                                 ("unknown", "unknown"), (None, "unknown"),
                                 ("PRIVATE_STATUS", "unknown")):
            with self.subTest(status=status):
                agents = normalize_agents({"agents": [source_agent(status=status)]})
                self.assertEqual(agents[0]["status"], expected)
                self.assertNotIn(b"PRIVATE_STATUS", encode_report(build_snapshot("host", agents)))

    def test_successful_empty_snapshot_is_not_an_error_report(self):
        snapshot = json.loads(encode_report(build_snapshot("host", normalize_agents({"agents": []}))))
        failure = json.loads(encode_report(build_error("host", "cli_failed")))
        self.assertEqual(snapshot, {"schema_version": 1, "host_id": "host",
                                    "kind": "snapshot", "agents": []})
        self.assertEqual(failure, {"schema_version": 1, "host_id": "host",
                                   "kind": "error", "error_code": "cli_failed"})

    def test_malformed_rosters_never_become_empty_success(self):
        cases = (None, [], {}, {"agents": None}, {"agents": {}},
                 {"agents": [None]}, {"agents": [{}]},
                 {"agents": [{"pane_id": 1, "agent": "OhMyPi"}]},
                 {"agents": [{"pane_id": 1, "agent": "OhMyPi", "state": None}]})
        for raw in cases:
            with self.subTest(raw=raw):
                self.assert_payload_error("invalid_payload", normalize_agents, raw)

    def test_structurally_invalid_readout_is_rejected(self):
        for readout in ([], "PRIVATE_READOUT", 0, True):
            with self.subTest(readout=readout):
                self.assert_payload_error("invalid_payload", normalize_agents,
                                          {"agents": [source_agent(readout=readout)]})

    def test_nonstring_status_is_rejected_instead_of_stringified(self):
        for status in ([], {}, 1, True):
            with self.subTest(status=status):
                self.assert_payload_error("invalid_payload", normalize_agents,
                                          {"agents": [source_agent(status=status)]})

    def test_one_bad_record_invalidates_the_complete_roster(self):
        self.assert_payload_error("invalid_payload", normalize_agents,
                                  {"agents": [source_agent(1), {"pane_id": 2, "agent": "", "state": {}}]})

    def test_duplicate_panes_are_rejected_but_shared_sessions_are_allowed(self):
        self.assert_payload_error("invalid_payload", normalize_agents,
                                  {"agents": [source_agent(7), source_agent(7, session_id="other")]})
        agents = normalize_agents({"agents": [source_agent(8), source_agent(7)]})
        self.assertEqual([agent["pane_id"] for agent in agents], [7, 8])
        self.assertEqual([agent["session_id"] for agent in agents], ["demo-session", "demo-session"])

    def test_numeric_fields_reject_booleans_floats_and_out_of_range_values(self):
        for field in ("pane_id", "activity", "turns"):
            for value in (True, False, 1.0, "1", -1, 9007199254740992):
                with self.subTest(field=field, value=value):
                    record = source_agent()
                    if field == "pane_id":
                        record[field] = value
                    else:
                        record["state"][field] = value
                    self.assert_payload_error("invalid_payload", normalize_agents, {"agents": [record]})
        self.assert_payload_error("invalid_payload", normalize_agents, {"agents": [source_agent(0)]})
        valid = normalize_agents({"agents": [source_agent(9007199254740991,
                                                         activity=9007199254740991, turns=0)]})[0]
        self.assertEqual(valid["pane_id"], 9007199254740991)
        self.assertEqual(valid["activity"], 9007199254740991)
        self.assertEqual(valid["turns"], 0)

    def test_string_fields_enforce_type_and_length_boundaries(self):
        for field, limit in (("agent", 64), ("session_id", 128),
                             ("model", 128), ("effort", 128), ("permission_mode", 128)):
            for value in (("",) if field != "effort" else ()) + ("x" * (limit + 1), [], 3, False):
                with self.subTest(field=field, value=value):
                    record = source_agent()
                    if field == "agent":
                        record[field] = value
                    elif field == "session_id":
                        record["state"][field] = value
                    else:
                        record["state"]["readout"][field] = value
                    self.assert_payload_error("invalid_payload", normalize_agents, {"agents": [record]})
            record = source_agent()
            target = record if field == "agent" else record["state"] if field == "session_id" else record["state"]["readout"]
            target[field] = "x" * limit
            self.assertEqual(normalize_agents({"agents": [record]})[0][field], "x" * limit)

    def test_agent_count_bound_rejects_oversize_without_truncation(self):
        agents = [source_agent(pane) for pane in range(1, 257)]
        self.assertEqual([agent["pane_id"] for agent in normalize_agents({"agents": agents})], list(range(1, 257)))
        self.assert_payload_error("payload_too_large", normalize_agents,
                                  {"agents": agents + [source_agent(257)]})

    def test_roster_order_does_not_change_the_wire_snapshot(self):
        first = normalize_agents({"agents": [source_agent(8), source_agent(2)]})
        second = normalize_agents({"agents": [source_agent(2), source_agent(8)]})
        self.assertEqual(encode_report(build_snapshot("host", first)),
                         encode_report(build_snapshot("host", second)))
        reordered = [dict(reversed(list(agent.items()))) for agent in reversed(first)]
        self.assertEqual(encode_report(build_snapshot("host", first)),
                         encode_report(build_snapshot("host", reordered)))

    def test_host_id_is_bounded_and_cannot_select_an_arbitrary_entity(self):
        for host in ("", "Desktop", "a/b", "sensor.other", "a" * 65, "host\n", None, True):
            with self.subTest(host=host):
                self.assert_payload_error("invalid_payload", build_snapshot, host, [])
                self.assert_payload_error("invalid_payload", build_error, host, "cli_timeout")
        self.assertEqual(build_snapshot("a" * 64, [wire_agent()])["host_id"], "a" * 64)
        self.assertEqual(build_error("desktop_demo-2", "cli_timeout")["host_id"], "desktop_demo-2")

    def test_error_codes_cannot_carry_arbitrary_diagnostics(self):
        for code in ("cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"):
            with self.subTest(code=code):
                self.assertEqual(json.loads(encode_report(build_error("host", code))),
                                 {"schema_version": 1, "host_id": "host", "kind": "error", "error_code": code})
        for code in ("PRIVATE_FAILURE", None, [], True):
            with self.subTest(code=code):
                error = self.assert_payload_error("invalid_payload", build_error, "host", code)
                self.assertNotIn("PRIVATE_FAILURE", str(error))
                self.assertNotIn("PRIVATE_FAILURE", repr(error))

    def test_outbound_record_injection_is_rejected(self):
        injected = wire_agent()
        injected["message"] = "PRIVATE_INJECTION"
        self.assert_payload_error("invalid_payload", build_snapshot, "host", [injected])
        report = build_snapshot("host", [wire_agent()])
        report["agents"][0]["launch_argv"] = ["PRIVATE_ARGUMENT"]
        error = self.assert_payload_error("invalid_payload", encode_report, report)
        self.assertNotIn("PRIVATE_ARGUMENT", str(error))

    def test_outbound_envelope_and_flat_fields_are_validated(self):
        valid = {"schema_version": 1, "host_id": "host", "kind": "snapshot", "agents": [wire_agent()]}
        for patch in ({"schema_version": True}, {"schema_version": 2}, {"kind": "other"},
                      {"host_id": "other/host"}, {"message": "PRIVATE_MESSAGE"}, {"agents": None}):
            with self.subTest(patch=patch):
                self.assert_payload_error("invalid_payload", encode_report, valid | patch)
        for field in wire_agent():
            with self.subTest(missing_field=field):
                broken = wire_agent()
                del broken[field]
                self.assert_payload_error("invalid_payload", build_snapshot, "host", [broken])
        for patch in ({"status": "PRIVATE_STATUS"}, {"activity": True}, {"model": {}}, {"pane_id": 0}):
            with self.subTest(patch=patch):
                self.assert_payload_error("invalid_payload", build_snapshot, "host", [wire_agent() | patch])
        for report in (None, [], {}, {"schema_version": 1, "host_id": "host", "kind": "error"},
                       {"schema_version": 1, "host_id": "host", "kind": "error", "error_code": "PRIVATE_ERROR"},
                       {"schema_version": 1, "host_id": "host", "kind": "error", "error_code": "cli_failed", "agents": []}):
            with self.subTest(report=report):
                self.assert_payload_error("invalid_payload", encode_report, report)

    def test_body_limit_is_applied_to_encoded_bytes_without_partial_output(self):
        agents = [wire_agent(pane) for pane in range(1, 257)]
        report = build_snapshot("host", agents)
        self.assertEqual(len(json.loads(encode_report(report))["agents"]), 256)
        for agent in agents:
            agent.update(agent="界" * 64, session_id="界" * 128,
                         model="界" * 128, effort="界" * 128, permission_mode="界" * 128)
        self.assert_payload_error("payload_too_large", encode_report, build_snapshot("host", agents))


if __name__ == "__main__":
    unittest.main()
