import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cn.mealmeter.app",
  appName: "餐标",
  webDir: "apps/native/capacitor-shell",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true
  }
};

export default config;
