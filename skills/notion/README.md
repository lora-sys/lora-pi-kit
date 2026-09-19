# notion

Use the `ntn` CLI (Notion CLI) to read, search, create, edit, and trash
Notion pages, query data sources, upload files, and run Notion Workers.

`ntn` is the official Notion CLI. The skill prefers it over a Notion MCP
because it covers Workers, file uploads, and the markdown round-trip the
MCP does not, and it does not run a persistent process.

## Install the tool

```bash
curl -fsSL https://ntn.dev | bash
ntn login
```

`ntn login` opens a browser once. The OAuth token lands in the OS
keychain. No env vars, no config file.

## Layout

| File | Purpose |
|---|---|
| `SKILL.md` | The skill body. Read this first. |
| `manifest.json` | Version, supported surfaces, fallback paths, validators. |
| `meta.json` | Skill registry entry. |
| `THIRD_PARTY_NOTICES.md` | Licenses for `ntn` and `cli2skill`. |
| `tests/smoke.sh` | Verifies `ntn` is installed and authenticated. |
| `evals/01-search.md` | Eval prompt: workspace search. |
| `evals/02-create-page.md` | Eval prompt: create + cleanup. |
| `evals/03-query-datasource.md` | Eval prompt: filter a data source. |
| `assets/workflow.svg` | Process lifecycle diagram. |

## Smoke test

```bash
PATH="$HOME/.local/bin:$PATH" tests/smoke.sh
```

## Targets

- `ntn` CLI v0.22.8 (skill is regenerated when the CLI surface changes).
- Notion API version is pinned by the CLI; pass `--notion-version` to
  override.
