/*
 * ===========================================================================
 * ESP32 WEB SERVER UCAPAN ROMANTIS (GENERIC LITTLEFS FILE STREAMER)
 * TEMA: WARM GOLD / KUNING GRADIENT ELEGANT
 * ===========================================================================
 * Mendukung pengiriman otomatis seluruh foto (.jpeg/.jpg), musik (.mp3),
 * dan halaman web (.html) langsung dari memori LittleFS ESP32.
 * Kompilasi ultra kilat (3 Detik)!
 * ===========================================================================
 */

#include <WiFi.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <LittleFS.h>

// ---------------------------------------------------------------------------
// 1. PENGATURAN HOTSPOT ESP32
// ---------------------------------------------------------------------------
const char* ap_ssid     = "BOTEK";
const char* ap_password = "277566aldy";

// Nama hosting offline
const char* hostname = "ArellGendut";

// IP Hotspot ESP32
const byte DNS_PORT = 53;
IPAddress apIP(192, 168, 4, 1);
IPAddress netMsk(255, 255, 255, 0);

DNSServer dnsServer;
WebServer server(80);

// Deteksi Jenis File Otomatis (HTML, JPEG, MP3, DLL)
String getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css"))  return "text/css";
  if (filename.endsWith(".js"))   return "application/javascript";
  if (filename.endsWith(".png"))  return "image/png";
  if (filename.endsWith(".gif"))  return "image/gif";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".ico"))  return "image/x-icon";
  if (filename.endsWith(".mp3"))  return "audio/mpeg";
  return "text/plain";
}

// Handler Pembacaan Seluruh File di Memori LittleFS
bool handleFileRead(String path) {
  if (path.endsWith("/")) path += "index.html";

  String contentType = getContentType(path);

  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    server.streamFile(file, contentType);
    file.close();
    return true;
  }

  return false;
}

// Handler Halaman Utama
void handleRoot() {
  if (!handleFileRead("/index.html")) {
    server.send(
      200,
      "text/html",
      "<h2>Web Server Siap! Upload data via LittleFS Data Upload</h2>"
    );
  }
}

// Handler Router Utama & Captive Portal Auto-Detect
void handleNotFound() {
  String uri = server.uri();

  if (handleFileRead(uri)) return;

  handleRoot();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================================");
  Serial.println("💖 ESP32 ROMANTIC GREETING SERVER STARTED 💖");
  Serial.println("=============================================");

  // 1. Inisialisasi LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("[LittleFS] ⚠️ Gagal Mount File System LittleFS");
  } else {
    Serial.println("[LittleFS] ✅ Memori Flash LittleFS Siap!");
  }

  // 2. Mode Wi-Fi AP SAJA
  WiFi.mode(WIFI_AP);

  WiFi.softAPConfig(apIP, apIP, netMsk);
  WiFi.softAP(ap_ssid, ap_password);

  Serial.print("[AP Mode] Hotspot Dibuat: ");
  Serial.println(ap_ssid);

  Serial.print("[AP Mode] IP Hotspot: ");
  Serial.println(WiFi.softAPIP());

  // -------------------------------------------------------------------------
  // 3. DNS SERVER UNTUK HOSTING OFFLINE
  // -------------------------------------------------------------------------
  // Semua nama domain diarahkan ke ESP32
  dnsServer.start(DNS_PORT, "*", apIP);

  Serial.print("[Hosting] Nama: http://");
  Serial.println(hostname);

  Serial.print("[Hosting] Alamat IP: http://");
  Serial.println(apIP);

  // -------------------------------------------------------------------------
  // 4. Router URL Server
  // -------------------------------------------------------------------------
  server.on("/", handleRoot);

  server.on("/generate_204", handleRoot);
  server.on("/fwlink", handleRoot);
  server.on("/hotspot-detect.html", handleRoot);
  server.on("/connecttest.txt", handleRoot);

  server.onNotFound(handleNotFound);

  server.begin();

  Serial.println("=============================================");
  Serial.println("✨ Web Server Siap Digunakan! ✨");
  Serial.println("=============================================");
  Serial.print("🌐 Hosting Offline: http://");
  Serial.println(hostname);
  Serial.println("🌐 IP Server: http://192.168.4.1");
  Serial.println();
}

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
}
