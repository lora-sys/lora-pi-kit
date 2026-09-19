# 装 MCP

两类 MCP 配置：**全局（所有 Claude Code 读）** vs **Claude 专属**。

## 全局 MCP

编辑 `/data/lora/.mcp.json`（Claude Code 自动读取）：

```json
{
  "mcpServers": {
    "name": {
      "type": "stdio",
      "command": "...",
      "args": []
    }
  }
}
```

- `stdio` 类型：本地进程
- `http` / `sse` 类型：远程 endpoint，需要 `url` 字段
- **重启 Claude Code 生效**（不是重开终端）

## Claude 专属 MCP

`~/.claude.json` 里的 `mcpServers` 字段。结构同上。

差异：全局 `~/.mcp.json` 跨项目生效；`~/.claude.json` 是用户级。

## 验证

```bash
# Claude Code 视角
claude mcp list

# 直接看配置
cat /data/lora/.mcp.json | python3 -m json.tool
```

## 不在范围

- 装 MCP server 的二进制（用 `install-tool.md` 的方式）
- 远程 MCP 的鉴权 / OAuth 流程
