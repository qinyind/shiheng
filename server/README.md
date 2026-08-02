# 餐标服务器

面向原生 iOS 客户端的个人自托管 API，提供设备配对、历史记录同步和 AI 文字/图片识餐。OpenAI API 密钥仅保存在服务器环境变量中，不会下发到手机。

## 本地或服务器启动

1. 复制 `.env.example` 为 `.env`。
2. 为 `POSTGRES_PASSWORD`、`PAIRING_CODE` 设置不同的长随机值，填写域名 `APP_DOMAIN`。
3. 如需 AI 识餐，填写 `OPENAI_API_KEY`；模型可通过 `OPENAI_MODEL` 显式调整。
4. 将域名 A/AAAA 记录指向服务器，开放 TCP 80/443 和 UDP 443。
5. 执行 `docker compose up -d --build`。
6. 检查 `https://你的域名/health`。

首次启动会自动建立 PostgreSQL 表。Caddy 自动申请并续期 HTTPS 证书。手机在“我的方案 → 服务器同步”中填写 HTTPS 地址和配对码即可。

## API

- `POST /v1/auth/pair`：用配对码换取设备令牌。
- `GET /v1/sync`：读取当前状态和版本。
- `PUT /v1/sync`：按 `baseVersion` 写入状态；冲突返回 409 和服务器版本。
- `POST /v1/ai/analyze-food`：提交文字及可选 Base64 图片，返回整份食物营养估算。

这是个人单用户模式。设备令牌在数据库中只保存 SHA-256 摘要，服务器日志不记录配对码和令牌。
