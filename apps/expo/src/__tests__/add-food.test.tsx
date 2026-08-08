/// <reference types="jest" />
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AddFoodScreen from "../app/add-food";
import { useMealStore } from "../store/mealStore";

// ---- 原生存储/路由打桩 ----
// store 的持久化中间件在 hydrate 前不写盘，但 persist.ts 顶层 import 了这些原生模块，
// 显式 mock 避免加载/调用时抛 "NativeModule is null"。
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

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ mealID: "breakfast" }),
}));

// 模块级单例 store：每个用例前恢复初始状态（actions 一并恢复，replace=true）。
const initialMealState = useMealStore.getState();
function resetStore() {
  useMealStore.setState(initialMealState, true);
}

describe("AddFoodScreen", () => {
  beforeEach(() => {
    resetStore();
    mockPush.mockClear();
    mockBack.mockClear();
  });

  test("渲染不触发无限重渲染（React #185 回归守卫）", async () => {
    // 若 mealsFor/dailyTarget/availableFoods 被直接当作 Zustand selector 用，
    // getSnapshot 每次返回新引用 → useSyncExternalStore 判定快照变化 → 无限重渲染，
    // render 会抛 "Maximum update depth exceeded"。整 store 订阅再派生的修复下不应抛错。
    await expect(render(<AddFoodScreen />)).resolves.toBeDefined();
    // 关键派生数据渲染出来：餐名 + 食物选择区 + 内置食物 chip。
    expect(screen.getByText("早饭")).toBeTruthy();
    expect(screen.getByText("选择食物")).toBeTruthy();
    expect(screen.getByText("熟米饭")).toBeTruthy();
    expect(screen.getByText("熟鸡胸肉")).toBeTruthy();
  });

  test("加餐交互：选中食物后添加 → store 出现新条目并返回", async () => {
    await render(<AddFoodScreen />);

    // 选中"熟米饭"chip，保持默认克数，点"添加"。
    await fireEvent.press(screen.getByText("熟米饭"));
    await fireEvent.press(screen.getByText("添加"));

    // 交互后 store 派生数据（整 store 订阅）应带着新条目稳定重渲染，不抛错。
    const entries = useMealStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].foodName).toBe("熟米饭");
    expect(entries[0].mealID).toBe("breakfast");
    expect(entries[0].grams).toBeGreaterThan(0);

    // 加餐完成后回退上一屏。
    expect(mockBack).toHaveBeenCalled();
  });

  test("store 动作触发重渲染不进入重渲染循环", async () => {
    await render(<AddFoodScreen />);
    // 在已挂载组件外派发 store 动作，验证整 store 订阅的派生模式重渲染稳定。
    await act(async () => {
      useMealStore.getState().addFood(
        { id: "rice", name: "熟米饭", category: "主食", per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } },
        100,
        "breakfast",
      );
    });
    const entries = useMealStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].foodName).toBe("熟米饭");
  });
});
