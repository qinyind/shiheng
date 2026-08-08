import test from "node:test";
import assert from "node:assert/strict";
import { calculate, macroForFood, strengthCalories, sumMacros, targetForMeal, targetsFor } from "./calcs.ts";
import { DEFAULT_PROFILE } from "./constants.ts";
import type { FoodEntry } from "./types.ts";

test("calculate produces sane numbers for the default profile", () => {
  const calc = calculate(DEFAULT_PROFILE);
  assert.ok(calc.bmr > 1500 && calc.bmr < 2000);
  assert.ok(calc.trainingKcal > calc.restKcal);
  assert.ok(calc.protein > 100);
  assert.ok(calc.trainingCarbs > 0);
});

test("strengthCalories depends on sex and level", () => {
  assert.equal(strengthCalories("male", "beginner"), 150);
  assert.equal(strengthCalories("male", "advanced"), 250);
  assert.equal(strengthCalories("female", "beginner"), 100);
  assert.equal(strengthCalories("female", "advanced"), 200);
});

test("targetsFor composes training/rest targets", () => {
  const calc = calculate(DEFAULT_PROFILE);
  const training = targetsFor(DEFAULT_PROFILE, "training");
  const rest = targetsFor(DEFAULT_PROFILE, "rest");
  // 训练档与 Web calculate 完全一致
  assert.equal(training.carbs, calc.trainingCarbs);
  assert.equal(training.protein, calc.protein);
  assert.equal(training.kcal, calc.trainingKcal);
  assert.equal(training.fat, calc.fat);
  // 休息档：kcal 一致，但 carbs 用休息档自身的 protein 重算（Swift 语义），与 Web 的 restCarbs 有差异
  assert.equal(rest.kcal, calc.restKcal);
  assert.ok(training.kcal > rest.kcal);
  assert.ok(training.carbs > rest.carbs);
});

test("macroForFood scales per100 by grams", () => {
  const entry: FoodEntry = { id: "1", foodId: "rice", name: "熟米饭", grams: 200, per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } };
  assert.deepEqual(macroForFood(entry), { carbs: 60, protein: 5.2, fat: 0.6, kcal: 266 });
});

test("sumMacros totals multiple entries", () => {
  const entries: FoodEntry[] = [
    { id: "1", foodId: "rice", name: "熟米饭", grams: 100, per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } },
    { id: "2", foodId: "chicken", name: "熟鸡胸肉", grams: 100, per100: { carbs: 0, protein: 25, fat: 4, kcal: 136 } },
  ];
  assert.deepEqual(sumMacros(entries), { carbs: 30, protein: 27.6, fat: 4.3, kcal: 269 });
});

test("targetForMeal splits daily target by carb/protein share", () => {
  const target = { carbs: 200, protein: 150, fat: 60, kcal: 1800 };
  const meal = { id: "lunch", name: "午饭", note: "", carbShare: 0.35, proteinShare: 0.3 };
  const result = targetForMeal(target, meal);
  assert.equal(result.carbs, 70);
  assert.equal(result.protein, 45);
  assert.equal(result.fat, 18);
  assert.ok(Math.abs(result.kcal - 585) < 1e-9);
});

test("calculate handles female gain profile with heavy weight", () => {
  const profile = { ...DEFAULT_PROFILE, sex: "female" as const, goal: "gain" as const, weight: 130 };
  const calc = calculate(profile);
  // gain → factor 0.84 / carbRatio 0.7；heavy female → fat 70
  assert.equal(calc.fat, 70);
  assert.equal(calc.strength, strengthCalories("female", "beginner"));
  assert.equal(calc.trainingKcal, calc.trainMaintenance * 0.84);
  assert.ok(calc.trainingCarbs > 0);
  // targetsFor 同 profile 训练档与 calculate 一致
  assert.equal(targetsFor(profile, "training").kcal, calc.trainingKcal);
  assert.equal(targetsFor(profile, "rest").fat, 70);
});

test("calculate with timing none yields zero strength and equal maintenance", () => {
  const calc = calculate({ ...DEFAULT_PROFILE, timing: "none" });
  assert.equal(calc.strength, 0);
  assert.equal(calc.trainMaintenance, calc.restMaintenance);
  assert.equal(targetsFor({ ...DEFAULT_PROFILE, timing: "none" }, "training").kcal, targetsFor({ ...DEFAULT_PROFILE, timing: "none" }, "rest").kcal);
});

test("strengthCalories intermediate levels", () => {
  assert.equal(strengthCalories("male", "intermediate"), 200);
  assert.equal(strengthCalories("female", "intermediate"), 150);
});

test("tiny profile clamps remaining kcal to zero", () => {
  const tiny = { sex: "female" as const, age: 80, height: 120, weight: 25, goal: "cut" as const, timing: "none" as const, level: "beginner" as const, cardioDaily: 0 };
  const calc = calculate(tiny);
  assert.equal(calc.protein, 0);
  assert.equal(calc.trainingCarbs, 0);
  const rest = targetsFor(tiny, "rest");
  assert.equal(rest.protein, 0);
  assert.equal(rest.carbs, 0);
});

test("cut profile at heavy weight caps fat at 70", () => {
  const profile = { ...DEFAULT_PROFILE, weight: 130 };
  assert.equal(calculate(profile).fat, 70);
  assert.equal(targetsFor(profile, "training").fat, 70);
});

test("gain male profile uses fat 80", () => {
  const profile = { ...DEFAULT_PROFILE, goal: "gain" as const };
  assert.equal(calculate(profile).fat, 80);
  assert.equal(targetsFor(profile, "rest").fat, 80);
});
