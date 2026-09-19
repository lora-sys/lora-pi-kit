# 装运行时和工具

## 语言运行时

```bash
# bun
mise use -g bun
# 或 npm i -g bun 后验证
which bun && bun --version

# node（用 mise / nvm / fnm 任一）
mise use -g node@20

# python（用 mise / pyenv / uv 任一）
mise use -g python@3.12
```

运行时本身装在 `/home/lora/.local/share/mise/installs/` 或对应工具的标准路径。**不要**把运行时写到 `/data/lora/ai/runtime/`——这是只读 Btrfs；要写运行时必须 remount 或 overlay。

## 包缓存

| 缓存 | 默认路径 | 说明 |
|---|---|---|
| pnpm | `~/.local/share/pnpm/store` | 默认即可 |
| npm | `~/.npm` | 默认即可 |
| cargo | `~/.cargo` | 默认即可 |
| pip | `~/.cache/pip` | 默认即可 |
| uv | `~/.cache/uv` | 默认即可 |

## 用户级工具（`~/.local/bin/`）

```bash
# Rust 工具
cargo install <crate>
# Node 工具
npm i -g <pkg>
# pipx 工具
pipx install <pkg>
# mise 装的工具
mise use -g <tool>
```

`~/.local/bin/` 一般在 `$PATH` 里。`which <tool>` 验证。

## 验证

```bash
which bun node python cargo
ls ~/.local/bin/ | head
```

## 不在范围

- 系统包（apt / brew / pacman）——用系统包管理器
- Docker 镜像
- 全局 GUI 应用
