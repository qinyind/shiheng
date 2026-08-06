import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE } from "./constants.ts";
import { LEGACY_MEAL_ID_MAP, fromWebState, legacyMealIDMapFor, migrateDayLogs, migrateEntries, migrateMetas, normalizeStoredState } from "./migrations.ts";
import type { DayLog, FoodEntry, MealPreset } from "./types.ts";

const entry = (id: string): FoodEntry => ({ id, foodId: "rice", name: "熟米饭", grams: 100, per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } });

test("LEGACY_MEAL_ID_MAP maps positioned ids to real meals", () => {
  assert.equal(LEGACY_MEAL_ID_MAP["breakfast-pre"], "breakfast");
  assert.equal(LEGACY_MEAL_ID_MAP["lunch-post"], "lunch");
  assert.equal(LEGACY_MEAL_ID_MAP["dinner-post"], "dinner");
  assert.equal(LEGACY_MEAL_ID_MAP["dinner-pre"], "dinner");
});

test("migrateDayLogs merges legacy ids into real meals", () => {
  const logs: Record<string, DayLog> = {
    "2026-08-06": { "breakfast-pre": [entry("a")], "lunch-post": [entry("b")] },
  };
  const migrated = migrateDayLogs(logs);
  assert.deepEqual(Object.keys(migrated["2026-08-06"]).sort(), ["breakfast", "lunch"]);
  assert.equal(migrated["2026-08-06"].breakfast.length, 1);
});

test("migrateMetas rewrites meal ids in snapshot meals", () => {
  const metas = {
    "2026-08-06": {
      dayType: "training" as const,
      target: { carbs: 1, protein: 1, fat: 1, kcal: 1 },
      planLabel: "5 减脂 · 晚饭前练",
      weight: 73,
      meals: [{ id: "dinner-post", name: "晚饭", note: "", carbShare: 0.35, proteinShare: 0.3 }],
    },
  };
  assert.equal(migrateMetas(metas)["2026-08-06"].meals[0].id, "dinner");
});

test("legacyMealIDMapFor covers every timing and falls back a/c", () => {
  assert.equal(legacyMealIDMapFor("breakfastEarly").a, "breakfast");
  assert.equal(legacyMealIDMapFor("breakfastLate").b, "lunch");
  assert.equal(legacyMealIDMapFor("beforeLunch").post, "lunch");
  assert.equal(legacyMealIDMapFor("beforeDinner").post, "dinner");
  assert.equal(legacyMealIDMapFor("afterDinner").pre, "dinner");
  assert.equal(legacyMealIDMapFor("beforeLunch").a, "breakfast");
  assert.equal(legacyMealIDMapFor("beforeLunch").c, "dinner");
});

test("migrateEntries maps native legacy meal ids by current timing", () => {
  const entries = [
    { id: "1", dateKey: "2026-08-06", mealID: "a", foodName: "早饭", grams: 100, per100: { carbs: 1, protein: 1, fat: 1, kcal: 1 } },
    { id: "2", dateKey: "2026-08-06", mealID: "other", foodName: "午饭", grams: 100, per100: { carbs: 1, protein: 1, fat: 1, kcal: 1 } },
  ];
  const migrated = migrateEntries(entries, "beforeDinner");
  assert.equal(migrated[0].mealID, "breakfast");
  assert.equal(migrated[1].mealID, "lunch");
});

test("fromWebState flattens logs and metas into SavedState", () => {
  const meal: MealPreset = { id: "breakfast", name: "早饭", note: "", carbShare: 0.2, proteinShare: 0.2 };
  const state = fromWebState({
    profile: DEFAULT_PROFILE,
    logs: { "2026-08-06": { breakfast: [entry("a")] } },
    metas: {
      "2026-08-06": { dayType: "rest", target: { carbs: 1, protein: 1, fat: 1, kcal: 1 }, planLabel: "5 减脂 · 晚饭前练", weight: 73, meals: [meal] },
    },
  });
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].dateKey, "2026-08-06");
  assert.equal(state.entries[0].mealID, "breakfast");
  assert.equal(state.entries[0].foodName, "熟米饭");
  assert.equal(state.dayTypes["2026-08-06"], "rest");
});

test("fromWebState migrates legacy positioned meal ids", () => {
  const state = fromWebState({ profile: DEFAULT_PROFILE, logs: { "2026-08-06": { "breakfast-pre": [entry("a")] } } });
  assert.equal(state.entries[0].mealID, "breakfast");
});

test("normalizeStoredState distinguishes web and native shapes", () => {
  assert.equal(normalizeStoredState({ profile: DEFAULT_PROFILE, logs: {} })?.kind, "web");
  assert.equal(
    normalizeStoredState({ profile: DEFAULT_PROFILE, entries: [], customFoods: [], dayTypes: {}, deletedEntryIDs: [], deletedFoodIDs: [] })?.kind,
    "native",
  );
  assert.equal(normalizeStoredState(null), null);
});
