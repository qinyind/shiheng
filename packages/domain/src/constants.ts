import type { Food, MealPreset, Profile } from "./types.ts";

export const FOODS: Food[] = [
  { id: "rice", name: "熟米饭", category: "主食", carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 },
  { id: "mantou", name: "馒头 / 花卷", category: "主食", carbs: 50, protein: 7, fat: 1, kcal: 237 },
  { id: "oats", name: "速食燕麦片", category: "主食", carbs: 60, protein: 13.5, fat: 7, kcal: 367 },
  { id: "sweet-potato", name: "蒸煮红薯", category: "主食", carbs: 18, protein: 1.6, fat: 0.2, kcal: 80 },
  { id: "potato", name: "蒸煮土豆", category: "主食", carbs: 18, protein: 2, fat: 0.1, kcal: 81 },
  { id: "bread", name: "切片面包", category: "主食", carbs: 50, protein: 9, fat: 4, kcal: 272 },
  { id: "banana", name: "香蕉（可食部）", category: "水果", carbs: 22, protein: 1.1, fat: 0.3, kcal: 89 },
  { id: "apple", name: "苹果（可食部）", category: "水果", carbs: 14, protein: 0.3, fat: 0.2, kcal: 57 },
  { id: "chicken", name: "熟鸡胸肉", category: "蛋白质", carbs: 0, protein: 25, fat: 4, kcal: 136 },
  { id: "lean-meat", name: "一般熟瘦肉", category: "蛋白质", carbs: 0, protein: 25, fat: 6, kcal: 154 },
  { id: "fish", name: "熟鱼虾", category: "蛋白质", carbs: 0, protein: 23, fat: 3, kcal: 119 },
  { id: "egg", name: "全蛋", category: "蛋白质", carbs: 1.1, protein: 12.6, fat: 10.6, kcal: 143 },
  { id: "milk", name: "全脂牛奶", category: "蛋白质", carbs: 4.8, protein: 3.2, fat: 3.3, kcal: 61 },
  { id: "whey", name: "蛋白粉", category: "蛋白质", carbs: 8, protein: 75, fat: 6, kcal: 386 },
  { id: "tofu", name: "豆腐", category: "蛋白质", carbs: 3, protein: 7, fat: 5, kcal: 85 },
  { id: "jerky", name: "低糖瘦肉干", category: "蛋白质", carbs: 8, protein: 40, fat: 5, kcal: 237 },
  { id: "nuts", name: "混合坚果", category: "脂肪", carbs: 18, protein: 20, fat: 50, kcal: 602 },
  { id: "oil", name: "烹调油（实际摄入）", category: "脂肪", carbs: 0, protein: 0, fat: 100, kcal: 900 },
  { id: "broccoli", name: "西兰花", category: "蔬菜", carbs: 7, protein: 2.8, fat: 0.4, kcal: 34 },
];

export const PLAN_OPTIONS: Array<{ goal: Goal; timing: Timing; label: string }> = [
  { goal: "cut", timing: "breakfastEarly", label: "1 减脂 · 早饭后练（早起）" },
  { goal: "cut", timing: "breakfastLate", label: "2 减脂 · 早饭后练（晚起）" },
  { goal: "cut", timing: "beforeLunch", label: "3 减脂 · 午饭前练" },
  { goal: "cut", timing: "afterLunch", label: "4 减脂 · 午饭后练" },
  { goal: "cut", timing: "beforeDinner", label: "5 减脂 · 晚饭前练" },
  { goal: "cut", timing: "afterDinner", label: "6 减脂 · 晚饭后练" },
  { goal: "cut", timing: "lateNight", label: "7 减脂 · 夜里练" },
  { goal: "cut", timing: "none", label: "8 减脂 · 无力训者" },
  { goal: "gain", timing: "breakfastEarly", label: "9 增肌 · 早饭后练（早起）" },
  { goal: "gain", timing: "breakfastLate", label: "10 增肌 · 早饭后练（晚起）" },
  { goal: "gain", timing: "beforeLunch", label: "11 增肌 · 午饭前练" },
  { goal: "gain", timing: "afterLunch", label: "12 增肌 · 午饭后练" },
  { goal: "gain", timing: "beforeDinner", label: "13 增肌 · 晚饭前练" },
  { goal: "gain", timing: "afterDinner", label: "14 增肌 · 晚饭后练" },
  { goal: "gain", timing: "lateNight", label: "15 增肌 · 夜里练" },
];

export const REST_MEALS: MealPreset[] = [
  { id: "breakfast", name: "早饭", note: "稳定开启一天", carbShare: 0.2, proteinShare: 0.2 },
  { id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.3 },
  { id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.3 },
  { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
];

export const EARLY_REST_MEALS: MealPreset[] = [
  { id: "breakfast", name: "早饭", note: "与训练日早饭一致", carbShare: 0.15, proteinShare: 0.2 },
  { id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.375, proteinShare: 0.3 },
  { id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.375, proteinShare: 0.3 },
  { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
];

export const DEFAULT_PROFILE: Profile = {
  sex: "male",
  age: 27,
  height: 180,
  weight: 73,
  goal: "cut",
  timing: "beforeDinner",
  level: "beginner",
  cardioDaily: 100,
};
