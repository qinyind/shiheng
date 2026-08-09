import { Pressable, StyleSheet, Text, View } from "react-native";
import { getRecommendation, guideForMeal, round, type DayType, type Goal, type Macro, type MealPreset, type SavedEntry } from "@diet/domain";
import { macroForSaved, sumSaved } from "../store/mealStore";
import { colors, font, radius, spacing } from "../theme/tokens";

type Props = {
  meal: MealPreset;
  target: Macro;
  entries: SavedEntry[];
  goal: Goal;
  dayType: DayType;
  onAddFood: (mealID: string) => void;
  onRemove: (entryID: string) => void;
};

// 逐餐卡片：指南摘要 + 已记录食物 + 本餐目标余量 + 下一口建议（对应 Web 版 MealCard）。
export function MealCard({ meal, target, entries, goal, dayType, onAddFood, onRemove }: Props) {
  const guide = guideForMeal(meal, goal, dayType);
  const total = sumSaved(entries);
  const recommendation = getRecommendation(target, total, meal);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.mealName}>{meal.name}</Text>
          <Text style={styles.mealNote}>{meal.note}</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => onAddFood(meal.id)} accessibilityLabel={`在${meal.name}添加食物`}>
          <Text style={styles.addBtnText}>+ 添加</Text>
        </Pressable>
      </View>

      <Text style={styles.guide}>{guide.summary}</Text>

      {entries.length > 0 && (
        <View style={styles.entries}>
          {entries.map((entry) => {
            const macro = macroForSaved(entry);
            return (
              <View style={styles.entry} key={entry.id}>
                <View style={styles.entryLeft}>
                  <Text style={styles.entryName}>{entry.foodName}</Text>
                  <Text style={styles.entryGrams}>{round(entry.grams)}g</Text>
                </View>
                <Text style={styles.entryMacro}>
                  {round(macro.kcal)} kcal · C{round(macro.carbs)} P{round(macro.protein)} F{round(macro.fat)}
                </Text>
                <Pressable onPress={() => onRemove(entry.id)} accessibilityLabel={`删除${entry.foodName}`}>
                  <Text style={styles.entryRemove}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.remainRow}>
          <Text style={styles.remainLabel}>本餐余量</Text>
          <Text style={styles.remainValue}>
            C{round(target.carbs - total.carbs)} · P{round(target.protein - total.protein)} · F{round(target.fat - total.fat)}
          </Text>
        </View>
        <Text style={styles.recommendation}>{recommendation.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.line,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  mealName: { fontSize: font.body, fontWeight: "800", color: colors.ink },
  mealNote: { fontSize: font.eyebrow, color: colors.muted },
  addBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  guide: { fontSize: font.small, lineHeight: 20, color: colors.ink },
  entries: { gap: 8 },
  entry: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.field, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  entryLeft: { flex: 1, gap: 1 },
  entryName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  entryGrams: { fontSize: 11, color: colors.muted },
  entryMacro: { fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] },
  entryRemove: { fontSize: 18, color: colors.red, paddingHorizontal: 4, fontWeight: "700" },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md, gap: spacing.sm },
  remainRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  remainLabel: { fontSize: font.eyebrow, color: colors.muted, fontWeight: "600" },
  remainValue: { fontSize: font.eyebrow, color: colors.ink, fontWeight: "700", fontVariant: ["tabular-nums"] },
  recommendation: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
