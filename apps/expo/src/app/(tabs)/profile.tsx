import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PLAN_OPTIONS, round, type Goal, type Level, type Sex, type Timing } from "@diet/domain";
import { calcFor, effectiveDayType, planLabel, useMealStore } from "../../store/mealStore";
import { colors, font, radius, spacing } from "../../theme/tokens";

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useMealStore((state) => state.profile);
  const syncState = useMealStore((state) => state.syncState);
  const serverURL = useMealStore((state) => state.serverURL);
  const updateProfile = useMealStore((state) => state.updateProfile);
  const changePlan = useMealStore((state) => state.changePlan);
  const store = useMealStore();

  const calc = calcFor(store);
  const bmi = profile.weight / (profile.height / 100) ** 2;
  const dayType = effectiveDayType(store);
  const label = planLabel(store);
  const planValue = `${profile.goal}:${profile.timing}`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>01 · 建立今日目标</Text>
      <Text style={styles.title}>{label}</Text>

      <View style={styles.quick}>
        <View style={styles.quickCell}>
          <Text style={styles.quickValue}>{profile.weight}</Text>
          <Text style={styles.quickLabel}>kg</Text>
        </View>
        <View style={styles.quickCell}>
          <Text style={styles.quickValue}>{round(bmi, 1)}</Text>
          <Text style={styles.quickLabel}>BMI</Text>
        </View>
        <View style={styles.quickCell}>
          <Text style={styles.quickValue}>{round(calc.bmr)}</Text>
          <Text style={styles.quickLabel}>基础代谢 kcal</Text>
        </View>
        <View style={styles.quickCell}>
          <Text style={styles.quickValue}>{round(dayType === "training" ? calc.trainMaintenance : calc.restMaintenance)}</Text>
          <Text style={styles.quickLabel}>今日平衡 kcal</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>训练方案</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={planValue}
            onValueChange={(value) => {
              const [goal, timing] = value.split(":") as [Goal, Timing];
              changePlan(goal, timing);
            }}
            style={styles.picker}
          >
            {PLAN_OPTIONS.map((option) => (
              <Picker.Item key={`${option.goal}:${option.timing}`} label={option.label} value={`${option.goal}:${option.timing}`} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>性别</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={profile.sex}
            onValueChange={(value) => updateProfile("sex", value as Sex)}
            style={styles.picker}
          >
            <Picker.Item label="男" value="male" />
            <Picker.Item label="女" value="female" />
          </Picker>
        </View>

        <Text style={styles.label}>力训水平</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={profile.level}
            enabled={profile.timing !== "none"}
            onValueChange={(value) => updateProfile("level", value as Level)}
            style={styles.picker}
          >
            <Picker.Item label="新手" value="beginner" />
            <Picker.Item label="有基础" value="intermediate" />
            <Picker.Item label="老手" value="advanced" />
          </Picker>
        </View>

        {(
          [
            ["age", "年龄", "岁"],
            ["height", "身高", "cm"],
            ["weight", "体重", "kg"],
            ["cardioDaily", "日均有氧消耗", "kcal"],
          ] as const
        ).map(([key, display, unit]) => (
          <View key={key}>
            <Text style={styles.label}>{display}</Text>
            <View style={styles.numberBox}>
              <TextInput
                style={styles.numberInput}
                keyboardType="decimal-pad"
                value={String(profile[key])}
                onChangeText={(value) => updateProfile(key, Number(value))}
                accessibilityLabel={display}
              />
              <Text style={styles.unit}>{unit}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.formulaNote}>采用 Mifflin–St Jeor 与方案配额系数；结果用于饮食规划，不代替医疗建议。</Text>

      <View style={styles.serverCard}>
        <View style={styles.serverText}>
          <Text style={styles.serverTitle}>服务器同步</Text>
          <Text style={styles.serverBody}>
            {serverURL ? serverURL : "未配对，数据仅保存在当前设备"}
            {"\n"}
            {syncState === "synced" ? "已与服务器同步" : syncState === "syncing" ? "正在同步…" : "仅保存在本机"}
          </Text>
        </View>
        <Pressable style={styles.serverBtn} onPress={() => router.push("/server-setup")}>
          <Text style={styles.serverBtnText}>{serverURL ? "管理" : "配对"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  eyebrow: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.green, textTransform: "uppercase" },
  title: { fontSize: font.h2, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  quick: { flexDirection: "row", gap: 8 },
  quickCell: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, alignItems: "center" },
  quickValue: { fontSize: 16, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  quickLabel: { fontSize: 10, color: colors.muted, marginTop: 3 },
  form: { backgroundColor: colors.card, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, gap: 10 },
  label: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.muted, textTransform: "uppercase", marginTop: 4 },
  pickerBox: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.field, overflow: "hidden" },
  picker: { height: 46, color: colors.ink },
  numberBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.field, paddingHorizontal: 12, height: 46 },
  numberInput: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.ink },
  unit: { fontSize: 12, color: colors.muted },
  formulaNote: { fontSize: 11, color: colors.muted, lineHeight: 17 },
  serverCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  serverText: { flex: 1, gap: 4 },
  serverTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  serverBody: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  serverBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  serverBtnText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
