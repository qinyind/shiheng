import type { FoodEntry, Level, Macro, MealPreset, Profile, Sex, DayType } from "./types.ts";

export function strengthCalories(sex: Sex, level: Level) {
  const table = sex === "male" ? [150, 200, 250] : [100, 150, 200];
  return table[level === "beginner" ? 0 : level === "intermediate" ? 1 : 2];
}

export function calculate(profile: Profile) {
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

// 按日类型组合当日目标（与 SwiftUI MealStore.targets(for:) 一致）。
export function targetsFor(profile: Profile, type: DayType): Macro {
  const { sex, age, height, weight, goal, cardioDaily, level, timing } = profile;
  const bmr = weight * 9.99 + height * 6.25 - age * 4.92 + (sex === "male" ? 5 : -161);
  const base = bmr / 0.7;
  const strength = timing === "none" ? 0 : strengthCalories(sex, level);
  const maintenance = base + cardioDaily + (type === "training" ? strength : 0);
  const factor = goal === "cut" ? 0.64 : 0.84;
  const fat = goal === "cut" ? (weight >= 120 ? 70 : sex === "male" ? 60 : 50) : sex === "male" ? 80 : 70;
  const kcal = maintenance * factor;
  const remaining = Math.max(0, kcal - fat * 9);
  const carbRatio = goal === "cut" ? 0.64 : 0.7;
  const protein = (remaining * (1 - carbRatio)) / 4;
  const trainingCarbs = (remaining * carbRatio) / 4;
  const restCarbs = Math.max(0, (kcal - fat * 9 - protein * 4) / 4);
  const carbs = type === "training" ? trainingCarbs : restCarbs;
  return { carbs, protein, fat, kcal };
}

export function macroForFood(entry: FoodEntry): Macro {
  const scale = entry.grams / 100;
  return {
    carbs: entry.per100.carbs * scale,
    protein: entry.per100.protein * scale,
    fat: entry.per100.fat * scale,
    kcal: entry.per100.kcal * scale,
  };
}

export function sumMacros(entries: FoodEntry[]): Macro {
  return entries.reduce(
    (sum, entry) => {
      const m = macroForFood(entry);
      return { carbs: sum.carbs + m.carbs, protein: sum.protein + m.protein, fat: sum.fat + m.fat, kcal: sum.kcal + m.kcal };
    },
    { carbs: 0, protein: 0, fat: 0, kcal: 0 },
  );
}

// 每餐目标：与 Web 版 MealCard 内联公式、SwiftUI MealStore.target(for:) 一致。
export function targetForMeal(dailyTarget: Macro, meal: MealPreset): Macro {
  return {
    carbs: dailyTarget.carbs * meal.carbShare,
    protein: dailyTarget.protein * meal.proteinShare,
    fat: dailyTarget.fat * meal.proteinShare,
    kcal: dailyTarget.kcal * ((meal.carbShare + meal.proteinShare) / 2),
  };
}
