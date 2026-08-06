# 食衡

面向手机的饮食营养记录工具：根据身高、体重、性别和训练方案生成每天、每餐的碳水/蛋白质/脂肪/热量指标，支持食物记录、历史记录、自定义食物及 AI 文字/图片识餐。

## 项目结构

- `apps/expo`：Expo / React Native 前端，一套代码库覆盖 Web + iOS + Android（react-native-web 渲染 Web），离线优先，可选连接自建服务器同步。
- `packages/domain`：共享领域逻辑（指标计算、餐次方案、同步合并、迁移），Web 与原生共用。
- `services/server`：Node.js + Fastify + PostgreSQL API，提供设备配对、跨设备同步和 AI 识餐。
- `packages/db`：Drizzle 迁移配置。

## 验证命令（在仓库根目录）

```bash
npm run dev        # Expo Metro（Web: http://localhost:8081）
npm run build      # expo export --platform web
npm test           # packages/domain 单测 + 覆盖率
npm run test:expo  # Expo 类型检查
npm run test:server
npm run lint
```

服务器上线步骤见 `services/server/README.md`，iOS 构建说明见 `docs/IOS_BUILD.md`。
