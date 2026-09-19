---
name: lora-tooling
description: 本机系统专用安装指南：装新 skill 到 canonical store、装 MCP、装模型、装运行时工具、跨 CLI 同步 skill 更新。触发词：安装、装到哪、skill 路径、模型放哪、MCP 配置、webbridge、推 GitHub、push skill、sync skill、全局更新、统一更新、canonical store、pi 兼容、quick_validate。**不**回答：写代码、改 skill 内容、调试其它工具——那是各自 skill 的事。
---

# 系统安装指南

本机所有 coding CLI 的 skills 都已 symlink 到同一个 canonical store：**只改这里，其它 CLI 自动生效**。

## 关键规则

1. **Canonical skill store 是 `/data/lora/ai/skills/`，只改这一个目录**。所有 CLI（codex / claude / gemini / qwen / pi / opencode）都通过 symlink 读它。
2. **数据盘 `/data/lora/` 是只读 Btrfs 快照**，不能直接写；要写到 `/home/lora/` 下的可写子目录（`.codex/`、`.gemini/`、`.qwen/`、`.pi/`、`.cache/`、`.cargo/`、`.bun/`、`.npm/`、`.kimi-webbridge/`）。
3. 各 CLI 的 skills 目录都是 symlink，**删 symlink 不影响** canonical store；要看真实路径必须 `readlink`。
4. **pi 兼容**：每个 skill 必须有 `skills/` 子目录（可以为空），否则 pi 加载报 "Cannot find module"。
5. **改完 SKILL.md 跑** `python3 ~/.agents/skills/.system/skill-creator/scripts/quick_validate.py <skill-path>` 确认 frontmatter 合规；**还要**用对应 CLI 跑一下首屏（`codex` 启动 / `pi -p "echo ok"`）确认 skill 真的被加载。

## 协作

- 装新 skill 时，**写完后交给**对应 skill 的 owner 自检（`teaching-html-story-deck/scripts/validate_deck.py` 之类）再发布。
- 装 MCP 后**重启**对应 CLI 生效；`.mcp.json` 是 Claude Code 读、`mcpServers` 字段是 Claude 专属。
- 改本 skill 自己（`SKILL.md` / `references/`）后跑 quick_validate，并 `pi -p "echo ok"` 确认没踩坏 pi 加载。
- **跨 CLI 同步更新**：所有 coding CLI 的 skills 都从 canonical store 读；改完一个 skill 后，确认该 skill 已被同步到 git repo（canonical repo: `lora-sys/skills`）并 push 出去，再保证 `~/.agents/skills/`（= `/data/lora/ai/skills/`）的内容与 repo 一致。任何 CLI 启动时重新读 symlink 目标即可生效。
- **带 handoff 的 skill 同步规则**：当一个 skill 的 SKILL.md 描述里出现 "automatically hand off" / "自动调用" / "after producing" 之类的自动级联触发语时，把该 skill 从 canonical store 同步到 git repo 之前，必须用 `quick_validate.py` 验证 frontmatter，并确认它的下游 skill（如 `html-stable-publish`）也已经在同一个 repo 的 `skills/` 目录里——否则自动链路在其它机器上会断。

## Out of scope

- 写代码、调 bug、改具体 skill 的内容——用各自 skill。
- 装**系统包**（apt / brew / pacman）——用系统包管理器，不在本 skill 范围。
- 解释某个 skill **做什么**——读那个 skill 自己的 `SKILL.md`。
- 跨机器同步 / 容器化部署——本 skill 只管单机。

## 文件

- `references/skill-store-layout.md`: 各 CLI 软链接目标 + `/data/lora/ai/` 真实布局（运行 `readlink` 自查，不要硬编码路径）。
- `references/install-skill.md`: 装一个新 skill 到 canonical store 的完整步骤。
- `references/install-mcp.md`: 全局 MCP（`.mcp.json`）与 Claude 专属 MCP。
- `references/install-model.md`: Ollama / LM Studio / HuggingFace。
- `references/install-tool.md`: 运行时（bun / node / python）+ 包缓存（.cargo / .local/bin）。
- `scripts/install-skill.sh`: 装一个新 skill 到 canonical store 的可重入脚本（带 `--dry-run`）。
