import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { isPaired } from "../api/serverClient";
import { useMealStore } from "../store/mealStore";
import { colors, font, radius, spacing } from "../theme/tokens";

export default function ServerSetupScreen() {
  const serverURL = useMealStore((state) => state.serverURL);
  const syncState = useMealStore((state) => state.syncState);
  const syncMessage = useMealStore((state) => state.syncMessage);
  const pair = useMealStore((state) => state.pair);
  const syncNow = useMealStore((state) => state.syncNow);
  const disconnectServer = useMealStore((state) => state.disconnectServer);

  const [urlInput, setUrlInput] = useState(serverURL);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState(false);

  useEffect(() => {
    let active = true;
    isPaired()
      .then((value) => {
        if (active) setPaired(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function submitPair() {
    const trimmed = urlInput.trim();
    if (!/^https?:\/\//i.test(trimmed)) return;
    setBusy(true);
    await pair(trimmed, codeInput.trim());
    setBusy(false);
    setPaired(await isPaired());
  }

  async function handleSync() {
    setBusy(true);
    try {
      await syncNow();
    } catch {
      // 错误已写入 syncState/syncMessage
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    await disconnectServer();
    setPaired(await isPaired());
  }

  const statusTitle =
    syncState === "synced"
      ? "已与服务器同步"
      : syncState === "syncing"
        ? "正在同步…"
        : syncState === "error"
          ? syncMessage || "同步失败"
          : "仅保存在本机";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>服务器配对</Text>
      <Text style={styles.body}>
        输入自托管服务器地址（https://…）与配对码。token 保存在系统安全存储中；未配对时所有数据只存本机。
      </Text>

      <Text style={styles.label}>服务器地址</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://example.com"
        placeholderTextColor={colors.muted}
        value={urlInput}
        onChangeText={setUrlInput}
      />

      {!paired && (
        <>
          <Text style={styles.label}>配对码</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="6 位配对码"
            placeholderTextColor={colors.muted}
            value={codeInput}
            onChangeText={setCodeInput}
          />
        </>
      )}

      <View style={styles.statusRow}>
        <View style={[styles.dot, syncState === "synced" ? styles.dotGreen : syncState === "error" ? styles.dotRed : styles.dotMuted]} />
        <Text style={styles.statusText}>{statusTitle}</Text>
      </View>
      {syncMessage ? <Text style={styles.error}>{syncMessage}</Text> : null}

      {!paired ? (
        <Pressable style={styles.primaryBtn} onPress={submitPair} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? "正在配对…" : "配对并同步"}</Text>
        </Pressable>
      ) : (
        <>
          <Pressable style={styles.primaryBtn} onPress={handleSync} disabled={busy}>
            <Text style={styles.primaryBtnText}>{busy ? "正在同步…" : "立即同步"}</Text>
          </Pressable>
          <Pressable style={styles.dangerBtn} onPress={handleDisconnect}>
            <Text style={styles.dangerBtnText}>断开连接（仅删除本机 token）</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  body: { fontSize: 13, lineHeight: 20, color: colors.muted },
  label: { fontSize: font.eyebrow, fontWeight: "800", letterSpacing: 1, color: colors.muted, textTransform: "uppercase", marginTop: 4 },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.ink },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  dotGreen: { backgroundColor: colors.green },
  dotRed: { backgroundColor: colors.red },
  dotMuted: { backgroundColor: colors.muted },
  statusText: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  error: { fontSize: 12, color: colors.red, lineHeight: 18 },
  primaryBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  dangerBtn: { alignItems: "center", paddingVertical: 10 },
  dangerBtnText: { fontSize: 13, color: colors.red, textDecorationLine: "underline" },
});
