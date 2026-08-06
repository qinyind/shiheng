import type { DayType, Macro, Profile } from "./types.ts";

// 与 SwiftUI FoodEntry 对应的 canonical 条目（dateKey + mealID + per100）。
export type SavedEntry = {
  id: string;
  dateKey: string;
  mealID: string;
  foodName: string;
  grams: number;
  per100: Macro;
};

// 与 SwiftUI Food 对应的自定义食材（per100 内聚）。
export type SavedCustomFood = {
  id: string;
  name: string;
  category: string;
  per100: Macro;
};

// canonical 存储/同步状态（与 SwiftUI SavedState 对齐；tombstone 用删除 ID 集合）。
export type SavedState = {
  profile: Profile;
  entries: SavedEntry[];
  customFoods: SavedCustomFood[];
  dayTypes: Record<string, DayType>;
  deletedEntryIDs: string[];
  deletedFoodIDs: string[];
};

// 服务端同步信封（/v1/sync 的 GET/PUT 返回；version 乐观锁）。
export type RemoteStateEnvelope = {
  version: number;
  state: SavedState | null;
  updatedAt: string | null;
};

// 与 SwiftUI MealStore.merge(local:remote:) 一致：
// profile 本地赢；entries/customFoods 按 id 合并、重复取 local、滤 tombstone；
// dayTypes 同 key 取 local；tombstone 取并集。
export function merge(local: SavedState, remote: SavedState): SavedState {
  const entryTombstones = new Set([...local.deletedEntryIDs, ...remote.deletedEntryIDs]);
  const foodTombstones = new Set([...local.deletedFoodIDs, ...remote.deletedFoodIDs]);
  const entriesById = new Map<string, SavedEntry>();
  for (const entry of [...remote.entries, ...local.entries]) entriesById.set(entry.id, entry);
  const entries = [...entriesById.values()]
    .filter((entry) => !entryTombstones.has(entry.id))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const foodsById = new Map<string, SavedCustomFood>();
  for (const food of [...remote.customFoods, ...local.customFoods]) foodsById.set(food.id, food);
  const foods = [...foodsById.values()].filter((food) => !foodTombstones.has(food.id));
  return {
    profile: local.profile,
    entries,
    customFoods: foods,
    dayTypes: { ...remote.dayTypes, ...local.dayTypes },
    deletedEntryIDs: [...entryTombstones],
    deletedFoodIDs: [...foodTombstones],
  };
}
