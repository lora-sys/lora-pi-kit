#!/usr/bin/env python3
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
def main():
    errors=[]
    skill=ROOT/"SKILL.md"
    if not skill.exists(): errors.append("Missing SKILL.md")
    else:
        text=skill.read_text(encoding="utf-8")
        if not text.startswith("---"): errors.append("Missing frontmatter")
        if "name: teaching-html-story-deck" not in text: errors.append("Unexpected skill name")
        if "description:" not in text: errors.append("Missing description")
    try:
        cases=json.loads((ROOT/"evals/cases.json").read_text(encoding="utf-8"))
        if len(cases)<3: errors.append("Too few eval cases")
    except Exception as exc: errors.append(f"Invalid eval JSON: {exc}")
    required=[
        "references/user-preferences.md","references/story-and-visual-framework.md",
        "references/svg-and-motion-system.md","references/quality-gates.md",
        "assets/base-shell.html","scripts/validate_deck.py"
    ]
    for rel in required:
        if not (ROOT/rel).exists(): errors.append(f"Missing {rel}")
    if errors:
        for e in errors: print("FAIL",e)
        return 1
    print("PASS skill structure\nPASS references\nPASS eval JSON")
    return 0
if __name__=="__main__": sys.exit(main())
