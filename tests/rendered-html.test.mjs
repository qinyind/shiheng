import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the finished meal tracker experience", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"食衡｜每日饮食指标与逐餐记录"/);
  assert.match(page, /aria-label="食衡首页"/);
  assert.match(page, /meal-meter-state-v1/);
  assert.match(page, /03 · 方案指导/);
  assert.match(page, /水果10g碳水≈少吃30g一般熟米饭/);
  assert.match(page, /AI 会拆成基础食材/);
  assert.match(page, /保存.*种食材/);
  assert.match(page, /deleteCustomFood/);
  assert.match(page, /删除后不会影响已经记录的历史餐次/);
  assert.match(page, /\/api\/sync/);
  // 共享逻辑已抽到 @diet/domain；page.tsx 不再内联餐次 ID、迁移与计算逻辑
  assert.match(page, /from "@diet\/domain"/);
  assert.doesNotMatch(page, /LEGACY_MEAL_ID_MAP/);
  assert.doesNotMatch(page, /id: "breakfast", name: "早饭 · 练前"/);
  assert.doesNotMatch(page, /id: "lunch", name: "午饭 · 练后"/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("ships a native SwiftUI iOS client with secure server sync and AI recognition", async () => {
  const [sceneDelegate, nativeView, serverClient, project] = await Promise.all([
    readFile(new URL("../apps/native/ios/App/App/SceneDelegate.swift", import.meta.url), "utf8"),
    readFile(new URL("../apps/native/ios/App/App/MealTrackerView.swift", import.meta.url), "utf8"),
    readFile(new URL("../apps/native/ios/App/App/ServerClient.swift", import.meta.url), "utf8"),
    readFile(new URL("../apps/native/ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8"),
  ]);

  assert.match(sceneDelegate, /UIHostingController\(rootView: MealTrackerRootView\(\)\)/);
  assert.doesNotMatch(sceneDelegate, /Capacitor|WebKit|CAPBridgeViewController/);
  assert.match(nativeView, /TabView/);
  assert.match(nativeView, /meal-meter-native-state-v1/);
  assert.match(nativeView, /HistoryView|FoodLibraryView|ProfileView/);
  assert.match(nativeView, /AIAnalyzeView|ServerSetupView|syncNow/);
  assert.match(nativeView, /未收录，可保存到食材库/);
  assert.match(nativeView, /removeCustomFood\(id:/);
  assert.match(nativeView, /删除食材？/);
  assert.match(nativeView, /ToolbarItemGroup\(placement: \.keyboard\)/);
  assert.match(nativeView, /scrollDismissesKeyboard\(\.interactively\)/);
  assert.match(nativeView, /Text\("方案指导"\)/);
  assert.match(nativeView, /全天最大餐，最好练完后半小时内开始吃/);
  // 训练日/休息日共享同一组真实餐次 ID，切换后记录不会丢失
  assert.match(nativeView, /MealPreset\(id: "breakfast", name: "早饭 · 练前"/);
  assert.match(nativeView, /MealPreset\(id: "lunch", name: "午饭 · 练后"/);
  assert.match(nativeView, /MealPreset\(id: "dinner", name: "晚饭 · 练后"/);
  assert.match(nativeView, /MealPreset\(id: "dinner", name: "晚饭 · 练前"/);
  assert.doesNotMatch(nativeView, /MealPreset\(id: "a"/);
  assert.doesNotMatch(nativeView, /MealPreset\(id: "other"/);
  assert.match(nativeView, /migratedEntries|legacyMealIDMap/);
  assert.match(serverClient, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(serverClient, /\/v1\/ai\/analyze-food|\/v1\/sync/);
  assert.match(serverClient, /NutritionIngredient/);
  assert.doesNotMatch(project, /CapApp-SPM in Frameworks|public in Resources/);
});
