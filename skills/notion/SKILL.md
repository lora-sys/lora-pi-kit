---
name: notion
description: Interact with the user's Notion workspace via the `ntn` CLI (Notion CLI). Use when the user asks to read, search, create, edit, or trash Notion pages, query a data source, upload a file, or run a Notion Worker. If `ntn whoami` fails, stop and ask the user to run `ntn login`.
---

# notion (ntn CLI)

`ntn` is Notion's official CLI. It stores the OAuth token in the OS keychain
(`ntn login` opens a browser once), then issues Notion HTTP API calls plus a
handful of higher-level helpers (`ntn pages`, `ntn datasources`, `ntn files`,
`ntn workers`).

If a `mcp.notion.com/mcp` MCP is configured, prefer `ntn`. The MCP exposes
only the public REST API; `ntn` also handles Workers, file uploads, and
the markdown round-trip.

## Before the first call

Run `ntn whoami`. If it errors with "not logged in", tell the user to run
`ntn login` and stop. The CLI does not accept a pasted token.

## Top-level commands

| Task | Command |
|---|---|
| Read a page as Markdown | `ntn pages get <page-id>` |
| Read a page as raw JSON | `ntn pages get <page-id> --json` |
| Create a page from Markdown | `ntn pages create --parent <target> --content '...'` |
| Create a page from a `.md` file | `ntn pages create --parent <target> < page.md` |
| Create a page interactively | `ntn pages create` (opens `$EDITOR`) |
| Edit a page from Markdown | `ntn pages edit <page-id> --content '...'` |
| Trash a page | `ntn pages trash <page-id> --yes` |
| Query a database | `ntn datasources query <url-or-db-id>` |
| List a database's data sources | `ntn datasources resolve <database-id>` |
| Query a data source by id (raw API) | `ntn api v1/data_sources/<ds-id>/query --method POST -d '{...}'` |
| Upload a file (byte stream) | `ntn files create < local.png` |
| Upload from a URL | `ntn files create --external-url <url>` |
| List file uploads | `ntn files list` |
| Call any Notion API path | `ntn api v1/<endpoint> [flags]` |
| List supported API endpoints | `ntn api ls` |
| Print docs for one endpoint | `ntn api <path> --docs` |
| Scaffold a Worker | `ntn workers new` |
| Deploy a Worker | `ntn workers deploy` |
| List Workers | `ntn workers list` |
| Inspect auth / health | `ntn auth`, `ntn doctor` |
| Update the CLI | `ntn update` |

## Markdown round-trip

`ntn pages get` prints Markdown with a YAML frontmatter block listing page
properties. `ntn pages create` and `edit` strip that frontmatter on input, so
the safe pattern is:

```bash
# round-trip an existing page
ntn pages get PAGE_ID > page.md
# edit page.md
ntn pages edit PAGE_ID < page.md
```

On create, a `title:` line in frontmatter sets the page title. Other
frontmatter properties are ignored by `ntn pages`; for those use
`ntn api v1/pages`.

## `--parent` syntax

`ntn pages create` accepts `--parent` in three forms:

```
--parent page:<page-id>
--parent database:<database-id>
--parent data-source:<data-source-id>
```

If `--parent` is omitted, the page is created at the workspace root. That
only works if the integration has workspace-level access.

## Common recipes

### Read a page given a Notion URL

```bash
# URL: https://www.notion.so/My-Page-Title-2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f
# The page id is the trailing 32-hex chunk; dashes are optional.
ntn pages get 2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f
```

For `notion.so/<slug>-<id>?v=<hash>` URLs, take everything after the last
hyphen in the path. For `notion.so/workspace/<ws>/<title>-<id>` URLs, the id
is the trailing 32-hex chunk.

### Search the workspace

```bash
ntn api v1/search -d '{"query":"Q3 plan","page_size":10}'
```

Filter by type:

```bash
ntn api v1/search -d '{"query":"","filter":{"value":"page","property":"object"},"page_size":10}'
```

### Create a page under a known page

```bash
ntn pages create --parent page:PARENT_PAGE_ID --content '# My new page

Some body text.'
```

### Create a row in a data source

```bash
ntn pages create --parent data-source:DS_ID --content '---
title: My new row
status: Inbox
---

Body of the row.'
```

The frontmatter `title` becomes the page title. For non-title properties the
frontmatter keys are ignored by `ntn pages`; for typed properties use
`ntn api v1/pages` with the `properties` body shape.

### Query a data source with a filter

`ntn datasources query` accepts a database id, a Notion URL, or (per its
docs) a data source id. In practice against `ntn 0.22.8`, the **database id**
form works; passing a raw data source id currently returns
`Failed to execute public API request`. If you have only a data source id,
query it via the public API:

```bash
ntn datasources query DB_OR_URL \
  --filter '{"property":"Status","select":{"equals":"Inbox"}}' \
  --limit 50 --json
```

```bash
# Fallback when you only have a data source id
ntn api v1/data_sources/DS_ID/query --method POST \
  -d '{"page_size":50,"filter":{"property":"Status","select":{"equals":"Inbox"}}}'
```

### Edit page content

```bash
ntn pages edit PAGE_ID --content '# Updated body

New content here.'
```

To replace page properties, use `ntn api v1/pages/PAGE_ID --method PATCH`.

### Upload a file

```bash
ntn files create < ./diagram.png
ntn files create --external-url https://example.com/photo.png
ntn files list
```

Then attach the returned upload id to a block on a page via
`ntn api v1/blocks` with a `file_upload` block type.

### Call any Notion API path

```bash
# GET
ntn api v1/users/me

# POST with JSON body
ntn api v1/search -d '{"query":"x"}'

# POST with inline inputs (a=b strings)
ntn api v1/pages parent[page_id]=PARENT properties[Name][title][0][text][content]="Hi"

# PATCH
ntn api v1/pages/PAGE_ID --method PATCH -d '{"properties":{"Name":{"title":[]}}}'
```

`ntn api` parses extra args after the path:

| Form | Meaning | Example |
|---|---|---|
| `path=value` | body field, string | `parent[page_id]=abc123` |
| `path:=json` | body field, raw JSON | `archived:=true` |
| `name==value` | query parameter | `page_size==100` |
| `Header:Value` | request header | `Accept:application/json` |
| `-d '<json>'` | whole body as JSON | `-d '{"query":"x"}'` |
| `--method X` | override HTTP method | `--method PATCH` |

No body inputs → `GET`. Body inputs → `POST` unless `--method` overrides.

## Error handling

| Symptom | Likely cause | Fix |
|---|---|---|
| `not logged in` from `ntn whoami` | OAuth not done | `ntn login` |
| `401 unauthorized` from `ntn api` | token expired in keychain | `ntn login` again |
| `404 object_not_found` on a page the user says exists | integration not shared into the page | user opens page → ⋯ → Connections → add the `Notion CLI` bot |
| `400 validation_error` on `pages create` | bad `--parent` syntax or missing required properties | run `ntn api v1/pages --docs` for the property schema; check `--parent` is `page:` / `database:` / `data-source:` |
| `404 database_not_found` on `datasources query` | wrong id, or a database-vs-data-source confusion | run `ntn datasources resolve <database-id>` to list data source ids |
| Truncated Markdown from `pages get` | page has blocks the Markdown converter doesn't know | re-run with `--json` and check `unknown_block_ids` on stderr |
| `pages create` opens an editor instead of running | ran in a TTY with no `--content` and no stdin | pipe `< page.md` or pass `--content '...'` |

## Pitfalls

- The `Notion CLI` integration must be **explicitly shared** into each page
  or database the user wants to act on. The OAuth login alone is not enough.
  Public-API integrations have no workspace-level read access by default.
- A Notion database can have multiple data sources. `pages create
  --parent database:DB_ID` picks one automatically; if it picks the wrong
  one, resolve first with `datasources resolve` and pass `data-source:`.
- `ntn api` writes to stdout. Pipe to `jq` to extract a field; do not
  regex-grep the JSON.
- `pages edit` is destructive: it replaces the page's body blocks with the
  Markdown. Pass `--allow-deleting-content` to allow removing child pages
  and databases during the edit. The default refuses this.
- `datasources query` returns only the first page of results. For more,
  use `--start-cursor` and `--json`.
- The CLI reads the OS keychain. `sudo` breaks the keychain lookup. The
  `NOTION_API_TOKEN` env var overrides the keychain with a worse flow, so
  leave it unset in interactive shells. Reserve it for CI / headless
  contexts.

## Discovery

- `ntn --help` for the top-level command list.
- `ntn <command> --help` for subcommand flags and examples.
- `ntn api ls` for every supported public endpoint.
- `ntn api <path> --docs` for the full Notion API doc fragment of one
  endpoint.
- `ntn doctor` for an auth / version / network diagnostic.
