# 📌 CATATAN RINGKAS (NOTE): PEMINDAHAN SERVER BOTEK IOT

> [!NOTE]
> Gunakan catatan ringkas ini sebagai panduan cepat (cheatsheet) saat memindahkan server BOTEK ke laptop baru.

---

### 📝 1. APLIKASI YANG HARUS DI-INSTALL (LAPTOP BARU)
- [ ] **Node.js LTS (v18 / v20)** ➔ Runtime server ([nodejs.org](https://nodejs.org/))
- [ ] **Git for Windows** ➔ Terminal Git Bash ([git-scm.com](https://git-scm.com/))
- [ ] **PM2 Manager** ➔ Ketik perintah: `npm install -g pm2`
- [ ] **Cloudflared** ➔ Untuk tunnel domain `iot.botek.my.id`

---

### 📦 2. ATURAN COPY-PASTE BERKAS

> [!IMPORTANT]
> **✅ WAJIB DI-COPY:**
> - 🗄️ **`sensor.db`** (*Database akun user, device, & history — SANGAT PENTING!*)
> - 📄 `server.js` & `database.js`
> - 📄 `package.json` & `package-lock.json`
> - 📁 `public/` (*Dashboard UI*) & 📁 `firmware/` (*Program ESP32*)
> - 📜 `start-botek.bat`, `stop-botek.bat`, `notify.ps1`, `register_tasks.ps1`
> 
> **❌ DILARANG DI-COPY:**
> - ❌ Folder **`node_modules/`** (*Wajib dibuat baru di laptop baru via `npm install`*)

---

### 🚀 3. PERINTAH TERMINAL (EKSEKUSI A - Z)

```powershell
# Langkah 1: Masuk ke folder proyek di laptop baru
cd D:\BOTEK

# Langkah 2: Install ulang semua pustaka & dependencies
npm install

# Langkah 3: Tes jalankan server secara manual
node server.js
# (Tekan Ctrl + C jika sudah muncul "Database connected" & "Port 3000 running")

# Langkah 4: Jalankan server di background menggunakan PM2
pm2 start server.js --name botek
pm2 save

# Langkah 5: Hubungkan Cloudflare Tunnel (Domain iot.botek.my.id)
cloudflared service install <TOKEN_CLOUDFLARE_TUNNEL_ANDA>
# Atau via PM2:
pm2 start "cloudflared tunnel run" --name cloudflared
pm2 save
```

---

### ⚡ 4. CATATAN KONEKSI HARDWARE ESP32

> [!TIP]
> **ESP32 TIDAK PERLU DIPROGRAM / DI-FLASH ULANG!**  
> Firmware utama ESP32 sudah menggunakan domain publik `iot.botek.my.id`. Begitu Cloudflare Tunnel di laptop baru aktif, semua alat ESP32 akan langsung terhubung secara otomatis ke laptop baru.

---

### ⚠️ 5. CATATAN SOLUSI CEPAT (TROUBLESHOOTING NOTE)

> [!WARNING]
> - **Error `MODULE_NOT_FOUND` / bcrypt / sqlite3**: Hapus folder `node_modules`, lalu jalankan `npm install` ulang.
> - **Error Port 3000 / 1883 Terpakai**: Jalankan `npx kill-port 3000` lalu restart PM2.
> - **Status ESP32 Offline**: Cek apakah service `cloudflared` sudah online dengan perintah `pm2 list`.
