/*
  ==============================================================
  BOTEK IoT Console - ESP32 Firmware with PWM Dimmer Support
  ==============================================================
  Fitur:
  - Kontrol Relay ON/OFF standar (Pin GPIO 26, 27, 14, 12)
  - Kontrol Dimmer PWM / Speed Control 0 - 100% (Pin GPIO 13 - LEDC PWM Channel 0)
  - Mengirimkan telemetry real-time ke BOTEK Console
  - Membaca instruksi status Dimmer (0 - 100) via WebSocket / MQTT
  ==============================================================
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ==========================================
// KONFIGURASI WIFI & BOTEK SERVER
// ==========================================
const char* ssid          = "NAMA_WIFI_ANDA";
const char* password      = "PASSWORD_WIFI_ANDA";
const char* botek_server  = "192.168.1.100";  // Ganti dengan IP/Domain BOTEK Server Anda
const int   botek_port    = 3000;             // Port BOTEK Console HTTP/WS
const char* device_code   = "ESP32-DIMMER-01"; // Kode Unik Perangkat BOTEK Anda

// ==========================================
// KONFIGURASI PIN PWM DIMMER & RELAY
// ==========================================
#define PWM_DIMMER_PIN   13  // Pin Output PWM (LED Dimmer / Fan Speed)
#define PWM_CHANNEL      0   // LEDC Channel 0
#define PWM_FREQ         5000// Frekuensi PWM 5kHz
#define PWM_RESOLUTION   8   // Resolusi 8-bit (0 - 255)

#define RELAY1_PIN       26  // Relay 1
#define RELAY2_PIN       27  // Relay 2

WebSocketsClient webSocket;
unsigned long lastTelemetrySend = 0;
int currentDimmerPercent = 0;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("❌ Terputus dari BOTEK Server!");
      break;
    case WStype_CONNECTED:
      Serial.println("✅ Terhubung ke BOTEK WebSocket Server!");
      // Registrasi Perangkat ke Server
      webSocket.sendTXT("{\"type\":\"register\",\"device_code\":\"" + String(device_code) + "\"}");
      break;
    case WStype_TEXT: {
      Serial.printf("📩 Pesan Masuk: %s\n", payload);
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (!error) {
        String action = doc["action"] | "";
        String controlName = doc["control_name"] | "";
        String status = doc["status"] | "";

        // Handle Perintah Dimmer PWM (Nilai 0 - 100)
        if (controlName.equalsIgnoreCase("Dimmer") || controlName.equalsIgnoreCase("PWM") || controlName.equalsIgnoreCase("Speed")) {
          int percent = status.toInt();
          percent = constrain(percent, 0, 100);
          currentDimmerPercent = percent;

          // Konversi Persentase 0-100% ke Duty Cycle 8-bit PWM (0 - 255)
          int dutyCycle = map(percent, 0, 100, 0, 255);
          ledcWrite(PWM_CHANNEL, dutyCycle);

          Serial.printf("🎚️ [PWM DIMMER] Intensitas diset ke: %d%% (Duty: %d/255)\n", percent, dutyCycle);
        }

        // Handle Perintah Relay Standar (ON / OFF)
        if (controlName.equalsIgnoreCase("Relay 1")) {
          digitalWrite(RELAY1_PIN, (status == "ON") ? LOW : HIGH);
        } else if (controlName.equalsIgnoreCase("Relay 2")) {
          digitalWrite(RELAY2_PIN, (status == "ON") ? LOW : HIGH);
        }
      }
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // Setup Pin Output Relay
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, HIGH); // OFF (Active LOW)
  digitalWrite(RELAY2_PIN, HIGH);

  // Setup ESP32 PWM (LEDC Channel)
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PWM_DIMMER_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0); // Mula-mula Dimmer OFF (0%)

  // Koneksi WiFi
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());

  // Inisialisasi WebSocket ke BOTEK Server
  webSocket.begin(botek_server, botek_port, "/ws");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();

  // Kirimkan Pembacaan Telemetri Real-Time Setiap 3 Detik
  if (millis() - lastTelemetrySend >= 3000) {
    lastTelemetrySend = millis();

    StaticJsonDocument<256> doc;
    doc["device_code"] = device_code;

    JsonObject data = doc.createNestedObject("data");
    data["Dimmer"] = currentDimmerPercent;
    data["Relay1"] = (digitalRead(RELAY1_PIN) == LOW) ? 1 : 0;
    data["Relay2"] = (digitalRead(RELAY2_PIN) == LOW) ? 1 : 0;

    String output;
    serializeJson(doc, output);
    webSocket.sendTXT(output);
  }
}
