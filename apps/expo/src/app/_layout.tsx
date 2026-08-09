import { useEffect } from "react";
import { Stack } from "expo-router";
import "../global.css";
import { useSync } from "../hooks/useSync";
import { useMealStore } from "../store/mealStore";

export default function RootLayout() {
  const hydrate = useMealStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useSync();

  // 不挂全局 <StatusBar>：它在 hydrate/useSync 触发的重渲染中反复断言 dark，
  // 会覆盖各 tab 页 useFocusEffect 设置的样式。各页自行 setStatusBarStyle，
  // 模态页（add-food/ai-analyze/server-setup）走原生 header，由系统配深色状态栏。
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-food" options={{ presentation: "modal", headerShown: true, title: "添加食物" }} />
      <Stack.Screen name="ai-analyze" options={{ presentation: "modal", headerShown: true, title: "AI 智能识餐" }} />
      <Stack.Screen name="server-setup" options={{ presentation: "modal", headerShown: true, title: "服务器配对" }} />
    </Stack>
  );
}
