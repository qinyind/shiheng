import { Pressable, StyleSheet, Text, View } from "react-native";
import { shiftDate, type DayType } from "@diet/domain";
import { colors, font, radius, spacing } from "../theme/tokens";

// 供 history.tsx 复用：key "2026-08-06" → "8月6日 周四"。
export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[new Date(year, month - 1, day).getDay()];
  return `${month}月${day}日 周${weekday}`;
}

type Props = {
  date: string;
  dayType: DayType;
  timingNone: boolean;
  onDateChange: (date: string) => void;
  onDayTypeChange: (type: DayType) => void;
  onClear: () => void;
};

export function DayToolbar({ date, dayType, timingNone, onDateChange, onDayTypeChange, onClear }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.dateRow}>
        <Pressable style={styles.step} onPress={() => onDateChange(shiftDate(date, -1))} accessibilityLabel="前一天">
          <Text style={styles.stepText}>‹</Text>
        </Pressable>
        <View style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{formatDate(date)}</Text>
          <Text style={styles.dateMeta}>{timingNone ? "无训练安排" : dayType === "training" ? "力训日" : "休息日"}</Text>
        </View>
        <Pressable style={styles.step} onPress={() => onDateChange(shiftDate(date, 1))} accessibilityLabel="后一天">
          <Text style={styles.stepText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.controls}>
        {!timingNone && (
          <View style={styles.seg}>
            {(["training", "rest"] as DayType[]).map((type) => (
              <Pressable
                key={type}
                style={[styles.segBtn, dayType === type && styles.segBtnActive]}
                onPress={() => onDayTypeChange(type)}
              >
                <Text style={[styles.segText, dayType === type && styles.segTextActive]}>{type === "training" ? "力训日" : "休息日"}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable style={styles.clear} onPress={onClear}>
          <Text style={styles.clearText}>清空当天</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  step: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 20, color: colors.ink, fontWeight: "700", marginTop: -2 },
  dateLabelWrap: { flex: 1, alignItems: "center", gap: 2 },
  dateLabel: { fontSize: font.body, fontWeight: "800", color: colors.ink },
  dateMeta: { fontSize: font.eyebrow, color: colors.muted },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  seg: { flexDirection: "row", backgroundColor: colors.toggle, borderRadius: radius.pill, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill },
  segBtnActive: { backgroundColor: colors.green },
  segText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  segTextActive: { color: colors.white },
  clear: { paddingHorizontal: 12, paddingVertical: 8 },
  clearText: { fontSize: 13, color: colors.red, fontWeight: "600" },
});
