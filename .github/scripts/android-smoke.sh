#!/usr/bin/env bash
# Android 模拟器冒烟测试脚本
# 由 build-android.yml 的 smoke-android job 调用。
# 注意：reactivecircus/android-emulator-runner 按行执行 script 输入，
# 多行 shell 控制流会被拆散，所以逻辑放独立文件、工作流里单行调用本脚本。
set -euo pipefail

adb install -r apk/app-release.apk
adb shell am start -n com.shiheng.app/.MainActivity

# 首次启动 + Hermes 加载 JS bundle 可能较慢，轮询首页文案（最多 ~90s）
for i in $(seq 1 9); do
  sleep 10
  adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 || true
  adb pull /sdcard/window_dump.xml ./window_dump.xml >/dev/null 2>&1 || true
  if grep -qE 'kcal|力训|蛋白|食衡' ./window_dump.xml 2>/dev/null; then
    echo "SMOKE_PASS: home page rendered (attempt $i)"
    break
  fi
  if [ "$i" -eq 9 ]; then
    adb logcat -d -t 800 > logcat_fail.txt || true
    echo "SMOKE_FAIL: home page text not found after ~90s"
    exit 1
  fi
done

adb exec-out screencap -p > screen.png
echo "SMOKE_DONE"
