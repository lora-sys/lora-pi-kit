---
name: html-stable-publish
description: 当最终交付物是单页 HTML 或静态 HTML/CSS/JS 页面时，使用 Postplan 发布可访问、可更新的 HTML draft。适用于“部署 HTML”“发布页面”“给我一个可打开的链接”；默认使用本机 Postplan 凭据，不把 key 写入产物。
---

# Postplan HTML 发布

## 适用范围

处理单个 HTML 文件，或根目录包含 `index.html` 的静态页面。目标平台固定为 `https://postplan.dev`，使用官方 `postplan` CLI 发布。Postplan 返回公开 draft URL 和 Raw HTML URL；同一个本地文件再次上传时默认更新对应 draft。

## 凭据与安全

- CLI 凭据由 `npx postplan auth set <api-key>` 保存到用户目录的 `.postplan/credentials.json`，权限应保持为仅用户可读写。
- 也可临时使用环境变量 `POSTPLAN_API_KEY`；API 地址可用 `POSTPLAN_API_URL` 覆盖，默认是 `https://postplan.dev`。
- 绝不把 API key 写入 HTML、项目文件、日志、对话回复或版本库；不要上传 `.env`、密码、真实用户数据、内网 URL 或私密资源。
- 实际上传属于外部发布。执行 `npx postplan upload` 前，必须向用户确认将公开发布；仅做本地检查或 dry-run 不需要确认。

## 发布流程

1. 确认产物是单个 HTML，或目录中存在 `index.html`。对目录发布时先准备一个构建输出目录，不上传源码项目、依赖目录或敏感文件。
2. 运行 `scripts/preflight_static_site.py <文件或目录>`，修复入口、绝对本地路径和敏感文件问题。该检查是发布前辅助检查，最终 HTML 规则仍以 Postplan CLI 返回的验证结果为准。
3. 在得到用户明确确认后执行：

   ```sh
   npx postplan upload <html-file>
   ```

   可选参数：`--description "简短说明"`、`--new`（强制创建新 draft）、`--api-url <url>`。
4. 记录 CLI 输出的 `URL`、`Raw HTML`、draft ID 和版本号。打开 URL 验证标题和页面内容；如交给另一个 agent 读取，优先提供 `Raw HTML` URL。
5. 交付时说明平台为 Postplan、这是公开 draft、是否使用了已有 draft 的更新，以及对应的版本号。不要称为永久生产托管；长期域名、生产发布或细粒度访问控制需要另行选择正式托管方案。

## 常用命令

```sh
# 配置或更新本机凭据（不要把真实 key 写进脚本）
npx postplan auth set <api-key>

# 检查凭据是否有效；不会打印 key 本身
npx postplan whoami

# 发布或更新页面
npx postplan upload <file.html> --description "页面说明"

# 查看当前账号的 drafts
npx postplan list
```

## HTML 限制

Postplan 会在上传时拒绝外部脚本、module script、事件处理属性、`javascript:` URL、表单、iframe/embed/object/applet 以及 meta refresh。允许语义 HTML、内联 CSS、普通 HTTPS 链接、HTTPS/data 图片，以及受平台规则允许的内联经典 JavaScript。页面不应依赖本地文件路径或未公开资源。

## 参考

需要核对 CLI 参数、凭据位置或 API 行为时，读取 `references/postplan.md`；不要再使用旧的匿名 Drop/Netlify 流程。
