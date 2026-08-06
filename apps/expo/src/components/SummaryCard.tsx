import { StyleSheet, Text, View } from "react-native";
import { round, type DayType, type Goal, type Macro } from "@diet/domain";
import { CalorieRing } from "./CalorieRing";
import { Progress } from "./Progress";
import { colors, font, spacing } from "../theme/tokens";

type Props = {
  dayType: DayType;
  goal: Goal;
  consumed: Macro;
  target: Macro;
};

// 绿色 hero 汇总卡：热量环 + 三大营养素进度条（对应 Web 版 summary-card）。
export function SummaryCard({ dayType, goal, consumed, target }: Props) {
  const progress = target.kcal > 0 ? consumed.kcal / target.kcal : 0;
  const title = goal === "cut" ? (dayType === "training" ? "力训日 · 减脂配额" : "休息日 · 减脂配额") : dayType === "training" ? "力训日 · 增肌配额" : "休息日 · 增肌配额";
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{round(target.kcal)} kcal 全天目标</Text>
      </View>
      <CalorieRing kcal={consumed.kcal} target={target.kcal} progress={progress} />
      <View style={styles.progressList}>
        <Progress label="碳水" value={consumed.carbs} target={target.carbs} color={colors.carb} />
        <Progress label="蛋白质" value={consumed.protein} target={target.protein} color={colors.protein} />
        <Progress label="脂肪" value={consumed.fat} target={target.fat} color={colors.fat} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.green, borderRadius: 24, padding: spacing.lg, gap: spacing.lg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { color: colors.summaryText, fontSize: font.body, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,.65)", fontSize: font.eyebrow },
  progressList: { gap: spacing.md },
});
