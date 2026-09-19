#!/usr/bin/env python3
"""Validate a static HTML artifact before any public deployment."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MAX_EDGEONE_FILE_BYTES = 25 * 1024 * 1024
MAX_EDGEONE_FILES = 20_000
TEXT_EXTENSIONS = {".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml"}
SENSITIVE_BASENAMES = {
    ".env",
    ".env.local",
    ".env.production",
    "id_rsa",
    "id_ed25519",
    "credentials.json",
    "service-account.json",
    ".npmrc",
    ".pypirc",
}
SENSITIVE_PARTS = {".git", ".ssh", "node_modules", "__pycache__"}
LOCAL_PATH_PATTERN = re.compile(r"(?:file://|(?:src|href)=[\"']/(?:home|Users|private|var|tmp)/|(?:src|href)=[\"'][A-Za-z]:\\)", re.IGNORECASE)
ROOT_ASSET_PATTERN = re.compile(r"(?:src|href)=[\"']/(?!/)([^\"'#?]+)", re.IGNORECASE)
EXTERNAL_HTTP_PATTERN = re.compile(r"(?:src|href)=[\"']https?://", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check a static HTML file or directory before public hosting."
    )
    parser.add_argument("artifact", type=Path, help="index.html or a directory containing it")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return non-zero for warnings in addition to blocking errors.",
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON only.")
    return parser.parse_args()


def collect_files(root: Path) -> list[Path]:
    return [path for path in root.rglob("*") if path.is_file()]


def inspect_text_file(path: Path, warnings: list[str]) -> None:
    if path.suffix.lower() not in TEXT_EXTENSIONS:
        return
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except OSError as exc:
        warnings.append(f"Cannot inspect text file {path}: {exc}")
        return

    if LOCAL_PATH_PATTERN.search(content):
        warnings.append(f"Local filesystem reference detected in {path}")
    if ROOT_ASSET_PATTERN.search(content):
        warnings.append(
            f"Root-relative asset path detected in {path}; it can break under GitHub project Pages"
        )
    if EXTERNAL_HTTP_PATTERN.search(content):
        warnings.append(f"External HTTP(S) dependency detected in {path}; availability is outside this deployment")


def main() -> int:
    args = parse_args()
    artifact = args.artifact.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    if not artifact.exists():
        errors.append(f"Artifact does not exist: {artifact}")
        root = artifact
        entry = artifact
        files: list[Path] = []
    elif artifact.is_file():
        if artifact.suffix.lower() not in {".html", ".htm"}:
            errors.append(f"Expected an HTML file, got: {artifact.name}")
        root = artifact.parent
        entry = artifact
        files = [artifact]
    elif artifact.is_dir():
        root = artifact
        entry = root / "index.html"
        if not entry.is_file():
            errors.append(f"Missing required entry file: {entry}")
        files = collect_files(root)
    else:
        errors.append(f"Artifact is neither a file nor a directory: {artifact}")
        root = artifact
        entry = artifact
        files = []

    total_bytes = 0
    oversized_files: list[str] = []
    sensitive_files: list[str] = []
    for path in files:
        try:
            size = path.stat().st_size
        except OSError as exc:
            errors.append(f"Cannot stat {path}: {exc}")
            continue
        total_bytes += size
        rel = path.relative_to(root) if root.exists() and root.is_dir() else path.name
        if size > MAX_EDGEONE_FILE_BYTES:
            oversized_files.append(f"{rel} ({size} bytes)")
        if path.name.lower() in SENSITIVE_BASENAMES or any(part in SENSITIVE_PARTS for part in path.parts):
            sensitive_files.append(str(rel))
        inspect_text_file(path, warnings)

    if len(files) > MAX_EDGEONE_FILES:
        errors.append(
            f"File count {len(files)} exceeds EdgeOne Direct Upload limit of {MAX_EDGEONE_FILES}"
        )
    if oversized_files:
        errors.append(
            "Files exceed EdgeOne Direct Upload single-file limit of 25 MiB: " + "; ".join(oversized_files)
        )
    if sensitive_files:
        errors.append(
            "Sensitive or deployment-noise files must be excluded before public upload: " + "; ".join(sensitive_files)
        )

    report = {
        "artifact": str(artifact),
        "root": str(root),
        "entry": str(entry),
        "entry_exists": entry.is_file(),
        "file_count": len(files),
        "total_bytes": total_bytes,
        "edgeone_direct_upload_limits": {
            "max_files": MAX_EDGEONE_FILES,
            "max_single_file_bytes": MAX_EDGEONE_FILE_BYTES,
        },
        "errors": sorted(set(errors)),
        "warnings": sorted(set(warnings)),
        "ready_for_static_hosting": not errors,
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("Static HTML preflight")
        print(f"  Artifact: {report['artifact']}")
        print(f"  Entry:    {report['entry']} ({'found' if report['entry_exists'] else 'missing'})")
        print(f"  Files:    {report['file_count']}")
        print(f"  Bytes:    {report['total_bytes']}")
        for error in report["errors"]:
            print(f"ERROR: {error}")
        for warning in report["warnings"]:
            print(f"WARNING: {warning}")
        print("RESULT: " + ("PASS" if not errors else "BLOCKED"))

    if errors:
        return 2
    if args.strict and warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
