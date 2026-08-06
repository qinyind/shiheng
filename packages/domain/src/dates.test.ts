import test from "node:test";
import assert from "node:assert/strict";
import { keyForDate, shiftDate, todayString } from "./dates.ts";

test("todayString uses yyyy-MM-dd", () => {
  assert.match(todayString(), /^\d{4}-\d{2}-\d{2}$/);
});

test("keyForDate formats a local date", () => {
  assert.equal(keyForDate(new Date(2026, 7, 6)), "2026-08-06");
});

test("shiftDate moves across month and year boundaries", () => {
  assert.equal(shiftDate("2026-08-31", 1), "2026-09-01");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
});
