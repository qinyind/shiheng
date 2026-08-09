import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { round, targetForMeal } from "@diet/domain";
import { DayToolbar } from "../../components/DayToolbar";
import { MealCard } from "../../components/MealCard";
import { PlanGuidance } from "../../components/PlanGuidance";
import { SummaryCard } from "../../components/SummaryCard";
import { calcFor, dailyTarget, effectiveDayType, mealsFor, planLabel, sumSaved, useMealStore } from "../../store/mealStore";
import { colors, radius, spacing } from "../../theme/tokens";

const SYNC_TITLES: Record<string, string> = {
  synced: "云端已同步",
  syncing: "正在同步…",
  local: "已保存在当前设备",
  error: "同步失败",
};

export default function TodayScreen() {
  const router = useRouter();
  const store = useMealStore();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
    }, []),
  );

  const dayType = effectiveDayType(store);
  const target = dailyTarget(store);
  const meals = mealsFor(store);
  const calc = calcFor(store);
  const label = planLabel(store);
  const bmi = store.profile.weight / (store.profile.height / 100) ** 2;
  const consumed = sumSaved(store.entries.filter((entry) => entry.dateKey === store.selectedDate));

  function openAddFood(mealID: string) {
    router.push({ pathname: "/add-food", params: { mealID } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 49 + spacing.lg }]}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <View style={styles.brandMark} />
            <Text style={styles.brandText}>食衡</Text>
          </View>
          <Pressable onPress={() => router.push("/server-setup")} accessibilityLabel="服务器配对">
            <View style={styles.syncRow}>
              <View style={[styles.syncDot, store.syncState === "synced" ? styles.syncDotGreen : store.syncState === "error" ? styles.syncDotRed : styles.syncDotMuted]} />
              <Text style={styles.syncText}>{SYNC_TITLES[store.syncState] ?? "已保存在当前设备"}</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.quick}>
          <View style={styles.quickCell}>
            <Text style={styles.quickValue}>{round(target.kcal)}</Text>
            <Text style={styles.quickLabel}>今日目标 kcal</Text>
          </View>
          <View style={styles.quickCell}>
            <Text style={styles.quickValue}>{round(target.protein)}</Text>
            <Text style={styles.quickLabel}>蛋白质 g</Text>
          </View>
        </View>
      </View>

      <DayToolbar
        date={store.selectedDate}
        dayType={dayType}
        timingNone={store.profile.timing === "none"}
        onDateChange={store.setDate}
        onDayTypeChange={store.setDayType}
        onClear={store.clearDay}
      />

      <SummaryCard
        dayType={dayType}
        goal={store.profile.goal}
        consumed={consumed}
        target={target}
        footer={
          <Pressable style={styles.aiBtn} onPress={() => router.push("/ai-analyze")}>
            <Text style={styles.aiBtnText}>AI 识餐 ✦</Text>
          </Pressable>
        }
      />

      {meals.map((meal) => {
        const entries = store.entries.filter((entry) => entry.dateKey === store.selectedDate && entry.mealID === meal.id);
        return (
          <MealCard
            key={meal.id}
            meal={meal}
            target={targetForMeal(target, meal)}
            entries={entries}
            goal={store.profile.goal}
            dayType={dayType}
            onAddFood={openAddFood}
            onRemove={store.removeEntry}
          />
        );
      })}

      <PlanGuidance profile={store.profile} dayType={dayType} bmi={bmi} planLabel={label} />

      <Text style={styles.footerNote}>配额会根据当前目标、训练安排和身体数据计算。智能秤体脂与软件计算均仅作趋势参考。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing.md },
  hero: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.lime },
  brandText: { color: colors.heroText, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  syncDot: { width: 7, height: 7, borderRadius: radius.pill },
  syncDotGreen: { backgroundColor: colors.lime },
  syncDotRed: { backgroundColor: colors.red },
  syncDotMuted: { backgroundColor: "rgba(255,255,255,.5)" },
  syncText: { fontSize: 12, color: colors.heroTextSoft },
  quick: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  quickCell: { flex: 1, maxWidth: 150, backgroundColor: "rgba(255,255,255,.1)", borderRadius: radius.md, paddingVertical: 8, alignItems: "center" },
  quickValue: { color: colors.heroText, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  quickLabel: { color: colors.heroTextSoft, fontSize: 11, marginTop: 1 },
  aiBtn: { backgroundColor: colors.green, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  aiBtnText: { fontSize: 13, fontWeight: "800", color: colors.white },
  footerNote: { fontSize: 11, color: colors.muted, lineHeight: 17, paddingHorizontal: spacing.lg },
});
