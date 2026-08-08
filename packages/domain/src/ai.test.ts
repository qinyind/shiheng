import test from "node:test";
import assert from "node:assert/strict";
import { applyIngredientEdit } from "./ai.ts";
import type { AiIngredient } from "./types.ts";

const ingredient: AiIngredient = { name: "熟米饭", grams: 200, carbs: 60, protein: 5.2, fat: 0.6, kcal: 266 };

test("grams edit scales macros proportionally", () => {
  const next = applyIngredientEdit(ingredient, "grams", 100);
  assert.equal(next.grams, 100);
  assert.equal(next.carbs, 30);
  assert.equal(next.kcal, 133);
});

test("macro edit recalculates kcal", () => {
  const next = applyIngredientEdit(ingredient, "carbs", 80);
  assert.equal(next.kcal, round(80 * 4 + 5.2 * 4 + 0.6 * 9, 1));
});

test("name edit updates name only", () => {
  assert.equal(applyIngredientEdit(ingredient, "name", "糙米饭").name, "糙米饭");
  assert.equal(applyIngredientEdit(ingredient, "name", "糙米饭").grams, 200);
});

test("negative or empty numeric input clamps to zero", () => {
  const next = applyIngredientEdit(ingredient, "grams", -10);
  assert.equal(next.grams, 0);
  assert.equal(next.carbs, 0);
});

test("non-numeric value falls through to zero", () => {
  const next = applyIngredientEdit(ingredient, "grams", "abc");
  assert.equal(next.grams, 0);
  assert.equal(next.carbs, 0);
});

test("grams edit with zero base grams keeps ratio 1", () => {
  const zero = { name: "未知食物", grams: 0, carbs: 0, protein: 0, fat: 0, kcal: 0 };
  const next = applyIngredientEdit(zero, "grams", 50);
  assert.equal(next.grams, 50);
  assert.equal(next.carbs, 0);
  assert.equal(next.kcal, 0);
});

test("kcal edit updates kcal without recalculating macros", () => {
  const next = applyIngredientEdit(ingredient, "kcal", 300);
  assert.equal(next.kcal, 300);
  assert.equal(next.carbs, 60);
});

test("protein and fat edits recalculate kcal", () => {
  const p = applyIngredientEdit(ingredient, "protein", 20);
  assert.equal(p.kcal, round(60 * 4 + 20 * 4 + 0.6 * 9, 1));
  const f = applyIngredientEdit(ingredient, "fat", 10);
  assert.equal(f.kcal, round(60 * 4 + 5.2 * 4 + 10 * 9, 1));
});

function round(value: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
