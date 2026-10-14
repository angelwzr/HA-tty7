"""Raw webhook boundaries shared by HA and the collector's wire protocol."""

import json
import unittest

from ha_tty7.protocol import PayloadError, decode_report, validate_report


class DecodeTests(unittest.TestCase):
    def test_valid_snapshot_and_error_are_bound_to_configured_host(self):
        for raw in (
            {"schema_version": 1, "host_id": "desktop_demo", "kind": "snapshot", "agents": []},
            {"schema_version": 1, "host_id": "desktop_demo", "kind": "error", "error_code": "cli_failed"},
        ):
            with self.subTest(kind=raw["kind"]):
                self.assertEqual(decode_report(json.dumps(raw).encode(), "desktop_demo"), raw)
                with self.assertRaises(PayloadError) as caught:
                    decode_report(json.dumps(raw).encode(), "other_host")
                self.assertEqual(caught.exception.code, "invalid_payload")

    def test_malformed_utf8_and_nonjson_input_are_not_empty_success(self):
        for body in (b"", b"PRIVATE_BAD_JSON", b"\xff", b"[]", b"null", b"{}"):
            with self.subTest(body=body):
                with self.assertRaises(PayloadError) as caught:
                    decode_report(body, "desktop_demo")
                self.assertEqual(caught.exception.code, "invalid_payload")
                self.assertNotIn("PRIVATE", str(caught.exception))

    def test_duplicate_keys_at_any_depth_are_rejected(self):
        bodies = (
            b'{"schema_version":1,"host_id":"other","host_id":"desktop_demo","kind":"snapshot","agents":[]}',
            b'{"schema_version":1,"host_id":"desktop_demo","kind":"error","error_code":"cli_failed","error_code":"cli_timeout"}',
            b'{"schema_version":1,"host_id":"desktop_demo","kind":"snapshot","agents":[{"pane_id":7,"pane_id":8,"agent":"OhMyPi","session_id":null,"status":"working","activity":0,"turns":0,"model":null,"effort":null,"permission_mode":null}]}',
        )
        for body in bodies:
            with self.subTest(body=body):
                with self.assertRaises(PayloadError):
                    decode_report(body, "desktop_demo")

    def test_original_body_size_is_bounded_before_parsing(self):
        body = b' ' * 65537
        with self.assertRaises(PayloadError) as caught:
            decode_report(body, "desktop_demo")
        self.assertEqual(caught.exception.code, "payload_too_large")

    def test_forbidden_envelope_keys_and_boolean_version_are_rejected(self):
        valid = {"schema_version": 1, "host_id": "desktop_demo", "kind": "snapshot", "agents": []}
        for extra in ({"message": "PRIVATE_MESSAGE"}, {"schema_version": True}):
            with self.subTest(extra=extra):
                with self.assertRaises(PayloadError) as caught:
                    validate_report(valid | extra)
                self.assertNotIn("PRIVATE_MESSAGE", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
