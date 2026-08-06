# CLAUDE.md

健身/饮食管理应用（Next.js + vinext + Cloudflare + Capacitor iOS + Drizzle/SQLite）。git 仓库在根目录；根目录另有 Excel 数据套表（不入库）与 `releases/` 发行产物。

## 常用命令（在根目录执行）

- **dev**:   `npm run dev`（vinext dev，Cloudflare 本地环境）
- **build**: `npm run build`
- **test**:  `npm test`（build + node --test 渲染测试）；服务端测试用 `npm run test:server`
- **lint**:  `npm run lint`（eslint）
- **db**:    `npm run db:generate`（drizzle-kit 生成迁移）
- **ios**:   `npm run ios:open`（打开 Xcode 工程）

## 备注

- 个人数据 Excel（根目录 `*.xlsx`）被 git 忽略，不入库
- `ios/` 是 Capacitor 原生壳；web 端由 vinext 构建
- `.claude/`（ECC 配置）被 git 忽略，仅本机生效
