import { StyleSheet, Text, View } from "react-native";
import { round } from "@diet/domain";
import { colors, font, radius } from "../theme/tokens";

type Props = { label: string; value: number; target: number; color: string };

// 与 Web 版 Progress（.progress-row/.progress-track）一致：超标（>110%）变红。
export function Progress({ label, value, target, color }: Props) {
  const pct = target > 0 ? (value / target) * 100 : value > 0 ? 120 : 0;
  const over = pct > 110;
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.values, over && styles.danger]}>
          {round(value, 1)} / {round(target, 1)}g
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.min(pct, 100)}%`, backgroundColor: over ? colors.red : color }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: font.eyebrow, color: colors.muted, fontWeight: "600" },
  values: { fontSize: font.small, color: colors.ink, fontWeight: "700" },
  danger: { color: colors.red },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.line, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill },
});
