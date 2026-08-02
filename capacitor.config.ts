import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cn.mealmeter.app",
  appName: "餐标",
  webDir: "capacitor-shell",
  server: {
    url: "https://meal-meter-cn.qq843341432.chatgpt.site",
    cleartext: false,
    allowNavigation: [
      "meal-meter-cn.qq843341432.chatgpt.site",
      "chatgpt.com",
      "*.chatgpt.com",
      "auth.openai.com"
    ]
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true
  }
};

export default config;
