# 食衡

面向手机的饮食营养记录工具。根据身高、体重、性别和训练方案，生成每天、每餐的碳水/蛋白质/脂肪/热量指标；支持食物记录、历史、自定义食物库，以及 AI 文字/图片识餐。

- **一套代码库**覆盖 Web + iOS + Android（Expo / React Native，Web 由 react-native-web 渲染），离线优先，可连接自建服务器跨设备同步。

## 功能

- **个性化目标**：按性别、年龄、身高、体重、训练目标（增肌/减脂）、训练方案（力训日/休息日）计算每日与每餐的三大营养素 + 热量指标
- **食物记录**：内置食物库 + 自定义食物，按餐次（早/午/晚/加餐）记录克数
- **AI 识餐**：输入文字描述或拍照，AI 估算营养并生成食物条目
- **离线优先 + 可选同步**：本地持久化；配对自己的服务器后自动跨设备同步（配对码 + Bearer token，乐观锁 + 409 冲突自动合并）
- **历史与趋势**：每日记录回溯

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Expo SDK / React Native + react-native-web、Expo Router、Zustand、TypeScript |
| 领域逻辑 | `packages/domain`（纯 TS，zod 校验，node:test 单测）—— Web 与原生共用，避免双实现漂移 |
| 后端 | `services/server`（Fastify + PostgreSQL，Drizzle 迁移，独立部署） |
| 测试 | node:test（domain）、jest-expo（前端单测）、Playwright（Web E2E）、Maestro（iOS/Android UI 冒烟） |
| CI | GitHub Actions（Linux 全量门禁 + macOS iOS 构建） |

## 项目结构

```
apps/expo/        # 唯一前端（Web + iOS + Android）
packages/domain/  # 共享领域逻辑（指标计算、餐次方案、同步合并、数据迁移）
packages/db/      # Drizzle 迁移配置
services/server/  # Fastify + PostgreSQL API（设备配对 / 同步 / AI 识餐）
e2e/              # Playwright Web 端到端
.maestro/         # 跨平台 UI 冒烟流（iOS/Android 模拟器共用）
.github/workflows/# CI
```

## 快速开始

```bash
npm install
npm run dev        # Expo Metro（Web: http://localhost:8081；真机用 Expo Go 扫码）
npm run build      # expo export --platform web（静态产物在 apps/expo/dist/）
npm run start      # serve 托管静态 Web 产物
```

## 测试与 CI

```bash
npm test                # packages/domain 单测 + 覆盖率
npm run test:expo:unit  # 前端 jest 单测
npm run test:expo       # 前端类型检查
npm run test:e2e        # Playwright Web 端到端（10 个用例）
npm run test:server     # 服务端测试（内存 repository，无需 Postgres）
npm run lint
```

CI 由 3 个 workflow 组成（全部免费 runner）：

| workflow | 触发 | 内容 |
|----------|------|------|
| `ci` | push/PR 自动 | 4 个并行 job：domain 单测、前端单测+类型检查、服务端测试、Playwright Web E2E |
| `build-android` | 手动 | 构建 APK（arm64 / x86_64 / debug）+ Android 模拟器 Maestro 冒烟 |
| `ios-e2e` | 手动 | iOS 模拟器 Release 构建 + Maestro 冒烟（macOS runner） |

iOS/Android 冒烟共用 `.maestro/smoke.yaml`（首页渲染 → 加餐 → 训练日切换 → 历史），与 Web E2E 覆盖同一批关键流。

## 部署

- 服务端上线步骤见 `services/server/README.md`
- iOS 本地构建见 `docs/IOS_BUILD.md`
- 真机验收清单见 `docs/device-acceptance-checklist.md`

## License

[MIT](./LICENSE)
