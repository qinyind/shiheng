# 餐标服务器

面向原生 iOS 客户端的个人自托管 API，提供设备配对、历史记录同步和 AI 文字/图片识餐。AI 接口地址与密钥仅保存在服务器环境变量中，不会下发到手机；可连接 OpenAI 或兼容 Responses API 的本地代理。

## 本地或服务器启动

1. 复制 `.env.example` 为 `.env`。
2. 为 `POSTGRES_PASSWORD`、`PAIRING_CODE` 设置不同的长随机值；如需调整本机代理目标端口，可设置 `API_HOST_PORT`。
3. AI 识餐默认通过 Docker 内网连接 CPA（`http://cli-proxy-api:8317/v1`），使用 `gpt-5.6-luna`。填写专用于餐标的 `AI_API_KEY`，不要复用 CPA 管理密钥；CPA 网络名可通过 `CPA_NETWORK_NAME` 调整。CPA 的 API、管理面板和 OAuth 回调端口应只绑定宿主机回环地址，不要暴露到公网。
4. 执行 `docker compose up -d --build`。API 默认只监听宿主机的 `127.0.0.1:18080`，不会占用 80/443，也不会直接暴露数据库。
5. 在服务器现有反向代理中，将专用域名（推荐）或 URL 路径转发到 `http://127.0.0.1:18080`，HTTPS 由该代理统一处理。若需要按真实客户端 IP 限流，将 `TRUST_PROXY` 设为反向代理连接 API 时使用的精确 IP，不要直接信任任意代理。
6. 检查 `curl http://127.0.0.1:18080/health`，再检查反向代理后的 HTTPS 地址。

默认防滥用策略：所有 API 每 IP 每分钟最多 120 次、配对 15 分钟最多 10 次、同步写入每分钟最多 60 次、AI 每分钟最多 20 次；每台设备每天最多调用 AI 100 次，同时最多处理 2 个 AI 请求。后两项可通过 `AI_DAILY_LIMIT`、`AI_MAX_CONCURRENT` 调整。缓存命中的识餐结果不消耗每日额度。

首次启动会自动建立 PostgreSQL 表。手机在“我的方案 → 服务器同步”中填写反向代理后的 HTTPS 地址和配对码即可。

如果使用 Nginx 专用域名，可将站点的 `location /` 代理到 `http://127.0.0.1:18080`。若使用 `/meal-meter/` 之类的路径前缀，代理时需去掉该前缀。

## API

- `POST /v1/auth/pair`：用配对码换取设备令牌。
- `GET /v1/sync`：读取当前状态和版本。
- `PUT /v1/sync`：按 `baseVersion` 写入状态；冲突返回 409 和服务器版本。
- `POST /v1/ai/analyze-food`：提交文字及可选 Base64 图片，返回整份食物营养估算。

这是个人单用户模式。设备令牌在数据库中只保存 SHA-256 摘要，服务器日志不记录配对码和令牌。
