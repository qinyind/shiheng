# CLAUDE.md

健身/饮食管理应用。web 应用在根目录（Next.js + vinext + Cloudflare + Drizzle/SQLite），Capacitor iOS 壳在 `apps/native/`，后端服务在 `services/server/`（独立部署），Cloudflare Worker 在 `services/worker/`，共享数据层与插件在 `packages/`。git 仓库在根目录；`data/` 存个人数据套表与发行产物（gitignored）。

## 常用命令（在根目录执行）

- **dev**:   `npm run dev`（vinext dev，Cloudflare 本地环境）
- **build**: `npm run build`
- **test**:  `npm test`（build + node --test 渲染测试）；服务端测试用 `npm run test:server`
- **lint**:  `npm run lint`（eslint）
- **db**:    `npm run db:generate`（drizzle-kit 生成迁移，配置在 `packages/db/`）
- **ios**:   `npm run ios:open`（打开 `apps/native/ios` 的 Xcode 工程）

## 备注

- 个人数据 Excel 与发行产物在 `data/`（`*.xlsx` 及整个 `data/` 被 git 忽略）
- `apps/native/` 是 Capacitor 原生壳（含 `ios/`、`web/` 原生 web 入口）
- `.claude/`（ECC 配置）被 git 忽略，仅本机生效
