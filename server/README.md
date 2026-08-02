# 餐标服务器

面向原生 iOS 客户端的个人自托管 API，提供设备配对、历史记录同步和 AI 文字/图片识餐。OpenAI API 密钥仅保存在服务器环境变量中，不会下发到手机。

## 本地或服务器启动

1. 复制 `.env.example` 为 `.env`。
2. 为 `POSTGRES_PASSWORD`、`PAIRING_CODE` 设置不同的长随机值；如需调整本机代理目标端口，可设置 `API_HOST_PORT`。
3. 如需 AI 识餐，填写 `OPENAI_API_KEY`；模型可通过 `OPENAI_MODEL` 显式调整。
4. 执行 `docker compose up -d --build`。API 默认只监听宿主机的 `127.0.0.1:18080`，不会占用 80/443，也不会直接暴露数据库。
5. 在服务器现有反向代理中，将专用域名（推荐）或 URL 路径转发到 `http://127.0.0.1:18080`，HTTPS 由该代理统一处理。
6. 检查 `curl http://127.0.0.1:18080/health`，再检查反向代理后的 HTTPS 地址。

首次启动会自动建立 PostgreSQL 表。手机在“我的方案 → 服务器同步”中填写反向代理后的 HTTPS 地址和配对码即可。

如果使用 Nginx 专用域名，可将站点的 `location /` 代理到 `http://127.0.0.1:18080`。若使用 `/meal-meter/` 之类的路径前缀，代理时需去掉该前缀。

## API

- `POST /v1/auth/pair`：用配对码换取设备令牌。
- `GET /v1/sync`：读取当前状态和版本。
- `PUT /v1/sync`：按 `baseVersion` 写入状态；冲突返回 409 和服务器版本。
- `POST /v1/ai/analyze-food`：提交文字及可选 Base64 图片，返回整份食物营养估算。

这是个人单用户模式。设备令牌在数据库中只保存 SHA-256 摘要，服务器日志不记录配对码和令牌。
