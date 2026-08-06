import type { Food } from "./types.ts";

export function foodNameKey(name: string) {
  return name.toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/实际摄入|可食部|一般|蒸煮|清蒸|水煮|熟制|熟|生/g, "")
    .replace(/[\s/·、_-]/g, "");
}

export function matchingFood(ingredientName: string, foods: Food[]) {
  const key = foodNameKey(ingredientName);
  if (!key) return undefined;
  return foods.find((food) => {
    const foodKey = foodNameKey(food.name);
    return foodKey === key || (Math.min(foodKey.length, key.length) >= 3 && (foodKey.includes(key) || key.includes(foodKey)));
  });
}
