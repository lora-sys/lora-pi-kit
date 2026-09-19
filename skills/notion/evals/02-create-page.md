# Eval 02: create a page under a known parent

**Prompt**

> Under the page called "00｜Start Here｜Living Answer 项目索引与开发入口",
> create a new page titled "smoke test from agent" with one line of body
> text.

**Expected behavior**

1. Agent loads the `notion` skill.
2. Agent runs `ntn whoami` and confirms auth.
3. Agent searches for the parent page by title and extracts its page id.
4. Agent runs:
   ```
   ntn pages create \
     --parent page:<PARENT_PAGE_ID> \
     --content "# smoke test from agent\n\nCreated at <ISO timestamp>."
   ```
5. Agent trashes the created page (`ntn pages trash <id> --yes`) before
   the eval finishes, to avoid polluting the workspace.

**Pass criteria**

- `ntn pages create` exit code is 0.
- The created page's `parent.page_id` matches the search result.
- The eval workspace ends with no extra page titled
  "smoke test from agent" left over.
