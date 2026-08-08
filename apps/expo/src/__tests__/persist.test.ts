/// <reference types="jest" />
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  IOS_TIP_KEY,
  SERVER_URL_KEY,
  STATE_KEY,
  TOKEN_KEY,
  WEB_STATE_KEY,
  jsonStore,
  tokenStore,
} from "../api/persist";

// ---- 原生存储打桩 ----
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// 测试环境是 jest-environment-node（无 jsdom），Web 分支需要自建 localStorage。
function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const storage = {
    getItem: jest.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(() => {
      store.clear();
    }),
  };
  (globalThis as any).localStorage = storage;
  return store;
}

beforeEach(() => {
  // 默认实现重置（clearAllMocks 不清实现，这里显式设默认值）。
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  // 清理 Web 分支遗留的 localStorage，避免跨用例污染。
  (globalThis as any).localStorage?.clear?.();
});

describe("存储键", () => {
  test("键名与 SwiftUI 版本一一对应", () => {
    expect(TOKEN_KEY).toBe("meal-meter-device-token");
    expect(SERVER_URL_KEY).toBe("meal-meter-server-url");
    expect(STATE_KEY).toBe("meal-meter-native-state-v1");
    expect(WEB_STATE_KEY).toBe("meal-meter-state-v1");
    expect(IOS_TIP_KEY).toBe("meal-meter-ios-tip");
  });
});

describe("原生分支（ios）", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "ios");
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("token-1");
  });

  test("tokenStore 走 SecureStore，键名正确", async () => {
    await expect(tokenStore.read()).resolves.toBe("token-1");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(TOKEN_KEY);

    await tokenStore.save("token-2");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, "token-2");

    await tokenStore.delete();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
  });

  test("jsonStore 走 AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("saved-payload");
    await expect(jsonStore.read(STATE_KEY)).resolves.toBe("saved-payload");
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(STATE_KEY);

    await jsonStore.write(SERVER_URL_KEY, "https://example.com");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SERVER_URL_KEY, "https://example.com");

    await jsonStore.remove(WEB_STATE_KEY);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(WEB_STATE_KEY);
  });
});

describe("Web 分支（localStorage）", () => {
  beforeEach(() => {
    installLocalStorage();
    jest.replaceProperty(Platform, "OS", "web");
    jest.clearAllMocks();
  });

  test("tokenStore 读/写/删走 localStorage，键名正确", async () => {
    await expect(tokenStore.read()).resolves.toBeNull();
    expect((globalThis as any).localStorage.getItem).toHaveBeenCalledWith(TOKEN_KEY);

    await tokenStore.save("token-1");
    expect((globalThis as any).localStorage.setItem).toHaveBeenCalledWith(TOKEN_KEY, "token-1");
    await expect(tokenStore.read()).resolves.toBe("token-1");

    await tokenStore.delete();
    expect((globalThis as any).localStorage.removeItem).toHaveBeenCalledWith(TOKEN_KEY);
    await expect(tokenStore.read()).resolves.toBeNull();
  });

  test("jsonStore 读/写/删走 localStorage", async () => {
    await jsonStore.write(STATE_KEY, "payload");
    expect((globalThis as any).localStorage.setItem).toHaveBeenCalledWith(STATE_KEY, "payload");
    await expect(jsonStore.read(STATE_KEY)).resolves.toBe("payload");

    await jsonStore.remove(SERVER_URL_KEY);
    expect((globalThis as any).localStorage.removeItem).toHaveBeenCalledWith(SERVER_URL_KEY);
  });

  test("Web 分支不触碰原生存储", async () => {
    await tokenStore.save("token-1");
    await jsonStore.write(STATE_KEY, "x");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe("Web 分支（localStorage 不可用）", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "web");
    jest.clearAllMocks();
    delete (globalThis as any).localStorage;
  });

  test("read 返回 null，save/delete 静默 noop", async () => {
    await expect(tokenStore.read()).resolves.toBeNull();
    await tokenStore.save("token-1");
    await tokenStore.delete();
    await expect(jsonStore.read(STATE_KEY)).resolves.toBeNull();
    await jsonStore.write(STATE_KEY, "x");
    await jsonStore.remove(STATE_KEY);
  });
});
