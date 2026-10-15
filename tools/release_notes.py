#!/usr/bin/env python3
"""Extract one changelog section without flattening its Markdown formatting."""
import argparse
from pathlib import Path
import re

HEADING = re.compile(r"^## \[([^\]]+)\](?:\s+-\s+\d{4}-\d{2}-\d{2})?\s*$")
REFERENCE = re.compile(r"^\[[^\]]+\]:\s+\S+")


def extract_notes(changelog: str, version: str) -> str:
    lines = changelog.splitlines()
    selected = False
    body = []
    for line in lines:
        heading = HEADING.fullmatch(line)
        if heading:
            if selected:
                break
            selected = heading[1].casefold() == version.casefold()
            continue
        if selected:
            if REFERENCE.match(line):
                break
            body.append(line)
    notes = "\n".join(body).strip()
    if not notes:
        raise ValueError(f"No release notes found for {version}")
    return notes + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="Exact changelog section, or Unreleased for a local draft")
    parser.add_argument("--changelog", type=Path, default=Path(__file__).resolve().parents[1] / "CHANGELOG.md")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        notes = extract_notes(args.changelog.read_text(encoding="utf-8"), args.version)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(notes, encoding="utf-8")
    else:
        print(notes, end="")


if __name__ == "__main__":
    main()
