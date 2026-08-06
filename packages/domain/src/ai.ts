import { round } from "./numbers.ts";
import type { AiIngredient } from "./types.ts";

export type AiIngredientKey = "name" | "grams" | "carbs" | "protein" | "fat" | "kcal";

// 编辑 AI 识别结果：改重量按比例换算营养；改宏量自动重算热量。
export function applyIngredientEdit(ingredient: AiIngredient, key: AiIngredientKey, value: string | number): AiIngredient {
  if (key === "name") return { ...ingredient, name: String(value) };
  const numericValue = Math.max(0, Number(value) || 0);
  if (key === "grams") {
    const ratio = ingredient.grams > 0 ? numericValue / ingredient.grams : 1;
    return {
      ...ingredient,
      grams: numericValue,
      carbs: round(ingredient.carbs * ratio, 2),
      protein: round(ingredient.protein * ratio, 2),
      fat: round(ingredient.fat * ratio, 2),
      kcal: round(ingredient.kcal * ratio, 1),
    };
  }
  const updated = { ...ingredient, [key]: numericValue };
  if (key === "carbs" || key === "protein" || key === "fat") {
    updated.kcal = round(updated.carbs * 4 + updated.protein * 4 + updated.fat * 9, 1);
  }
  return updated;
}
