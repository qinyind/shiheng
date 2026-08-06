# 食衡

面向手机的饮食营养记录工具：根据身高、体重、性别和训练方案生成每天、每餐的碳水/蛋白质/脂肪/热量指标，支持食物记录、历史记录、自定义食物及 AI 文字/图片识餐。

## 项目结构

- `ios/App`：纯 SwiftUI 原生 iOS 客户端，离线优先，历史保存在本机；可选连接自建服务器。
- `server`：Node.js + Fastify + PostgreSQL API，Docker Compose 部署，提供设备配对、跨设备同步和 AI 识餐。
- `app`：现有 Web 版本，可独立构建和使用；不再作为 iOS 客户端界面。

## 验证命令

```bash
npm test
npm --prefix server test
docker build -t meal-meter-server:test server
```

服务器上线步骤见 `server/README.md`，原生端构建见 `IOS_BUILD.md`。
