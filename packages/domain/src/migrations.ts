import { DEFAULT_PROFILE } from "./constants.ts";
import type { SavedEntry, SavedState } from "./sync.ts";
import type { DayLog, DayMeta, DayType, Food, Profile, Timing } from "./types.ts";

// 旧版本里真实餐次用了带练前/练后位置的 ID，导致切换训练日/休息日时记录互相不可见。
// 统一为真实餐次 ID（breakfast/lunch/dinner）后，把旧数据一次性迁移过去。
export const LEGACY_MEAL_ID_MAP: Record<string, string> = {
  "breakfast-pre": "breakfast",
  "lunch-post": "lunch",
  "dinner-post": "dinner",
  "dinner-pre": "dinner",
};

export function migrateDayLog(dayLog: DayLog): DayLog {
  return Object.entries(dayLog).reduce<DayLog>((next, [mealId, entries]) => {
    const target = LEGACY_MEAL_ID_MAP[mealId] ?? mealId;
    next[target] = [...(next[target] || []), ...entries];
    return next;
  }, {});
}

export function migrateDayLogs(logs: Record<string, DayLog>): Record<string, DayLog> {
  return Object.fromEntries(
    Object.entries(logs).map(([recordDate, dayLog]) => [recordDate, migrateDayLog(dayLog)]),
  );
}

export function migrateMetas(metas: Record<string, DayMeta>): Record<string, DayMeta> {
  return Object.fromEntries(
    Object.entries(metas).map(([recordDate, meta]) => [
      recordDate,
      {
        ...meta,
        meals: meta.meals.map((meal) => ({
          ...meal,
          id: LEGACY_MEAL_ID_MAP[meal.id] ?? meal.id,
        })),
      },
    ]),
  );
}

// SwiftUI 侧的旧餐次映射：旧版本训练日用 a/b/c/d、other、pre、post，按当前方案映射到真实餐次。
export function legacyMealIDMapFor(timing: Timing): Record<string, string> {
  let map: Record<string, string>;
  switch (timing) {
    case "breakfastEarly": map = { a: "breakfast", b: "post", c: "lunch", d: "dinner" }; break;
    case "breakfastLate": map = { a: "breakfast", b: "lunch", c: "dinner" }; break;
    case "beforeLunch": map = { post: "lunch", other: "dinner" }; break;
    case "afterLunch": map = { pre: "lunch", other: "dinner" }; break;
    case "beforeDinner": map = { other: "lunch", post: "dinner" }; break;
    case "afterDinner": map = { pre: "dinner", other: "lunch" }; break;
    case "lateNight": map = { a: "breakfast", b: "lunch", c: "dinner", d: "post" }; break;
    case "none": map = {}; break;
  }
  // 当前方案无法判定的旧 ID，用跨方案稳定的兜底映射。
  if (map.a == null) map.a = "breakfast";
  if (map.c == null) map.c = "dinner";
  return map;
}

export function migrateEntries(entries: SavedEntry[], timing: Timing): SavedEntry[] {
  const map = legacyMealIDMapFor(timing);
  return entries.map((entry) => {
    const target = map[entry.mealID];
    if (!target) return entry;
    return { ...entry, mealID: target };
  });
}

// Web 端当前持久化形状（localStorage meal-meter-state-v1）。
export type WebState = {
  profile?: Profile;
  logs?: Record<string, DayLog>;
  metas?: Record<string, DayMeta>;
  customFoods?: Food[];
};

// 把 Web 的 {profile, logs, metas, customFoods} 扁平化为 canonical SavedState。
// metas[date].dayType 折进 dayTypes，其余快照字段（target/planLabel/weight/meals）丢弃，
// 与 iOS 行为统一：历史日期目标随当前 profile 重算。
export function fromWebState(webState: WebState): SavedState {
  const profile = webState.profile ?? DEFAULT_PROFILE;
  const logs = migrateDayLogs(webState.logs ?? {});
  const metas = webState.metas ?? {};
  const entries: SavedEntry[] = [];
  const dayTypes: Record<string, DayType> = {};
  for (const [recordDate, dayLog] of Object.entries(logs)) {
    dayTypes[recordDate] = metas[recordDate]?.dayType ?? "training";
    for (const [mealID, items] of Object.entries(dayLog)) {
      for (const item of items) {
        entries.push({
          id: item.id,
          dateKey: recordDate,
          mealID,
          foodName: item.name,
          grams: item.grams,
          per100: item.per100,
        });
      }
    }
  }
  const customFoods = (webState.customFoods ?? []).map((food) => ({
    id: food.id,
    name: food.name,
    category: food.category,
    per100: { carbs: food.carbs, protein: food.protein, fat: food.fat, kcal: food.kcal },
  }));
  return { profile, entries, customFoods, dayTypes, deletedEntryIDs: [], deletedFoodIDs: [] };
}

// 识别存储里的旧 Web 形状还是 native canonical 形状。
export function normalizeStoredState(raw: unknown): { kind: "web" | "native"; state: SavedState } | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.entries) && record.profile) {
    return { kind: "native", state: record as unknown as SavedState };
  }
  if (record.profile && record.logs) {
    return { kind: "web", state: fromWebState(record as unknown as WebState) };
  }
  return null;
}
