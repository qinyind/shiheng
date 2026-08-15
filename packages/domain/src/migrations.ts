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
// 注意：pre/post 永不作为旧 ID 的 key——它们是当前方案里的合法餐次 ID（练前/练后餐），
// 旧的位置 pre/post 一并保留原 ID，避免任何对当前数据的静默改写。
export function legacyMealIDMapFor(timing: Timing): Record<string, string> {
  let map: Record<string, string>;
  switch (timing) {
    case "breakfastEarly": map = { a: "breakfast", b: "post", c: "lunch", d: "dinner" }; break;
    case "breakfastLate": map = { a: "breakfast", b: "lunch", c: "dinner" }; break;
    case "beforeLunch": map = { other: "dinner" }; break;
    case "afterLunch": map = { other: "dinner" }; break;
    case "beforeDinner": map = { other: "lunch" }; break;
    case "afterDinner": map = { other: "lunch" }; break;
    case "lateNight": map = { a: "breakfast", b: "lunch", c: "dinner", d: "post" }; break;
    case "none": map = {}; break;
  }
  // 当前方案无法判定的旧 ID，用跨方案稳定的兜底映射（覆盖 a/b/c/d/other 全集合，
  // 保证任何 timing 下旧 ID 一次迁移完毕、不残留，门按内容自动熄灭）。
  if (map.a == null) map.a = "breakfast";
  if (map.b == null) map.b = "lunch";
  if (map.c == null) map.c = "dinner";
  if (map.d == null) map.d = "dinner";
  if (map.other == null) map.other = "lunch";
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

// ── 内容门控：旧版迁移只在存在真正的旧餐次 ID 时执行一次 ──────────────
// 旧版（SwiftUI/Web 早期）用位置 ID：a/b/c/d、other、pre、post、breakfast-pre 等；
// 而当前方案里 pre/post 同时是合法餐次 ID（练前/练后餐，见 plans.ts trainingMeals）。
// 若按当前 timing 无条件 migrateEntries，会把用户已记录的 pre/post 条目静默改到
// 别的餐（数据丢失级 bug）。
//
// 两个配套保证：
// 1. legacyMealIDMapFor 只用 a/b/c/d/other 作 key，永不把 pre/post 当旧 ID——
//    迁移永远不触碰当前合法的 pre/post 条目（含混合旧数据场景）。
// 2. 兜底映射覆盖 a/b/c/d/other 全集合（a→breakfast、b→lunch、c/d→dinner、other→lunch），
//    任何 timing 下旧 ID 都一次迁移完毕、不残留；因此只在存在铁定旧 ID 时才迁移，
//    跑完后按内容自动熄灭（无需持久化标记）。
//
// 残余限制：已被旧代码改写为 dinner/lunch 的条目无法恢复，本次只止损。
const CURRENT_MEAL_IDS = new Set(["breakfast", "lunch", "dinner", "snack", "pre", "post"]);

export function hasLegacyMealIDs(entries: SavedEntry[]): boolean {
  return entries.some((entry) => !CURRENT_MEAL_IDS.has(entry.mealID));
}

export function maybeMigrateEntries(entries: SavedEntry[], timing: Timing): SavedEntry[] {
  return hasLegacyMealIDs(entries) ? migrateEntries(entries, timing) : entries;
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
