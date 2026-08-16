/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - ESP32 RELAY (PIN 18 & 19) + SINKRON TOMBOL FISIK
 * ===================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ===================================================================
// 1. KONFIGURASI WIFI & SERVER BOTEK MQTT
// ===================================================================
const char* WIFI_SSID     = "Drt.net";       // SSID WiFi Anda
const char* WIFI_PASSWORD = "112345678888";  // Password WiFi Anda

// Device Code disesuaikan dengan kode perangkat di Dashboard BOTEK Anda
const char* DEVICE_CODE   = "ESP32_ROOM_01"; 

// Host / IP Server Botek
// PENTING: Gunakan Hostname/IP SAJA, TANPA "https://" atau "http://" !
// 1. Untuk Akses Lokal (Wi-Fi Rumah): gunakan IP Laptop "192.168.1.6"
// 2. Untuk Domain Publik: gunakan "iot.botek.my.id" (TANPA https://)
const char* MQTT_SERVER   = "192.168.1.6"; 
const int   MQTT_PORT     = 1883;

// ===================================================================
// 2. KONFIGURASI PIN HARDWARE ESP32
// ===================================================================
const int RELAY_1_PIN  = 18; // Output Relay 1
const int RELAY_2_PIN  = 19; // Output Relay 2

const int BUTTON_1_PIN = 4;  // Input Tombol Fisik Relay 1 (Ke GND)
const int BUTTON_2_PIN = 5;  // Input Tombol Fisik Relay 2 (Ke GND)

// Tipe Relay Module:
// Set true  => ACTIVE LOW  (Relay ON saat LOW, OFF saat HIGH)
// Set false => ACTIVE HIGH (Relay ON saat HIGH, OFF saat LOW)
const bool IS_ACTIVE_LOW = false; 

// ===================================================================
// VARIABEL STATUS RELAY & DEBOUNCE TOMBOL
// ===================================================================
bool relay1State = false; // false = OFF, true = ON
bool relay2State = false;

int lastBtn1Reading = HIGH;
int btn1State = HIGH;
unsigned long lastDebounceTime1 = 0;

int lastBtn2Reading = HIGH;
int btn2State = HIGH;
unsigned long lastDebounceTime2 = 0;

const unsigned long DEBOUNCE_DELAY = 50; // Delay anti-bounce (50 ms)

WiFiClient espClient;
PubSubClient mqttClient(espClient);

void setRelayHardware(int pin, bool turnOn) {
  if (IS_ACTIVE_LOW) {
    digitalWrite(pin, turnOn ? LOW : HIGH);
  } else {
    digitalWrite(pin, turnOn ? HIGH : LOW);
  }
}

void publishRelayStatus(const char* controlName, bool isOn) {
  if (mqttClient.connected()) {
    String topic = "botek/" + String(DEVICE_CODE) + "/relay/" + String(controlName);
    String payload = isOn ? "ON" : "OFF";
    mqttClient.publish(topic.c_str(), payload.c_str(), true);
    Serial.printf("📡 [MQTT PUBLISH] %s -> %s\n", topic.c_str(), payload.c_str());
  }
}

// Callback saat Web BOTEK menekan tombol sakelar di dashboard
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  
  Serial.printf("⚡ [INSTANT MQTT IN] Topik: %s | Pesan: %s\n", topic, message.c_str());
  
  String topicStr = String(topic);
  bool isOn = (message.equalsIgnoreCase("ON") || message == "1");

  if (topicStr.endsWith("/Relay 1")) {
    relay1State = isOn;
    setRelayHardware(RELAY_1_PIN, relay1State);
    Serial.printf("🔘 Relay 1 diubah via Web -> %s\n", relay1State ? "ON" : "OFF");
  } 
  else if (topicStr.endsWith("/Relay 2")) {
    relay2State = isOn;
    setRelayHardware(RELAY_2_PIN, relay2State);
    Serial.printf("🔘 Relay 2 diubah via Web -> %s\n", relay2State ? "ON" : "OFF");
  }
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Menghubungkan ke BOTEK MQTT Broker...");
    
    String clientId = "BOTEK-ESP32-" + String(DEVICE_CODE) + "-" + String(random(0xffff), HEX);
    String lwtTopic = "botek/" + String(DEVICE_CODE) + "/status";
    
    if (mqttClient.connect(clientId.c_str(), lwtTopic.c_str(), 0, true, "OFFLINE")) {
      Serial.println("\n✅ [CONNECTED] Berhasil Terhubung ke MQTT Broker!");
      mqttClient.publish(lwtTopic.c_str(), "ONLINE", true);
      
      String subTopic = "botek/" + String(DEVICE_CODE) + "/relay/#";
      mqttClient.subscribe(subTopic.c_str());
      Serial.printf("📡 Subscribed ke: %s\n", subTopic.c_str());

      // Kirim status awal ke website agar tampilan website langsung sinkron
      publishRelayStatus("Relay 1", relay1State);
      publishRelayStatus("Relay 2", relay2State);
    } else {
      Serial.printf(" Gagal (RC=%d). Coba lagi dalam 3 detik...\n", mqttClient.state());
      delay(3000);
    }
  }
}

void handlePhysicalButtons() {
  // 1. TOMBOL FISIK 1 (RELAY 1)
  int reading1 = digitalRead(BUTTON_1_PIN);
  if (reading1 != lastBtn1Reading) {
    lastDebounceTime1 = millis();
  }
  if ((millis() - lastDebounceTime1) > DEBOUNCE_DELAY) {
    if (reading1 != btn1State) {
      btn1State = reading1;
      if (btn1State == LOW) {
        relay1State = !relay1State; // Toggle Relay 1
        setRelayHardware(RELAY_1_PIN, relay1State);
        Serial.printf("🔘 [TOMBOL FISIK 1 DITEKAN] Status Relay 1 -> %s\n", relay1State ? "ON" : "OFF");
        publishRelayStatus("Relay 1", relay1State); // Sync ke Website
      }
    }
  }
  lastBtn1Reading = reading1;

  // 2. TOMBOL FISIK 2 (RELAY 2)
  int reading2 = digitalRead(BUTTON_2_PIN);
  if (reading2 != lastBtn2Reading) {
    lastDebounceTime2 = millis();
  }
  if ((millis() - lastDebounceTime2) > DEBOUNCE_DELAY) {
    if (reading2 != btn2State) {
      btn2State = reading2;
      if (btn2State == LOW) {
        relay2State = !relay2State; // Toggle Relay 2
        setRelayHardware(RELAY_2_PIN, relay2State);
        Serial.printf("🔘 [TOMBOL FISIK 2 DITEKAN] Status Relay 2 -> %s\n", relay2State ? "ON" : "OFF");
        publishRelayStatus("Relay 2", relay2State); // Sync ke Website
      }
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
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Handle tombol fisik dan sinkronkan ke web BOTEK secara real-time
  handlePhysicalButtons();
}
