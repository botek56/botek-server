/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - ESP32 WEBSOCKET ONLINE (ALIVE BREATHING LED)
 *  WITH 5V VOLTAGE DIVIDER TELEMETRY SENSOR (GPIO 23 / D23)
 * ===================================================================
 *  Server: wss://iot.botek.my.id/mqtt (Cloudflare Tunnel HTTPS/WSS)
 *  Fitur Unggulan:
 *   1. SENSOR TEGANGAN 5V (ADC GPIO 23 / D23 dengan Resistor Pembagi Tegangan 10k + 10k)
 *   2. EFEK LED "BERNAPAS / ALIVE" (Apple-Style Breathing LED PWM):
 *      - TERHUBUNG 100% (Online) : LED "Bernapas" Halus (Fade In-Out Kontinu)
 *      - SEDANG HUBUNGKAN         : LED Kedip Lambat (1000ms)
 *      - MODE PORTAL SETUP        : LED Kedip Cepat (150ms)
 *   3. WIFIMANAGER DYNAMIC WIFI (Tanpa hardcode SSID/Password)
 *   4. MEMORI PERMANEN (Preferences / Flash Memory)
 *   5. Sakelar Switch Dinding Respon Instan 0-Delay
 *   6. Event-Driven Push Sub-Second (Bardi / Blynk Style)
 * ===================================================================
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WiFiManager.h>

// ===================================================================
// 1. KONFIGURASI PERANGKAT & SERVER BOTEK WSS ONLINE
// ===================================================================
const char* DEVICE_CODE   = "ESP32_ROOM_01"; 

// Cloudflare Tunnel WebSocket Host
const char* WSS_HOST      = "iot.botek.my.id";
const int   WSS_PORT      = 443;
const char* WSS_PATH      = "/mqtt";

// ===================================================================
// 2. KONFIGURASI PIN HARDWARE ESP32
// ===================================================================
const int RELAY_1_PIN     = 18; // Output Relay 1
const int RELAY_2_PIN     = 19; // Output Relay 2

const int BUTTON_1_PIN    = 4;  // Input Sakelar Switch 1 (Ke GND)
const int BUTTON_2_PIN    = 5;  // Input Sakelar Switch 2 (Ke GND)

// LED Indikator Status (Pin GPIO 2 = LED Bawaan Biru pada ESP32 Dev Module)
const int LED_STATUS_PIN  = 2;  

// Pin ADC Sensor Pembagi Tegangan 5V (Pin D23 / GPIO 23)
const int VOLTAGE_ADC_PIN = 33; 

// Parameter Resistor Pembagi Tegangan (Voltage Divider 10k + 10k)
const float R1 = 10000.0;        // 10 kΩ
const float R2 = 10000.0;        // 10 kΩ
const float VREF = 3.3;          // Tegangan acuan ADC ESP32 (3.3V)
const int ADC_RESOLUTION = 4095; // 12-Bit Resolution (0-4095)

const bool IS_ACTIVE_LOW  = false; 

// Status Relay lokal
bool relay1State = false;
bool relay2State = false;

// Debounce Sakelar Switch 1 & 2
int lastBtn1Reading = HIGH;
int btn1State = HIGH;
unsigned long lastDebounceTime1 = 0;

int lastBtn2Reading = HIGH;
int btn2State = HIGH;
unsigned long lastDebounceTime2 = 0;

const unsigned long DEBOUNCE_DELAY = 50;

// Variabel LED Status & Telemetri Non-Blocking
unsigned long lastLedBlinkTime = 0;
bool ledState = false;

unsigned long lastVoltageSendTime = 0;
const unsigned long VOLTAGE_INTERVAL = 2000; // Kirim pembacaan tegangan setiap 2 detik

WebSocketsClient webSocket;
Preferences preferences;
WiFiManager wm;

// Function Membaca Tegangan 5V Menggunakan Pembagi Tegangan (D23 / GPIO 23)
float readVoltage5V() {
  long adcSum = 0;
  // Multisampling 10x untuk meredam noise sinyal analog ADC
  for (int i = 0; i < 10; i++) {
    adcSum += analogRead(VOLTAGE_ADC_PIN);
    delayMicroseconds(100);
  }
  float rawAdc = adcSum / 10.0;

  // Konversi nilai mentah ADC ke Volt pada Pin ESP32 (0 - 3.3V)
  float vAdc = (rawAdc / (float)ADC_RESOLUTION) * VREF;

  // Hitung Tegangan Asli Sumber (5V) berdasarkan rumus Voltage Divider: Vin = Vadc * ((R1 + R2) / R2)
  float vActual = vAdc * ((R1 + R2) / R2);

  return vActual;
}

// Function Set State Hardware Relay & Simpan ke Memori Permanen (Flash)
void setRelayHardware(int pin, bool turnOn, bool saveMemory = true) {
  if (IS_ACTIVE_LOW) {
    digitalWrite(pin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(pin, turnOn ? HIGH : LOW);
  }

  if (saveMemory) {
    if (pin == RELAY_1_PIN) {
      preferences.putBool("r1", turnOn);
    } else if (pin == RELAY_2_PIN) {
      preferences.putBool("r2", turnOn);
    }
  }
}

// Function Update Indikator LED "Bernapas / Alive" (ESP32 Core 3.x API)
void updateStatusLed() {
  unsigned long now = millis();

  // Mode 1: 100% ONLINE READY -> EFEK LED "BERNAPAS / ALIVE" (Fade In-Out Halus 0-255)
  if (WiFi.status() == WL_CONNECTED && webSocket.isConnected()) {
    float breath = (exp(sin(now / 2500.0 * 2.0 * M_PI)) - 0.36787944) * 108.0;
    int brightness = constrain((int)breath, 0, 255);
    ledcWrite(LED_STATUS_PIN, brightness);
  }
  // Mode 2: Wi-Fi Terhubung, Sedang Hubungkan ke Server WSS -> KEDIP LAMBAT (1000ms)
  else if (WiFi.status() == WL_CONNECTED && !webSocket.isConnected()) {
    if (now - lastLedBlinkTime >= 1000) {
      lastLedBlinkTime = now;
      ledState = !ledState;
      ledcWrite(LED_STATUS_PIN, ledState ? 255 : 0);
    }
  }
  // Mode 3: Menghubungkan ke Wi-Fi / Mode Setup Portal -> KEDIP CEPAT (150ms)
  else if (WiFi.status() != WL_CONNECTED) {
    if (now - lastLedBlinkTime >= 150) {
      lastLedBlinkTime = now;
      ledState = !ledState;
      ledcWrite(LED_STATUS_PIN, ledState ? 255 : 0);
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

// Function Publish Telemetri Tegangan 5V ke Web BOTEK via JSON WebSocket
void sendVoltageWssJson(float voltageVal) {
  if (webSocket.isConnected()) {
    StaticJsonDocument<128> doc;
    doc["device_code"] = DEVICE_CODE;
    doc["sensor_name"] = "Voltage";
    doc["sensor_type"] = "Voltage";
    doc["unit"]        = "V";
    doc["value"]       = String(voltageVal, 2);

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    webSocket.sendTXT(jsonPayload);
    Serial.printf("📊 [TELEMETRY WSS] Voltage: %.2f V | Payload: %s\n", voltageVal, jsonPayload.c_str());
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
      sendRelayWssJson("Relay 1", relay1State);
      sendRelayWssJson("Relay 2", relay2State);
      sendVoltageWssJson(readVoltage5V());
      break;

    case WStype_TEXT:
      {
        String jsonMsg = String((char*)payload);
        Serial.printf("⚡ [JSON WSS INCOMING] %s\n", jsonMsg.c_str());

        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, jsonMsg);

        if (!err) {
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
      
      relay2State = !relay2State; 
      setRelayHardware(RELAY_2_PIN, relay2State); 
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

  // Konfigurasi ADC ESP32 untuk Pembacaan Tegangan pada Pin D23 (GPIO 23)
  analogReadResolution(12);             // 12-Bit Resolution (0-4095)
  analogSetAttenuation(ADC_11db);        // Rentang pengukuran ADC 0 - 3.3V
  pinMode(VOLTAGE_ADC_PIN, INPUT);

  // Inisialisasi PWM LEDC untuk Efek LED Bernapas (ESP32 Core 3.x API: GPIO 2)
  ledcAttach(LED_STATUS_PIN, 5000, 8); // Pin, 5 kHz, 8-bit resolution (0-255)
  ledcWrite(LED_STATUS_PIN, 0);

  // 1. MEMORI PERMANEN PREFERENCES
  preferences.begin("botek-relay", false);
  relay1State = preferences.getBool("r1", false);
  relay2State = preferences.getBool("r2", false);

  setRelayHardware(RELAY_1_PIN, relay1State, false);
  setRelayHardware(RELAY_2_PIN, relay2State, false);

  Serial.printf("💾 [MEMORI PREFERENCES] Relay 1: %s | Relay 2: %s\n", 
                relay1State ? "ON" : "OFF", relay2State ? "ON" : "OFF");

  // 2. WIFIMANAGER DYNAMIC CONNECT
  wm.setConfigPortalTimeout(120);
  wm.setConnectTimeout(10);
  
  Serial.println("🌐 Memulai AutoConnect WiFiManager...");
  if (!wm.autoConnect("BOTEK-SETUP")) {
    Serial.println("⚠️ Gagal konek / Portal timeout. Sakelar fisik tetap aktif offline.");
  } else {
    Serial.println("✅ WiFi Terhubung via WiFiManager!");
  }

  // 3. Inisialisasi WebSocket SSL/WSS Cloudflare (wss://iot.botek.my.id:443/mqtt)
  webSocket.beginSSL(WSS_HOST, WSS_PORT, WSS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);

  Serial.println("✅ System BOTEK JSON WSS Ready! (5V Voltage ADC Sensor & Alive Breathing LED Active)");
}

void loop() {
  handlePhysicalButtons();
  updateStatusLed(); // Update Efek LED "Bernapas / Alive" Non-Blocking
  webSocket.loop();

  // Transmisi Pembacaan Sensor Tegangan 5V secara Berkala (Setiap 2 Detik, Non-Blocking)
  unsigned long now = millis();
  if (now - lastVoltageSendTime >= VOLTAGE_INTERVAL) {
    lastVoltageSendTime = now;
    if (webSocket.isConnected()) {
      float v5v = readVoltage5V();
      sendVoltageWssJson(v5v);
    }
  }
}
