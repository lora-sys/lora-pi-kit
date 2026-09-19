# Skill store 与目录布局

> **运行时自查**：任何路径都可能因为新增 / 删除 symlink 而变。装之前先 `readlink` 或 `ls -la` 确认真实位置，不要照搬本页。

## Canonical skill store

所有 coding CLI 的 skills 都指向同一个真实目录：

```bash
readlink -f /data/lora/ai/skills    # 真实数据在这里
ls -la /home/lora/.codex/skills     # symlink 形式之一
```

修改时**只改 `/data/lora/ai/skills/`**，所有 CLI 自动同步。

## 各 CLI 的 symlink 目标

```bash
for p in /home/lora/.codex/skills \
         /home/lora/.claude/skills \
         /home/lora/.gemini/skills \
         /home/lora/.qwen/skills \
         /home/lora/.config/opencode/skills \
         /home/lora/.agents/skills ; do
  printf "%-40s -> %s\n" "$p" "$(readlink "$p" 2>/dev/null || echo MISSING)"
done
# /home/lora/.pi/agent/skills/ 是目录内逐个软链接，与上面不同
ls -la /home/lora/.pi/agent/skills/ | head
```

## `/data/lora/ai/` 真实布局

> **运行时自查**：`tree -L 2 /data/lora/ai/` 或 `ls /data/lora/ai/` 看当前真实结构。下列是常见子目录，新目录随时可加。

| 子目录 | 用途 |
|---|---|
| `skills/` | 唯一 skill 仓库 |
| `models/ollama/` | Ollama 模型 |
| `models/lmstudio/` | LM Studio 模型 |
| `models/huggingface/` | HuggingFace 模型 |
| `models/cache/` | 模型下载缓存 |
| `mcp/configs/` | MCP server 配置 |
| `mcp/servers/` | MCP server 文件 |
| `agents/` | Agent 配置 |
| `runtime/{bun,node,python}/` | 语言运行时（可写 overlay）|
| `storage/` | 其它存储（Docker volumes 等）|
| `backups/` | 备份 |
| `prompts/` | 提示词模板 |

## `/home/lora/` 可写子目录

`/data/lora/` 是只读 Btrfs 快照；要写只能写 `/home/lora/` 下：

```text
.codex/         Codex 配置
.gemini/        Gemini 配置
.qwen/          Qwen 配置
.pi/            Pi 配置（agent/skills/ + settings.json + sessions/）
.config/        opencode / astro / zed 等
.agents/        系统 skill 仓库入口
.cache/         本地缓存（较大，可写）
.cargo/         Rust 包
.bun/           Bun 运行时
.npm/           NPM 缓存
.local/bin/     用户级 CLI 工具
.kimi-webbridge/  Kimi WebBridge
```

## pi 兼容的 sentinel

`/home/lora/.pi/agent/skills/` 的形式是"目录里逐个 symlink"，不是 symlink 整体指向 `/data/lora/ai/skills`。所以**新装 skill 时**会自动出现在 `.pi/agent/skills/`，但**已装 skill 的 `skills/` 子目录必须存在**——pi 加载时把它当必需的 entry，缺失会报 "Cannot find module"。

修法：`mkdir /data/lora/ai/skills/<skill>/skills`（空目录即可）。
