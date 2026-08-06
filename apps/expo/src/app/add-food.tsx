import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getRecommendation, round, targetForMeal, type Food, type Macro } from "@diet/domain";
import { availableFoods, dailyTarget, mealsFor, sumSaved, useMealStore } from "../store/mealStore";
import { colors, font, radius, spacing } from "../theme/tokens";

type CustomDraft = { name: string; carbs: string; protein: string; fat: string; kcal: string };

const CUSTOM_ID = "__custom__";

export default function AddFoodScreen() {
  const router = useRouter();
  const { mealID } = useLocalSearchParams<{ mealID: string }>();
  const mealId = typeof mealID === "string" ? mealID : "";

  // 派生选择器（mealsFor/dailyTarget/availableFoods）每次调用都返回新引用，
  // 不能直接当 Zustand selector 用（getSnapshot 不稳定 → 无限重渲染 React #185）。
  // 与 index.tsx 一致：订阅整个 store，再以普通函数派生。
  const store = useMealStore();
  const meals = mealsFor(store);
  const target = dailyTarget(store);
  const foods = availableFoods(store);
  const entries = mealId ? store.entries.filter((entry) => entry.dateKey === store.selectedDate && entry.mealID === mealId) : [];

  const meal = meals.find((item) => item.id === mealId) ?? meals[0];
  const mealTarget = targetForMeal(target, meal);
  const recommendation = getRecommendation(mealTarget, sumSaved(entries), meal);

  const [selectedId, setSelectedId] = useState(recommendation.foodId);
  const [grams, setGrams] = useState(String(Math.max(1, Math.round(recommendation.grams))));
  const [custom, setCustom] = useState<CustomDraft>({ name: "", carbs: "0", protein: "0", fat: "0", kcal: "" });

  const categories = useMemo(() => {
    const map = new Map<string, Food[]>();
    for (const food of foods) {
      if (!map.has(food.category)) map.set(food.category, []);
      map.get(food.category)!.push(food);
    }
    return [...map.entries()];
  }, [foods]);

  function applyRecommendation() {
    setSelectedId(recommendation.foodId);
    setGrams(String(Math.max(1, recommendation.grams)));
  }

  function customPer100(): Macro {
    const carbs = Number(custom.carbs) || 0;
    const protein = Number(custom.protein) || 0;
    const fat = Number(custom.fat) || 0;
    return {
      carbs,
      protein,
      fat,
      kcal: Number(custom.kcal) || carbs * 4 + protein * 4 + fat * 9,
    };
  }

  function add() {
    const gramsValue = Number(grams);
    if (!gramsValue || gramsValue <= 0) return;
    if (selectedId === CUSTOM_ID) {
      store.addFood({ id: "custom", name: custom.name || "自定义食物", category: "自定义", per100: customPer100() }, gramsValue, mealId);
    } else {
      const food = foods.find((item) => item.id === selectedId);
      if (!food) return;
      store.addFood(
        { id: food.id, name: food.name, category: food.category, per100: { carbs: food.carbs, protein: food.protein, fat: food.fat, kcal: food.kcal } },
        gramsValue,
        mealId,
      );
    }
    router.back();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.mealName}>{meal.name}</Text>
      <Text style={styles.mealNote}>{meal.note}</Text>

      <Pressable style={styles.recRow} onPress={applyRecommendation}>
        <Text style={styles.recSpark}>✦</Text>
        <Text style={styles.recText}>
          <Text style={styles.recTitle}>本餐推荐：</Text>
          {recommendation.text}
        </Text>
        <Text style={styles.recArrow}>↗</Text>
      </Pressable>

      <Text style={styles.groupLabel}>选择食物</Text>
      {categories.map(([category, items]) => (
        <View key={category}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.chipWrap}>
            {items.map((food) => {
              const selected = selectedId !== CUSTOM_ID && selectedId === food.id;
              return (
                <Pressable
                  key={food.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setSelectedId(food.id)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{food.name}</Text>
                  <Text style={styles.chipMacro}>{round(food.kcal)} kcal/100g</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={styles.chipWrap}>
        <Pressable
          style={[styles.chip, selectedId === CUSTOM_ID && styles.chipSelected]}
          onPress={() => setSelectedId(CUSTOM_ID)}
        >
          <Text style={[styles.chipText, selectedId === CUSTOM_ID && styles.chipTextSelected]}>＋ 自定义食物</Text>
        </Pressable>
      </View>

      {selectedId === CUSTOM_ID && (
        <View style={styles.customCard}>
          <TextInput
            style={styles.input}
            placeholder="食物名称"
            placeholderTextColor={colors.muted}
            value={custom.name}
            onChangeText={(name) => setCustom((current) => ({ ...current, name }))}
          />
          {(["carbs", "protein", "fat", "kcal"] as const).map((key) => (
            <View style={styles.customField} key={key}>
              <Text style={styles.customLabel}>
                {key === "carbs" ? "碳水" : key === "protein" ? "蛋白质" : key === "fat" ? "脂肪" : "热量"}/100g
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={custom[key]}
                onChangeText={(value) => setCustom((current) => ({ ...current, [key]: value }))}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.gramRow}>
        <Text style={styles.groupLabel}>重量</Text>
        <View style={styles.gramControl}>
          <Pressable style={styles.stepBtn} onPress={() => setGrams((current) => String(Math.max(1, (Number(current) || 0) - 10)))}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <TextInput style={styles.gramInput} keyboardType="decimal-pad" value={grams} onChangeText={setGrams} accessibilityLabel="克数" />
          <Pressable style={styles.stepBtn} onPress={() => setGrams((current) => String((Number(current) || 0) + 10))}>
            <Text style={styles.stepText}>＋</Text>
          </Pressable>
          <Text style={styles.gramUnit}>克</Text>
        </View>
      </View>

      <Pressable style={styles.addBtn} onPress={add} disabled={!grams || Number(grams) <= 0}>
        <Text style={styles.addBtnText}>添加</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  mealName: { fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  mealNote: { fontSize: 13, color: colors.muted, marginTop: 2 },
  recRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12 },
  recSpark: { color: colors.green, fontSize: 16 },
  recText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.ink },
  recTitle: { fontWeight: "800", color: colors.green },
  recArrow: { color: colors.green, fontSize: 16, fontWeight: "800" },
  groupLabel: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.muted, textTransform: "uppercase" },
  categoryTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  chipTextSelected: { color: colors.white },
  chipMacro: { fontSize: 11, color: colors.muted, marginTop: 1 },
  customCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 10 },
  customField: { flexDirection: "row", alignItems: "center", gap: 10 },
  customLabel: { fontSize: 13, color: colors.muted, width: 90 },
  input: { flex: 1, backgroundColor: colors.field, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: colors.ink },
  gramRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gramControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 18, color: colors.ink, fontWeight: "700" },
  gramInput: { width: 76, height: 36, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.ink },
  gramUnit: { fontSize: 13, color: colors.muted },
  addBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  addBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});
