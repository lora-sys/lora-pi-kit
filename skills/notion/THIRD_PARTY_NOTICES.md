# Third-party notices

This skill wraps two upstream projects. Neither is vendored into this
repository; users install them locally before the skill works.

## Notion CLI (`ntn`)

- Source: https://github.com/makenotion/notion-cli (install via `curl -fsSL https://ntn.dev | bash`)
- License: MIT
- Author: Notion Labs, Inc.

The skill documents the CLI's public surface and tells the agent when to
call each subcommand. It does not redistribute the binary or any
Notion API code.

## `cli2skill`

- Source: https://github.com/2233admin/cli2skill
- License: MIT
- Author: 2233admin

`cli2skill` was used during development to parse `ntn --help` and surface
its subcommands. The generated scaffold was rewritten by hand before
publication; the tool itself is not required at runtime.
