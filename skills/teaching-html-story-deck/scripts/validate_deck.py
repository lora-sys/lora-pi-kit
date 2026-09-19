#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import argparse
import re
import sys

class DeckParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.slides=0; self.svgs=0; self.svg_accessible=0; self.scripts=0
        self.external_scripts=[]; self.external_styles=[]
        self.has_title=False; self.has_viewport=False
    def handle_starttag(self, tag, attrs):
        data=dict(attrs)
        if tag=="section" and "slide" in data.get("class","").split(): self.slides+=1
        if tag=="svg":
            self.svgs+=1
            if (data.get("role")=="img" and data.get("aria-label")) or data.get("aria-hidden")=="true": self.svg_accessible+=1
        if tag=="script":
            self.scripts+=1
            if data.get("src"): self.external_scripts.append(data["src"])
        if tag=="link" and data.get("rel")=="stylesheet": self.external_styles.append(data.get("href",""))
        if tag=="title": self.has_title=True
        if tag=="meta" and data.get("name")=="viewport": self.has_viewport=True

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("html_file"); args=ap.parse_args()
    path=Path(args.html_file)
    if not path.exists(): print(f"ERROR missing file: {path}"); return 2
    text=path.read_text(encoding="utf-8"); p=DeckParser(); p.feed(text)
    checks={
        "doctype":text.lstrip().lower().startswith("<!doctype html>"),
        "title":p.has_title,
        "viewport":p.has_viewport,
        "slides":p.slides>=1,
        "script":p.scripts>=1,
        "keyboard":bool(re.search(r"ArrowRight|ArrowLeft",text)),
        "fullscreen":"requestFullscreen" in text,
        "reduced_motion":"prefers-reduced-motion" in text,
        "no_external_scripts":not p.external_scripts,
        "no_external_styles":not p.external_styles,
        "svg_accessibility":p.svgs==0 or p.svg_accessible==p.svgs,
    }
    failed=[k for k,v in checks.items() if not v]
    for name,ok in checks.items(): print(f"{'PASS' if ok else 'FAIL'} {name}")
    print(f"slides={p.slides} svgs={p.svgs} accessible_svgs={p.svg_accessible}")
    if failed: print("FAILED:",", ".join(failed)); return 1
    return 0
if __name__=="__main__": sys.exit(main())
