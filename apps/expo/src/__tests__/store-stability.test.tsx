/// <reference types="jest" />
import { act, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TodayScreen from "../app/(tabs)/index";
import { useMealStore } from "../store/mealStore";

// 首页自 plan C 起调用 useSafeAreaInsets() → 测试需提供 SafeAreaProvider。
// initialMetrics 固定 insets，使布局在 jest 环境下确定。
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
function renderTodayScreen() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TodayScreen />
    </SafeAreaProvider>,
  );
}

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
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  // 首页 plan B 起调用 useFocusEffect 切换状态栏样式；测试里直接执行回调即可。
  useFocusEffect: (effect: () => void) => effect(),
}));

const initialMealState = useMealStore.getState();
function resetStore() {
  useMealStore.setState(initialMealState, true);
}

describe("TodayScreen store 访问稳定性（#185 派生模式）", () => {
  beforeEach(() => {
    resetStore();
    mockPush.mockClear();
  });

  test("首页整 store 订阅 + 派生渲染不触发无限重渲染", async () => {
    // 与 add-food 相同模式：const store = useMealStore(); 再 mealsFor/dailyTarget/calcFor/planLabel 派生。
    // 若这些函数被当作 selector 直接传 useMealStore(...)，getSnapshot 不稳定 → 无限重渲染抛错。
    await expect(renderTodayScreen()).resolves.toBeDefined();
    // 关键派生数据渲染出来。
    expect(screen.getByText("食衡")).toBeTruthy();
    expect(screen.getByText("早饭")).toBeTruthy();
    expect(screen.getByText("晚饭 · 练后")).toBeTruthy();
    // PlanGuidance 标题：默认方案为「N 减脂 · …」
    expect(screen.getAllByText(/减脂/).length).toBeGreaterThan(0);
  });

  test("store 动作（加餐/清空/改日/改日型）驱动重渲染不进入重渲染循环", async () => {
    await renderTodayScreen();

    // 加餐 → 对应餐卡的条目出现。
    await act(async () => {
      useMealStore.getState().addFood(
        { id: "rice", name: "熟米饭", category: "主食", per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } },
        100,
        "lunch",
      );
    });
    expect(screen.getByText("熟米饭")).toBeTruthy();

    // 切到休息日 → SummaryCard 标题随 dayType 派生更新。
    await act(async () => {
      useMealStore.getState().setDayType("rest");
    });
    expect(screen.getByText("休息日 · 减脂配额")).toBeTruthy();

    // 改日期 → DayToolbar 日期标签更新。
    await act(async () => {
      useMealStore.getState().setDate("2026-08-06");
    });
    expect(screen.getByText(/8月6日/)).toBeTruthy();

    // 清空当天 → 刚才的加餐条目消失。
    await act(async () => {
      useMealStore.getState().clearDay();
    });
    expect(screen.queryByText("熟米饭")).toBeNull();
  });

  test("store 动作同步结果正确（加餐/删除/清空）", () => {
    const store = useMealStore.getState();
    store.addFood(
      { id: "chicken", name: "熟鸡胸肉", category: "蛋白质", per100: { carbs: 0, protein: 25, fat: 4, kcal: 136 } },
      120,
      "lunch",
    );
    expect(useMealStore.getState().entries).toHaveLength(1);
    const entry = useMealStore.getState().entries[0];
    expect(entry.foodName).toBe("熟鸡胸肉");
    expect(entry.grams).toBe(120);
    expect(entry.mealID).toBe("lunch");

    useMealStore.getState().removeEntry(entry.id);
    expect(useMealStore.getState().entries).toHaveLength(0);
  });
});
