# Playwright CLI Skill provenance

- Upstream repository: https://github.com/microsoft/playwright
- Reviewed commit: `e125b2ff24ad285b22e595f4e01a14f038b2c800`
- Original path: `packages/playwright-core/src/tools/skills/playwright-cli/SKILL.md`
- License: Apache-2.0. See `LICENSE` in this directory.

This local entrypoint adapts the upstream Playwright CLI procedure to the Glassbox protected Tool. It removes direct Bash access and commands outside the server's action allowlist, including arbitrary code execution, storage-state import, and file upload. It adds Glassbox authorization, isolated session, public-network, and source-evidence rules. The upstream command reference remains available at the pinned source commit.
