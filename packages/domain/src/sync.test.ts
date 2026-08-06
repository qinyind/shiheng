import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE } from "./constants.ts";
import { merge } from "./sync.ts";
import type { SavedEntry, SavedState } from "./sync.ts";

const entry = (id: string, dateKey = "2026-08-06"): SavedEntry => ({ id, dateKey, mealID: "breakfast", foodName: "熟米饭", grams: 100, per100: { carbs: 30, protein: 2.6, fat: 0.3, kcal: 133 } });

const state = (overrides: Partial<SavedState> = {}): SavedState => ({
  profile: DEFAULT_PROFILE,
  entries: [],
  customFoods: [],
  dayTypes: {},
  deletedEntryIDs: [],
  deletedFoodIDs: [],
  ...overrides,
});

test("merge keeps local profile", () => {
  const local = state({ profile: { ...DEFAULT_PROFILE, weight: 80 } });
  const remote = state({ profile: { ...DEFAULT_PROFILE, weight: 70 } });
  assert.equal(merge(local, remote).profile.weight, 80);
});

test("merge unions entries, prefers local on id conflict, sorts by dateKey", () => {
  const local = state({ entries: [entry("dup"), entry("1", "2026-08-05")] });
  const remote = state({ entries: [entry("2"), entry("dup", "2026-08-06")] });
  const merged = merge(local, remote);
  assert.deepEqual(merged.entries.map((e) => e.id).sort(), ["1", "2", "dup"]);
  assert.equal(merged.entries.find((e) => e.id === "dup")!.foodName, "熟米饭");
});

test("merge drops tombstoned entries and unions tombstones", () => {
  const local = state({ entries: [entry("a")], deletedEntryIDs: ["b"] });
  const remote = state({ entries: [entry("b")], deletedEntryIDs: ["c"] });
  const merged = merge(local, remote);
  assert.deepEqual(merged.entries.map((e) => e.id), ["a"]);
  assert.deepEqual(merged.deletedEntryIDs.sort(), ["b", "c"]);
});

test("merge keeps local dayTypes on key conflict", () => {
  const local = state({ dayTypes: { "2026-08-06": "training" } });
  const remote = state({ dayTypes: { "2026-08-06": "rest" } });
  assert.equal(merge(local, remote).dayTypes["2026-08-06"], "training");
});

test("merge unions custom foods preferring local", () => {
  const local = state({
    customFoods: [{ id: "f1", name: "我的鸡胸", category: "我的食材", per100: { carbs: 0, protein: 25, fat: 4, kcal: 136 } }],
  });
  const remote = state({
    customFoods: [{ id: "f1", name: "远程鸡胸", category: "我的食材", per100: { carbs: 0, protein: 20, fat: 4, kcal: 120 } }],
  });
  assert.equal(merge(local, remote).customFoods[0].name, "我的鸡胸");
});

test("merge drops tombstoned custom foods", () => {
  const local = state({ customFoods: [{ id: "f1", name: "我的鸡胸", category: "我的食材", per100: { carbs: 0, protein: 25, fat: 4, kcal: 136 } }] });
  const remote = state({ deletedFoodIDs: ["f1"] });
  assert.equal(merge(local, remote).customFoods.length, 0);
});
