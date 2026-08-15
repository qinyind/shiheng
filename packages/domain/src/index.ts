export type {
  AiEstimate,
  AiIngredient,
  DayLog,
  DayMeta,
  DayType,
  Food,
  FoodEntry,
  Goal,
  Level,
  Macro,
  MealGuide,
  MealPreset,
  MealRole,
  Profile,
  Sex,
  SyncStatus,
  Timing,
} from "./types.ts";

export { DEFAULT_PROFILE, EARLY_REST_MEALS, FOODS, PLAN_OPTIONS, REST_MEALS } from "./constants.ts";
export { getRecommendation, guideForMeal, mealRole, trainingMeals } from "./plans.ts";
export { calculate, macroForFood, strengthCalories, sumMacros, targetForMeal, targetsFor } from "./calcs.ts";
export { foodNameKey, matchingFood } from "./matching.ts";
export { round } from "./numbers.ts";
export { keyForDate, shiftDate, todayString } from "./dates.ts";
export {
  LEGACY_MEAL_ID_MAP,
  fromWebState,
  hasLegacyMealIDs,
  legacyMealIDMapFor,
  maybeMigrateEntries,
  migrateDayLog,
  migrateDayLogs,
  migrateEntries,
  migrateMetas,
  normalizeStoredState,
} from "./migrations.ts";
export type { WebState } from "./migrations.ts";
export { merge } from "./sync.ts";
export type { RemoteStateEnvelope, SavedCustomFood, SavedEntry, SavedState } from "./sync.ts";
export { applyIngredientEdit } from "./ai.ts";
export type { AiIngredientKey } from "./ai.ts";
