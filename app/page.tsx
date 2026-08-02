"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Sex = "male" | "female";
type Goal = "cut" | "gain";
type Level = "beginner" | "intermediate" | "advanced";
type Timing =
  | "breakfastEarly"
  | "breakfastLate"
  | "beforeLunch"
  | "afterLunch"
  | "beforeDinner"
  | "afterDinner"
  | "lateNight"
  | "none";
type DayType = "training" | "rest";

type Profile = {
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  goal: Goal;
  timing: Timing;
  level: Level;
  cardioDaily: number;
};

type Macro = { carbs: number; protein: number; fat: number; kcal: number };
type MealPreset = {
  id: string;
  name: string;
  note: string;
  carbShare: number;
  proteinShare: number;
};
type Food = Macro & { id: string; name: string; category: string; unit?: string };
type AiEstimate = Macro & {
  name: string;
  grams: number;
  confidence: "low" | "medium" | "high";
  note: string;
};
type FoodEntry = {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  per100: Macro;
};
type DayLog = Record<string, FoodEntry[]>;
type DayMeta = {
  dayType: DayType;
  target: Macro;
  planLabel: string;
  weight: number;
  meals: MealPreset[];
};
type SyncStatus = "connecting" | "saving" | "synced" | "local";
type MealRole = "breakfast" | "regular" | "pre" | "post" | "snack";
type MealGuide = { summary: string; choices: string[]; cautions: string[] };

const FOODS: Food[] = [
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

const PLAN_OPTIONS: Array<{ goal: Goal; timing: Timing; label: string }> = [
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

const REST_MEALS: MealPreset[] = [
  { id: "breakfast", name: "早饭", note: "稳定开启一天", carbShare: 0.2, proteinShare: 0.2 },
  { id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.3 },
  { id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.35, proteinShare: 0.3 },
  { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
];

const EARLY_REST_MEALS: MealPreset[] = [
  { id: "breakfast", name: "早饭", note: "与训练日早饭一致", carbShare: 0.15, proteinShare: 0.2 },
  { id: "lunch", name: "午饭", note: "常规正餐", carbShare: 0.375, proteinShare: 0.3 },
  { id: "dinner", name: "晚饭", note: "常规正餐", carbShare: 0.375, proteinShare: 0.3 },
  { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
];

function trainingMeals(timing: Timing): MealPreset[] {
  switch (timing) {
    case "breakfastEarly":
      return [
        { id: "breakfast-pre", name: "早饭 · 练前", note: "少量、易消化", carbShare: 0.15, proteinShare: 0.2 },
        { id: "post", name: "练后餐", note: "全天最大餐", carbShare: 0.35, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "breakfastLate":
      return [
        { id: "breakfast-pre", name: "早饭 · 练前", note: "训练前主餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch-post", name: "午饭 · 练后", note: "全天最大餐", carbShare: 0.4, proteinShare: 0.3 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.3, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "beforeLunch":
      return standardTimedMeals("练前餐", "午饭 · 练后", "晚饭", "before-lunch");
    case "afterLunch":
      return standardTimedMeals("午饭 · 练前", "练后餐", "晚饭", "after-lunch");
    case "beforeDinner":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.3 },
        { id: "pre", name: "练前餐", note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0 },
        { id: "dinner-post", name: "晚饭 · 练后", note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "afterDinner":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.3 },
        { id: "dinner-pre", name: "晚饭 · 练前", note: "控制到五六分饱", carbShare: 0.15, proteinShare: 0 },
        { id: "post", name: "练后餐", note: "补充碳水和蛋白质", carbShare: 0.35, proteinShare: 0.3 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    case "lateNight":
      return [
        { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "lunch", name: "午饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "dinner", name: "晚饭", note: "其他餐", carbShare: 0.2, proteinShare: 0.2 },
        { id: "post", name: "夜间练后餐", note: "训练后的主要补给", carbShare: 0.3, proteinShare: 0.2 },
        { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
      ];
    default:
      return REST_MEALS;
  }
}

function standardTimedMeals(preName: string, postName: string, dinnerName: string, key: string): MealPreset[] {
  const preIsLunch = key === "after-lunch";
  return [
    { id: "breakfast", name: "早饭", note: "常规早餐", carbShare: 0.2, proteinShare: 0.2 },
    { id: "pre", name: preName, note: "只垫少量碳水", carbShare: 0.15, proteinShare: 0 },
    { id: "post", name: postName, note: "全天最大餐", carbShare: 0.35, proteinShare: 0.3 },
    { id: "dinner", name: dinnerName, note: preIsLunch ? "训练后的其他餐" : "其他餐", carbShare: 0.2, proteinShare: 0.3 },
    { id: "snack", name: "零食 / 夜宵", note: "碳水主要作漏算预留", carbShare: 0.1, proteinShare: 0.2 },
  ];
}

function mealRole(meal: MealPreset): MealRole {
  if (meal.name.includes("零食") || meal.name.includes("夜宵")) return "snack";
  if (meal.name.includes("练前")) return "pre";
  if (meal.name.includes("练后")) return "post";
  if (meal.name.includes("早饭")) return "breakfast";
  return "regular";
}

function guideForMeal(meal: MealPreset, goal: Goal, dayType: DayType): MealGuide {
  const role = mealRole(meal);
  if (role === "pre") return {
    summary: "这不是正式一餐：只垫少量易消化碳水，吃到五六分饱即可开练。",
    choices: ["香蕉：小根约20g、大根约30g碳水", "娃哈哈八宝粥：约30–47g碳水/罐", "旺仔小馒头：约37g碳水/袋", "脉动等运动饮料：约30g碳水/瓶"],
    cautions: ["蛋白质不用专门吃；若刚好吃正餐，可以搭配少量瘦肉", "原则上不吃脂肪，避开非瘦肉、糖油混合物和吸油菜", "吃完不需要专门等待，但不要吃到全饱"],
  };
  if (role === "post") return {
    summary: "全天最大餐，最好练完后半小时内开始吃；先碳水和蛋白质。",
    choices: ["高GI主食：一般米饭、馒头、花卷、熟面", "蛋白质：一般熟瘦肉、去皮禽肉、鱼虾贝", "来不及吃正餐：便携快碳 + 蛋白粉"],
    cautions: ["水果只能占一部分碳水，不能替代主要淀粉主食", "意面、燕麦麸皮等低GI或高纤主食不作为练后主要碳水", "蔬菜少吃、后吃；与一般正餐的进食顺序相反"],
  };
  if (role === "snack") return {
    summary: "预留的10%碳水用于抵扣牛奶、蔬菜和调料的漏算，不是让你再吃一份主食。",
    choices: ["低糖牛肉干 / 鸡肉干", "鸡蛋、乳制品", "蔬菜、无糖饮料"],
    cautions: ["不专门吃面包、米面、奶茶或水果", "不吃饼干、膨化食品、甜品糕点等糖油混合物", "不吃也可以，把少量额度分到其他正餐"],
  };
  if (role === "breakfast") return {
    summary: "早餐同时建立碳水、蛋白质和基础脂肪来源。",
    choices: ["主食任选：米饭/粥、馒头、切片面包、燕麦、薯类", "蛋白质优先：鸡蛋 + 纯牛奶；或鸡蛋", "鸡蛋可水煮、茶叶蛋、蒸蛋羹"],
    cautions: ["鸡蛋优先选择水煮蛋，不用煎蛋替代", goal === "gain" ? "增肌方案还安排每天约30g坚果作为脂肪来源" : "减脂方案用蛋黄牛奶和正餐带油瘦肉覆盖脂肪，不建议逐克追脂肪", "如果完全不吃蛋黄和牛奶，需要按脂肪不足规则补充"],
  };
  return {
    summary: dayType === "rest" ? "休息日正餐：主食配瘦肉，蔬菜先吃、多吃。" : "其他正餐：主食配瘦肉，蔬菜先吃、多吃。",
    choices: ["主食：一般米饭、馒头、熟面、红薯、土豆、玉米", "瘦肉：去皮鸡鸭、无白色脂肪层的猪牛羊、鱼虾贝、肝肾肚血", "蔬菜不用定量，争取每天都吃"],
    cautions: ["红薯、土豆、玉米、山药、芋头属于碳水主食，不算蔬菜", "避开肥牛肥羊、排骨牛排、肉馅肉丸、炸肉等非瘦肉", goal === "cut" ? "重油菜在盘边刮油或简单过水；减脂期严格排除糖油混合物" : "重油菜尽量刮油；糖油混合物增肌期也只偶尔吃"],
  };
}

const DEFAULT_PROFILE: Profile = {
  sex: "male",
  age: 27,
  height: 180,
  weight: 73,
  goal: "cut",
  timing: "beforeDinner",
  level: "beginner",
  cardioDaily: 100,
};

function strengthCalories(sex: Sex, level: Level) {
  const table = sex === "male" ? [150, 200, 250] : [100, 150, 200];
  return table[level === "beginner" ? 0 : level === "intermediate" ? 1 : 2];
}

function calculate(profile: Profile) {
  const { sex, age, height, weight, goal, cardioDaily, level, timing } = profile;
  const bmr = weight * 9.99 + height * 6.25 - age * 4.92 + (sex === "male" ? 5 : -161);
  const base = bmr / 0.7;
  const strength = timing === "none" ? 0 : strengthCalories(sex, level);
  const trainMaintenance = base + strength + cardioDaily;
  const restMaintenance = base + cardioDaily;
  const factor = goal === "cut" ? 0.64 : 0.84;
  const fat = goal === "cut" ? (weight >= 120 ? 70 : sex === "male" ? 60 : 50) : sex === "male" ? 80 : 70;
  const trainingKcal = trainMaintenance * factor;
  const restKcal = restMaintenance * factor;
  const remaining = Math.max(0, trainingKcal - fat * 9);
  const carbRatio = goal === "cut" ? 0.64 : 0.7;
  const proteinRatio = 1 - carbRatio;
  const protein = (remaining * proteinRatio) / 4;
  const trainingCarbs = (remaining * carbRatio) / 4;
  const restCarbs = Math.max(0, (restKcal - fat * 9 - protein * 4) / 4);
  return { bmr, base, strength, trainMaintenance, restMaintenance, trainingKcal, restKcal, fat, protein, trainingCarbs, restCarbs };
}

function macroForFood(entry: FoodEntry): Macro {
  const scale = entry.grams / 100;
  return {
    carbs: entry.per100.carbs * scale,
    protein: entry.per100.protein * scale,
    fat: entry.per100.fat * scale,
    kcal: entry.per100.kcal * scale,
  };
}

function sumMacros(entries: FoodEntry[]): Macro {
  return entries.reduce(
    (sum, entry) => {
      const m = macroForFood(entry);
      return { carbs: sum.carbs + m.carbs, protein: sum.protein + m.protein, fat: sum.fat + m.fat, kcal: sum.kcal + m.kcal };
    },
    { carbs: 0, protein: 0, fat: 0, kcal: 0 },
  );
}

function round(value: number, digits = 0) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Progress({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? (value / target) * 100 : value > 0 ? 120 : 0;
  const over = pct > 110;
  return (
    <div className="progress-row">
      <div className="progress-label">
        <span>{label}</span>
        <strong className={over ? "danger-text" : ""}>{round(value, 1)} / {round(target, 1)}g</strong>
      </div>
      <div className="progress-track"><span style={{ width: `${Math.min(pct, 100)}%`, background: over ? "var(--red)" : color }} /></div>
    </div>
  );
}

function getRecommendation(target: Macro, total: Macro, meal: MealPreset) {
  const remain = {
    carbs: target.carbs - total.carbs,
    protein: target.protein - total.protein,
    fat: target.fat - total.fat,
  };
  if (remain.carbs < -5 || remain.protein < -5 || remain.fat < -4) {
    return { text: "本餐已有指标超出，接下来优先选择无油蔬菜或停止加餐。", foodId: "broccoli", grams: 150 };
  }
  const role = mealRole(meal);
  if (role === "snack") {
    if (remain.protein > 10) {
      const food = FOODS.find((f) => f.id === "jerky")!;
      return { text: `本次加餐不再补主食；若确实饿，可用约 ${round((remain.protein / food.protein) * 100)}g 低糖瘦肉干补蛋白质。`, foodId: food.id, grams: round((remain.protein / food.protein) * 100) };
    }
    return { text: "这餐的碳水是漏算预留，不必吃满；可选鸡蛋、乳制品、蔬菜或无糖饮料。", foodId: "egg", grams: 50 };
  }
  if (role === "pre") {
    if (remain.carbs > 8) {
      const food = FOODS.find((f) => f.id === "banana")!;
      return { text: `练前只垫碳水：可吃约 ${round((remain.carbs / food.carbs) * 100)}g 香蕉，五六分饱即可，不必补蛋白质和脂肪。`, foodId: food.id, grams: round((remain.carbs / food.carbs) * 100) };
    }
    return { text: "练前碳水已接近目标，不要为了吃满而继续加餐，准备训练即可。", foodId: "banana", grams: 80 };
  }
  if (remain.protein > 10) {
    if (role === "breakfast") {
      const eggs = Math.max(1, Math.ceil(remain.protein / 6));
      return { text: `早餐还差约 ${round(remain.protein)}g 蛋白质，可安排约 ${eggs} 个全蛋；也可用鸡蛋加纯牛奶组合。`, foodId: "egg", grams: eggs * 50 };
    }
    const food = FOODS.find((f) => f.id === "chicken")!;
    return { text: `${role === "post" ? "练后优先补足" : "还差约"} ${round(remain.protein)}g 蛋白质，可选约 ${round((remain.protein / food.protein) * 100)}g 一般熟瘦肉。`, foodId: food.id, grams: round((remain.protein / food.protein) * 100) };
  }
  if (remain.carbs > 12) {
    const food = FOODS.find((f) => f.id === (role === "breakfast" ? "oats" : "rice"))!;
    const amount = round((remain.carbs / food.carbs) * 100);
    return { text: role === "post" ? `练后还差约 ${round(remain.carbs)}g 碳水，可补 ${amount}g 一般熟米饭；水果不能作为主要来源。` : `还差约 ${round(remain.carbs)}g 碳水，可选约 ${amount}g ${food.name}。`, foodId: food.id, grams: amount };
  }
  return { text: role === "post" ? "练后餐已接近目标；如吃蔬菜，请少吃、后吃。" : "本餐已经接近目标，先吃、多吃蔬菜即可。", foodId: "broccoli", grams: 150 };
}

function PlanGuidance({ profile, dayType, bmi, planLabel }: { profile: Profile; dayType: DayType; bmi: number; planLabel: string }) {
  const isCut = profile.goal === "cut";
  const cardio = !isCut
    ? "增肌期一般不安排有氧，把恢复能力留给稳定力训。"
    : profile.weight > 80
      ? "80kg以上减脂者先不做有氧，优先用饮食建立缺口。"
      : profile.weight >= 70
        ? `你目前${profile.weight}kg：70–80kg先不做有氧；感觉饥饿时再加有氧，并等量增加饮食。`
        : "70kg以下减脂者每周约2小时有氧；长有氧与力训隔开。";
  const trend = isCut
    ? "用1–2周体重趋势判断，理论参考为2周约下降2%；两三天变化多是水分和食糜，不用据此改配额。"
    : `按月看增重：${profile.sex === "male" ? "男性一般不超过1kg/月" : "女性一般不超过0.5kg/月"}，一个月完全不长再增加饮食。`;
  const switchPoint = isCut
    ? `普通人不追求极低体脂；建议${profile.sex === "male" ? "男性BMI 22–23" : "女性BMI 20–21"}附近转增肌。你目前BMI ${round(bmi, 1)}。`
    : `若介意发胖，建议${profile.sex === "male" ? "男性BMI 23–24" : "女性BMI 21–22"}附近转减脂。你目前BMI ${round(bmi, 1)}。`;
  const fatRule = isCut
    ? "男性约60g、女性约50g；不必逐克细算。早餐蛋黄牛奶 + 正餐带油瘦肉通常即可；缺少这些来源时，可补30g坚果、3个全蛋或1盒全脂牛奶。"
    : "男性约80g、女性约70g；早餐蛋黄牛奶 + 正餐带油瘦肉 + 每天约30g坚果。若蛋奶和菜油都不足，按脂肪不足规则补充。";

  return (
    <section className="plan-guidance" id="guidance">
      <div className="guide-heading"><div><p className="eyebrow">03 · 方案指导</p><h2>不只算数字，也告诉你怎么吃</h2></div><span>{planLabel} · {dayType === "training" ? "力训日" : "休息日"}</span></div>
      <div className="guide-highlight"><strong>{profile.timing === "beforeDinner" && dayType === "training" ? "晚饭是全天最大练后餐" : dayType === "rest" ? "不力训就是休息日，与是否做有氧无关" : "训练日按练前、练后位置分配餐次"}</strong><p>{profile.timing === "beforeDinner" && dayType === "training" ? "餐序：早饭 → 午饭（其他餐）→ 练前餐 → 晚饭（练后餐）→ 少量零食/夜宵预留。" : "具体食物选择和进食顺序已写入下方每一餐。"}</p></div>
      <div className="guide-grid">
        <article><span>体重趋势</span><p>{trend}</p></article>
        <article><span>何时换阶段</span><p>{switchPoint}</p></article>
        <article><span>力训与有氧</span><p>{profile.goal === "gain" ? "稳定力训3–5次/周是增肌前提。" : "力训不是制造缺口的必需项，但每周3–5次有助于减少肌肉损失。"} {cardio}</p></article>
        <article><span>脂肪怎么吃</span><p>{fatRule}</p></article>
      </div>
      <details className="food-boundaries">
        <summary>查看食物分类、置换与禁忌</summary>
        <div>
          <section><h3>碳水主食</h3><p>米饭一般按30%碳水率；馒头/花卷/切片面包50%；蒸煮红薯和土豆18%；速食燕麦60%。练后优先米饭、馒头、熟面等高GI主食。</p></section>
          <section><h3>蛋白质</h3><p>一般熟瘦肉按25%蛋白质率；柴感熟肉30%；低糖瘦肉干40%；蛋白粉约75%。瘦肉只包括去皮禽肉、无白色脂肪层的猪牛羊、鱼虾贝和部分内脏。</p></section>
          <section><h3>蔬菜与水果</h3><p>蔬菜不用定量。水果必须计入碳水并置换主食：水果10g碳水≈少吃30g一般熟米饭；练后水果不能替代主要淀粉主食。</p></section>
          <section><h3>平时排除</h3><p>高脂肉、肉馅肉丸、肥牛肥羊、排骨牛排，以及饼干、蛋糕、油条、花式面包、膨化食品等糖油混合物。复杂混合菜不要直接套用营养软件的单一数据。</p></section>
        </div>
      </details>
    </section>
  );
}

function AiFoodAnalyzer({ onSave }: { onSave: (food: Food) => void }) {
  const [description, setDescription] = useState("");
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [estimate, setEstimate] = useState<AiEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function chooseImage(file?: File) {
    setError("");
    setSaved(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择照片或图片文件。");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("图片请控制在 8MB 以内。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(String(reader.result || ""));
      setImageName(file.name);
    };
    reader.onerror = () => setError("图片读取失败，请重新选择。");
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!description.trim() && !imageData) {
      setError("请先写下食物和份量，或拍一张照片。");
      return;
    }
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: description.trim(), image: imageData || undefined }),
      });
      const data = await response.json() as { estimate?: AiEstimate; error?: string };
      if (!response.ok || !data.estimate) throw new Error(data.error || "暂时无法完成识别，请稍后重试。");
      setEstimate(data.estimate);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法完成识别，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function updateEstimate<K extends keyof AiEstimate>(key: K, value: AiEstimate[K]) {
    setEstimate((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  }

  function saveFood() {
    if (!estimate || estimate.grams <= 0 || !estimate.name.trim()) return;
    const scale = 100 / estimate.grams;
    onSave({
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: estimate.name.trim(),
      category: "我的食物",
      carbs: round(Math.max(0, estimate.carbs) * scale, 2),
      protein: round(Math.max(0, estimate.protein) * scale, 2),
      fat: round(Math.max(0, estimate.fat) * scale, 2),
      kcal: round(Math.max(0, estimate.kcal) * scale, 1),
    });
    setSaved(true);
  }

  const confidenceLabel = estimate?.confidence === "high" ? "较高" : estimate?.confidence === "medium" ? "中等" : "较低";

  return (
    <section className="ai-card" id="ai-food">
      <div className="ai-copy">
        <p className="eyebrow">04 · AI 智能识餐</p>
        <h2>说出来，或拍下来</h2>
        <p>描述食物、重量和烹饪方式，或拍摄餐盘 / 营养标签。AI 会估算整份营养；保存前可以手动校正。</p>
        <div className="ai-tips"><span>写清生重 / 熟重</span><span>带上油与酱料</span><span>照片尽量俯拍</span></div>
      </div>

      <div className="ai-input-panel">
        <label className="ai-text-label"><span>文字描述</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="例如：熟米饭 200g，煎鸡胸肉 150g，用了约 8g 油；或输入包装营养成分表" /></label>
        <div className="photo-row">
          <label className="photo-button"><input type="file" accept="image/*" capture="environment" onChange={(event) => chooseImage(event.target.files?.[0])} /><span>{imageData ? "更换照片" : "拍照 / 选图"}</span></label>
          {imageData ? <div className="photo-preview"><img src={imageData} alt="待识别食物预览" /><span>{imageName}</span><button onClick={() => { setImageData(""); setImageName(""); }} aria-label="移除照片">×</button></div> : <p>支持餐盘、外卖、包装标签，最大 8MB</p>}
        </div>
        <button className="analyze-button" onClick={analyze} disabled={loading}>{loading ? "正在分析营养…" : "开始 AI 计算"}<span>✦</span></button>
        {error && <p className="ai-error" role="alert">{error}</p>}
      </div>

      {estimate && (
        <div className="ai-result">
          <div className="ai-result-head"><div><span>AI 估算结果</span><strong>置信度{confidenceLabel}</strong></div><p>{estimate.note}</p></div>
          <div className="estimate-grid">
            <label className="estimate-name"><span>保存名称</span><input value={estimate.name} onChange={(event) => updateEstimate("name", event.target.value)} /></label>
            <label><span>整份重量</span><div><input type="number" min="1" value={estimate.grams} onChange={(event) => updateEstimate("grams", Number(event.target.value))} /><b>g</b></div></label>
            {(["carbs", "protein", "fat", "kcal"] as const).map((key) => (
              <label key={key}><span>{key === "carbs" ? "整份碳水" : key === "protein" ? "整份蛋白质" : key === "fat" ? "整份脂肪" : "整份热量"}</span><div><input type="number" min="0" step="0.1" value={round(estimate[key], 1)} onChange={(event) => updateEstimate(key, Number(event.target.value))} /><b>{key === "kcal" ? "kcal" : "g"}</b></div></label>
            ))}
          </div>
          <div className="save-result-row"><p>保存后会自动换算为每 100g 营养，并出现在所有餐次的“我的食物”中。</p><button onClick={saveFood} disabled={saved}>{saved ? "已保存到我的食物" : "保存为自定义食物"}</button></div>
        </div>
      )}
    </section>
  );
}

function MealCard({ meal, target, entries, foods, goal, dayType, onAdd, onRemove }: {
  meal: MealPreset;
  target: Macro;
  entries: FoodEntry[];
  foods: Food[];
  goal: Goal;
  dayType: DayType;
  onAdd: (entry: FoodEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [foodId, setFoodId] = useState("rice");
  const [grams, setGrams] = useState(100);
  const [custom, setCustom] = useState({ name: "", carbs: 0, protein: 0, fat: 0, kcal: 0 });
  const total = useMemo(() => sumMacros(entries), [entries]);
  const recommendation = getRecommendation(target, total, meal);
  const excelGuide = guideForMeal(meal, goal, dayType);
  const maxRatio = Math.max(
    target.carbs ? total.carbs / target.carbs : total.carbs ? 2 : 0,
    target.protein ? total.protein / target.protein : total.protein ? 2 : 0,
    target.fat ? total.fat / target.fat : total.fat ? 2 : 0,
  );
  const status = !entries.length ? "待记录" : maxRatio > 1.1 ? "有超标" : maxRatio >= 0.8 ? "接近目标" : "还可补充";

  function addFood() {
    if (!grams || grams <= 0) return;
    const food = foods.find((item) => item.id === foodId);
    const per100 = foodId === "custom"
      ? { carbs: custom.carbs, protein: custom.protein, fat: custom.fat, kcal: custom.kcal || custom.carbs * 4 + custom.protein * 4 + custom.fat * 9 }
      : food!;
    const name = foodId === "custom" ? custom.name || "自定义食物" : food!.name;
    onAdd({ id: `${Date.now()}-${Math.random()}`, foodId, name, grams, per100 });
  }

  function applyRecommendation() {
    setFoodId(recommendation.foodId);
    setGrams(Math.max(1, recommendation.grams));
  }

  return (
    <article className="meal-card">
      <header className="meal-head">
        <div>
          <p className="eyebrow">{meal.note}</p>
          <h3>{meal.name}</h3>
        </div>
        <span className={`status ${status === "有超标" ? "status-danger" : status === "接近目标" ? "status-good" : ""}`}>{status}</span>
      </header>

      <div className="meal-targets">
        <Progress label="碳水" value={total.carbs} target={target.carbs} color="var(--carb)" />
        <Progress label="蛋白质" value={total.protein} target={target.protein} color="var(--protein)" />
        <Progress label="脂肪" value={total.fat} target={target.fat} color="var(--fat)" />
      </div>

      {entries.length > 0 && (
        <div className="food-list">
          {entries.map((entry) => {
            const macro = macroForFood(entry);
            return (
              <div className="food-row" key={entry.id}>
                <div><strong>{entry.name}</strong><span>{round(entry.grams)}g · {round(macro.kcal)} kcal</span></div>
                <div className="food-macros">C {round(macro.carbs, 1)} · P {round(macro.protein, 1)} · F {round(macro.fat, 1)}</div>
                <button className="icon-button" onClick={() => onRemove(entry.id)} aria-label={`删除${entry.name}`}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="add-food">
        <select value={foodId} onChange={(e) => setFoodId(e.target.value)} aria-label="选择食物">
          {[...new Set(foods.map((f) => f.category))].map((category) => (
            <optgroup key={category} label={category}>
              {foods.filter((f) => f.category === category).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
            </optgroup>
          ))}
          <option value="custom">＋ 自定义食物</option>
        </select>
        <label className="gram-input"><input type="number" min="1" value={grams} onChange={(e) => setGrams(Number(e.target.value))} /><span>克</span></label>
        <button className="add-button" onClick={addFood}>添加</button>
      </div>
      {foodId === "custom" && (
        <div className="custom-food">
          <input placeholder="食物名称" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
          {(["carbs", "protein", "fat", "kcal"] as const).map((key) => (
            <label key={key}><span>{key === "carbs" ? "碳水" : key === "protein" ? "蛋白质" : key === "fat" ? "脂肪" : "热量"}/100g</span><input type="number" min="0" value={custom[key]} onChange={(e) => setCustom({ ...custom, [key]: Number(e.target.value) })} /></label>
          ))}
        </div>
      )}

      <button className="recommendation" onClick={applyRecommendation}>
        <span className="spark">✦</span><span><b>本餐推荐</b>{recommendation.text}</span><span className="arrow">↗</span>
      </button>
      <div className="meal-excel-guide">
        <div className="meal-guide-title"><span>本餐建议</span><p>{excelGuide.summary}</p></div>
        <div className="meal-guide-chips">{excelGuide.choices.slice(0, 3).map((choice) => <span key={choice}>{choice}</span>)}</div>
        <p className="meal-guide-warning"><b>注意</b>{excelGuide.cautions[0]}</p>
        <details><summary>展开全部建议与注意事项</summary><div><ul>{excelGuide.choices.map((choice) => <li key={choice}>{choice}</li>)}</ul><ul>{excelGuide.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></div></details>
      </div>
    </article>
  );
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [dayType, setDayType] = useState<DayType>("training");
  const [date, setDate] = useState(todayString());
  const [logs, setLogs] = useState<Record<string, DayLog>>({});
  const [metas, setMetas] = useState<Record<string, DayMeta>>({});
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");
  const [showIosTip, setShowIosTip] = useState(false);
  const lastModifiedRef = useRef(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("meal-meter-state-v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted device state once on mount
        if (parsed.profile) setProfile(parsed.profile);
        if (parsed.logs) setLogs(parsed.logs);
        if (parsed.metas) setMetas(parsed.metas);
        if (Array.isArray(parsed.customFoods)) setCustomFoods(parsed.customFoods);
        lastModifiedRef.current = Number(parsed.updatedAt) || 0;
      }
    } catch { /* device-local storage is optional */ }
    const capacitorWindow = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
    const isNativeApp = Boolean(capacitorWindow.Capacitor?.isNativePlatform?.());
    if (!isNativeApp && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !isNativeApp && !navigatorWithStandalone.standalone && localStorage.getItem("meal-meter-ios-tip") !== "dismissed") setShowIosTip(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("meal-meter-state-v1", JSON.stringify({ profile, logs, metas, customFoods, updatedAt: lastModifiedRef.current }));
  }, [profile, logs, metas, customFoods, ready]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    async function loadCloudState() {
      setSyncStatus("connecting");
      try {
        const response = await fetch("/api/sync", { signal: controller.signal, cache: "no-store" });
        if (response.status === 401) {
          setSyncStatus("local");
          return;
        }
        if (!response.ok) throw new Error("sync unavailable");
        const data = await response.json() as { state?: { profile?: Profile; logs?: Record<string, DayLog>; metas?: Record<string, DayMeta>; customFoods?: Food[] } | null; updatedAt?: string | null };
        const serverTime = data.updatedAt ? Date.parse(data.updatedAt) : 0;
        if (data.state && serverTime > lastModifiedRef.current) {
          if (data.state.profile) setProfile(data.state.profile);
          if (data.state.logs) setLogs(data.state.logs);
          if (data.state.metas) setMetas(data.state.metas);
          if (Array.isArray(data.state.customFoods)) setCustomFoods(data.state.customFoods);
          lastModifiedRef.current = serverTime;
        }
        setCloudReady(true);
        setSyncStatus("synced");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSyncStatus("local");
      }
    }
    loadCloudState();
    return () => controller.abort();
  }, [ready]);

  useEffect(() => {
    if (!ready || !cloudReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect the debounced persistence state immediately
    setSyncStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/sync", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: { profile, logs, metas, customFoods } }),
        });
        if (!response.ok) throw new Error("sync failed");
        const data = await response.json() as { updatedAt?: string };
        if (data.updatedAt) lastModifiedRef.current = Date.parse(data.updatedAt);
        localStorage.setItem("meal-meter-state-v1", JSON.stringify({ profile, logs, metas, customFoods, updatedAt: lastModifiedRef.current }));
        setSyncStatus("synced");
      } catch {
        setSyncStatus("local");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [profile, logs, metas, customFoods, ready, cloudReady]);

  const calc = useMemo(() => calculate(profile), [profile]);
  const computedDayType: DayType = profile.timing === "none" ? "rest" : dayType;
  const computedTarget: Macro = computedDayType === "training"
    ? { carbs: calc.trainingCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.trainingKcal }
    : { carbs: calc.restCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.restKcal };
  const computedMeals = computedDayType === "training" ? trainingMeals(profile.timing) : profile.timing === "breakfastEarly" ? EARLY_REST_MEALS : REST_MEALS;
  const dateMeta = metas[date];
  const effectiveDayType = dateMeta?.dayType ?? computedDayType;
  const dailyTarget = dateMeta?.target ?? computedTarget;
  const meals = dateMeta?.meals ?? computedMeals;
  const dateLog = logs[date] || {};
  const dayEntries = meals.flatMap((meal) => dateLog[meal.id] || []);
  const consumed = sumMacros(dayEntries);
  const bmi = profile.weight / ((profile.height / 100) ** 2);
  const currentPlanLabel = PLAN_OPTIONS.find((p) => p.goal === profile.goal && p.timing === profile.timing)?.label || "自定义方案";
  const availableFoods = useMemo(() => [...FOODS, ...customFoods], [customFoods]);

  const historyRows = useMemo(() => Object.keys(logs)
    .filter((recordDate) => Object.values(logs[recordDate] || {}).some((items) => items.length > 0))
    .sort((a, b) => b.localeCompare(a))
    .map((recordDate) => {
      const total = sumMacros(Object.values(logs[recordDate] || {}).flat());
      const meta = metas[recordDate];
      const target = meta?.target;
      return {
        date: recordDate,
        total,
        meta,
        completion: target?.kcal ? Math.round((total.kcal / target.kcal) * 100) : 0,
      };
    }), [logs, metas]);

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    markChanged();
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function changePlan(value: string) {
    markChanged();
    const [goal, timing] = value.split(":") as [Goal, Timing];
    setProfile((current) => ({ ...current, goal, timing }));
    if (timing === "none") setDayType("rest");
  }

  function addEntry(mealId: string, entry: FoodEntry) {
    markChanged();
    if (!metas[date]) {
      setMetas((current) => ({ ...current, [date]: { dayType: computedDayType, target: computedTarget, planLabel: currentPlanLabel, weight: profile.weight, meals: computedMeals } }));
    }
    setLogs((current) => ({
      ...current,
      [date]: { ...current[date], [mealId]: [...(current[date]?.[mealId] || []), entry] },
    }));
  }

  function removeEntry(mealId: string, id: string) {
    markChanged();
    setLogs((current) => ({
      ...current,
      [date]: { ...current[date], [mealId]: (current[date]?.[mealId] || []).filter((entry) => entry.id !== id) },
    }));
  }

  function clearDay() {
    markChanged();
    setLogs((current) => ({ ...current, [date]: {} }));
    setMetas((current) => {
      const next = { ...current };
      delete next[date];
      return next;
    });
  }

  function saveCustomFood(food: Food) {
    markChanged();
    setCustomFoods((current) => [...current.filter((item) => !(item.name === food.name && item.category === "我的食物")), food]);
  }

  function chooseDayType(next: DayType) {
    markChanged();
    setDayType(next);
    const nextTarget: Macro = next === "training"
      ? { carbs: calc.trainingCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.trainingKcal }
      : { carbs: calc.restCarbs, protein: calc.protein, fat: calc.fat, kcal: calc.restKcal };
    const nextMeals = next === "training" ? trainingMeals(profile.timing) : profile.timing === "breakfastEarly" ? EARLY_REST_MEALS : REST_MEALS;
    setMetas((current) => ({ ...current, [date]: { dayType: next, target: nextTarget, planLabel: currentPlanLabel, weight: profile.weight, meals: nextMeals } }));
  }

  function openRecord(recordDate: string) {
    setDate(recordDate);
    document.getElementById("today")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function markChanged() {
    // eslint-disable-next-line react-hooks/purity -- called only from user event handlers to version local mutations
    lastModifiedRef.current = Date.now();
    if (cloudReady) setSyncStatus("saving");
  }

  function dismissIosTip() {
    localStorage.setItem("meal-meter-ios-tip", "dismissed");
    setShowIosTip(false);
  }

  const planValue = `${profile.goal}:${profile.timing}`;
  const completion = dailyTarget.kcal ? Math.min(100, Math.round((consumed.kcal / dailyTarget.kcal) * 100)) : 0;

  return (
    <main>
      <section className="hero">
        <nav className="topbar">
          <a className="brand" href="#top" aria-label="餐标首页"><span>餐</span>餐标</a>
          <div className="top-note"><i />{syncStatus === "synced" ? "云端已同步" : syncStatus === "saving" ? "正在同步…" : syncStatus === "connecting" ? "正在连接云端…" : "已保存在当前设备"}</div>
        </nav>

        <div className="hero-copy" id="top">
          <p className="kicker">让每一餐都有清晰标准</p>
          <h1>今天这顿，<em>吃对了吗？</em></h1>
          <p>选择训练方案，系统自动拆分每日与每餐指标。记录食物或让 AI 看图识餐，立即看到余量、超标项和下一口建议。</p>
        </div>

        <div className="profile-panel" id="settings">
          <div className="panel-title"><span>01</span><div><h2>建立今日目标</h2><p>{currentPlanLabel}</p></div><button className="settings-toggle" onClick={() => setSettingsOpen((value) => !value)}>{settingsOpen ? "收起参数" : "调整参数"}</button></div>
          <div className="profile-quick">
            <span><b>{profile.weight}</b> kg</span><span><b>{round(bmi, 1)}</b> BMI</span><span><b>{round(dailyTarget.kcal)}</b> kcal</span><span><b>{round(dailyTarget.protein)}</b>g 蛋白质</span>
          </div>
          <div className={`settings-body ${settingsOpen ? "open" : ""}`}>
          <div className="profile-grid">
            <label className="field field-wide"><span>训练方案</span><select value={planValue} onChange={(e) => changePlan(e.target.value)}>{PLAN_OPTIONS.map((p) => <option key={`${p.goal}:${p.timing}`} value={`${p.goal}:${p.timing}`}>{p.label}</option>)}</select></label>
            <label className="field"><span>性别</span><select value={profile.sex} onChange={(e) => updateProfile("sex", e.target.value as Sex)}><option value="male">男</option><option value="female">女</option></select></label>
            <label className="field"><span>年龄</span><div className="number-field"><input type="number" min="18" max="90" value={profile.age} onChange={(e) => updateProfile("age", Number(e.target.value))} /><b>岁</b></div></label>
            <label className="field"><span>身高</span><div className="number-field"><input type="number" min="120" max="230" value={profile.height} onChange={(e) => updateProfile("height", Number(e.target.value))} /><b>cm</b></div></label>
            <label className="field"><span>体重</span><div className="number-field"><input type="number" min="35" max="250" step="0.1" value={profile.weight} onChange={(e) => updateProfile("weight", Number(e.target.value))} /><b>kg</b></div></label>
            <label className="field"><span>力训水平</span><select value={profile.level} disabled={profile.timing === "none"} onChange={(e) => updateProfile("level", e.target.value as Level)}><option value="beginner">新手</option><option value="intermediate">有基础</option><option value="advanced">老手</option></select></label>
            <label className="field"><span>日均有氧消耗</span><div className="number-field"><input type="number" min="0" max="1000" value={profile.cardioDaily} onChange={(e) => updateProfile("cardioDaily", Number(e.target.value))} /><b>kcal</b></div></label>
          </div>
          <div className="formula-strip">
            <span>BMI <b>{round(bmi, 1)}</b></span><span>基础代谢 <b>{round(calc.bmr)} kcal</b></span><span>今日平衡热量 <b>{round(effectiveDayType === "training" ? calc.trainMaintenance : calc.restMaintenance)} kcal</b></span>
            <p>采用 Mifflin–St Jeor 与方案配额系数；结果用于饮食规划，不代替医疗建议。</p>
          </div>
          </div>
        </div>
      </section>

      <section className="dashboard-shell" id="today">
        {showIosTip && <aside className="ios-install-tip"><span>iPhone 安装</span><p>在 Safari 点“分享”，再选“添加到主屏幕”，即可像 App 一样全屏使用。</p><button onClick={dismissIosTip} aria-label="关闭安装提示">×</button></aside>}
        <div className="day-toolbar">
          <div className="date-control"><button onClick={() => setDate(shiftDate(date, -1))} aria-label="前一天">←</button><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button onClick={() => setDate(shiftDate(date, 1))} aria-label="后一天">→</button></div>
          <div className="day-switch" aria-label="训练日类型">
            <button className={effectiveDayType === "training" ? "active" : ""} disabled={profile.timing === "none"} onClick={() => chooseDayType("training")}>力训日</button>
            <button className={effectiveDayType === "rest" ? "active" : ""} onClick={() => chooseDayType("rest")}>休息日</button>
          </div>
          <button className="clear-button" onClick={clearDay}>清空当天</button>
        </div>

        <section className="summary-card">
          <div className="summary-intro">
            <p className="eyebrow">02 · 今日摄入总览</p>
            <h2>{effectiveDayType === "training" ? "力训日" : "休息日"}目标</h2>
            <p>{profile.goal === "cut" ? "当前是减脂配额，关注趋势与训练表现。" : "当前是增肌配额，以缓慢增重为目标。"}</p>
          </div>
          <div className="calorie-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{round(consumed.kcal)}</strong><span>/ {round(dailyTarget.kcal)} kcal</span></div>
          </div>
          <div className="summary-macros">
            <Progress label="碳水" value={consumed.carbs} target={dailyTarget.carbs} color="var(--carb)" />
            <Progress label="蛋白质" value={consumed.protein} target={dailyTarget.protein} color="var(--protein)" />
            <Progress label="脂肪" value={consumed.fat} target={dailyTarget.fat} color="var(--fat)" />
          </div>
          <div className="target-numbers">
            <div><span>碳水</span><strong>{round(dailyTarget.carbs)}<small>g</small></strong></div>
            <div><span>蛋白质</span><strong>{round(dailyTarget.protein)}<small>g</small></strong></div>
            <div><span>脂肪</span><strong>{round(dailyTarget.fat)}<small>g</small></strong></div>
          </div>
        </section>

        <PlanGuidance profile={profile} dayType={effectiveDayType} bmi={bmi} planLabel={currentPlanLabel} />

        <AiFoodAnalyzer onSave={saveCustomFood} />

        <div className="section-heading">
          <div><p className="eyebrow">05 · 逐餐记录</p><h2>每一餐都有清楚的边界</h2></div>
          <p>每餐同时显示指标、动态补充建议、食物选择、进食顺序和注意事项。</p>
        </div>

        <section className="meal-grid">
          {meals.map((meal) => {
            const target = {
              carbs: dailyTarget.carbs * meal.carbShare,
              protein: dailyTarget.protein * meal.proteinShare,
              fat: dailyTarget.fat * meal.proteinShare,
              kcal: dailyTarget.kcal * ((meal.carbShare + meal.proteinShare) / 2),
            };
            return <MealCard key={meal.id} meal={meal} target={target} entries={dateLog[meal.id] || []} foods={availableFoods} goal={profile.goal} dayType={effectiveDayType} onAdd={(entry) => addEntry(meal.id, entry)} onRemove={(id) => removeEntry(meal.id, id)} />;
          })}
        </section>

        <section className="history-section" id="history">
          <div className="section-heading history-heading">
            <div><p className="eyebrow">06 · 历史记录</p><h2>每天的变化，都留得住</h2></div>
            <p>记录按日期保存在当前设备；每一天会锁定当时的方案、体重和目标，之后调整参数不会改写旧记录。</p>
          </div>
          {historyRows.length ? (
            <div className="history-list">
              {historyRows.map((row) => (
                <button className="history-row" key={row.date} onClick={() => openRecord(row.date)}>
                  <div className="history-date"><strong>{row.date.slice(5).replace("-", "/")}</strong><span>{row.meta?.dayType === "training" ? "力训日" : "休息日"} · {row.meta?.weight || profile.weight}kg</span></div>
                  <div className="history-plan">{row.meta?.planLabel || "历史方案"}</div>
                  <div className="history-macros"><span>C {round(row.total.carbs)}g</span><span>P {round(row.total.protein)}g</span><span>F {round(row.total.fat)}g</span></div>
                  <div className={`history-score ${row.completion > 110 ? "over" : ""}`}><strong>{row.completion}%</strong><span>{round(row.total.kcal)} kcal</span></div>
                  <span className="history-arrow">→</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-history"><span>○</span><h3>还没有历史记录</h3><p>在任意一餐添加食物后，当天记录会自动保存在这里。</p></div>
          )}
        </section>

        <footer>
          <div className="footer-mark"><span>餐</span><strong>把目标落到每一餐。</strong></div>
          <p>配额会根据当前目标、训练安排和身体数据计算。智能秤体脂与软件计算均仅作趋势参考。</p>
        </footer>
      </section>
      <nav className="mobile-nav" aria-label="移动端导航">
        <button onClick={() => scrollTo("today")}><span>●</span>今日</button>
        <button onClick={() => scrollTo("guidance")}><span>▤</span>指导</button>
        <button onClick={() => scrollTo("history")}><span>◷</span>历史</button>
        <button onClick={() => { setSettingsOpen(true); scrollTo("settings"); }}><span>⌁</span>设置</button>
      </nav>
    </main>
  );
}
