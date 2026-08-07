#!/usr/bin/env bash
# Android 模拟器冒烟测试脚本
# 由 build-android.yml 的 smoke-android job 调用。
# 注意：reactivecircus/android-emulator-runner 按行执行 script 输入，
# 多行 shell 控制流会被拆散，所以逻辑放独立文件、工作流里单行调用本脚本。
set -euo pipefail

adb install -r apk/app-release.apk

echo "=== Launching app ==="
adb shell am start -W -n com.shiheng.app/.MainActivity || true

# 轮询首页文案（uiautomator dump），最多 ~90s。
# 不解析 mResumedActivity：该模拟器 dumpsys 解析为空（踩过坑）。
# 不做 "食衡" 匹配：它是桌面图标 label，launcher 页会假阳性。
# 断言串 kcal/力训/蛋白 只出现在 App 内 → 桌面/白屏/启动页都不会误判。
for i in $(seq 1 9); do
  sleep 10
  focus=$(adb shell dumpsys window 2>/dev/null | grep -m1 'mCurrentFocus' || true)
  echo "[attempt $i] focus: $focus"
  adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window_dump.xml ./window_dump.xml >/dev/null 2>&1 || true
  if grep -qE 'kcal|力训|蛋白' ./window_dump.xml 2>/dev/null; then
    echo "SMOKE_PASS: home content rendered (attempt $i)"
    break
  fi
  if [ "$i" -eq 9 ]; then
    echo "SMOKE_FAIL: home content not found after ~90s"
    adb exec-out screencap -p > screen_fail.png || true
    adb logcat -d > logcat.txt || true
    exit 1
  fi
done

# 收尾：截图 + UI dump + logcat 一并传回，供人工复核
sleep 3
adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 || true
adb pull /sdcard/window_dump.xml ./window_dump.xml >/dev/null 2>&1 || true
adb exec-out screencap -p > screen.png
adb logcat -d > logcat.txt || true
if grep -qE 'FATAL EXCEPTION|AndroidRuntime.*FATAL' logcat.txt; then
  echo "WARNING: crash signature found in logcat (see artifact)"
fi
echo "SMOKE_DONE"
