# 餐标 iOS 原生版构建

客户端是纯 SwiftUI，应用标识为 `cn.mealmeter.app`，最低支持 iOS 15。最终 target 不包含 WebView、网页资源或 Capacitor 运行时。

## 在 Mac 上运行

1. 用 Xcode 打开 `ios/App/App.xcodeproj`。
2. 在 Signing & Capabilities 中选择个人开发团队；如 Bundle ID 冲突，改成自己的唯一标识。
3. 连接 iPhone、选择设备并运行。
4. 免费 Apple ID 的签名仍有 7 天期限；也可把无签名 IPA 交给 AltServer 安装，由 AltServer 完成设备签名。

## 连接服务器

服务端位于 `server/`，部署方法见 `server/README.md`。上线后在 App 的“我的 → 服务器同步”填写 HTTPS 地址和配对码。配对生成的设备令牌存入 iOS 钥匙串，OpenAI API 密钥不会进入安装包。

## 功能验证

- 原生录餐、每日指标、自定义食物和历史记录可完全离线使用。
- 配对后验证历史同步和冲突合并。
- 配置 `OPENAI_API_KEY` 后验证文字识餐、相册照片识餐、保存为自定义食物。
