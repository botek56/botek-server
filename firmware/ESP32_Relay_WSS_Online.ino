/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - ESP32 WEBSOCKET MQTT ONLINE (EEPROM / PREFERENCES)
 * ===================================================================
 *  Server: wss://iot.botek.my.id/mqtt (Cloudflare Tunnel HTTPS/WSS)
 *  Format Data: JSON Structured Payload (ArduinoJson v6)
 *  Fitur Unggulan:
 *   1. MEMORI PERMANEN (Preferences / EEPROM Non-Volatile Memory)
 *      - Jika mati listrik & dinyalakan kembali (tanpa internet sekalipun),
 *        ESP32 LANGSUNG MENGINGAT STATUS RELAY TERAKHIR.
 *   2. Booting Non-Blocking (0.1s Ready)
 *   3. Sakelar Switch Dinding Respon Instan (0 milidetik)
 *   4. Event-Driven Push Sub-Second (Bardi / Blynk Style)
 * ===================================================================
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ===================================================================
// 1. KONFIGURASI WIFI & SERVER BOTEK WSS ONLINE
// ===================================================================
const char* WIFI_SSID     = "Drt.net";       // SSID WiFi Anda
const char* WIFI_PASSWORD = "112345678888";  // Password WiFi Anda

const char* DEVICE_CODE   = "ESP32_ROOM_01"; 

// Cloudflare Tunnel WebSocket Host
const char* WSS_HOST      = "iot.botek.my.id";
const int   WSS_PORT      = 443;
const char* WSS_PATH      = "/mqtt";

// ===================================================================
// 2. KONFIGURASI PIN HARDWARE ESP32
// ===================================================================
const int RELAY_1_PIN  = 18; // Output Relay 1
const int RELAY_2_PIN  = 19; // Output Relay 2

const int BUTTON_1_PIN = 4;  // Input Sakelar Switch 1 (Ke GND)
const int BUTTON_2_PIN = 5;  // Input Sakelar Switch 2 (Ke GND)

const bool IS_ACTIVE_LOW = false; 

// Status Relay lokal
bool relay1State = false;
bool relay2State = false;

// Debounce Sakelar Switch 1
int lastBtn1Reading = HIGH;
int btn1State = HIGH;
unsigned long lastDebounceTime1 = 0;

// Debounce Sakelar Switch 2
int lastBtn2Reading = HIGH;
int btn2State = HIGH;
unsigned long lastDebounceTime2 = 0;

const unsigned long DEBOUNCE_DELAY = 50;

WebSocketsClient webSocket;
Preferences preferences;

// Function Set State Hardware Relay & Simpan ke Memori Permanen (Flash)
void setRelayHardware(int pin, bool turnOn, bool saveMemory = true) {
  if (IS_ACTIVE_LOW) {
    digitalWrite(pin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(pin, turnOn ? HIGH : LOW);
  }

  // Simpan ke Flash Memory Permanen
  if (saveMemory) {
    if (pin == RELAY_1_PIN) {
      preferences.putBool("r1", turnOn);
    } else if (pin == RELAY_2_PIN) {
      preferences.putBool("r2", turnOn);
    }
  }
}

// Function Publish Status Relay ke Web BOTEK via JSON WebSocket
void sendRelayWssJson(const char* controlName, bool isOn) {
  if (webSocket.isConnected()) {
    StaticJsonDocument<128> doc;
    doc["device_code"]  = DEVICE_CODE;
    doc["control_name"] = controlName;
    doc["status"]       = isOn ? "ON" : "OFF";

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    webSocket.sendTXT(jsonPayload);
    Serial.printf("📡 [JSON WSS SEND] %s\n", jsonPayload.c_str());
  }
}

// Handler Peristiwa WebSocket Masuk dari Cloudflare Server BOTEK (Parsing JSON)
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("❌ [WSS] Terputus dari BOTEK Server!");
      break;

    case WStype_CONNECTED:
      Serial.println("✅ [WSS CONNECTED] Terhubung ke wss://iot.botek.my.id/mqtt!");
      // Kirim status awal ke server dalam format JSON
      sendRelayWssJson("Relay 1", relay1State);
      sendRelayWssJson("Relay 2", relay2State);
      break;

    case WStype_TEXT:
      {
        String jsonMsg = String((char*)payload);
        Serial.printf("⚡ [JSON WSS INCOMING] %s\n", jsonMsg.c_str());

        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, jsonMsg);

        if (!err) {
          // Safety Check: Ignore WebSocket messages intended for other device codes
          if (doc.containsKey("device_code")) {
            const char* targetDev = doc["device_code"];
            if (targetDev && String(targetDev).length() > 0 && String(targetDev) != String(DEVICE_CODE)) {
              Serial.printf("⚠️ [WSS IGNORED] Message for '%s' ignored on this device ('%s')\n", targetDev, DEVICE_CODE);
              return;
            }
          }

          const char* name = doc["control_name"] | doc["sensor_name"];
          const char* statusStr = doc["status"] | doc["value"];
          
          if (name && statusStr) {
            bool isOn = (String(statusStr).equalsIgnoreCase("ON") || String(statusStr) == "1");

            if (String(name) == "Relay 1" && relay1State != isOn) {
              relay1State = isOn;
              setRelayHardware(RELAY_1_PIN, relay1State, true);
              Serial.printf("🔘 [INSTANT JSON WSS] Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
            }
            else if (String(name) == "Relay 2" && relay2State != isOn) {
              relay2State = isOn;
              setRelayHardware(RELAY_2_PIN, relay2State, true);
              Serial.printf("🔘 [INSTANT JSON WSS] Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
            }
          }
        }
      }
      break;

    case WStype_BIN:
      break;
  }
}

// Function membaca sakelar switch dinding (Respon 0-Delay Instan)
void handlePhysicalButtons() {
  // 1. SAKELAR SWITCH 1 (RELAY 1)
  int reading1 = digitalRead(BUTTON_1_PIN);
  if (reading1 != lastBtn1Reading) {
    lastDebounceTime1 = millis();
  }
  if ((millis() - lastDebounceTime1) > DEBOUNCE_DELAY) {
    if (reading1 != btn1State) {
      btn1State = reading1;
      
      // CETLEK RELAY INSTAN TANPA DELAY (0 MILIDETIK)
      relay1State = !relay1State; 
      setRelayHardware(RELAY_1_PIN, relay1State, true); 
      Serial.printf("⚡ [INSTANT HARDWARE] Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
      
      sendRelayWssJson("Relay 1", relay1State);
    }
  }
  lastBtn1Reading = reading1;

  // 2. SAKELAR SWITCH 2 (RELAY 2)
  int reading2 = digitalRead(BUTTON_2_PIN);
  if (reading2 != lastBtn2Reading) {
    lastDebounceTime2 = millis();
  }
  if ((millis() - lastDebounceTime2) > DEBOUNCE_DELAY) {
    if (reading2 != btn2State) {
      btn2State = reading2;
      
      // CETLEK RELAY INSTAN TANPA DELAY (0 MILIDETIK)
      relay2State = !relay2State; 
      setRelayHardware(RELAY_2_PIN, relay2State, true); 
      Serial.printf("⚡ [INSTANT HARDWARE] Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
      
      sendRelayWssJson("Relay 2", relay2State);
    }
  }
  lastBtn2Reading = reading2;
}

void setup() {
  Serial.begin(115200);
  
  pinMode(RELAY_1_PIN, OUTPUT);
  pinMode(RELAY_2_PIN, OUTPUT);

  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);

  // 1. INISIALISASI PREFERENCES (MEMORI FLASHDISK ESP32)
  preferences.begin("botek-relay", false);

  // 2. BACA STATUS TERAKHIR DARI FLASHDISK ESP32 (MEMORI PERMANEN)
  relay1State = preferences.getBool("r1", false);
  relay2State = preferences.getBool("r2", false);

  // 3. TERAPKAN KEMBALI STATUS TERAKHIR KE HARDWARE RELAY (SEKETIKA ON BOOT)
  setRelayHardware(RELAY_1_PIN, relay1State, false);
  setRelayHardware(RELAY_2_PIN, relay2State, false);

  Serial.printf("💾 [MEMORI ESP32 BACA] Relay 1: %s | Relay 2: %s\n", 
                relay1State ? "ON" : "OFF", relay2State ? "ON" : "OFF");

  // Inisialisasi WiFi (Non-Blocking Boot)
  Serial.printf("\nMenghubungkan ke WiFi: %s ...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Inisialisasi WebSocket SSL/WSS Cloudflare (wss://iot.botek.my.id:443/mqtt)
  webSocket.beginSSL(WSS_HOST, WSS_PORT, WSS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);

  Serial.println("✅ System BOTEK JSON WSS Ready! (Memori Flash Active)");
}

void loop() {
  handlePhysicalButtons();
  webSocket.loop();
}
