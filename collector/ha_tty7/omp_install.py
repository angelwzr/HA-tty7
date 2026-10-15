"""Install the credential-free, automatically discovered OMP status extension."""
from __future__ import annotations

import argparse
import hashlib
from importlib.resources import files
import os
from pathlib import Path
import shutil
import stat
import tempfile

class FlockUnavailableError(ValueError):
    """The Linux cross-runtime publication lock dependency is unavailable."""



def _directory(path: Path, *, private: bool = False) -> None:
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        pass
    info = path.lstat()
    if (not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or info.st_mode & (0o077 if private else 0o022)):
        raise ValueError("Unsafe OMP extension directory; owned real directories are required.")


def _read(path: Path) -> bytes | None:
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    except OSError:
        raise ValueError("Unsafe managed extension file; symlinks are refused.") from None
    try:
        info = os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1
                or info.st_size > 128 * 1024):
            raise ValueError("Unsafe managed extension file; owned single-link 0600 files are required.")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            return stream.read(128 * 1024 + 1)
    finally:
        os.close(fd)


def _replace(path: Path, content: bytes) -> None:
    fd, temporary = tempfile.mkstemp(prefix=".ha-tty7-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.lexists(temporary):
            os.unlink(temporary)


def install_extension(home: Path | None = None) -> Path:
    """Install/update only our managed extension, preserving custom OMP files."""
    if shutil.which("flock") is None:
        raise FlockUnavailableError("OMP status reporting requires flock (util-linux); install util-linux using your distribution package manager, then retry.")
    home = (home if home is not None else Path.home()).expanduser().absolute()
    # Do not traverse symlinked homes/ancestors or writable external directories.
    for parent in reversed((home / ".omp").parents):
        info = parent.lstat()
        if (not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0, os.getuid())
                or (info.st_mode & 0o022 and not info.st_mode & stat.S_ISVTX)):
            raise ValueError("Unsafe OMP extension ancestry.")
    _directory(home)
    directory = home
    for component in (".omp", "agent", "extensions", "ha-tty7-status"):
        directory /= component
        _directory(directory, private=component == "ha-tty7-status")
    target = directory / "index.ts"
    receipt = directory / ".managed-sha256"
    source = files("ha_tty7").joinpath("omp_extension.ts").read_bytes()
    installed, previous = _read(target), _read(receipt)
    digest = lambda value: hashlib.sha256(value).hexdigest().encode("ascii") + b"\n"
    if installed is not None and (previous is None or previous != digest(installed)):
        raise ValueError("Custom or modified ha-tty7-status extension was preserved; move it before installing the managed reporter.")
    if installed is None and previous is not None:
        raise ValueError("Incomplete managed extension; existing files were preserved.")
    if installed != source:
        _replace(target, source)
        _replace(receipt, digest(source))
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, help="Installation home (defaults to the current user's home)")
    args = parser.parse_args(argv)
    try:
        install_extension(args.home)
    except FlockUnavailableError as error:
        print(str(error))
        return 1
    except (OSError, ValueError):
        print("OMP status extension installation refused unsafe or custom files; existing OMP settings were preserved.")
        return 1
    print("OMP status reporter installed. Reload plugins or start a new OMP process for existing sessions; no session input was sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
