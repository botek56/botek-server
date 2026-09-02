@echo off
title BOTEK - Kontrol HP OPPO (1-Click Scrcpy)
echo ========================================================
echo       MEMBUKA KONTROL HP OPPO (1-CLICK SCRCPY)
echo ========================================================
echo.

cd /d D:\Aldi\scrcpy-win64-v4.1

echo 1. Memeriksa koneksi HP OPPO...
adb devices

echo 2. Membuka layar HP dengan kontrol mouse (UHID Mode)...
start scrcpy --mouse=uhid --stay-awake --turn-screen-off

echo.
echo ✅ SELESAI! Layar HP OPPO siap dikontrol dari Laptop.
