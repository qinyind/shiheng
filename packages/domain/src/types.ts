export type Sex = "male" | "female";
export type Goal = "cut" | "gain";
export type Level = "beginner" | "intermediate" | "advanced";
export type Timing =
  | "breakfastEarly"
  | "breakfastLate"
  | "beforeLunch"
  | "afterLunch"
  | "beforeDinner"
  | "afterDinner"
  | "lateNight"
  | "none";
export type DayType = "training" | "rest";

export type Profile = {
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  goal: Goal;
  timing: Timing;
  level: Level;
  cardioDaily: number;
};

export type Macro = { carbs: number; protein: number; fat: number; kcal: number };
export type MealPreset = {
  id: string;
  name: string;
  note: string;
  carbShare: number;
  proteinShare: number;
};
export type Food = Macro & { id: string; name: string; category: string; unit?: string };
export type AiIngredient = Macro & { name: string; grams: number };
export type AiEstimate = Macro & {
  name: string;
  grams: number;
  confidence: "low" | "medium" | "high";
  note: string;
  ingredients: AiIngredient[];
};
// Web 端逐条记录的条目形状（page.tsx 当前数据模型；native/SavedState 用 sync.ts 的 SavedEntry）
export type FoodEntry = {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  per100: Macro;
};
export type DayLog = Record<string, FoodEntry[]>;
export type DayMeta = {
  dayType: DayType;
  target: Macro;
  planLabel: string;
  weight: number;
  meals: MealPreset[];
};
export type SyncStatus = "connecting" | "saving" | "synced" | "local";
export type MealRole = "breakfast" | "regular" | "pre" | "post" | "snack";
export type MealGuide = { summary: string; choices: string[]; cautions: string[] };
