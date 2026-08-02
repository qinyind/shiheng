import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the finished meal tracker experience", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"餐标｜每日饮食指标与逐餐记录"/);
  assert.match(page, /5 减脂 · 晚饭前练/);
  assert.match(page, /13 增肌 · 晚饭前练/);
  assert.match(page, /meal-meter-state-v1/);
  assert.match(page, /\/api\/sync/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("ships a native SwiftUI iOS client without a web runtime", async () => {
  const [sceneDelegate, nativeView, project] = await Promise.all([
    readFile(new URL("../ios/App/App/SceneDelegate.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/App/App/MealTrackerView.swift", import.meta.url), "utf8"),
    readFile(new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8"),
  ]);

  assert.match(sceneDelegate, /UIHostingController\(rootView: MealTrackerRootView\(\)\)/);
  assert.doesNotMatch(sceneDelegate, /Capacitor|WebKit|CAPBridgeViewController/);
  assert.match(nativeView, /TabView/);
  assert.match(nativeView, /meal-meter-native-state-v1/);
  assert.match(nativeView, /HistoryView|FoodLibraryView|ProfileView/);
  assert.doesNotMatch(project, /CapApp-SPM in Frameworks|public in Resources/);
});
