# 统一反向代理网关

该 Compose 项目与食衡 API 分开运行。网关统一监听 80/443，并将请求转发到只监听本机的食衡 API。中国大陆云服务器会拦截未备案域名，因此生产入口使用 Let’s Encrypt 的短期公网 IP 证书，不依赖域名；域名入口仅作为可选方案保留。

1. 将 `.env.example` 复制为 `.env`，设置域名与上游地址。
2. 执行 `docker compose up -d`。
3. 使用 Certbot 5.4 或更高版本签发 `shortlived` 公网 IP 证书，并在 Caddyfile 中加载证书。
4. 启用 `meal-meter-cert-renew.timer`，每天检查两次续期。
5. 访问 `https://服务器公网IP/health` 验证 HTTPS 与转发。

以后增加其他服务时，可在 `Caddyfile` 中增加新的域名块，不需要让业务容器直接暴露 80/443。
