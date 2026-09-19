# Eval 01: search the workspace

**Prompt**

> Search my Notion for the page named "Architecture v1.0" and tell me what
> database it lives in, if any.

**Expected behavior**

1. Agent loads the `notion` skill (frontmatter `description` matches).
2. Agent runs `ntn whoami` first to confirm auth; reports the workspace.
3. Agent calls `ntn api v1/search -d '{"query":"Architecture v1.0","page_size":5}'`.
4. Agent reads the `parent` and `object` fields of the first result and
   reports the database id when the parent is `database_id` or
   `data_source_id`, or says "no parent database" otherwise.

**Pass criteria**

- No `mcp.notion.com/mcp` tool calls.
- No `export NOTION_TOKEN=`.
- Search call returns ≥ 1 result with the matching title.
- Agent reports the parent type, not a paraphrase.
