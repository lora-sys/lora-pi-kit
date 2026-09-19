#!/usr/bin/env bash
# Smoke test for the notion skill. Exits 0 if every check passes.
# Requires `ntn` on PATH and a completed `ntn login`.

set -euo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
ok()   { printf 'ok   %s\n' "$*"; }

command -v ntn >/dev/null 2>&1 || fail "ntn not on PATH; run: curl -fsSL https://ntn.dev | bash"

ntn --version >/dev/null || fail "ntn --version failed"
ok "ntn --version"

if ! ntn whoami >/dev/null 2>&1; then
  fail "ntn whoami failed; run: ntn login"
fi
ok "ntn whoami"

# Probe a public API path. Should exit 0 and contain the bot's id when auth is good.
out=$(ntn api v1/users/me 2>&1) || fail "ntn api v1/users/me exited non-zero: $out"
printf '%s' "$out" | grep -qE '"object":\s*"user"' || fail "ntn api v1/users/me response did not look like a user object: $out"
ok "ntn api v1/users/me returned a user object"

printf 'all checks passed\n'
