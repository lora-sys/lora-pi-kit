#!/usr/bin/env python3
"""Validate a Samuel Video Coach JSON storyboard against the bundled schema."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/validate_storyboard.py <storyboard.json>")
        return 2

    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        print("Missing dependency: pip install jsonschema")
        return 2

    target = Path(sys.argv[1]).expanduser().resolve()
    schema_path = Path(__file__).resolve().parents[1] / "assets" / "storyboard.schema.json"

    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        print(f"File not found: {exc.filename}")
        return 2
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON: {exc}")
        return 2

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda err: list(err.absolute_path))
    if errors:
        print(f"Validation failed with {len(errors)} error(s):")
        for error in errors:
            path = ".".join(str(part) for part in error.absolute_path) or "<root>"
            print(f"- {path}: {error.message}")
        return 1

    print("Storyboard JSON is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
