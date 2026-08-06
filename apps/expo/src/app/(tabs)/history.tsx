import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { round, targetsFor, type SavedEntry } from "@diet/domain";
import { formatDate } from "../../components/DayToolbar";
import { sumSaved, useMealStore } from "../../store/mealStore";
import { colors, font, radius, spacing } from "../../theme/tokens";

type Row = {
  dateKey: string;
  total: ReturnType<typeof sumSaved>;
  dayType: "training" | "rest";
  completion: number;
};

export default function HistoryScreen() {
  const router = useRouter();
  const entries = useMealStore((state) => state.entries);
  const dayTypes = useMealStore((state) => state.dayTypes);
  const profile = useMealStore((state) => state.profile);
  const setDate = useMealStore((state) => state.setDate);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, SavedEntry[]>();
    for (const entry of entries) {
      if (!map.has(entry.dateKey)) map.set(entry.dateKey, []);
      map.get(entry.dateKey)!.push(entry);
    }
    return [...map.entries()]
      .filter(([, list]) => list.length > 0)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, list]) => {
        const dayType = dayTypes[dateKey] ?? (profile.timing === "none" ? "rest" : "training");
        const total = sumSaved(list);
        const target = targetsFor(profile, dayType);
        return { dateKey, total, dayType, completion: target.kcal ? Math.round((total.kcal / target.kcal) * 100) : 0 };
      });
  }, [entries, dayTypes, profile]);

  function openRecord(dateKey: string) {
    setDate(dateKey);
    router.navigate("/");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>06 · 历史记录</Text>
      <Text style={styles.title}>每天的变化，都留得住</Text>
      <Text style={styles.body}>记录按日期保存在当前设备；每一天会锁定当时的方案、体重和目标，之后调整参数不会改写旧记录。</Text>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>○</Text>
          <Text style={styles.emptyTitle}>还没有历史记录</Text>
          <Text style={styles.emptyBody}>在任意一餐添加食物后，当天记录会自动保存在这里。</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable style={styles.row} key={row.dateKey} onPress={() => openRecord(row.dateKey)}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>{formatDate(row.dateKey).split(" ")[0]}</Text>
                <Text style={styles.rowMeta}>
                  {row.dayType === "training" ? "力训日" : "休息日"} · {profile.weight}kg
                </Text>
              </View>
              <View style={styles.rowMacros}>
                <Text style={styles.rowMacro}>C {round(row.total.carbs)}g</Text>
                <Text style={styles.rowMacro}>P {round(row.total.protein)}g</Text>
                <Text style={styles.rowMacro}>F {round(row.total.fat)}g</Text>
              </View>
              <View style={styles.rowScore}>
                <Text style={[styles.rowPct, row.completion > 110 && styles.rowOver]}>{row.completion}%</Text>
                <Text style={styles.rowKcal}>{round(row.total.kcal)} kcal</Text>
              </View>
              <Text style={styles.rowArrow}>→</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  eyebrow: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.green, textTransform: "uppercase" },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyIcon: { fontSize: 34, color: colors.line },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: "center" },
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  rowLeft: { flex: 1, gap: 2 },
  rowDate: { fontSize: 15, fontWeight: "800", color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.muted },
  rowMacros: { gap: 1, alignItems: "flex-end" },
  rowMacro: { fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
  rowScore: { alignItems: "flex-end", gap: 1 },
  rowPct: { fontSize: 16, fontWeight: "800", color: colors.green },
  rowOver: { color: colors.red },
  rowKcal: { fontSize: 11, color: colors.muted },
  rowArrow: { fontSize: 15, color: colors.muted },
});
