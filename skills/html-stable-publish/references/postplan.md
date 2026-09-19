# Postplan 配置速查

- 默认 API：`https://postplan.dev`
- CLI：`npx postplan`
- 凭据文件：Windows 下通常为 `%USERPROFILE%\.postplan\credentials.json`
- API key 环境变量：`POSTPLAN_API_KEY`
- API 地址环境变量：`POSTPLAN_API_URL`
- 配置凭据：`npx postplan auth set <api-key>`
- 验证凭据：`npx postplan whoami`
- 发布：`npx postplan upload <file.html>`
- 查看账号 drafts：`npx postplan list`

上传接口为 `POST /api/uploads`，CLI 会输出公开 `URL`、`Raw HTML`、draft ID 和版本号。`POSTPLAN_API_KEY` 只用于本机 CLI 请求，不应写入 HTML 或仓库。
