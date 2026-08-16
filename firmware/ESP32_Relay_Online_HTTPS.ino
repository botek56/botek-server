/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - ESP32 DUAL-CORE ONLINE FIRMWARE (FREERTOS)
 * ===================================================================
 *  SOLUSI 0-DELAY ULTIMATE:
 *   - Core 1 (Hardware): Menangani sakelar fisik & relay GPIO 18/19 (0 MILIDETIK / INSTAN)
 *   - Core 0 (Network): Menangani HTTPS POST/GET ke Cloudflare di background
 *   
 *  Hardware tidak akan pernah terhambat oleh lag internet/HTTPS!
 * ===================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ===================================================================
// 1. KONFIGURASI WIFI & SERVER BOTEK ONLINE
// ===================================================================
const char* WIFI_SSID     = "Drt.net";       // SSID WiFi Anda
const char* WIFI_PASSWORD = "112345678888";  // Password WiFi Anda

const char* DEVICE_CODE   = "ESP32_ROOM_01"; 
const String SERVER_URL   = "https://iot.botek.my.id";

// ===================================================================
// 2. KONFIGURASI PIN HARDWARE ESP32
// ===================================================================
const int RELAY_1_PIN  = 18; // Output Relay 1
const int RELAY_2_PIN  = 19; // Output Relay 2

const int BUTTON_1_PIN = 4;  // Input Sakelar Switch 1 (Ke GND)
const int BUTTON_2_PIN = 5;  // Input Sakelar Switch 2 (Ke GND)

const bool IS_ACTIVE_LOW = false; 

// Status Relay lokal (Volatile agar aman diakses 2 Core)
volatile bool relay1State = false;
volatile bool relay2State = false;

// Flags untuk mengirim data ke server di background
volatile bool pendingSyncRelay1 = false;
volatile bool pendingSyncRelay2 = false;

// Debounce Sakelar Switch 1
int lastBtn1Reading = HIGH;
int btn1State = HIGH;
unsigned long lastDebounceTime1 = 0;

// Debounce Sakelar Switch 2
int lastBtn2Reading = HIGH;
int btn2State = HIGH;
unsigned long lastDebounceTime2 = 0;

const unsigned long DEBOUNCE_DELAY = 50;

// Task Handle untuk Core 0
TaskHandle_t NetworkTaskHandle;

// Function Set State Hardware Relay (Instant)
void setRelayHardware(int pin, bool turnOn) {
  if (IS_ACTIVE_LOW) {
    digitalWrite(pin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(pin, turnOn ? HIGH : LOW);
  }
}

// Function Sync Status Relay dari ESP32 ke Server (HTTPS POST - Berjalan di Core 0)
void syncRelayToServer(const char* sensorName, bool isOn) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = SERVER_URL + "/api/device/" + String(DEVICE_CODE) + "/sensor";
  
  if (http.begin(client, url)) {
    http.setReuse(true);
    http.setTimeout(1500);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<128> doc;
    doc["sensor_name"] = sensorName;
    doc["value"]       = isOn ? "ON" : "OFF";

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
      Serial.printf("🌐 [BACKGROUND SYNC] %s -> %s (HTTP %d)\n", sensorName, isOn ? "ON" : "OFF", httpCode);
    }
    http.end();
  }
}

// Function Polling Status Relay dari Server (HTTPS GET - Berjalan di Core 0)
void fetchRelayStatusFromServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = SERVER_URL + "/api/device/" + String(DEVICE_CODE) + "/controls";

  if (http.begin(client, url)) {
    http.setReuse(true);
    http.setTimeout(1500);
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      
      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, payload);
      
      if (!error && doc.is<JsonArray>()) {
        JsonArray array = doc.as<JsonArray>();
        for (JsonObject item : array) {
          const char* name = item["control_name"];
          const char* statusStr = item["status"];
          bool isOn = (String(statusStr).equalsIgnoreCase("ON") || String(statusStr) == "1");

          if (String(name) == "Relay 1" && isOn != relay1State && !pendingSyncRelay1) {
            relay1State = isOn;
            setRelayHardware(RELAY_1_PIN, relay1State);
            Serial.printf("🔘 [WEB UPDATE] Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
          }
          else if (String(name) == "Relay 2" && isOn != relay2State && !pendingSyncRelay2) {
            relay2State = isOn;
            setRelayHardware(RELAY_2_PIN, relay2State);
            Serial.printf("🔘 [WEB UPDATE] Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
          }
        }
      }
    }
    http.end();
  }
}

// ===================================================================
// TASK NETWORK & INTERNET (BERJALAN INDEPENDEN DI CORE 0)
// ===================================================================
void networkTaskLoop(void * pvParameters) {
  // Connect WiFi di Core 0
  Serial.printf("\n[CORE 0] Menghubungkan ke WiFi: %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(400 / portTICK_PERIOD_MS);
    Serial.print(".");
  }
  Serial.println("\n✅ [CORE 0] WiFi Terhubung ke Internet!");

  unsigned long lastPollTime = 0;

  for (;;) {
    // 1. Cek apakah ada antrean sync dari sakelar fisik
    if (pendingSyncRelay1) {
      syncRelayToServer("Relay 1", relay1State);
      pendingSyncRelay1 = false;
    }
    if (pendingSyncRelay2) {
      syncRelayToServer("Relay 2", relay2State);
      pendingSyncRelay2 = false;
    }

    // 2. Polling status dari website setiap 1 detik
    unsigned long now = millis();
    if (now - lastPollTime >= 1000) {
      lastPollTime = now;
      fetchRelayStatusFromServer();
    }

    vTaskDelay(50 / portTICK_PERIOD_MS); // Give time to watchdog
  }
}

// ===================================================================
// HARDWARE & SAKELAR FISIK (BERJALAN DI CORE 1 / MAIN LOOP)
// ===================================================================
void handlePhysicalButtons() {
  // 1. SAKELAR SWITCH 1 (RELAY 1)
  int reading1 = digitalRead(BUTTON_1_PIN);
  if (reading1 != lastBtn1Reading) {
    lastDebounceTime1 = millis();
  }
  if ((millis() - lastDebounceTime1) > DEBOUNCE_DELAY) {
    if (reading1 != btn1State) {
      btn1State = reading1;
      
      // CETLEK RELAY INSTAN TANPA WAIT NETWORK (0 MILIDETIK)
      relay1State = !relay1State; 
      setRelayHardware(RELAY_1_PIN, relay1State); 
      Serial.printf("⚡ [INSTANT HARDWARE] Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
      
      // Beritahu Core 0 untuk sync ke web di background
      pendingSyncRelay1 = true;
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
      
      // CETLEK RELAY INSTAN TANPA WAIT NETWORK (0 MILIDETIK)
      relay2State = !relay2State; 
      setRelayHardware(RELAY_2_PIN, relay2State); 
      Serial.printf("⚡ [INSTANT HARDWARE] Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
      
      // Beritahu Core 0 untuk sync ke web di background
      pendingSyncRelay2 = true;
    }
  }
  lastBtn2Reading = reading2;
}

void setup() {
  Serial.begin(115200);
  
  // Setup Hardware Output & Input
  pinMode(RELAY_1_PIN, OUTPUT);
  pinMode(RELAY_2_PIN, OUTPUT);
  setRelayHardware(RELAY_1_PIN, relay1State);
  setRelayHardware(RELAY_2_PIN, relay2State);

  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);

  // BUAT TASK NETWORK DI CORE 0 (Supaya urusan internet terpisah total dari hardware)
  xTaskCreatePinnedToCore(
    networkTaskLoop,     /* Task function. */
    "NetworkTask",       /* name of task. */
    10000,               /* Stack size of task */
    NULL,                /* parameter of the task */
    1,                   /* priority of the task */
    &NetworkTaskHandle,  /* Task handle to keep track of created task */
    0                    /* pin task to core 0 */
  );

  Serial.println("✅ Core 1 (Hardware) & Core 0 (Network) Aktif!");
}

void loop() {
  // Core 1 murni menangani sakelar fisik & relay (SEKETIKA / 0-DELAY)
  handlePhysicalButtons();
  delay(1); // Small delay to yield
}
