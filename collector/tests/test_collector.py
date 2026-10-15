"""Real process/TLS boundaries and transient collector lifecycle behavior."""

import dataclasses
import http.server
import json
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from ha_tty7.config import CollectorConfig, ConfigError, load_config
from ha_tty7.protocol import build_snapshot, encode_report
from ha_tty7.main import DeliveryState, collect_report, run
from ha_tty7.transport import DeliveryError, post_report
from ha_tty7.tty7 import CollectorError, read_agents


class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def executable(self, program):
        path = self.root / 'tty7-test'
        path.write_text('#!/usr/bin/env python3\n' + program)
        path.chmod(0o700)
        return path

    def config(self, executable=None, **updates):
        config = CollectorConfig(host_id='desktop_demo', tty7_path=executable or Path('/missing/tty7'),
                                 webhook_url='https://localhost/api/webhook/private-demo')
        return dataclasses.replace(config, **updates)

    def private_file(self, name, text):
        path = self.root / name
        path.write_text(text)
        path.chmod(0o600)
        return path

    def configuration_file(self):
        self.private_file('url', 'https://localhost/api/webhook/private-demo\n')
        return self.private_file('config.toml',
            'host_id = "desktop_demo"\ntty7_path = "/usr/bin/tty7"\nwebhook_url_file = "url"\n')

    def test_private_config_loads_relative_secret_without_exposing_it(self):
        config = load_config(self.configuration_file())
        self.assertEqual(config.host_id, 'desktop_demo')
        self.assertEqual(config.webhook_url, 'https://localhost/api/webhook/private-demo')
        self.assertNotIn('private-demo', repr(config))

    def test_public_files_and_symlinked_secrets_are_rejected(self):
        config_path = self.configuration_file()
        for path in (config_path, self.root / 'url'):
            path.chmod(0o644)
            with self.assertRaises(ConfigError):
                load_config(config_path)
            path.chmod(0o600)
        (self.root / 'url').rename(self.root / 'real-url')
        (self.root / 'url').symlink_to(self.root / 'real-url')
        with self.assertRaises(ConfigError):
            load_config(config_path)

    def test_insecure_credential_and_wrong_endpoint_urls_are_rejected(self):
        config_path = self.configuration_file()
        for url in ('http://localhost/api/webhook/private-demo',
                    'https://user:password@localhost/api/webhook/private-demo',
                    'https://localhost/api/config',
                    'https://localhost/api/webhook/private-demo?token=x',
                    'https://localhost/api/webhook/private-demo#fragment'):
            with self.subTest(url=url):
                self.private_file('url', url)
                with self.assertRaises(ConfigError) as caught:
                    load_config(config_path)
                self.assertNotIn('password', str(caught.exception))
                self.assertNotIn('private-demo', str(caught.exception))

    def test_invalid_configuration_is_not_silently_defaulted(self):
        config_path = self.configuration_file()
        base = config_path.read_text()
        for suffix in ('poll_seconds = 0\n', 'heartbeat_seconds = true\n', 'verify_tls = false\n'):
            with self.subTest(suffix=suffix):
                config_path.write_text(base + suffix)
                with self.assertRaises(ConfigError):
                    load_config(config_path)
        config_path.write_text(base.replace('desktop_demo', 'sensor.other'))
        with self.assertRaises(ConfigError):
            load_config(config_path)

    def test_real_cli_success_empty_and_allowlisted_snapshot(self):
        empty = self.executable('import json,sys\nassert sys.argv[1:] == ["--json", "agents"]\nprint(json.dumps({"agents": []}))\n')
        self.assertEqual(read_agents(self.config(empty)), [])
        executable = self.executable('import json\nprint(json.dumps({"agents":[{"pane_id":7,"agent":"OhMyPi","state":{"status":"working","message":"PRIVATE_MESSAGE","launch_argv":["PRIVATE_ARGUMENT"]}}]}))\n')
        report = collect_report(self.config(executable))
        self.assertEqual(report['kind'], 'snapshot')
        self.assertEqual(report['agents'][0]['pane_id'], 7)
        self.assertNotIn(b'PRIVATE_MESSAGE', encode_report(report))
        self.assertNotIn(b'PRIVATE_ARGUMENT', encode_report(report))

    def test_cli_failures_emit_fixed_errors_not_empty_success(self):
        cases = (
            ('import sys\nprint("PRIVATE_STDERR", file=sys.stderr)\nsys.exit(2)\n', 'cli_failed'),
            ('print("PRIVATE_INVALID_JSON")\n', 'invalid_payload'),
            ('print("x" * (1024 * 1024 + 1))\n', 'payload_too_large'),
        )
        for program, code in cases:
            with self.subTest(code=code):
                report = collect_report(self.config(self.executable(program)))
                self.assertEqual(report['kind'], 'error')
                self.assertEqual(report['error_code'], code)
                self.assertNotIn('agents', report)
        self.assertEqual(collect_report(self.config())['error_code'], 'cli_unavailable')

    def test_hanging_cli_is_killed_without_waiting_for_a_full_buffer(self):
        executable = self.executable('import time\nprint("partial", flush=True)\ntime.sleep(10)\n')
        with patch('ha_tty7.tty7.CLI_TIMEOUT_SECONDS', 0.1):
            with self.assertRaises(CollectorError) as caught:
                read_agents(self.config(executable))
        self.assertEqual(caught.exception.code, 'cli_timeout')

    def test_delivery_state_tracks_success_and_paces_failures(self):
        state = DeliveryState(heartbeat_seconds=15, poll_seconds=2)
        self.assertTrue(state.due(b'old', 0))
        state.attempted(b'old', 0, success=True)
        self.assertFalse(state.due(b'old', 14))
        self.assertTrue(state.due(b'old', 15))
        self.assertTrue(state.due(b'new', 1))
        state.attempted(b'new', 1, success=False)
        self.assertFalse(state.due(b'newest', 2))
        self.assertTrue(state.due(b'newest', 3))
        state.attempted(b'newest', 3, success=True)
        self.assertFalse(state.due(b'newest', 4))

    def test_once_reports_read_failure_with_nonzero_exit(self):
        # Real unavailable CLI; only the unreachable external transport is replaced.
        with patch('ha_tty7.main.post_report') as post:
            self.assertEqual(run(self.config(), once=True), 1)
        payload = json.loads(post.call_args.args[1])
        self.assertEqual(payload['kind'], 'error')
        self.assertEqual(payload['error_code'], 'cli_unavailable')
        self.assertNotIn('agents', payload)


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.cert = cls.root / 'cert.pem'
        cls.key = cls.root / 'key.pem'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', str(cls.key), '-out', str(cls.cert), '-days', '1',
                        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.received = []
        cls.response_status = 200
        owner = cls

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                data = self.rfile.read(int(self.headers['Content-Length']))
                owner.received.append((self.path, json.loads(data)))
                if owner.trickle_headers:
                    try:
                        self.wfile.write(b'HTTP/1.1 200 OK\r\n')
                        for _ in range(24):
                            self.wfile.write(b'X-Trickle: yes\r\n')
                            self.wfile.flush()
                            time.sleep(0.05)
                        self.wfile.write(b'\r\n')
                    except OSError:
                        pass
                    return
                self.send_response(owner.response_status)
                if owner.response_status == 302:
                    self.send_header('Location', '/stolen')
                self.end_headers()
            def log_message(self, format, *args):
                pass

        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cls.cert, cls.key)
        cls.server.socket = context.wrap_socket(cls.server.socket, server_side=True)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def setUp(self):
        self.received.clear()
        type(self).response_status = 200
        type(self).trickle_headers = False
        self.config = CollectorConfig(host_id='host', tty7_path=Path('/usr/bin/tty7'),
            webhook_url=f'https://localhost:{self.server.server_port}/api/webhook/private-demo',
            ca_file=self.cert)
        self.body = encode_report(build_snapshot('host', []))

    def test_verified_tls_delivers_exact_sanitized_payload(self):
        post_report(self.config, self.body)
        self.assertEqual(self.received, [('/api/webhook/private-demo', {
            'schema_version': 1, 'host_id': 'host', 'kind': 'snapshot', 'agents': []})])

    def test_wrong_trust_and_hostname_fail_without_delivery(self):
        for config in (dataclasses.replace(self.config, ca_file=None),
                       dataclasses.replace(self.config, webhook_url=self.config.webhook_url.replace('localhost', '127.0.0.1'))):
            with self.subTest(ca=config.ca_file):
                with self.assertRaises(DeliveryError) as caught:
                    post_report(config, self.body)
                self.assertNotIn('private-demo', str(caught.exception))
        self.assertEqual(self.received, [])

    def test_redirect_is_not_followed(self):
        type(self).response_status = 302
        with self.assertRaises(DeliveryError):
            post_report(self.config, self.body)
        self.assertEqual([path for path, _ in self.received], ['/api/webhook/private-demo'])

    def test_http_failure_has_no_secret_in_its_diagnostic(self):
        type(self).response_status = 500
        with self.assertRaises(DeliveryError) as caught:
            post_report(self.config, self.body)
        self.assertNotIn('private-demo', str(caught.exception))
        self.assertNotIn('private-demo', repr(caught.exception))

    def test_trickled_headers_cannot_extend_the_total_delivery_deadline(self):
        type(self).trickle_headers = True
        started = time.monotonic()
        with patch('ha_tty7.transport.HTTP_TIMEOUT_SECONDS', 0.4):
            with self.assertRaises(DeliveryError):
                post_report(self.config, self.body)
        self.assertLess(time.monotonic() - started, 0.9)


if __name__ == '__main__':
    unittest.main()
