"""Installer regressions use synthetic pairing data and actual filesystem state."""
import argparse
import importlib.util
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[2]


class InstallerTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location("reporter_installer", ROOT / "install.py")
        self.installer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.installer)
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name)
        self.paths = self.installer.Paths(self.home)

    def wheel(self, version="0.4.1", name="ha-tty7"):
        wheel = self.home / "ha_tty7-0.4.1-py3-none-any.whl"
        with zipfile.ZipFile(wheel, "w") as archive:
            archive.writestr("ha_tty7-0.4.1.dist-info/METADATA",
                             f"Metadata-Version: 2.1\nName: {name}\nVersion: {version}\n")
        return wheel

    def prepare(self):
        self.installer.prepare_directories(self.paths)

    def test_private_files_are_exclusive_owned_and_private(self):
        self.prepare()
        self.installer.write_private_new(self.paths.url, b"https://ha.invalid/api/webhook/synthetic\n")
        self.assertEqual(stat.S_IMODE(self.paths.url.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.paths.config_dir.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(self.paths.data.stat().st_mode), 0o700)
        with self.assertRaises(self.installer.InstallError):
            self.installer.write_private_new(self.paths.url, b"replacement")
        self.assertEqual(self.paths.url.read_bytes(), b"https://ha.invalid/api/webhook/synthetic\n")

    def test_symlink_and_public_secret_are_refused_without_touching_target(self):
        self.prepare()
        target = self.home / "target"
        target.write_bytes(b"untouched")
        self.paths.url.symlink_to(target)
        with self.assertRaises(self.installer.InstallError):
            self.installer.private_read(self.paths.url)
        with self.assertRaises(self.installer.InstallError):
            self.installer.write_private_new(self.paths.url, b"replacement")
        self.assertEqual(target.read_bytes(), b"untouched")
        self.paths.url.unlink()
        self.paths.url.write_bytes(b"synthetic")
        self.paths.url.chmod(0o644)
        with self.assertRaises(self.installer.InstallError):
            self.installer.private_read(self.paths.url)

    def test_symlinked_managed_directory_is_not_followed(self):
        (self.home / ".config").mkdir()
        target = self.home / "target"
        target.mkdir(mode=0o700)
        (self.home / ".config" / "ha-tty7").symlink_to(target, target_is_directory=True)
        with self.assertRaises(self.installer.InstallError):
            self.prepare()
        self.assertEqual(list(target.iterdir()), [])

    def test_public_managed_directory_is_refused_not_silently_repaired(self):
        self.prepare()
        self.paths.config_dir.chmod(0o755)
        with self.assertRaises(self.installer.InstallError):
            self.prepare()
        self.assertEqual(stat.S_IMODE(self.paths.config_dir.stat().st_mode), 0o755)

    def test_nonowned_secret_is_refused(self):
        self.prepare()
        self.installer.write_private_new(self.paths.url, b"synthetic")
        with patch.object(self.installer.os, "getuid", return_value=os.getuid() + 1):
            with self.assertRaises(self.installer.InstallError):
                self.installer.private_read(self.paths.url)

    def test_wrong_distribution_or_release_fails_before_install(self):
        for version, name in (("0.4.0", "ha-tty7"), ("0.4.1", "other-package")):
            with self.subTest(version=version, name=name):
                with self.assertRaises(self.installer.InstallError):
                    self.installer.validate_wheel(self.wheel(version, name))
        self.installer.validate_wheel(self.wheel())

    def test_existing_settings_and_pairing_survive_without_prompts(self):
        self.prepare()
        config = (b'host_id="synthetic_host"\ntty7_path="/usr/bin/tty7"\n'
                  b'webhook_url_file="webhook-url"\ncollect_inventory=true\n'
                  b'include_names=true\ninclude_derived_labels=true\ncollect_source=false\n')
        self.installer.write_private_new(self.paths.config, config)
        self.installer.write_private_new(self.paths.url, b"https://ha.invalid/api/webhook/synthetic\n")
        before = self.paths.config.stat().st_mtime_ns
        with patch("builtins.input", side_effect=AssertionError("unexpected prompt")), \
                patch.object(self.installer.getpass, "getpass", side_effect=AssertionError("unexpected secret prompt")):
            self.installer.prepare_config(self.paths, Path("/usr/bin/tty7"), None, None)
        self.assertEqual(self.paths.config.read_bytes(), config)
        self.assertEqual(self.paths.config.stat().st_mtime_ns, before)
        self.assertEqual(self.paths.url.read_bytes(), b"https://ha.invalid/api/webhook/synthetic\n")

    def test_custom_service_is_preserved_and_managed_service_is_idempotent(self):
        self.prepare()
        self.installer.prepare_service_directory(self.paths)
        self.paths.unit.write_text("[Service]\nExecStart=/custom/reporter\n")
        self.paths.unit.chmod(0o600)
        self.installer.write_service(self.paths)
        self.assertEqual(self.paths.unit.read_text(), "[Service]\nExecStart=/custom/reporter\n")
        self.paths.unit.unlink()
        self.installer.write_service(self.paths)
        first = self.paths.unit.read_bytes()
        stamp = self.paths.unit.stat().st_mtime_ns
        self.installer.write_service(self.paths)
        self.assertEqual(self.paths.unit.read_bytes(), first)
        self.assertEqual(self.paths.unit.stat().st_mtime_ns, stamp)
        self.assertIn(b"UMask=0077", first)
        self.assertIn(b"NoNewPrivileges=true", first)

    def test_no_service_does_not_create_units_or_call_service_manager(self):
        self.prepare()
        self.installer.write_private_new(self.paths.config, b'host_id="synthetic"\ntty7_path="/usr/bin/tty7"\nwebhook_url_file="webhook-url"\n')
        self.installer.write_private_new(self.paths.url, b"https://ha.invalid/api/webhook/synthetic\n")
        args = argparse.Namespace(wheel=self.wheel(), tty7=None, no_service=True,
                                  ca_file=None, tty7_config_dir=None)
        # pip/stock CLI/HTTPS are external; filesystem and installer orchestration are real.
        with patch.object(self.installer, "install_wheel"), \
                patch.object(self.installer, "verify_source"), \
                patch.object(self.installer, "verify_delivery"), \
                patch.object(self.installer, "service_action", side_effect=AssertionError("systemctl in manual mode")):
            self.installer.install(args, home=self.home)
        self.assertFalse(self.paths.unit.exists())
        self.assertFalse((self.home / ".config/systemd").exists())
        self.assertEqual(self.paths.url.read_bytes(), b"https://ha.invalid/api/webhook/synthetic\n")

    def test_failed_delivery_never_enables_or_creates_service(self):
        self.prepare()
        self.installer.write_private_new(self.paths.config, b'host_id="synthetic"\ntty7_path="/usr/bin/tty7"\nwebhook_url_file="webhook-url"\n')
        self.installer.write_private_new(self.paths.url, b"https://ha.invalid/api/webhook/synthetic\n")
        args = argparse.Namespace(wheel=self.wheel(), tty7=None, no_service=False,
                                  ca_file=None, tty7_config_dir=None)
        with patch.object(self.installer, "install_wheel"), \
                patch.object(self.installer, "verify_source"), \
                patch.object(self.installer, "verify_delivery",
                             side_effect=self.installer.InstallError("delivery failed")), \
                patch.object(self.installer, "service_action",
                             side_effect=AssertionError("service action before delivery")):
            with self.assertRaisesRegex(self.installer.InstallError, "delivery"):
                self.installer.install(args, home=self.home)
        self.assertFalse(self.paths.unit.exists())

    def test_ephemeral_stock_cli_copy_survives_mount_removal_and_is_private(self):
        self.prepare()
        mount = self.home / ".mount_synthetic"
        mount.mkdir(mode=0o700)
        source = mount / "tty7"
        # Synthetic executable bytes: copy behavior only, never a fake runtime reporter.
        source.write_bytes(b"\x7fELF-synthetic-stock-cli-copy-fixture")
        source.chmod(0o700)
        copied = self.installer.stabilize_cli(self.paths, source)
        source.unlink()
        mount.rmdir()
        self.assertEqual(copied, self.paths.data / "tty7")
        self.assertEqual(copied.read_bytes(), b"\x7fELF-synthetic-stock-cli-copy-fixture")
        self.assertEqual(stat.S_IMODE(copied.stat().st_mode), 0o700)
        self.assertEqual(copied.stat().st_uid, os.getuid())


if __name__ == "__main__":
    unittest.main()
