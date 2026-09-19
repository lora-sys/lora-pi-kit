#!/usr/bin/env bash
# Install a skill into the canonical store at /data/lora/ai/skills/.
# Idempotent: running twice for the same name reports the existing install.
# Always read the live layout from references/skill-store-layout.md before trusting
# any hard-coded path.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-skill.sh --source <path> [--name <skill-name>] [--dry-run]

Examples:
  install-skill.sh --source ./my-skill
  install-skill.sh --source ./my-skill --name my-skill
  install-skill.sh --source ./my-skill --dry-run
EOF
}

SOURCE=""
NAME=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="${2:-}"; shift 2 ;;
    --name) NAME="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: Unknown argument: $1" >&2; usage >&2; exit 64 ;;
  esac
done

[[ -n "$SOURCE" ]] || { echo "ERROR: --source is required" >&2; usage >&2; exit 64; }
[[ -d "$SOURCE" ]] || { echo "ERROR: --source is not a directory: $SOURCE" >&2; exit 65; }
[[ -f "$SOURCE/SKILL.md" ]] || { echo "ERROR: $SOURCE/SKILL.md not found" >&2; exit 66; }

if [[ -z "$NAME" ]]; then
  NAME="$(basename "$(cd "$SOURCE" && pwd)")"
fi

CANONICAL="/data/lora/ai/skills"
TARGET="$CANONICAL/$NAME"

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
  else
    eval "$@"
  fi
}

printf 'CANONICAL=%s\nTARGET=%s\nNAME=%s\nDRY_RUN=%s\n' \
  "$CANONICAL" "$TARGET" "$NAME" "$DRY_RUN"

if [[ -d "$TARGET" ]]; then
  echo "INFO: $TARGET already exists; treating as update (no files removed)"
fi

run "cp -r '$SOURCE' '$TARGET'"
run "test -f '$TARGET/meta.json' || cat > '$TARGET/meta.json' <<EOF
{
  \"id\": \"$NAME\",
  \"entry\": \"SKILL.md\"
}
EOF"
run "mkdir -p '$TARGET/skills'"

# Validate, if the validator exists.
VALIDATOR="$HOME/.agents/skills/.system/skill-creator/scripts/quick_validate.py"
if [[ -f "$VALIDATOR" ]]; then
  run "python3 '$VALIDATOR' '$TARGET'"
else
  echo "WARN: validator not found at $VALIDATOR; skipped"
fi

echo "DONE: $NAME installed at $TARGET"
