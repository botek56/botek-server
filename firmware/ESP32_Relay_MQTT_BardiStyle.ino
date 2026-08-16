/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - ESP32 MQTT PERSISTENT FIRMWARE (NON-BLOCKING)
 * ===================================================================
 *  Bardi / Blynk Style: Event-Driven Push (< 0.01 detik)
 *  Anti-Crash & Anti-Watchdog Reboot (Zero Blocking Loop)
 * ===================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ===================================================================
// 1. KONFIGURASI WIFI & MQTT BROKER BOTEK
// ===================================================================
const char* WIFI_SSID     = "Drt.net";       // SSID WiFi Anda
const char* WIFI_PASSWORD = "112345678888";  // Password WiFi Anda

const char* DEVICE_CODE   = "ESP32_ROOM_01"; 

// Host MQTT Broker BOTEK (IP Laptop Server BOTEK Anda)
const char* MQTT_SERVER   = "192.168.1.6";   
const int   MQTT_PORT     = 1883;            // Port TCP MQTT BOTEK

// ===================================================================
// 2. KONFIGURASI PIN HARDWARE ESP32
// ===================================================================
const int RELAY_1_PIN  = 18; // Output Relay 1
const int RELAY_2_PIN  = 19; // Output Relay 2

const int BUTTON_1_PIN = 4;  // Input Sakelar Switch 1 (Ke GND)
const int BUTTON_2_PIN = 5;  // Input Sakelar Switch 2 (Ke GND)

// Tipe Relay: set false jika Active HIGH, set true jika Active LOW
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

// Timer non-blocking reconnect MQTT
unsigned long lastMqttReconnectAttempt = 0;

WiFiClient espClient;
PubSubClient mqttClient(espClient);

void setRelayHardware(int pin, bool turnOn) {
  if (IS_ACTIVE_LOW) {
    digitalWrite(pin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(pin, turnOn ? HIGH : LOW);
  }
}

// Function Publish Status Relay ke MQTT Broker (Dipanggil saat sakelar fisik di-ceklik)
void publishRelayState(const char* controlName, bool isOn) {
  if (mqttClient.connected()) {
    String topic = "botek/" + String(DEVICE_CODE) + "/relay/" + String(controlName);
    String payload = isOn ? "ON" : "OFF";
    mqttClient.publish(topic.c_str(), payload.c_str(), true);
    Serial.printf("📡 [MQTT PUSH EVENT] %s -> %s\n", topic.c_str(), payload.c_str());
  }
}

// ===================================================================
// CALLBACK INSTANT: PERINTAH MASUK DARI WEBSITE / SERVER (< 0.01 DETIK)
// ===================================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  
  Serial.printf("\n⚡ [EVENT DARI WEB / SERVER] Topik: %s | Pesan: %s\n", topic, message.c_str());
  
  String topicStr = String(topic);
  bool isOn = (message.equalsIgnoreCase("ON") || message == "1");

  // Sakelar Relay 1 diubah dari Web
  if (topicStr.endsWith("/Relay 1")) {
    if (relay1State != isOn) {
      relay1State = isOn;
      setRelayHardware(RELAY_1_PIN, relay1State);
      Serial.printf("🔘 [INSTANT PUSH] Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
    }
  } 
  // Sakelar Relay 2 diubah dari Web
  else if (topicStr.endsWith("/Relay 2")) {
    if (relay2State != isOn) {
      relay2State = isOn;
      setRelayHardware(RELAY_2_PIN, relay2State);
      Serial.printf("🔘 [INSTANT PUSH] Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
    }
  }
}

// ===================================================================
// RECONNECT MQTT NON-BLOCKING (ANTI-TIMEOUT RC=-4)
// ===================================================================
bool reconnectMQTTNonBlocking() {
  espClient.stop(); // Bersihkan socket lama
  
  String clientId = "BOTEK-ESP32-" + String(DEVICE_CODE);
  
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("\n✅ [CONNECTED] Terhubung ke BOTEK MQTT Broker!");
    
    // Publish status ONLINE
    String lwtTopic = "botek/" + String(DEVICE_CODE) + "/status";
    mqttClient.publish(lwtTopic.c_str(), "ONLINE", true);
    
    // Subscribe ke seluruh perintah relay: botek/{DEVICE_CODE}/relay/#
    String subTopic = "botek/" + String(DEVICE_CODE) + "/relay/#";
    mqttClient.subscribe(subTopic.c_str());
    Serial.printf("📡 [EVENT LISTENER] Subscribed ke: %s\n", subTopic.c_str());

    // Sync status awal ke server
    publishRelayState("Relay 1", relay1State);
    publishRelayState("Relay 2", relay2State);
    return true;
  }
  Serial.printf(" Gagal (RC=%d)\n", mqttClient.state());
  return false;
}

// ===================================================================
// HARDWARE & SAKELAR FISIK (RESPON INSTAN 0 MILIDETIK)
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
      
      // CETLEK RELAY INSTAN TANPA DELAY (0 MILIDETIK)
      relay1State = !relay1State; 
      setRelayHardware(RELAY_1_PIN, relay1State); 
      Serial.printf("⚡ [INSTANT HARDWARE] Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
      
      // Publish event ke server MQTT
      publishRelayState("Relay 1", relay1State);
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
      setRelayHardware(RELAY_2_PIN, relay2State); 
      Serial.printf("⚡ [INSTANT HARDWARE] Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
      
      // Publish event ke server MQTT
      publishRelayState("Relay 2", relay2State);
    }
  }
  lastBtn2Reading = reading2;
}

void setup() {
  Serial.begin(115200);
  
  pinMode(RELAY_1_PIN, OUTPUT);
  pinMode(RELAY_2_PIN, OUTPUT);
  setRelayHardware(RELAY_1_PIN, relay1State);
  setRelayHardware(RELAY_2_PIN, relay2State);

  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);

  Serial.printf("\nMenghubungkan ke WiFi: %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Terhubung!");

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("✅ System BOTEK MQTT (Non-Blocking Bardi/Blynk Style) Ready!");
}

void loop() {
  // 1. Sakelar fisik instan (0-delay)
  handlePhysicalButtons();

  // 2. Non-blocking MQTT reconnect & processing
  if (!mqttClient.connected()) {
    unsigned long now = millis();
    if (now - lastMqttReconnectAttempt > 3000) {
      lastMqttReconnectAttempt = now;
      Serial.print("Menghubungkan ke BOTEK MQTT Broker...");
      if (reconnectMQTTNonBlocking()) {
        lastMqttReconnectAttempt = 0;
      }
    }
  } else {
    mqttClient.loop(); // Memproses event MQTT masuk instan (< 0.01s)
  }
}
