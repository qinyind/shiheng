import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme/tokens";

export type SelectOption = {
  label: string;
  value: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  enabled?: boolean;
};

// 跨端下拉选择字段（Web / iOS / Android 一套实现）。
// 取代 @react-native-picker/picker：该库在 iOS 渲染内联 UIPickerView 滚轮，
// 在 height:46 + overflow:hidden 容器里会被裁剪成空白条带（Web 的 <select> 无此问题）。
export function SelectField({ value, options, onChange, enabled = true }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const disabled = !enabled;

  function choose(optionValue: string) {
    setOpen(false);
    onChange(optionValue);
  }

  return (
    <>
      <Pressable
        style={[styles.box, disabled && styles.boxDisabled]}
        onPress={() => enabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selected?.label}
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.value, disabled && styles.valueDisabled]}>
          {selected ? selected.label : "未选择"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={disabled ? colors.muted : colors.ink} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="关闭选择">
          <View style={styles.sheet}>
            <ScrollView bounces={false}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => choose(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.green} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    paddingHorizontal: 12,
    height: 46,
  },
  boxDisabled: { opacity: 0.5 },
  value: { fontSize: 15, fontWeight: "700", color: colors.ink },
  valueDisabled: { color: colors.muted },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: "60%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  optionActive: { backgroundColor: colors.quick },
  optionText: { fontSize: font.body, color: colors.ink, fontWeight: "600" },
  optionTextActive: { color: colors.green, fontWeight: "800" },
});
