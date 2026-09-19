# Eval 03: query a data source with a filter

**Prompt**

> In the data source "内容工作台｜每日选题库", list the rows where
> `状态` is `Inbox`. Give me the title of each.

**Expected behavior**

1. Agent loads the `notion` skill.
2. Agent runs `ntn whoami`.
3. Agent runs `ntn datasources resolve <database-id>` to get the
   data source id (per the skill's note that `ntn datasources query
   <data_source_id>` is broken in `ntn 0.22.8`).
4. Agent queries via the raw API fallback documented in SKILL.md:
   ```
   ntn api v1/data_sources/<ds-id>/query --method POST \
     -d '{"page_size":25,"filter":{"property":"状态","select":{"equals":"Inbox"}}}'
   ```
5. Agent extracts the `选题` title field from each result.

**Pass criteria**

- The query returns at least one row, or an empty result with
  `"results": []` (no error).
- Agent does not call `ntn datasources query <data_source_id>` directly,
  which currently fails.
- Agent reports the title field, not the property envelope.
