import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// 存储键与 SwiftUI 版本一一对应：token 存 Keychain（SecureStore），
// serverURL 与 SavedState 存 UserDefaults/AsyncStorage；Web 一律用 localStorage。
export const TOKEN_KEY = "meal-meter-device-token";
export const SERVER_URL_KEY = "meal-meter-server-url";
export const STATE_KEY = "meal-meter-native-state-v1";
export const WEB_STATE_KEY = "meal-meter-state-v1";
export const IOS_TIP_KEY = "meal-meter-ios-tip";

function webStorageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

// token：原生走 SecureStore（Keychain，AfterFirstUnlockThisDeviceOnly 语义由 expo-secure-store 默认提供），Web 走 localStorage。
export const tokenStore = {
  async read(): Promise<string | null> {
    if (Platform.OS === "web") return webStorageAvailable() ? localStorage.getItem(TOKEN_KEY) : null;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async save(token: string): Promise<void> {
    if (Platform.OS === "web") {
      if (webStorageAvailable()) localStorage.setItem(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async delete(): Promise<void> {
    if (Platform.OS === "web") {
      if (webStorageAvailable()) localStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

// 普通字符串/JSON 存储：原生 AsyncStorage，Web 用 localStorage。
export const jsonStore = {
  async read(key: string): Promise<string | null> {
    if (Platform.OS === "web") return webStorageAvailable() ? localStorage.getItem(key) : null;
    return AsyncStorage.getItem(key);
  },
  async write(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (webStorageAvailable()) localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (webStorageAvailable()) localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};
