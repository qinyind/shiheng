import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { round, type DayType, type Goal, type Macro } from "@diet/domain";
import { CalorieRing } from "./CalorieRing";
import { Progress } from "./Progress";
import { colors, font, radius, spacing } from "../theme/tokens";

type Props = {
  dayType: DayType;
  goal: Goal;
  consumed: Macro;
  target: Macro;
  footer?: ReactNode;
};

// 配额汇总卡：左环 + 右进度条（并排压缩高度），底部可挂主操作（AI 识餐）。
export function SummaryCard({ dayType, goal, consumed, target, footer }: Props) {
  const progress = target.kcal > 0 ? consumed.kcal / target.kcal : 0;
  const title = goal === "cut" ? (dayType === "training" ? "力训日 · 减脂配额" : "休息日 · 减脂配额") : dayType === "training" ? "力训日 · 增肌配额" : "休息日 · 增肌配额";
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{round(target.kcal)} kcal 全天目标</Text>
      </View>
      <View style={styles.body}>
        <CalorieRing kcal={consumed.kcal} target={target.kcal} progress={progress} size={110} />
        <View style={styles.progressList}>
          <Progress label="碳水" value={consumed.carbs} target={target.carbs} color={colors.carb} />
          <Progress label="蛋白质" value={consumed.protein} target={target.protein} color={colors.protein} />
          <Progress label="脂肪" value={consumed.fat} target={target.fat} color={colors.fat} />
        </View>
      </View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  // 首屏配额卡：环与进度条并排，竖向占用压缩到一屏能装下「早饭」卡
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    borderColor: colors.sumBorder,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { color: colors.green, fontSize: font.body, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: font.eyebrow },
  body: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  progressList: { flex: 1, gap: spacing.sm },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
});
