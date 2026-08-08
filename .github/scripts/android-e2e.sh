#!/usr/bin/env bash
# Android 交互级 E2E（Maestro）
# 由 build-android.yml 的 smoke-android job 调用，复用同一台模拟器：
#   ① android-smoke.sh —— 首页渲染冒烟（APK 安装 + 启动 + uiautomator 断言，底座）
#   ② maestro test .maestro/smoke.yaml —— 真实交互流（首页 → 加餐 → 训练日切换 → 历史）
# 注意：reactivecircus/android-emulator-runner 按行执行 script 输入，
# 多行控制流会被拆散（此前已踩坑）→ 工作流里单行调用本脚本。
set -euo pipefail

# 任一段失败 → 照抄 android-smoke.sh 的兜底产物：截图 + logcat + UI dump，供人工复核
on_fail() {
  echo "E2E_FAIL: capturing debug artifacts"
  adb exec-out screencap -p > screen_fail.png || true
  adb logcat -d > logcat.txt || true
  adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window_dump.xml ./window_dump.xml >/dev/null 2>&1 || true
}
trap on_fail ERR

# ① 首页渲染冒烟（底座）：装 APK、启动、断言 kcal/力训/蛋白
bash .github/scripts/android-smoke.sh

# ② Maestro 交互流：launchApp(stopApp: true) 冷启，与 ① 的启动不冲突；
#    与 iOS/Web 共用同一份 .maestro/smoke.yaml（appId: com.shiheng.app）。
export PATH="$HOME/.maestro/bin:$PATH"
maestro test .maestro/smoke.yaml

echo "E2E_DONE"
