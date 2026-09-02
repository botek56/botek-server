@echo off
title BOTEK - Jalankan Server BOTEK di HP Android
echo ========================================================
echo   MEMBUKA TERMUX & MENJALANKAN SERVER BOTEK DI HP
echo ========================================================
echo.

cd /d D:\Aldi\scrcpy-win64-v4.1

echo 1. Membangunkan HP Android...
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard

echo 2. Membuka Aplikasi Termux di HP...
adb shell am start -n com.termux/.app.TermuxActivity
timeout /t 2 >nul

echo 3. Menyalakan Server BOTEK di Termux HP...
adb shell input text "termux-wake-lock"
adb shell input keyevent 66
adb shell input text "sshd"
adb shell input keyevent 66
adb shell input text "pm2"
adb shell input keyevent 62
adb shell input text "resurrect"
adb shell input keyevent 66
adb shell input text "pm2"
adb shell input keyevent 62
adb shell input text "restart"
adb shell input keyevent 62
adb shell input text "all"
adb shell input keyevent 66

echo.
echo ========================================================
echo   ✅ SUCCESS! Server BOTEK di HP (Termux) Aktif!
echo ========================================================
timeout /t 3
