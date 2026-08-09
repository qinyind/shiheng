/// <reference types="jest" />
// MealCard 顶层 import 了 mealStore → persist.ts → 原生存储模块，测试环境需打桩。
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

import { fireEvent, render, screen } from "@testing-library/react-native";
import { DEFAULT_PROFILE, REST_MEALS, shiftDate, type Macro, type SavedEntry } from "@diet/domain";
import { CalorieRing } from "../components/CalorieRing";
import { SummaryCard } from "../components/SummaryCard";
import { MealCard } from "../components/MealCard";
import { DayToolbar } from "../components/DayToolbar";
import { PlanGuidance } from "../components/PlanGuidance";

const macro: Macro = { carbs: 100, protein: 60, fat: 40, kcal: 800 };
const consumed: Macro = { carbs: 50, protein: 30, fat: 20, kcal: 520 };
const entry: SavedEntry = {
  id: "e1",
  dateKey: "2026-08-08",
  mealID: "breakfast",
  foodName: "熟鸡胸肉",
  grams: 100,
  per100: { carbs: 0, protein: 25, fat: 4, kcal: 136 },
};

describe("CalorieRing", () => {
  test("渲染当前热量与目标", async () => {
    await render(<CalorieRing kcal={500} target={800} progress={0.5} />);
    expect(screen.getByText("500")).toBeTruthy();
    expect(screen.getByText("/ 800 kcal")).toBeTruthy();
  });

  test("round 数值并容忍 progress > 1（超标不抛错）", async () => {
    await render(<CalorieRing kcal={500.6} target={800} progress={1.5} />);
    expect(screen.getByText("501")).toBeTruthy();
    expect(screen.getByText("/ 800 kcal")).toBeTruthy();
  });
});

describe("SummaryCard", () => {
  test("力训日 + 减脂 → 对应标题与全天目标", async () => {
    await render(<SummaryCard dayType="training" goal="cut" consumed={consumed} target={macro} />);
    expect(screen.getByText("力训日 · 减脂配额")).toBeTruthy();
    expect(screen.getByText("800 kcal 全天目标")).toBeTruthy();
    expect(screen.getByText("520")).toBeTruthy();
    expect(screen.getByText("50 / 100g")).toBeTruthy();
    expect(screen.getByText("30 / 60g")).toBeTruthy();
    expect(screen.getByText("20 / 40g")).toBeTruthy();
  });

  test("休息日 + 增肌 → 标题切换", async () => {
    await render(<SummaryCard dayType="rest" goal="gain" consumed={consumed} target={macro} />);
    expect(screen.getByText("休息日 · 增肌配额")).toBeTruthy();
  });
});

describe("MealCard", () => {
  const target: Macro = { carbs: 40, protein: 20, fat: 10, kcal: 300 };

  test("渲染指南摘要、已记录条目、余量与建议", async () => {
    const onAddFood = jest.fn();
    const onRemove = jest.fn();
    await render(
      <MealCard
        meal={REST_MEALS[0]}
        target={target}
        entries={[entry]}
        goal="cut"
        dayType="training"
        onAddFood={onAddFood}
        onRemove={onRemove}
      />,
    );

    // 餐名 + 指南摘要（guideForMeal 派生）。
    expect(screen.getByText("早饭")).toBeTruthy();
    expect(screen.getByText(/早餐同时建立碳水、蛋白质和基础脂肪来源/)).toBeTruthy();

    // 已记录食物：名称、克数、宏量。
    expect(screen.getByText("熟鸡胸肉")).toBeTruthy();
    expect(screen.getByText("100g")).toBeTruthy();
    expect(screen.getByText("136 kcal · C0 P25 F4")).toBeTruthy();

    // 本餐余量（target − total 派生）与建议文本。
    expect(screen.getByText("本餐余量")).toBeTruthy();
    expect(screen.getByText("C40 · P-5 · F6")).toBeTruthy();
    expect(screen.getByText(/速食燕麦片/)).toBeTruthy();
  });

  test("添加/删除按钮回调正确", async () => {
    const onAddFood = jest.fn();
    const onRemove = jest.fn();
    await render(
      <MealCard
        meal={REST_MEALS[0]}
        target={target}
        entries={[entry]}
        goal="cut"
        dayType="training"
        onAddFood={onAddFood}
        onRemove={onRemove}
      />,
    );

    await fireEvent.press(screen.getByText("+ 添加"));
    expect(onAddFood).toHaveBeenCalledWith("breakfast");

    await fireEvent.press(screen.getByLabelText("删除熟鸡胸肉"));
    expect(onRemove).toHaveBeenCalledWith("e1");
  });
});

describe("DayToolbar", () => {
  test("渲染日期与日型，导航/切日型/清空回调正确", async () => {
    const onDateChange = jest.fn();
    const onDayTypeChange = jest.fn();
    const onClear = jest.fn();
    await render(
      <DayToolbar
        date="2026-08-08"
        dayType="training"
        timingNone={false}
        onDateChange={onDateChange}
        onDayTypeChange={onDayTypeChange}
        onClear={onClear}
      />,
    );

    expect(screen.getByText(/8月8日/)).toBeTruthy();
    // 有训练安排时日型仅由切换段表达（不再在日期下重复），选中段 + 未选中段各一。
    expect(screen.getAllByText("力训日")).toHaveLength(1);
    expect(screen.getByText("休息日")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("前一天"));
    expect(onDateChange).toHaveBeenCalledWith(shiftDate("2026-08-08", -1));

    await fireEvent.press(screen.getByLabelText("后一天"));
    expect(onDateChange).toHaveBeenCalledWith(shiftDate("2026-08-08", 1));

    // 未选中段"休息日"唯一可点。
    await fireEvent.press(screen.getByText("休息日"));
    expect(onDayTypeChange).toHaveBeenCalledWith("rest");

    await fireEvent.press(screen.getByText("清空当天"));
    expect(onClear).toHaveBeenCalled();
  });

  test("休息日选中态下可切回力训日", async () => {
    const onDayTypeChange = jest.fn();
    await render(
      <DayToolbar
        date="2026-08-08"
        dayType="rest"
        timingNone={false}
        onDateChange={jest.fn()}
        onDayTypeChange={onDayTypeChange}
        onClear={jest.fn()}
      />,
    );
    // 休息日选中时切换段内只有一个「休息日」文案（日期下不再重复）。
    expect(screen.getAllByText("休息日")).toHaveLength(1);
    await fireEvent.press(screen.getByText("力训日"));
    expect(onDayTypeChange).toHaveBeenCalledWith("training");
  });

  test("timingNone 时隐藏日型切换、显示无训练安排", async () => {
    await render(
      <DayToolbar
        date="2026-08-08"
        dayType="training"
        timingNone
        onDateChange={jest.fn()}
        onDayTypeChange={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByText("无训练安排")).toBeTruthy();
    expect(screen.queryByText("力训日")).toBeNull();
    expect(screen.queryByText("休息日")).toBeNull();
  });
});

describe("PlanGuidance", () => {
  test("渲染方案标签、体重/BMI/身高与健康区间提示", async () => {
    await render(<PlanGuidance profile={DEFAULT_PROFILE} dayType="training" bmi={22.5} planLabel="5 减脂 · 晚饭前练" />);
    expect(screen.getByText("5 减脂 · 晚饭前练")).toBeTruthy();
    expect(screen.getByText("73kg")).toBeTruthy();
    expect(screen.getByText("22.5")).toBeTruthy();
    expect(screen.getByText("180cm")).toBeTruthy();
    expect(screen.getByText(/今天是力训日/)).toBeTruthy();
    expect(screen.getByText(/体重在健康区间，保持当前节奏/)).toBeTruthy();
  });

  test("BMI 偏低/偏高切换提示文案", async () => {
    await render(<PlanGuidance profile={DEFAULT_PROFILE} dayType="rest" bmi={17} planLabel="5 减脂 · 晚饭前练" />);
    expect(screen.getByText(/今天是休息日/)).toBeTruthy();
    expect(screen.getByText(/体重偏低，建议以增肌 \/ 维持为主/)).toBeTruthy();
  });

  test("BMI 偏高提示", async () => {
    await render(<PlanGuidance profile={DEFAULT_PROFILE} dayType="training" bmi={26} planLabel="5 减脂 · 晚饭前练" />);
    expect(screen.getByText(/BMI 偏高，建议控制能量摄入/)).toBeTruthy();
  });

  test("timing none → 无训练安排", async () => {
    await render(<PlanGuidance profile={{ ...DEFAULT_PROFILE, timing: "none" }} dayType="training" bmi={22} planLabel="8 减脂 · 无力训者" />);
    expect(screen.getByText(/无训练安排。/)).toBeTruthy();
  });
});
