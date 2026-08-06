import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROFILE, EARLY_REST_MEALS, FOODS, PLAN_OPTIONS, REST_MEALS } from "./constants.ts";

test("PLAN_OPTIONS has the 15 numbered plans", () => {
  assert.equal(PLAN_OPTIONS.length, 15);
  assert.ok(PLAN_OPTIONS.some((p) => p.label === "5 减脂 · 晚饭前练"));
  assert.ok(PLAN_OPTIONS.some((p) => p.label === "13 增肌 · 晚饭前练"));
  assert.ok(PLAN_OPTIONS.every((p) => p.label.startsWith(`${PLAN_OPTIONS.indexOf(p) + 1} `)));
});

test("rest meals share only real meal IDs", () => {
  const ids = [...REST_MEALS, ...EARLY_REST_MEALS].map((m) => m.id);
  assert.deepEqual([...new Set(ids)].sort(), ["breakfast", "dinner", "lunch", "snack"]);
});

test("FOODS contains every id referenced by recommendations", () => {
  const ids = new Set(FOODS.map((f) => f.id));
  for (const id of ["rice", "banana", "chicken", "oats", "jerky", "egg", "broccoli"]) {
    assert.ok(ids.has(id), `missing built-in food ${id}`);
  }
});

test("DEFAULT_PROFILE is a complete profile", () => {
  assert.equal(DEFAULT_PROFILE.goal, "cut");
  assert.equal(DEFAULT_PROFILE.timing, "beforeDinner");
});
