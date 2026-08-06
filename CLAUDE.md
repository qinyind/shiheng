# CLAUDE.md

健身/饮食管理应用。前端统一在 `apps/expo/`（Expo/React Native，一套代码库覆盖 Web + iOS + Android，react-native-web 渲染 Web），共享领域逻辑在 `packages/domain/`，后端服务在 `services/server/`（独立部署，Fastify + Postgres），数据库迁移配置在 `packages/db/`（drizzle）。git 仓库在根目录；`data/` 存个人数据套表与发行产物（gitignored）。

## 常用命令（在根目录执行）

- **dev**:   `npm run dev`（Expo Metro，Web 打开 http://localhost:8081；真机用 Expo Go 扫码）
- **build**: `npm run build`（`expo export --platform web`，静态产物在 `apps/expo/dist/`）
- **start**: `npm run start`（`serve` 托管静态 Web 产物）
- **test**:  `npm test`（`packages/domain` 单测 + 覆盖率）；类型检查 `npm run test:expo`；服务端测试 `npm run test:server`
- **lint**:  `npm run lint`（eslint）
- **db**:    `npm run db:generate`（drizzle-kit 生成迁移，配置在 `packages/db/`）
- **ios**:   `npm run ios:open`（打开 `apps/native/ios` 的 Xcode 工程，Phase 4 前暂存）

## 备注

- 个人数据 Excel 与发行产物在 `data/`（`*.xlsx` 及整个 `data/` 被 git 忽略）
- `apps/expo/` 是唯一前端实现；`apps/native/` 为旧 Capacitor/SwiftUI 壳（待删除）
- Web 与 iOS 领域逻辑共用 `packages/domain`，避免双实现漂移
- `.claude/`（ECC 配置）被 git 忽略，仅本机生效
