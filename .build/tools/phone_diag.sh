#!/usr/bin/env bash
# 手机诊断：一次性把「三条通道是否真的活着」打印出来
# 用法：bash .build/tools/phone_diag.sh
set -u
ADB="D:/小账本/.build/platform-tools/platform-tools/adb.exe"
PKG="com.xiaozhangben.app"

echo "==== 1. 设备 ===="
"$ADB" devices
"$ADB" shell getprop ro.product.model 2>/dev/null
"$ADB" shell getprop ro.build.version.release 2>/dev/null
"$ADB" shell getprop ro.build.version.sdk 2>/dev/null

echo
echo "==== 2. App 版本 ===="
"$ADB" shell dumpsys package "$PKG" 2>/dev/null | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime" | head -6

echo
echo "==== 3. 通知监听（主通道）====="
echo "-- 系统里登记的通知监听器："
"$ADB" shell settings get secure enabled_notification_listeners 2>/dev/null
echo "-- 当前已连接的通知监听："
"$ADB" shell dumpsys notification 2>/dev/null | grep -A3 "Notification listeners" | head -12

echo
echo "==== 4. 无障碍（读屏通道）====="
"$ADB" shell settings get secure enabled_accessibility_services 2>/dev/null
"$ADB" shell settings get secure accessibility_enabled 2>/dev/null

echo
echo "==== 5. 电池优化 / 后台限制 ===="
"$ADB" shell dumpsys deviceidle whitelist 2>/dev/null | grep -i xiaozhangben
"$ADB" shell cmd appops get "$PKG" RUN_IN_BACKGROUND 2>/dev/null
"$ADB" shell cmd appops get "$PKG" RUN_ANY_IN_BACKGROUND 2>/dev/null

echo
echo "==== 6. 小账本的常驻服务 ===="
"$ADB" shell dumpsys activity services "$PKG" 2>/dev/null | grep -E "ServiceRecord|isForeground|startRequested" | head -12

echo
echo "==== 7. 通知栏现有内容的原文（看看支付类通知长什么样）===="
"$ADB" shell dumpsys notification --noredact 2>/dev/null | grep -E "NotificationRecord|android.title=|android.text=|pkg=" | tail -60

echo
echo "==== 8. 小账本自己的日志（最近 200 行）===="
"$ADB" logcat -d -v time -s XZB-Notify:V XZB-Screen:V XZB-Main:V XZB-Sms:V 2>/dev/null | tail -200
