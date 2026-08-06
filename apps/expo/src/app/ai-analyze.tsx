import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { applyIngredientEdit, matchingFood, round, type AiEstimate, type AiIngredient } from "@diet/domain";
import { pickPhoto, type PickedImage } from "../api/image";
import * as ServerAPI from "../api/serverClient";
import { availableFoods, mealsFor, useMealStore } from "../store/mealStore";
import { colors, font, radius, spacing } from "../theme/tokens";

const INGREDIENT_KEYS = ["carbs", "protein", "fat", "kcal"] as const;

export default function AiAnalyzeScreen() {
  const router = useRouter();
  const { mealID } = useLocalSearchParams<{ mealID: string }>();
  const mealParam = typeof mealID === "string" ? mealID : "";

  const serverURL = useMealStore((state) => state.serverURL);
  const addEstimate = useMealStore((state) => state.addEstimate);
  // availableFoods/mealsFor 每次返回新引用，不能当 selector；订阅整 store 后以普通函数派生。
  const store = useMealStore();
  const foods = availableFoods(store);
  const meals = mealsFor(store);

  const [selectedMealId, setSelectedMealId] = useState(mealParam || meals[0]?.id || "");

  const [description, setDescription] = useState("");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [estimate, setEstimate] = useState<AiEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveFlags, setSaveFlags] = useState<boolean[]>([]);
  const [saved, setSaved] = useState(false);

  function clearError() {
    setError("");
    setSaved(false);
  }

  async function choosePhoto(fromCamera: boolean) {
    clearError();
    try {
      const picked = await pickPhoto(fromCamera);
      if (picked) setImage(picked);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法读取图片，请重试。");
    }
  }

  function updateIngredient(index: number, key: keyof AiIngredient, value: string | number) {
    setEstimate((current) => {
      if (!current) return current;
      const ingredients = current.ingredients.map((ingredient, itemIndex) =>
        itemIndex === index ? applyIngredientEdit(ingredient, key, value) : ingredient,
      );
      const sum = (macro: keyof AiIngredient | "grams") =>
        ingredients.reduce((total, ingredient) => total + Number(ingredient[macro] || 0), 0);
      return {
        ...current,
        ingredients,
        grams: sum("grams"),
        carbs: sum("carbs"),
        protein: sum("protein"),
        fat: sum("fat"),
        kcal: sum("kcal"),
      };
    });
    setSaveFlags((flags) => flags.map((flag, flagIndex) => (flagIndex === index ? true : flag)));
    setSaved(false);
  }

  async function analyze() {
    if (!description.trim() && !image) {
      setError("请先写下食物和份量，或拍一张照片。");
      return;
    }
    if (!serverURL) {
      setError("请先在「我的」中配对服务器后使用 AI 识餐。");
      return;
    }
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const result = await ServerAPI.analyze(serverURL, description.trim(), image?.dataURL);
      setEstimate(result);
      setSaveFlags(result.ingredients.map((ingredient) => !matchingFood(ingredient.name, foods)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法完成识别，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function addToMeal() {
    if (!estimate) return;
    addEstimate(estimate, selectedMealId, saveFlags);
    setSaved(true);
    router.back();
  }

  const confidenceLabel = estimate?.confidence === "high" ? "较高" : estimate?.confidence === "medium" ? "中等" : "较低";
  const saveCount =
    estimate?.ingredients.filter((ingredient, index) => saveFlags[index] && ingredient.grams > 0 && ingredient.name.trim()).length || 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>04 · AI 智能识餐</Text>
        <Text style={styles.title}>说出来，或拍下来</Text>
        <Text style={styles.body}>描述食物、重量和烹饪方式，或拍摄餐盘 / 营养标签。AI 会拆成基础食材，逐项估算后相加；保存前可以手动校正。</Text>
        <View style={styles.tips}>
          <Text style={styles.tip}>写清生重 / 熟重</Text>
          <Text style={styles.tip}>带上油与酱料</Text>
          <Text style={styles.tip}>照片尽量俯拍</Text>
        </View>
      </View>

      <View>
        <Text style={styles.mealPickerLabel}>加入餐次</Text>
        <View style={styles.mealPicker}>
          {meals.map((meal) => {
            const selected = selectedMealId === meal.id;
            return (
              <Pressable key={meal.id} style={[styles.mealChip, selected && styles.mealChipSelected]} onPress={() => setSelectedMealId(meal.id)}>
                <Text style={[styles.mealChipText, selected && styles.mealChipTextSelected]}>{meal.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextInput
        style={styles.textArea}
        multiline
        placeholder="例如：熟米饭 200g，煎鸡胸肉 150g，用了约 8g 油；或输入包装营养成分表"
        placeholderTextColor={colors.muted}
        value={description}
        onChangeText={setDescription}
      />

      <View style={styles.photoRow}>
        <Pressable style={styles.photoBtn} onPress={() => choosePhoto(true)}>
          <Text style={styles.photoBtnText}>拍照</Text>
        </Pressable>
        <Pressable style={styles.photoBtn} onPress={() => choosePhoto(false)}>
          <Text style={styles.photoBtnText}>{image ? "更换照片" : "选图"}</Text>
        </Pressable>
        {image && (
          <Pressable style={styles.photoRemove} onPress={() => setImage(null)} accessibilityLabel="移除照片">
            <Text style={styles.photoRemoveText}>×</Text>
          </Pressable>
        )}
      </View>
      {image ? (
        <Image source={{ uri: image.dataURL }} style={styles.preview} resizeMode="cover" accessibilityLabel="待识别食物预览" />
      ) : (
        <Text style={styles.photoHint}>支持餐盘、外卖、包装标签</Text>
      )}

      <Pressable style={styles.analyzeBtn} onPress={analyze} disabled={loading}>
        <Text style={styles.analyzeBtnText}>{loading ? "正在分析营养…" : "开始 AI 计算"} ✦</Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} role="alert">
          {error}
        </Text>
      ) : null}

      {estimate && (
        <View style={styles.result}>
          <View style={styles.resultHead}>
            <Text style={styles.resultName}>
              {estimate.name} · {estimate.ingredients.length} 种基础食材
            </Text>
            <Text style={styles.resultConfidence}>置信度{confidenceLabel}</Text>
            <Text style={styles.resultNote}>{estimate.note}</Text>
          </View>
          <Text style={styles.editTip}>可直接修改下方结果：调整重量会按比例换算营养；修改碳水、蛋白质或脂肪会自动重算热量。</Text>
          {estimate.ingredients.map((ingredient, index) => {
            const matched = matchingFood(ingredient.name, foods);
            return (
              <View style={styles.ingredientCard} key={index}>
                <Pressable
                  style={styles.saveToggle}
                  onPress={() => setSaveFlags((flags) => flags.map((flag, flagIndex) => (flagIndex === index ? !flag : flag)))}
                >
                  <View style={[styles.checkbox, saveFlags[index] && styles.checkboxOn]}>
                    {saveFlags[index] ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.saveToggleText}>
                    {matched ? `已匹配：${matched.name}；勾选可保存更正` : "未收录，保存到食材库"}
                  </Text>
                </Pressable>
                <View style={styles.fields}>
                  <TextInput
                    style={styles.input}
                    value={ingredient.name}
                    onChangeText={(value) => updateIngredient(index, "name", value)}
                    accessibilityLabel="基础食材"
                  />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>重量</Text>
                    <TextInput
                      style={styles.inputSmall}
                      keyboardType="decimal-pad"
                      value={String(round(ingredient.grams, 1))}
                      onChangeText={(value) => updateIngredient(index, "grams", Number(value))}
                    />
                    <Text style={styles.unit}>g</Text>
                  </View>
                  {INGREDIENT_KEYS.map((key) => (
                    <View style={styles.fieldRow} key={key}>
                      <Text style={styles.fieldLabel}>
                        {key === "carbs" ? "碳水" : key === "protein" ? "蛋白质" : key === "fat" ? "脂肪" : "热量"}
                      </Text>
                      <TextInput
                        style={styles.inputSmall}
                        keyboardType="decimal-pad"
                        value={String(round(ingredient[key], 1))}
                        onChangeText={(value) => updateIngredient(index, key, Number(value))}
                      />
                      <Text style={styles.unit}>{key === "kcal" ? "kcal" : "g"}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          <View style={styles.total}>
            <Text style={styles.totalLabel}>按 {estimate.ingredients.length} 种食材之和计算</Text>
            <Text style={styles.totalValue}>
              {round(estimate.grams, 1)}g · 碳水 {round(estimate.carbs, 1)}g · 蛋白质 {round(estimate.protein, 1)}g · 脂肪 {round(estimate.fat, 1)}g · {round(estimate.kcal)} kcal
            </Text>
          </View>
          <Pressable style={styles.saveBtn} onPress={addToMeal} disabled={saved}>
            <Text style={styles.saveBtnText}>
              {saved ? "已加入记录" : saveCount ? `保存 ${saveCount} 种食材并加入记录` : "加入记录"}
            </Text>
          </Pressable>
          <Text style={styles.saveHint}>保存时按每 100g 换算；同名食材将以你的更正值为准。</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  copy: { gap: 6 },
  eyebrow: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.green, textTransform: "uppercase" },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted },
  tips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tip: { backgroundColor: colors.formula, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "700", color: colors.green },
  textArea: { minHeight: 88, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, fontSize: 14, color: colors.ink, textAlignVertical: "top" },
  photoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  photoBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  photoBtnText: { fontSize: 13, fontWeight: "700", color: colors.green },
  photoRemove: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center" },
  photoRemoveText: { fontSize: 15, color: colors.red, fontWeight: "700" },
  preview: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.card },
  photoHint: { fontSize: 12, color: colors.muted },
  mealPickerLabel: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.muted, textTransform: "uppercase" },
  mealPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  mealChip: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8 },
  mealChipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  mealChipText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  mealChipTextSelected: { color: colors.white },
  analyzeBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  analyzeBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  error: { color: colors.red, fontSize: 13, lineHeight: 19 },
  result: { gap: spacing.md },
  resultHead: { gap: 4 },
  resultName: { fontSize: 15, fontWeight: "800", color: colors.ink },
  resultConfidence: { fontSize: 12, color: colors.muted },
  resultNote: { fontSize: 13, lineHeight: 19, color: colors.ink },
  editTip: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  ingredientCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 10 },
  saveToggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkboxMark: { color: colors.white, fontSize: 13, fontWeight: "800" },
  saveToggleText: { flex: 1, fontSize: 12, color: colors.ink, lineHeight: 17 },
  fields: { gap: 8 },
  input: { backgroundColor: colors.field, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.ink },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldLabel: { fontSize: 12, color: colors.muted, width: 48 },
  inputSmall: { flex: 1, backgroundColor: colors.field, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, color: colors.ink },
  unit: { fontSize: 12, color: colors.muted, width: 32 },
  total: { backgroundColor: colors.field, borderRadius: radius.md, padding: 12, gap: 4 },
  totalLabel: { fontSize: 11, color: colors.muted },
  totalValue: { fontSize: 13, fontWeight: "700", color: colors.ink },
  saveBtn: { backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  saveHint: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
