# 餐标 iOS 构建

项目已包含 Capacitor iOS 工程，应用标识为 `cn.mealmeter.app`，最低支持 iOS 15。

## 在 Mac 上运行

1. 安装 Node.js 22、Xcode 和 Xcode Command Line Tools。
2. 在项目目录执行 `npm install`。
3. 执行 `npm run ios:sync`，把最新配置同步到 Xcode 工程。
4. 执行 `npm run ios:open`，或直接打开 `ios/App/App.xcodeproj`。
5. 在 Xcode 的 Signing & Capabilities 中选择开发团队；如果 Bundle ID 已被占用，将 `cn.mealmeter.app` 改成自己账号下的唯一标识。
6. 连接 iPhone 后选择设备并运行。TestFlight / App Store 发布使用 Xcode 的 Archive 流程。

## 应用结构

- iOS 工程负责原生容器、应用图标、启动页、相机和相册权限。
- 页面加载正式站点 `https://meal-meter-cn.qq843341432.chatgpt.site`。
- AI 密钥、营养分析和云端同步均留在服务器端，不进入 iOS 安装包。
- 正式站点当前需要 ChatGPT 登录；首次打开 App 时会在应用内完成登录。

## 发布前检查

- 在真实 iPhone 上验证 ChatGPT 登录回跳、拍照、相册选择和断网提示。
- 配置服务器端 `OPENAI_API_KEY` 后再验证 AI 识餐。
- 在 App Store Connect 中补充隐私政策、营养估算免责声明、截图和应用描述。
