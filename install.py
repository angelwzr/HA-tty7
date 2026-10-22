#!/usr/bin/env python3
"""Install the pinned read-only HA-tty7 reporter without sudo or HA account tokens."""

import argparse
from email.parser import BytesParser
import getpass
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import tomllib
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener
import warnings
import zipfile

VERSION = "0.4.4"
WHEEL_NAME = f"ha_tty7-{VERSION}-py3-none-any.whl"
WHEEL_URL = f"https://github.com/angelwzr/HA-tty7/releases/download/v{VERSION}/{WHEEL_NAME}"
MAX_WHEEL_BYTES = 32 * 1024 * 1024


class InstallError(RuntimeError):
    """An actionable, secret-free installation failure."""


class Paths:
    def __init__(self, home: Path):
        self.home = home.expanduser().absolute()
        self.config_dir = self.home / ".config/ha-tty7"
        self.config = self.config_dir / "collector.toml"
        self.url = self.config_dir / "webhook-url"
        self.data = self.home / ".local/share/ha-tty7"
        self.venv = self.data / "venv"
        self.python = self.venv / "bin/python"
        self.reporter = self.venv / "bin/ha-tty7"
        self.cli = self.data / "tty7"
        self.unit = self.home / ".config/systemd/user/ha-tty7.service"


def check_ancestors(path: Path) -> None:
    """Never follow symlinks or non-sticky writable ancestors for managed files."""
    for parent in reversed(path.absolute().parents):
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode):
            raise InstallError("Unsafe path: a parent is not a real directory.")
        if info.st_mode & 0o022 and not info.st_mode & stat.S_ISVTX:
            raise InstallError("Unsafe path: a parent is writable by other users.")
        if info.st_uid not in (0, os.getuid()):
            raise InstallError("Unsafe path: a parent belongs to another user.")


def directory(path: Path, *, private: bool) -> None:
    check_ancestors(path)
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        pass
    info = path.lstat()
    forbidden = 0o077 if private else 0o022
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or info.st_mode & forbidden):
        raise InstallError("Unsafe installation directory; require owned, non-symlink directories (managed directories: 0700).")


def prepare_directories(paths: Paths) -> None:
    directory(paths.home, private=False)
    for path, private in ((paths.home / ".config", False),
                          (paths.config_dir, True), (paths.home / ".local", False),
                          (paths.home / ".local/share", False), (paths.data, True)):
        directory(path, private=private)


def private_read(path: Path, limit: int = 65536) -> bytes:
    check_ancestors(path)
    parent = path.parent.stat()
    if parent.st_uid != os.getuid() or parent.st_mode & 0o077:
        raise InstallError("Private files require an owned 0700 parent directory.")
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError:
        raise InstallError("Cannot safely open private file; symlinks and missing files are refused.") from None
    try:
        info = os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1
                or info.st_size > limit):
            raise InstallError("Unsafe private file; require an owned regular 0600 file with one link.")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            content = stream.read(limit + 1)
        if len(content) > limit:
            raise InstallError("Private file exceeds its size limit.")
        return content
    finally:
        os.close(fd)


def write_private_new(path: Path, content: bytes, *, executable: bool = False) -> None:
    check_ancestors(path)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                     0o700 if executable else 0o600)
    except FileExistsError:
        raise InstallError("Refusing to replace an existing file or symlink.") from None
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        path.unlink()
        raise


def existing_config(paths: Paths) -> dict | None:
    if not os.path.lexists(paths.config):
        return None
    try:
        raw = tomllib.loads(private_read(paths.config).decode("utf-8"))
        secret = Path(raw["webhook_url_file"]).expanduser()
        if not secret.is_absolute():
            secret = paths.config_dir / secret
        # Relative parent traversals still undergo the same ancestor checks.
        private_read(secret, 4096)
        return raw
    except (ValueError, KeyError, TypeError, UnicodeError):
        raise InstallError("Existing reporter configuration is invalid; it was not replaced.") from None


def command(argv: list[str], failure: str, *, timeout: int = 60, data: bytes | None = None) -> None:
    try:
        result = subprocess.run(argv, input=data, stdin=subprocess.DEVNULL if data is None else None,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                timeout=timeout, check=False)
    except (OSError, subprocess.SubprocessError):
        raise InstallError(failure) from None
    if result.returncode:
        raise InstallError(failure)


def validate_configuration(paths: Paths, config: Path) -> None:
    command([str(paths.python), "-I", "-c",
             "from pathlib import Path; import sys; from ha_tty7.config import load_config; load_config(Path(sys.argv[1]))",
             str(config)], "Reporter configuration or pairing URL is invalid; existing files were preserved.")


def prepare_config(paths: Paths, tty7: Path, ca_file: Path | None,
                   tty7_config_dir: Path | None) -> None:
    raw = existing_config(paths)
    if raw is not None:
        for key, supplied in (("ca_file", ca_file), ("tty7_config_dir", tty7_config_dir)):
            if supplied is not None and str(supplied.expanduser().absolute()) != raw.get(key):
                raise InstallError("Existing configuration is preserved; edit its private TOML explicitly to change settings.")
        return
    if not sys.stdin.isatty():
        raise InstallError("New pairing requires an interactive terminal; no secret command-line arguments are supported.")
    host_id = input("Host ID (the same source ID configured in Home Assistant): ").strip()
    url_exists = os.path.lexists(paths.url)
    if url_exists:
        url = private_read(paths.url, 4096)
    else:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                url = (getpass.getpass("Pairing HTTPS URL (hidden): ").strip() + "\n").encode("utf-8")
        except (getpass.GetPassWarning, EOFError):
            raise InstallError("Cannot read the pairing URL securely from this terminal.") from None
    values = {"host_id": host_id, "tty7_path": str(tty7),
              "webhook_url_file": str(paths.url)}
    if ca_file is not None:
        values["ca_file"] = str(ca_file.expanduser().absolute())
    if tty7_config_dir is not None:
        values["tty7_config_dir"] = str(tty7_config_dir.expanduser().absolute())
    # The installed collector is the sole authority for configuration/URL constraints.
    with tempfile.TemporaryDirectory(prefix="pairing-", dir=paths.config_dir) as temporary:
        candidate = Path(temporary) / "collector.toml"
        candidate_url = Path(temporary) / "webhook-url"
        write_private_new(candidate_url, url)
        candidate_values = dict(values, webhook_url_file=str(candidate_url))
        write_private_new(candidate, toml_strings(candidate_values))
        validate_configuration(paths, candidate)
    if not url_exists:
        write_private_new(paths.url, url)
    write_private_new(paths.config, toml_strings(values))


def toml_strings(values: dict[str, str]) -> bytes:
    lines = []
    for key, value in values.items():
        quoted = json.dumps(value, ensure_ascii=False).replace("\x7f", "\\u007f")
        lines.append(f"{key} = {quoted}\n")
    return "".join(lines).encode("utf-8")


def validate_wheel(path: Path) -> None:
    check_ancestors(path)
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022 or info.st_size > MAX_WHEEL_BYTES:
        raise InstallError("Wheel must be a regular, non-writable-by-others local file within the size limit.")
    try:
        with zipfile.ZipFile(path) as archive:
            entries = [item for item in archive.infolist() if item.filename.endswith(".dist-info/METADATA")]
            if len(entries) != 1 or entries[0].file_size > 65536:
                raise InstallError("Wheel must contain exactly one bounded distribution metadata file.")
            metadata = BytesParser().parsebytes(archive.read(entries[0]))
            names, versions = metadata.get_all("Name", []), metadata.get_all("Version", [])
            if (len(names) != 1 or re.sub(r"[-_.]+", "-", names[0]).lower() != "ha-tty7"
                    or versions != [VERSION]):
                raise InstallError("Wheel distribution Name/Version must be ha-tty7 0.4.4.")
    except (OSError, zipfile.BadZipFile, KeyError, RuntimeError):
        raise InstallError("Cannot read a valid reporter release wheel.") from None


class HTTPSRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(newurl).scheme != "https":
            raise InstallError("Release download refused a non-HTTPS redirect.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download_wheel(destination: Path) -> None:
    try:
        with build_opener(HTTPSRedirects()).open(WHEEL_URL, timeout=30) as response:
            if urlsplit(response.url).scheme != "https":
                raise InstallError("Release download requires verified HTTPS.")
            with destination.open("xb") as stream:
                total = 0
                while chunk := response.read(65536):
                    total += len(chunk)
                    if total > MAX_WHEEL_BYTES:
                        raise InstallError("Release wheel exceeds its size limit.")
                    stream.write(chunk)
        destination.chmod(0o600)
    except (OSError, ValueError):
        raise InstallError("Verified HTTPS release download failed; check the published v0.4.4 asset and network trust.") from None


def check_venv(paths: Paths) -> None:
    # Distribution venv roots may be 0755; their managed data boundary must stay 0700.
    directory(paths.data, private=True)
    directory(paths.venv, private=False)
    interpreter = Path(sys.executable).resolve(strict=True)
    check_ancestors(interpreter)
    info = interpreter.stat()
    if (not stat.S_ISREG(info.st_mode) or info.st_uid not in (0, os.getuid())
            or info.st_mode & 0o022 or not os.access(interpreter, os.X_OK)):
        raise InstallError("The running Python interpreter is unsafe.")
    for root, dirs, files in os.walk(paths.venv, followlinks=False):
        for name in dirs + files:
            path = Path(root) / name
            info = path.lstat()
            if stat.S_ISLNK(info.st_mode):
                # Distro-specific bin aliases are safe only for this exact verified interpreter.
                try:
                    target = path.resolve(strict=True)
                except (OSError, RuntimeError):
                    raise InstallError("Unsafe symlink in existing reporter virtual environment.") from None
                python_link = path.parent == paths.venv / "bin" and target == interpreter
                lib_link = path == paths.venv / "lib64" and os.readlink(path) == "lib"
                if info.st_uid != os.getuid() or not (python_link or lib_link):
                    raise InstallError("Unsafe symlink in existing reporter virtual environment.")
            elif (not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode))
                  or info.st_uid != os.getuid() or info.st_mode & 0o022):
                raise InstallError("Unsafe ownership or permissions in existing reporter virtual environment.")


def install_wheel(paths: Paths, wheel: Path) -> None:
    validate_wheel(wheel)
    if os.path.lexists(paths.venv):
        check_venv(paths)
        if not paths.python.exists():
            raise InstallError("Existing virtual environment is incomplete; no files were replaced.")
    else:
        command([sys.executable, "-I", "-m", "venv", "--copies", str(paths.venv)],
                "Cannot create Python virtual environment; install your distribution's Python venv support.", timeout=120)
        check_venv(paths)
    command([str(paths.python), "-I", "-m", "pip", "--isolated", "install", "--no-index",
             "--no-deps", "--no-cache-dir", "--disable-pip-version-check", "--only-binary=:all:", str(wheel)],
            "Pinned reporter wheel installation failed.", timeout=180)
    command([str(paths.python), "-I", "-c",
             "from importlib.metadata import version; assert version('ha-tty7') == '0.4.4'"],
            "Installed reporter distribution is not version 0.4.4.")

def install_omp_extension(paths: Paths) -> None:
    command([str(paths.python), "-I", "-m", "ha_tty7.omp_install", "--home", str(paths.home)],
            "OMP status extension installation failed; unsafe or custom extension files were preserved.")
    print("OMP status reporter installed. Use /restart in existing OMP sessions after their work finishes; no session input was sent.")



def find_cli(supplied: Path | None) -> Path:
    candidate = str(supplied.expanduser()) if supplied is not None else shutil.which("tty7")
    if not candidate:
        raise InstallError("Stock tty7 CLI not found on PATH; supply --tty7 /absolute/path/to/tty7.")
    path = Path(candidate).absolute().resolve(strict=True)
    check_ancestors(path)
    info = path.stat()
    if (not stat.S_ISREG(info.st_mode) or not os.access(path, os.X_OK)
            or info.st_uid not in (0, os.getuid()) or info.st_mode & 0o022):
        raise InstallError("Stock tty7 CLI must be an executable file not writable by other users.")
    return path


def stabilize_cli(paths: Paths, source: Path) -> Path:
    appdir = os.environ.get("APPDIR")
    ephemeral = any(part.startswith(".mount_") for part in source.parts)
    if appdir:
        ephemeral = ephemeral or source.is_relative_to(Path(appdir).absolute().resolve())
    if not ephemeral:
        return source
    # A standalone stock CLI is copied verbatim, never patched or wrapped.
    with source.open("rb") as stream:
        content = stream.read(64 * 1024 * 1024 + 1)
    if len(content) > 64 * 1024 * 1024:
        raise InstallError("Stock CLI exceeds the managed copy size limit.")
    if os.path.lexists(paths.cli):
        check_ancestors(paths.cli)
        info = paths.cli.lstat()
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or stat.S_IMODE(info.st_mode) != 0o700 or info.st_nlink != 1
                or paths.cli.read_bytes() != content):
            raise InstallError("Managed stock CLI already differs or is unsafe; refusing destructive replacement. Supply a stable --tty7 path.")
    else:
        write_private_new(paths.cli, content, executable=True)
    return paths.cli


def verify_source(paths: Paths) -> None:
    validate_configuration(paths, paths.config)
    command([str(paths.python), "-I", "-c",
             "from pathlib import Path; import sys,subprocess; from ha_tty7.config import load_config; "
             "from ha_tty7.tty7 import read_agents; c=load_config(Path(sys.argv[1])); "
             "p=subprocess.run([str(c.tty7_path),'--version'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=3); "
             "assert p.returncode == 0 and p.stdout.strip().lower().startswith(b'tty7') and len(p.stdout)<4096; read_agents(c)",
             str(paths.config)], "Stock tty7 version/read-only agents check failed; start tty7 or check its configured server directory.", timeout=15)


def verify_delivery(paths: Paths) -> None:
    command([str(paths.python), "-I", "-m", "ha_tty7", "--config", str(paths.config), "--once"],
            "Real roster delivery failed; update the HA integration to 0.4.4 and check pairing, verified TLS and stock tty7. Service was not enabled.", timeout=30)


def prepare_service_directory(paths: Paths) -> None:
    directory(paths.home / ".config/systemd", private=False)
    directory(paths.unit.parent, private=False)


def systemd_quote(path: Path) -> str:
    # Specifier and environment expansion occur even inside quoted arguments.
    value = str(path).replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%").replace("$", "$$")
    value = "".join(f"\\x{ord(char):02x}" if ord(char) < 32 or ord(char) == 127 else char for char in value)
    return '"' + value + '"'


def write_service(paths: Paths) -> None:
    body = ("# Managed by the HA-tty7 reporter installer\n[Unit]\n"
            "Description=Read-only tty7 agent status for Home Assistant\nAfter=network.target\n\n"
            "[Service]\nType=simple\nExecStart=" + systemd_quote(paths.python) +
            " -I -m ha_tty7 --config " + systemd_quote(paths.config) +
            "\nRestart=on-failure\nRestartSec=5\nUMask=0077\nNoNewPrivileges=true\n\n"
            "[Install]\nWantedBy=default.target\n").encode("utf-8")
    if os.path.lexists(paths.unit):
        check_ancestors(paths.unit)
        info = paths.unit.lstat()
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or info.st_mode & 0o022 or info.st_nlink != 1):
            raise InstallError("Existing user service is unsafe; it was not changed.")
        if paths.unit.read_bytes() != body:
            print("Preserving your existing custom ha-tty7.service; review its ExecStart and privacy settings.")
        return
    write_private_new(paths.unit, body)


def service_action(*arguments: str) -> None:
    command(["systemctl", "--user", *arguments],
            "User service action failed (" + " ".join(arguments) + "); inspect systemctl --user status ha-tty7.service.", timeout=30)


def install(args: argparse.Namespace, *, home: Path | None = None) -> None:
    paths = Paths(home if home is not None else Path.home())
    if shutil.which("flock") is None:
        raise InstallError("OMP status reporting requires flock (util-linux); install util-linux using your distribution package manager, then retry.")
    prepare_directories(paths)
    raw = existing_config(paths)
    # Check existing private files before any pip/network operation.
    if raw is not None and args.tty7 is not None:
        if str(args.tty7.expanduser().absolute()) != raw.get("tty7_path"):
            raise InstallError("Existing tty7_path is preserved; edit its private TOML explicitly to change it.")
    with tempfile.TemporaryDirectory(prefix="install-", dir=paths.data) as temporary:
        wheel = args.wheel.expanduser().absolute() if args.wheel is not None else Path(temporary) / WHEEL_NAME
        if args.wheel is None:
            print("Downloading pinned reporter 0.4.4 over verified HTTPS.")
            download_wheel(wheel)
        validate_wheel(wheel)
        install_wheel(paths, wheel)
    install_omp_extension(paths)
    if raw is None:
        tty7 = stabilize_cli(paths, find_cli(args.tty7))
    else:
        tty7 = Path(raw["tty7_path"])
    prepare_config(paths, tty7, args.ca_file, args.tty7_config_dir)
    verify_source(paths)
    print("Ensure the Home Assistant integration is updated to 0.4.4; verifying one real roster delivery.")
    verify_delivery(paths)
    if args.no_service:
        print("Delivery verified. Manual mode: no service-manager action was performed.")
        print("Run: " + shlex.join([str(paths.python), "-I", "-m", "ha_tty7", "--config", str(paths.config)]))
        return
    prepare_service_directory(paths)
    write_service(paths)
    service_action("daemon-reload")
    service_action("enable", "ha-tty7.service")
    service_action("restart", "ha-tty7.service")
    service_action("is-active", "--quiet", "ha-tty7.service")
    print("Delivery verified; ha-tty7.service is enabled and active for this user (no lingering was enabled).")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, epilog=(
        "New setup prompts for Host ID and a hidden pairing HTTPS URL. Existing private configuration, "
        "pairing and privacy choices are preserved. No secret arguments, sudo or HA token. "
        "A real verified-HTTPS delivery is required, including in manual mode."))
    parser.add_argument("--wheel", type=Path, help="Explicit local ha-tty7 0.4.4 wheel (offline package installation)")
    parser.add_argument("--tty7", type=Path, help="Stock tty7 CLI path; otherwise find tty7 on PATH")
    parser.add_argument("--ca-file", type=Path, help="Trusted PEM CA for new pairing; never disables TLS verification")
    parser.add_argument("--tty7-config-dir", type=Path, help="Stock tty7 server directory for new setup (not read by installer)")
    parser.add_argument("--no-service", action="store_true", help="Manual/container mode: never call systemctl or create a user service")
    args = parser.parse_args(argv)
    if sys.platform != "linux" or sys.version_info < (3, 11):
        print("Installation requires Linux and Python 3.11 or newer.", file=sys.stderr)
        return 2
    previous_umask = os.umask(0o077)
    try:
        install(args)
        return 0
    except InstallError as error:
        print("Installation failed: " + str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError, EOFError):
        # OS/parser exceptions may contain a secret filename or pairing data.
        print("Installation failed: filesystem, configuration or input error; no unsafe fallback was used.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Installation cancelled.", file=sys.stderr)
        return 130
    finally:
        os.umask(previous_umask)


if __name__ == "__main__":
    raise SystemExit(main())
