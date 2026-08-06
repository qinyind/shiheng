import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "./constants.ts";
import { getRecommendation, guideForMeal, mealRole, trainingMeals } from "./plans.ts";
import type { Timing } from "./types.ts";

const timings: Timing[] = ["breakfastEarly", "breakfastLate", "beforeLunch", "afterLunch", "beforeDinner", "afterDinner", "lateNight", "none"];

test("trainingMeals only ever use real meal IDs (no breakfast-pre / lunch-post)", () => {
  for (const timing of timings) {
    const ids = trainingMeals(timing).map((m) => m.id);
    for (const id of ["breakfast", "lunch", "dinner", "snack"]) {
      assert.ok(ids.includes(id), `${timing} is missing ${id}`);
    }
    for (const id of ids) {
      assert.ok(["breakfast", "lunch", "dinner", "snack", "pre", "post"].includes(id), `${timing} has unexpected id ${id}`);
    }
  }
});

test("specific meal names are preserved after unification", () => {
  assert.ok(trainingMeals("breakfastEarly").some((m) => m.id === "breakfast" && m.name === "早饭 · 练前"));
  assert.ok(trainingMeals("breakfastLate").some((m) => m.id === "lunch" && m.name === "午饭 · 练后"));
  assert.ok(trainingMeals("beforeDinner").some((m) => m.id === "dinner" && m.name === "晚饭 · 练后"));
  assert.ok(trainingMeals("afterDinner").some((m) => m.id === "dinner" && m.name === "晚饭 · 练前"));
});

test("pre/post are only used for real extra slots around lunch", () => {
  assert.ok(trainingMeals("beforeLunch").some((m) => m.id === "pre" && m.name === "练前餐"));
  assert.ok(trainingMeals("beforeLunch").some((m) => m.id === "lunch" && m.name === "午饭 · 练后"));
  assert.ok(trainingMeals("afterLunch").some((m) => m.id === "lunch" && m.name === "午饭 · 练前"));
  assert.ok(trainingMeals("afterLunch").some((m) => m.id === "post" && m.name === "练后餐"));
});

test("mealRole infers role from meal name", () => {
  const preset = (id: string, name: string) => ({ id, name, note: "", carbShare: 0, proteinShare: 0 });
  assert.equal(mealRole(preset("pre", "练前餐")), "pre");
  assert.equal(mealRole(preset("post", "练后餐")), "post");
  assert.equal(mealRole(preset("breakfast", "早饭")), "breakfast");
  assert.equal(mealRole(preset("snack", "零食 / 夜宵")), "snack");
  assert.equal(mealRole(preset("lunch", "午饭")), "regular");
});

test("guideForMeal for the biggest post-training meal keeps its copy", () => {
  const guide = guideForMeal(trainingMeals("beforeDinner")[3], "cut", "training");
  assert.equal(guide.summary, "全天最大餐，最好练完后半小时内开始吃；先碳水和蛋白质。");
  assert.ok(guide.choices.length > 0);
  assert.ok(guide.cautions.length > 0);
});

test("getRecommendation for a pre meal suggests banana and 练前只垫碳水", () => {
  const pre = trainingMeals("beforeDinner").find((m) => m.id === "pre")!;
  const rec = getRecommendation({ carbs: 100, protein: 100, fat: 50, kcal: 1000 }, { carbs: 20, protein: 0, fat: 0, kcal: 80 }, pre);
  assert.match(rec.text, /练前只垫碳水/);
  assert.equal(rec.foodId, "banana");
  assert.equal(FOODS.find((f) => f.id === "banana")?.name, "香蕉（可食部）");
});

test("getRecommendation falls back to veggies near target", () => {
  const lunch = trainingMeals("beforeDinner").find((m) => m.id === "lunch")!;
  const rec = getRecommendation({ carbs: 100, protein: 100, fat: 50, kcal: 1000 }, { carbs: 95, protein: 95, fat: 48, kcal: 950 }, lunch);
  assert.equal(rec.foodId, "broccoli");
});

test("guideForMeal covers every role, goal and day type", () => {
  const meals = {
    pre: trainingMeals("beforeDinner").find((m) => m.id === "pre")!,
    post: trainingMeals("beforeDinner").find((m) => m.id === "dinner")!,
    breakfast: trainingMeals("beforeDinner").find((m) => m.id === "breakfast")!,
    snack: trainingMeals("beforeDinner").find((m) => m.id === "snack")!,
    regular: trainingMeals("beforeDinner").find((m) => m.id === "lunch")!,
  };
  for (const goal of ["cut", "gain"] as const) {
    for (const dayType of ["training", "rest"] as const) {
      for (const meal of Object.values(meals)) {
        const guide = guideForMeal(meal, goal, dayType);
        assert.ok(guide.summary.length > 0);
        assert.ok(guide.choices.length > 0);
        assert.ok(guide.cautions.length > 0);
      }
    }
  }
  const gainBreakfast = guideForMeal(meals.breakfast, "gain", "training");
  assert.match(gainBreakfast.cautions.join(""), /增肌方案每天还要安排约30g坚果/);
});

test("getRecommendation covers snack, over-target, protein and carb branches", () => {
  const meals = {
    snack: trainingMeals("beforeDinner").find((m) => m.id === "snack")!,
    breakfast: trainingMeals("beforeDinner").find((m) => m.id === "breakfast")!,
    post: trainingMeals("beforeDinner").find((m) => m.id === "dinner")!,
    lunch: trainingMeals("beforeDinner").find((m) => m.id === "lunch")!,
    pre: trainingMeals("beforeDinner").find((m) => m.id === "pre")!,
  };
  const T = { carbs: 100, protein: 100, fat: 50, kcal: 1000 };
  // 超支 → 无油蔬菜
  assert.equal(getRecommendation(T, { carbs: 200, protein: 200, fat: 60, kcal: 3000 }, meals.lunch).foodId, "broccoli");
  // 加餐缺蛋白 → 低糖瘦肉干；不缺 → 鸡蛋
  assert.equal(getRecommendation(T, { carbs: 0, protein: 0, fat: 0, kcal: 0 }, meals.snack).foodId, "jerky");
  assert.equal(getRecommendation({ carbs: 10, protein: 10, fat: 5, kcal: 100 }, { carbs: 0, protein: 0, fat: 0, kcal: 0 }, meals.snack).foodId, "egg");
  // 早餐缺蛋白 → 全蛋
  assert.equal(getRecommendation(T, { carbs: 0, protein: 0, fat: 0, kcal: 0 }, meals.breakfast).foodId, "egg");
  // 练后缺蛋白 → 瘦肉，文案「练后优先补足」
  const postProtein = getRecommendation(T, { carbs: 0, protein: 0, fat: 0, kcal: 0 }, meals.post);
  assert.equal(postProtein.foodId, "chicken");
  assert.match(postProtein.text, /练后优先补足/);
  // 早餐缺碳水 → 燕麦；练后缺碳水 → 米饭
  assert.equal(getRecommendation(T, { carbs: 0, protein: 100, fat: 50, kcal: 1000 }, meals.breakfast).foodId, "oats");
  assert.equal(getRecommendation(T, { carbs: 0, protein: 100, fat: 50, kcal: 1000 }, meals.post).foodId, "rice");
  // 练后接近目标 → 蔬菜；练前碳水已足 → 香蕉兜底
  const postNear = getRecommendation(T, { carbs: 95, protein: 95, fat: 48, kcal: 950 }, meals.post);
  assert.match(postNear.text, /练后餐已接近目标/);
  assert.equal(getRecommendation({ carbs: 5, protein: 0, fat: 0, kcal: 20 }, { carbs: 0, protein: 0, fat: 0, kcal: 0 }, meals.pre).foodId, "banana");
});
