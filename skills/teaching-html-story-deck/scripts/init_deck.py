#!/usr/bin/env python3
"""Scaffold a standalone teaching HTML deck.

Default output filename is slugified from --title so multiple decks do not
overwrite each other. --out still wins when supplied.
"""
from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "assets" / "base-shell.html"


def slugify(value: str) -> str:
    """Make a filename-safe slug from an arbitrary title.

    ASCII transliteration is preferred; non-ASCII runs are kept as a single
    dash-separated block so a Chinese title still produces a recognizable
    filename like `teaching-deck-教学.html`.
    """
    text = value.strip()
    if not text:
        return "teaching-deck"

    ascii_parts: list[str] = []
    cjk_parts: list[str] = []
    for ch in unicodedata.normalize("NFKC", text):
        if ch.isascii() and (ch.isalnum() or ch in "-_"):
            ascii_parts.append(ch.lower())
        elif unicodedata.category(ch).startswith("Lo") or "\u4e00" <= ch <= "\u9fff":
            cjk_parts.append(ch)
        elif ch.isspace() or ch in "/\\":
            ascii_parts.append("-")
        # Other punctuation is dropped.

    ascii_slug = re.sub(r"-+", "-", "".join(ascii_parts)).strip("-")
    if ascii_slug and cjk_parts:
        return f"{ascii_slug}-{"".join(cjk_parts)}"
    if ascii_slug:
        return ascii_slug
    if cjk_parts:
        return "".join(cjk_parts)
    return "teaching-deck"


def default_out(title: str) -> str:
    return f"teaching-deck-{slugify(title)}.html"


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold a standalone teaching HTML deck.")
    parser.add_argument("--title", required=True, help="Deck title; also seeds the default output filename.")
    parser.add_argument("--out", help="Output HTML path. Defaults to teaching-deck-<slug>.html.")
    args = parser.parse_args()

    text = BASE.read_text(encoding="utf-8").replace("{{TITLE}}", args.title)
    out = Path(args.out) if args.out else Path(default_out(args.title))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
