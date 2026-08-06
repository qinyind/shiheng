import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import { useSync } from "../hooks/useSync";
import { useMealStore } from "../store/mealStore";

export default function RootLayout() {
  const hydrate = useMealStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useSync();

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-food" options={{ presentation: "modal", headerShown: true, title: "添加食物" }} />
        <Stack.Screen name="ai-analyze" options={{ presentation: "modal", headerShown: true, title: "AI 智能识餐" }} />
        <Stack.Screen name="server-setup" options={{ presentation: "modal", headerShown: true, title: "服务器配对" }} />
      </Stack>
    </>
  );
}
