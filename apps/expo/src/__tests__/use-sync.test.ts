/// <reference types="jest" />
import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useSync } from "../hooks/useSync";
import { useMealStore } from "../store/mealStore";

// ---- 原生存储打桩（persist.ts 顶层 import）----
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

// RN jest preset 已把 AppState 替换成 mock（addEventListener 是 jest.fn）。
// 这里只覆写 addEventListener 的实现：捕获 change 回调、返回可断言的 remove。
let appStateHandler: ((state: string) => void) | undefined;
let mockAppStateRemove: jest.Mock;

// 模块级单例 store：每例前恢复初始状态（actions 一并恢复，replace=true）。
const initialMealState = useMealStore.getState();
function resetStore() {
  useMealStore.setState(initialMealState, true);
}

async function triggerAppState(state: string) {
  await act(async () => {
    appStateHandler?.(state);
  });
}

describe("useSync", () => {
  beforeEach(() => {
    resetStore();
    mockAppStateRemove = jest.fn();
    appStateHandler = undefined;
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_type: string, handler: (state: string) => void) => {
        appStateHandler = handler;
        return { remove: mockAppStateRemove };
      },
    );
    (AppState.addEventListener as jest.Mock).mockClear();
  });

  test("未 hydrated → 挂载不 sync，也不注册 AppState 监听", async () => {
    const syncNow = jest.fn().mockResolvedValue(undefined);
    useMealStore.setState({ hydrated: false, serverURL: "https://example.com", syncNow });

    await renderHook(() => useSync());

    expect(syncNow).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  test("hydrated + serverURL → 挂载即 sync 一次", async () => {
    const syncNow = jest.fn().mockResolvedValue(undefined);
    useMealStore.setState({ hydrated: true, serverURL: "https://example.com", syncNow });

    await renderHook(() => useSync());

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(AppState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  test("App 回到 active → 再次 sync", async () => {
    const syncNow = jest.fn().mockResolvedValue(undefined);
    useMealStore.setState({ hydrated: true, serverURL: "https://example.com", syncNow });

    await renderHook(() => useSync());
    expect(syncNow).toHaveBeenCalledTimes(1);

    // 非 active 状态不应触发同步。
    await triggerAppState("background");
    expect(syncNow).toHaveBeenCalledTimes(1);

    // 回到前台 → 再同步一次。
    await triggerAppState("active");
    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  test("hydrated 但无 serverURL → 挂载不 sync（AppState 监听仍注册）", async () => {
    const syncNow = jest.fn().mockResolvedValue(undefined);
    useMealStore.setState({ hydrated: true, serverURL: "", syncNow });

    await renderHook(() => useSync());

    expect(syncNow).not.toHaveBeenCalled();
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  });

  test("卸载 → 移除 AppState 监听", async () => {
    const syncNow = jest.fn().mockResolvedValue(undefined);
    useMealStore.setState({ hydrated: true, serverURL: "https://example.com", syncNow });

    const { unmount } = await renderHook(() => useSync());

    await unmount();
    expect(mockAppStateRemove).toHaveBeenCalled();
  });
});
