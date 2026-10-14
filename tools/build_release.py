#!/usr/bin/env python3
"""Build the integration archive from a complete, allowlisted runtime directory."""

import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "ha_tty7"
ALLOWED_SUFFIXES = {".py", ".json", ".png", ".js", ".txt", ".md"}
REQUIRED = {
    "__init__.py", "manifest.json", "config_flow.py", "sensor.py", "binary_sensor.py",
    "protocol/__init__.py", "frontend/ha-tty7-card.js", "brand/icon.png",
}


def build(output: Path) -> Path:
    manifest = json.loads((COMPONENT / "manifest.json").read_text())
    if manifest.get("domain") != "ha_tty7" or not manifest.get("config_flow"):
        raise ValueError("Invalid integration manifest")
    files = {
        path.relative_to(COMPONENT).as_posix(): path
        for path in COMPONENT.rglob("*")
        if path.is_file() and not path.is_symlink()
        and path.suffix in ALLOWED_SUFFIXES
        and not any(part.startswith(".") or part == "__pycache__" for part in path.relative_to(COMPONENT).parts)
    }
    missing = REQUIRED - files.keys()
    if missing:
        raise ValueError("Incomplete integration artifact: " + ", ".join(sorted(missing)))
    if files["frontend/ha-tty7-card.js"].stat().st_size < 1000:
        raise ValueError("Build the complete frontend bundle before packaging")
    output.mkdir(parents=True, exist_ok=True)
    archive_path = output / "ha_tty7.zip"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for relative, path in sorted(files.items()):
            archive.write(path, relative)
        archive.write(ROOT / "LICENSE", "LICENSE")
    return archive_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    print(build(args.output))


if __name__ == "__main__":
    main()
