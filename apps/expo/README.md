# 食衡 · Expo 客户端（iOS / Android / Web 单一代码库）

Expo（React Native）实现，统一接管 Web + iOS + Android，原生手感、不用 WebView。
共享领域逻辑在 `packages/domain`，后端在 `services/server`（独立部署）。

## 常用命令（在仓库根目录执行）

- `npm run dev:expo` — 启动 Metro（`expo start`），可用 Expo Go 扫码 / 模拟器 / 浏览器打开
- `npm run ios` — 在 iOS 模拟器打开
- `npm run android` — 在 Android 模拟器打开
- `npm run web` — 以 Web 打开（react-native-web）
- `npm run test:expo` — TypeScript 类型检查
- `npx expo export --platform web` — 产出静态 Web 构建（`dist/`）

## 认证与同步

复刻 SwiftUI 客户端契约：服务器 URL + 配对码 + Bearer token（存 SecureStore / Web localStorage）。
Web 端可本地单机使用，也可配对同步。

- `src/api/serverClient.ts` — ServerClient 1:1 复刻（pair / fetch / push / analyze）
- `src/api/persist.ts` — token / 状态持久化（原生 vs Web 分支）
- `src/store/mealStore.ts` — Zustand 状态 + 自动持久化 + 同步编排
- `src/hooks/useSync.ts` — 启动与回前台自动同步

## 目录结构

```
app/(tabs)/     # 今日 / 历史 / 食物 / 我的
app/*.tsx       # 模态页：添加食物 / AI 识餐 / 服务器配对
src/api/        # serverClient + image 处理
src/store/      # Zustand 全局状态
src/components/ # 领域组件
src/theme/      # 设计 token（12 色与 Web 版一致）
src/hooks/      # useSync
```
