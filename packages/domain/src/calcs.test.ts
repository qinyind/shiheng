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
