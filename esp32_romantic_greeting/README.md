# 💖 Proyek Web Server ESP32 Ucapan Romantis (DUAL MODE: AP + Wi-Fi Rumah)

Proyek ini membuat ESP32 bertindak sebagai **Web Server Dual-Mode**:
1. **Mode Wi-Fi Rumah (STA)**: ESP32 terhubung ke Wi-Fi rumah Anda, sehingga Anda bisa menguji coba tampilan web dari **Laptop** via IP atau `http://ucapan-sayang.local`.
2. **Mode Hotspot (AP + Captive Portal)**: Saat dibawa ke luar (dicolok ke Powerbank), HP pasangan tinggal konek ke Wi-Fi ESP32 dan web ucapan akan **otomatis pop-up**!

---

## ⚙️ Pengaturan Wi-Fi pada Kode ESP32

Buka berkas [`esp32_romantic_greeting.ino`](file:///d:/BOTEK/esp32_romantic_greeting/esp32_romantic_greeting.ino) di Arduino IDE:

### 1. Masukkan Wi-Fi Rumah Anda (Baris 20-21)
```cpp
const char* sta_ssid     = "NAMA_WIFI_RUMAH_ANDA";     // <-- Ganti dengan SSID Wi-Fi Rumah
const char* sta_password = "PASSWORD_WIFI_RUMAH_ANDA"; // <-- Ganti dengan Password Wi-Fi Rumah
```

---

## 💻 Cara Menguji Coba dari Laptop

1. Setelah kode di-upload ke ESP32, buka **Serial Monitor** di Arduino IDE (`Baudrate: 115200`).
2. ESP32 akan menampilkan informasi alamat IP lokal:
   ```text
   [STA Mode] ✅ Terhubung ke Wi-Fi Rumah!
   [STA Mode] Alamat IP Laptop: http://192.168.1.150
   [mDNS] ✅ Domain Lokal Aktif: http://ucapan-sayang.local
   ```
3. Buka browser di Laptop (Chrome/Edge/Firefox) yang terhubung ke Wi-Fi rumah yang sama.
4. Ketik salah satu alamat berikut:
   * **`http://ucapan-sayang.local`** (Domain Lokal)
   * Atau alamat IP ESP32 (contoh: **`http://192.168.1.150`**).
5. Halaman web ucapan romantis akan langsung terbuka di laptop Anda!

---

## 🎁 Cara Menggunakannya Saat Kejutan (Untuk Pasangan)
* Anda **tidak perlu mengubah kode apapun lagi**! 
* Walaupun ESP32 dibawa ke luar rumah (tanpa ada Wi-Fi rumah), ESP32 akan tetap memancarkan Hotspot **`💖 Pesan Khusus Untukmu 💖`** secara otomatis. Pasangan Anda tinggal menyambungkan HP-nya ke Wi-Fi tersebut dan web akan **otomatis pop-up**.
