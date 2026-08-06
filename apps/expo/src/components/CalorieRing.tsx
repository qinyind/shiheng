import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { round } from "@diet/domain";
import { colors } from "../theme/tokens";

type Props = { kcal: number; target: number; progress: number };

// 热量环：react-native-svg 圆环（替代 Web 版 conic-gradient）。progress ∈ [0,1]。
export function CalorieRing({ kcal, target, progress }: Props) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const over = progress > 1;
  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,.18)" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? colors.red : colors.lime}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.kcal, over && styles.over]}>{round(kcal)}</Text>
        <Text style={styles.suffix}>/ {round(target)} kcal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  center: { position: "absolute", alignItems: "center" },
  kcal: { color: colors.summaryText, fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  over: { color: colors.red },
  suffix: { color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 2 },
});
