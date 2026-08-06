import test from "node:test";
import assert from "node:assert/strict";
import { FOODS } from "./constants.ts";
import { foodNameKey, matchingFood } from "./matching.ts";

test("foodNameKey strips descriptors and punctuation", () => {
  assert.equal(foodNameKey("熟米饭"), "米饭");
  assert.equal(foodNameKey("香蕉（可食部）"), "香蕉");
  assert.equal(foodNameKey("一般熟瘦肉"), "瘦肉");
});

test("matchingFood finds built-in foods by normalized key", () => {
  assert.equal(matchingFood("低糖瘦肉干", FOODS)?.id, "jerky");
  assert.equal(matchingFood("香蕉", FOODS)?.id, "banana");
  assert.equal(matchingFood("苹果（可食部）", FOODS)?.id, "apple");
});

test("matchingFood returns undefined for unknown foods", () => {
  assert.equal(matchingFood("油炸臭豆腐", FOODS), undefined);
});
