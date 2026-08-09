import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import { round, type Macro } from "@diet/domain";
import { useMealStore } from "../../store/mealStore";
import { colors, font, radius, spacing } from "../../theme/tokens";

type Draft = { name: string; carbs: string; protein: string; fat: string; kcal: string };

export default function FoodsScreen() {
  const customFoods = useMealStore((state) => state.customFoods);
  const removeCustomFood = useMealStore((state) => state.removeCustomFood);
  const addCustomFood = useMealStore((state) => state.addCustomFood);

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: "", carbs: "0", protein: "0", fat: "0", kcal: "" });
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("dark");
    }, []),
  );

  function confirmDelete(id: string, name: string) {
    Alert.alert("删除食材？", `确定从食材库删除“${name}”吗？已记录的历史餐次不会受影响。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeCustomFood(id) },
    ]);
  }

  function submit() {
    const carbs = Number(draft.carbs) || 0;
    const protein = Number(draft.protein) || 0;
    const fat = Number(draft.fat) || 0;
    const per100: Macro = {
      carbs,
      protein,
      fat,
      kcal: Number(draft.kcal) || carbs * 4 + protein * 4 + fat * 9,
    };
    if (!draft.name.trim()) return;
    addCustomFood(draft.name.trim(), "我的食材", per100);
    setDraft({ name: "", carbs: "0", protein: "0", fat: "0", kcal: "" });
    setFormOpen(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 49 + spacing.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>我的食材</Text>
          <Text style={styles.title}>已保存 {customFoods.length} 种</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setFormOpen((value) => !value)}>
          <Text style={styles.addBtnText}>{formOpen ? "收起" : "＋ 新增"}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>删除后不会影响已经记录的历史餐次。</Text>

      {formOpen && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="食物名称"
            placeholderTextColor={colors.muted}
            value={draft.name}
            onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
          />
          {(["carbs", "protein", "fat", "kcal"] as const).map((key) => (
            <View style={styles.fieldRow} key={key}>
              <Text style={styles.fieldLabel}>
                {key === "carbs" ? "碳水" : key === "protein" ? "蛋白质" : key === "fat" ? "脂肪" : "热量"}/100g
              </Text>
              <TextInput
                style={styles.inputSmall}
                keyboardType="decimal-pad"
                value={draft[key]}
                onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
              />
              <Text style={styles.unit}>{key === "kcal" ? "kcal" : "g"}</Text>
            </View>
          ))}
          <Pressable style={styles.submitBtn} onPress={submit} disabled={!draft.name.trim()}>
            <Text style={styles.submitBtnText}>保存食材</Text>
          </Pressable>
        </View>
      )}

      {customFoods.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>○</Text>
          <Text style={styles.emptyTitle}>还没有自定义食材</Text>
          <Text style={styles.emptyBody}>用 AI 识餐勾选保存，或点「新增」手动录入。</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {customFoods.map((food) => (
            <View style={styles.row} key={food.id}>
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{food.name}</Text>
                <Text style={styles.rowMacros}>
                  每100g · 碳水 {round(food.per100.carbs, 1)}g · 蛋白质 {round(food.per100.protein, 1)}g · 脂肪 {round(food.per100.fat, 1)}g · {round(food.per100.kcal)} kcal
                </Text>
              </View>
              <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(food.id, food.name)} accessibilityLabel={`删除${food.name}`}>
                <Text style={styles.deleteBtnText}>删除</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingText: { gap: 4 },
  eyebrow: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.green, textTransform: "uppercase" },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  addBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  hint: { fontSize: 12, color: colors.muted, marginTop: -6 },
  form: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 10 },
  input: { backgroundColor: colors.field, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: colors.ink },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldLabel: { fontSize: 12, color: colors.muted, width: 76 },
  inputSmall: { flex: 1, backgroundColor: colors.field, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, color: colors.ink },
  unit: { fontSize: 12, color: colors.muted, width: 32 },
  submitBtn: { backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 34, color: colors.line },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: "center" },
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  rowText: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: "800", color: colors.ink },
  rowMacros: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  deleteBtnText: { fontSize: 13, color: colors.red, fontWeight: "700" },
});
