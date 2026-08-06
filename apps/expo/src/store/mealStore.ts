import { create } from "zustand";
import {
  DEFAULT_PROFILE,
  FOODS,
  REST_MEALS,
  calculate,
  foodNameKey,
  merge,
  migrateEntries,
  normalizeStoredState,
  targetsFor,
  todayString,
  trainingMeals,
  type AiEstimate,
  type DayType,
  type Goal,
  type Macro,
  type MealPreset,
  type Profile,
  type SavedCustomFood,
  type SavedEntry,
  type SavedState,
  type Timing,
} from "@diet/domain";
import * as ServerAPI from "../api/serverClient";
import { SERVER_URL_KEY, STATE_KEY, WEB_STATE_KEY, jsonStore, tokenStore } from "../api/persist";

export type SyncState = "local" | "syncing" | "synced" | "error";

// 本地 id 生成：与 Web 版 Date.now()+随机数 一致，够用即可。
export function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function macroForSaved(entry: SavedEntry): Macro {
  const scale = entry.grams / 100;
  return {
    carbs: entry.per100.carbs * scale,
    protein: entry.per100.protein * scale,
    fat: entry.per100.fat * scale,
    kcal: entry.per100.kcal * scale,
  };
}

export function sumSaved(entries: SavedEntry[]): Macro {
  return entries.reduce(
    (sum, entry) => {
      const macro = macroForSaved(entry);
      return { carbs: sum.carbs + macro.carbs, protein: sum.protein + macro.protein, fat: sum.fat + macro.fat, kcal: sum.kcal + macro.kcal };
    },
    { carbs: 0, protein: 0, fat: 0, kcal: 0 },
  );
}

export function per100For(grams: number, macros: Macro): Macro {
  const scale = 100 / Math.max(grams, 0.1);
  return {
    carbs: macros.carbs * scale,
    protein: macros.protein * scale,
    fat: macros.fat * scale,
    kcal: macros.kcal * scale,
  };
}

function snapshotState(state: {
  profile: Profile;
  entries: SavedEntry[];
  customFoods: SavedCustomFood[];
  dayTypes: Record<string, DayType>;
  deletedEntryIDs: string[];
  deletedFoodIDs: string[];
}): SavedState {
  return {
    profile: state.profile,
    entries: state.entries,
    customFoods: state.customFoods,
    dayTypes: state.dayTypes,
    deletedEntryIDs: state.deletedEntryIDs,
    deletedFoodIDs: state.deletedFoodIDs,
  };
}

type PersistedState = {
  profile: Profile;
  entries: SavedEntry[];
  customFoods: SavedCustomFood[];
  dayTypes: Record<string, DayType>;
  deletedEntryIDs: string[];
  deletedFoodIDs: string[];
};

export type MealStoreState = PersistedState & {
  serverURL: string;
  selectedDate: string;
  syncState: SyncState;
  syncMessage: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setDate: (date: string) => void;
  setDayType: (type: DayType) => void;
  updateProfile: (key: keyof Profile, value: Profile[keyof Profile]) => void;
  changePlan: (goal: Goal, timing: Timing) => void;
  addFood: (food: { id: string; name: string; category: string; per100: Macro }, grams: number, mealID: string) => void;
  removeEntry: (id: string) => void;
  clearDay: () => void;
  addCustomFood: (name: string, category: string, per100: Macro) => void;
  removeCustomFood: (id: string) => void;
  addEstimate: (estimate: AiEstimate, mealID: string, saveFlags: boolean[]) => void;
  pair: (serverURL: string, pairingCode: string) => Promise<void>;
  disconnectServer: () => Promise<void>;
  syncNow: () => Promise<void>;
};

export const useMealStore = create<MealStoreState>((set, get) => {
  function applyState(state: SavedState) {
    const tombstonedEntries = new Set(state.deletedEntryIDs);
    const tombstonedFoods = new Set(state.deletedFoodIDs);
    const entries = migrateEntries(
      state.entries.filter((entry) => !tombstonedEntries.has(entry.id)),
      state.profile.timing,
    );
    const customFoods = state.customFoods.filter((food) => !tombstonedFoods.has(food.id));
    set({
      profile: state.profile,
      entries,
      customFoods,
      dayTypes: state.dayTypes,
      deletedEntryIDs: state.deletedEntryIDs,
      deletedFoodIDs: state.deletedFoodIDs,
    });
  }

  return {
    profile: DEFAULT_PROFILE,
    entries: [],
    customFoods: [],
    dayTypes: {},
    deletedEntryIDs: [],
    deletedFoodIDs: [],
    serverURL: "",
    selectedDate: todayString(),
    syncState: "local",
    syncMessage: null,
    hydrated: false,

    hydrate: async () => {
      const [storedURL, storedStateRaw, token] = await Promise.all([
        jsonStore.read(SERVER_URL_KEY),
        jsonStore.read(STATE_KEY),
        tokenStore.read(),
      ]);
      let serverURL = storedURL ?? "";
      if (storedStateRaw) {
        try {
          const parsed = normalizeStoredState(JSON.parse(storedStateRaw));
          if (parsed) applyState(parsed.state);
        } catch {
          // 损坏的本地状态忽略，回退默认值
        }
      }
      // Web 一次性迁移：旧的 meal-meter-state-v1 → canonical SavedState。
      if (!storedStateRaw) {
        const webRaw = await jsonStore.read(WEB_STATE_KEY);
        if (webRaw) {
          try {
            const parsed = normalizeStoredState(JSON.parse(webRaw));
            if (parsed && parsed.kind === "web") applyState(parsed.state);
          } catch {
            // 忽略迁移失败
          }
        }
      }
      set({
        serverURL,
        hydrated: true,
        syncState: serverURL && token ? "synced" : "local",
      });
    },

    setDate: (date) => set({ selectedDate: date }),
    setDayType: (type) =>
      set((state) => ({ dayTypes: { ...state.dayTypes, [state.selectedDate]: type } })),

    updateProfile: (key, value) =>
      set((state) => ({ profile: { ...state.profile, [key]: value } })),

    changePlan: (goal, timing) =>
      set((state) => ({ profile: { ...state.profile, goal, timing } })),

    addFood: (food, grams, mealID) =>
      set((state) => ({
        entries: [
          ...state.entries,
          { id: uuid(), dateKey: state.selectedDate, mealID, foodName: food.name, grams, per100: food.per100 },
        ],
      })),

    removeEntry: (id) =>
      set((state) => ({
        deletedEntryIDs: [...state.deletedEntryIDs, id],
        entries: state.entries.filter((entry) => entry.id !== id),
      })),

    clearDay: () =>
      set((state) => {
        const today = state.selectedDate;
        const removedIds = state.entries.filter((entry) => entry.dateKey === today).map((entry) => entry.id);
        return {
          deletedEntryIDs: [...state.deletedEntryIDs, ...removedIds],
          entries: state.entries.filter((entry) => entry.dateKey !== today),
          dayTypes: Object.fromEntries(Object.entries(state.dayTypes).filter(([key]) => key !== today)),
        };
      }),

    addCustomFood: (name, category, per100) =>
      set((state) => ({
        customFoods: [...state.customFoods, { id: `custom-${uuid()}`, name, category, per100 }],
      })),

    removeCustomFood: (id) =>
      set((state) => ({
        deletedFoodIDs: [...state.deletedFoodIDs, id],
        customFoods: state.customFoods.filter((food) => food.id !== id),
      })),

    addEstimate: (estimate, mealID, saveFlags) =>
      set((state) => {
        let customFoods = state.customFoods;
        let deletedFoodIDs = state.deletedFoodIDs;
        const additions: SavedEntry[] = [];
        estimate.ingredients.forEach((ingredient, index) => {
          const per100 = per100For(ingredient.grams, ingredient);
          additions.push({
            id: uuid(),
            dateKey: state.selectedDate,
            mealID,
            foodName: ingredient.name,
            grams: ingredient.grams,
            per100,
          });
          if (saveFlags[index]) {
            const replaced = customFoods.filter((food) => foodNameKey(food.name) === foodNameKey(ingredient.name));
            deletedFoodIDs = [...deletedFoodIDs, ...replaced.map((food) => food.id)];
            customFoods = customFoods.filter((food) => foodNameKey(food.name) !== foodNameKey(ingredient.name));
            customFoods = [...customFoods, { id: `custom-${uuid()}`, name: ingredient.name, category: "我的食材", per100 }];
          }
        });
        return { entries: [...state.entries, ...additions], customFoods, deletedFoodIDs };
      }),

    pair: async (serverURL, pairingCode) => {
      set({ syncState: "syncing", syncMessage: null });
      try {
        await ServerAPI.pair(serverURL, pairingCode);
        const trimmed = serverURL.trim().replace(/\/+$/, "");
        set({ serverURL: trimmed });
        await get().syncNow();
      } catch (error) {
        const message = error instanceof Error ? error.message : "配对失败，请检查配对码与网络。";
        set({ syncState: "error", syncMessage: message });
      }
    },

    disconnectServer: async () => {
      await ServerAPI.disconnect();
      set({ syncState: "local", syncMessage: null });
    },

    syncNow: async () => {
      const state = get();
      const token = await tokenStore.read();
      if (!token || !state.serverURL) throw ServerAPI.ServerAPIError.notPaired();
      set({ syncState: "syncing", syncMessage: null });
      try {
        let remote = await ServerAPI.fetchState(state.serverURL);
        let merged = remote.state ? merge(snapshotState(state), remote.state) : snapshotState(state);
        try {
          remote = await ServerAPI.pushState(state.serverURL, merged, remote.version);
        } catch (error) {
          if (error instanceof ServerAPI.ServerAPIError && error.code === "conflict" && error.envelope) {
            if (error.envelope.state) merged = merge(merged, error.envelope.state);
            remote = await ServerAPI.pushState(state.serverURL, merged, error.envelope.version);
          } else {
            throw error;
          }
        }
        applyState(remote.state ?? merged);
        set({ syncState: "synced" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "同步失败，请检查网络。";
        set({ syncState: "error", syncMessage: message });
        throw error;
      }
    },
  };
});

// 每次状态变更自动持久化（等价 Swift didSet { save() }）。hydration 完成前不写，避免覆盖磁盘状态。
let lastServerURL: string | null = null;
useMealStore.subscribe((state) => {
  if (!state.hydrated) return;
  const persisted = snapshotState(state);
  jsonStore.write(STATE_KEY, JSON.stringify(persisted)).catch(() => undefined);
  if (lastServerURL !== state.serverURL) {
    lastServerURL = state.serverURL;
    jsonStore.write(SERVER_URL_KEY, state.serverURL).catch(() => undefined);
  }
});

// ---- 派生选择器（不进 store，保持状态精简）----

export function effectiveDayType(state: MealStoreState): DayType {
  if (state.profile.timing === "none") return "rest";
  return state.dayTypes[state.selectedDate] ?? "training";
}

export function dailyTarget(state: MealStoreState): Macro {
  return targetsFor(state.profile, effectiveDayType(state));
}

export function mealsFor(state: MealStoreState): MealPreset[] {
  const dayType = effectiveDayType(state);
  if (dayType === "rest") return REST_MEALS;
  return trainingMeals(state.profile.timing);
}

// customFoods 优先，内置 FOODS 按 foodNameKey 去重（与 Web/MealStore.foods 一致）。
export function availableFoods(state: MealStoreState) {
  const customNames = new Set(state.customFoods.map((food) => foodNameKey(food.name)));
  const custom = state.customFoods.map((food) => ({ id: food.id, name: food.name, category: food.category, ...food.per100 }));
  const builtin = FOODS.filter((food) => !customNames.has(foodNameKey(food.name)));
  return [...custom, ...builtin];
}

const TIMING_ORDER: Timing[] = ["breakfastEarly", "breakfastLate", "beforeLunch", "afterLunch", "beforeDinner", "afterDinner", "lateNight", "none"];
const TIMING_TITLES: Record<Timing, string> = {
  breakfastEarly: "晨间训练",
  breakfastLate: "上午训练",
  beforeLunch: "午前训练",
  afterLunch: "午后训练",
  beforeDinner: "晚饭前训练",
  afterDinner: "晚饭后训练",
  lateNight: "夜间训练",
  none: "无训练安排",
};

export function planLabel(state: MealStoreState): string {
  const index = TIMING_ORDER.indexOf(state.profile.timing);
  const number = state.profile.goal === "cut" ? index + 1 : index + 9;
  const goalTitle = state.profile.goal === "cut" ? "减脂" : "增肌";
  return `${number} ${goalTitle} · ${TIMING_TITLES[state.profile.timing]}`;
}

export function calcFor(state: MealStoreState) {
  return calculate(state.profile);
}
