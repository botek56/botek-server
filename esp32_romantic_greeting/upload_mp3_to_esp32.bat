@echo off
title Upload MP3 to ESP32 Flash
color 0E

echo =======================================================
echo   UPLOAD BERGEMA.MP3 KE MEMORI FLASH ESP32 (OTOMATIS)
echo =======================================================
echo.

set DATA_DIR=%~dp0data
set OUTPUT_BIN=%~dp0littlefs.bin

echo [1/3] Memindai alat pemicu Arduino di laptop Anda...
powershell -NoProfile -ExecutionPolicy Bypass -Command "^
$appData = [Environment]::GetFolderPath('LocalApplicationData'); ^
$mk = Get-ChildItem -Path \"$appData\Arduino15\" -Include 'mklittlefs.exe','mkspiffs.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName; ^
$esp = Get-ChildItem -Path \"$appData\Arduino15\" -Filter 'esptool.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName; ^
if (-not $esp) { $esp = Get-ChildItem -Path 'C:\Program Files*' -Filter 'esptool.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName; } ^
if ($mk -and $esp) { ^
    Write-Host '[OK] Tools Ditemukan!'; ^
    Write-Host \"Compiling $env:DATA_DIR into LittleFS binary...\"; ^
    & $mk -c \"$env:DATA_DIR\" -p 256 -b 4096 -s 0x180000 \"$env:OUTPUT_BIN\"; ^
    if (Test-Path \"$env:OUTPUT_BIN\") { ^
        Write-Host '[OK] Mengirimkan lagu MP3 ke ESP32 COM7...'; ^
        & $esp --chip esp32 --port COM7 --baud 921600 write_flash 0x290000 \"$env:OUTPUT_BIN\"; ^
        Write-Host '======================================================='; ^
        Write-Host '🎉 SUKSES! Berkas MP3 berhasil di-upload ke ESP32!'; ^
        Write-Host '======================================================='; ^
    } else { Write-Host '[ERROR] Gagal membuat littlefs.bin'; } ^
} else { ^
    Write-Host '[INFO] Tools mklittlefs belum terpasang di Arduino15.'; ^
    Write-Host '[SOLUSI] Gunakan Mode Embedded MP3 (Pilihan A) tanpa perlu alat tambahan!'; ^
} ^
"

echo.
pause
