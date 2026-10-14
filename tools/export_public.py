#!/usr/bin/env python3
"""Export only public release source, never local history/runtime/private evidence."""

import argparse
from pathlib import Path
import shutil
import re

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "README.md", "LICENSE", "hacs.json", "pyproject.toml", ".gitignore",
    "docs/install.md", "tools/build_release.py", "tools/export_public.py",
    "card/package.json", "card/package-lock.json", "card/tsconfig.json",
    "card/vite.config.ts", "card/playwright.config.ts", "card/index.html", "card/README.md",
    "integration-tests/README.md", "integration-tests/conftest.py",
)
DIRECTORIES = (
    "custom_components/ha_tty7", "collector", "deploy", "examples",
    "card/src", "card/test", "card/dev", "card/e2e", "integration-tests",
)
SUFFIXES = {".py", ".json", ".toml", ".service", ".ts", ".html", ".md", ".js", ".png", ".txt"}
FORBIDDEN_PARTS = {".git", ".storage", "__pycache__", "node_modules", ".pytest_cache", "test-results", "runtime"}


def export(destination: Path) -> int:
    destination = destination.resolve()
    if destination == ROOT or (destination.exists() and any(destination.iterdir())):
        raise ValueError("Use a new empty publication directory")
    paths = {ROOT / name for name in FILES}
    for name in DIRECTORIES:
        directory = ROOT / name
        paths.update(path for path in directory.rglob("*") if path.is_file())
    selected = []
    for path in sorted(paths):
        relative = path.relative_to(ROOT)
        if (not path.is_file() or path.is_symlink() or path.suffix not in SUFFIXES and relative.as_posix() not in FILES
                or any(part in FORBIDDEN_PARTS or part.startswith(".") and part != ".gitignore" for part in relative.parts)
                or path.name.endswith((".secret", ".local.toml", ".local.json"))):
            continue
        # Fail rather than silently publish known environment-specific content.
        if path.suffix != ".png":
            content = path.read_text(encoding="utf-8")
            if (str(Path.home()) + "/" in content
                    or re.search(r"https?://[^\s/]+\.int\.", content)
                    or re.search(r"\b192\.168\.\d{1,3}\.\d{1,3}\b", content)):
                raise ValueError("Private environment marker in public file: " + relative.as_posix())
        selected.append((path, relative))
    destination.mkdir(parents=True, exist_ok=True)
    for path, relative in selected:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    return len(selected)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(f"Exported {export(args.output)} public files without history or private runtime")


if __name__ == "__main__":
    main()
