import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { round, targetForMeal } from "@diet/domain";
import { DayToolbar } from "../../components/DayToolbar";
import { MealCard } from "../../components/MealCard";
import { PlanGuidance } from "../../components/PlanGuidance";
import { SummaryCard } from "../../components/SummaryCard";
import { calcFor, dailyTarget, effectiveDayType, mealsFor, planLabel, sumSaved, useMealStore } from "../../store/mealStore";
import { colors, font, radius, spacing } from "../../theme/tokens";

const SYNC_TITLES: Record<string, string> = {
  synced: "云端已同步",
  syncing: "正在同步…",
  local: "已保存在当前设备",
  error: "同步失败",
};

export default function TodayScreen() {
  const router = useRouter();
  const store = useMealStore();

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="light" />
      <View style={styles.hero}>
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
        <Text style={styles.kicker}>让每一餐都有清晰标准</Text>
        <Text style={styles.heroTitle}>
          今天这顿，<Text style={styles.heroEm}>吃对了吗？</Text>
        </Text>
        <Text style={styles.heroSub}>选择训练方案，系统自动拆分每日与每餐指标。记录食物或让 AI 看图识餐，立即看到余量、超标项和下一口建议。</Text>
        <View style={styles.quick}>
          <View style={styles.quickCell}>
            <Text style={styles.quickValue}>{store.profile.weight}</Text>
            <Text style={styles.quickLabel}>kg</Text>
          </View>
          <View style={styles.quickCell}>
            <Text style={styles.quickValue}>{round(bmi, 1)}</Text>
            <Text style={styles.quickLabel}>BMI</Text>
          </View>
          <View style={styles.quickCell}>
            <Text style={styles.quickValue}>{round(target.kcal)}</Text>
            <Text style={styles.quickLabel}>kcal</Text>
          </View>
          <View style={styles.quickCell}>
            <Text style={styles.quickValue}>{round(target.protein)}</Text>
            <Text style={styles.quickLabel}>g 蛋白质</Text>
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

      <SummaryCard dayType={dayType} goal={store.profile.goal} consumed={consumed} target={target} />

      <View style={styles.sectionHeading}>
        <View style={styles.sectionHeadingText}>
          <Text style={styles.eyebrow}>05 · 逐餐记录</Text>
          <Text style={styles.sectionTitle}>每一餐都有清楚的边界</Text>
        </View>
        <Pressable style={styles.aiBtn} onPress={() => router.push("/ai-analyze")}>
          <Text style={styles.aiBtnText}>AI 识餐 ✦</Text>
        </Pressable>
      </View>

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
  content: { paddingBottom: 40, gap: spacing.lg },
  hero: { backgroundColor: colors.green, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: 14 },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.lime },
  brandText: { color: colors.heroText, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  syncDot: { width: 7, height: 7, borderRadius: radius.pill },
  syncDotGreen: { backgroundColor: colors.lime },
  syncDotRed: { backgroundColor: colors.red },
  syncDotMuted: { backgroundColor: "rgba(255,255,255,.5)" },
  syncText: { fontSize: 12, color: colors.heroTextSoft },
  kicker: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1.5, color: colors.lime, textTransform: "uppercase", marginTop: 8 },
  heroTitle: { fontSize: 38, lineHeight: 40, fontWeight: "800", color: colors.heroText, letterSpacing: -1 },
  heroEm: { color: colors.lime },
  heroSub: { fontSize: 14, lineHeight: 22, color: colors.heroTextSoft },
  quick: { flexDirection: "row", gap: 8, marginTop: 4 },
  quickCell: { flex: 1, backgroundColor: "rgba(255,255,255,.1)", borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  quickValue: { color: colors.heroText, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  quickLabel: { color: colors.heroTextSoft, fontSize: 11, marginTop: 2 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  sectionHeadingText: { gap: 4, flex: 1 },
  eyebrow: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.green, textTransform: "uppercase" },
  sectionTitle: { fontSize: font.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  aiBtn: { backgroundColor: colors.lime, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  aiBtnText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  footerNote: { fontSize: 11, color: colors.muted, lineHeight: 17, paddingHorizontal: spacing.xl },
});
