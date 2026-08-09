import { StyleSheet, Text, View } from "react-native";
import { round, type DayType, type Profile } from "@diet/domain";
import { colors, font, radius, spacing } from "../theme/tokens";

type Props = {
  profile: Profile;
  dayType: DayType;
  bmi: number;
  planLabel: string;
};

// 方案与身体数据提示卡（对应 Web 版 PlanGuidance 的摘要区）。
export function PlanGuidance({ profile, dayType, bmi, planLabel }: Props) {
  const dayTitle = profile.timing === "none" ? "无训练安排" : dayType === "training" ? "今天是力训日" : "今天是休息日";
  const bmiNote = bmi < 18.5 ? "体重偏低，建议以增肌 / 维持为主" : bmi > 24 ? "BMI 偏高，建议控制能量摄入" : "体重在健康区间，保持当前节奏";
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{planLabel}</Text>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{round(profile.weight)}kg</Text>
          <Text style={styles.statLabel}>体重</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{round(bmi, 1)}</Text>
          <Text style={styles.statLabel}>BMI</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{round(profile.height)}cm</Text>
          <Text style={styles.statLabel}>身高</Text>
        </View>
      </View>
      <Text style={styles.body}>{dayTitle}。{bmiNote}。方案可在「我的」页随时调整，调整后从当天起生效。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.formula,
    borderRadius: radius.panel,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  stats: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 10, alignItems: "center", gap: 2 },
  statValue: { fontSize: 16, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted },
  body: { fontSize: font.small, lineHeight: 20, color: colors.muted, marginTop: spacing.xs },
});
