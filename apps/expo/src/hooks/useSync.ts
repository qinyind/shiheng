import { useEffect } from "react";
import { AppState } from "react-native";
import { useMealStore } from "../store/mealStore";

// 复刻 SwiftUI：启动（挂载）时若已配对则自动同步；App 回到前台（active）再次同步。
// 网络失败不自动重试，由 UI 提供手动「立即同步」。
export function useSync(): void {
  const hydrated = useMealStore((state) => state.hydrated);
  const serverURL = useMealStore((state) => state.serverURL);
  const syncNow = useMealStore((state) => state.syncNow);

  useEffect(() => {
    if (!hydrated || !serverURL) return;
    syncNow().catch(() => undefined);
  }, [hydrated, serverURL, syncNow]);

  useEffect(() => {
    if (!hydrated) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncNow().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [hydrated, syncNow]);
}
