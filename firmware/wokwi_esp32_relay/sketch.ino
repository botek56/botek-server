/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - WOKWI ONLINE SIMULATOR FIRMWARE
 *  Kompatibel: Wokwi ESP32 + Relay Module + LED
 *  Protocol: MQTT Real-Time (~0.01 detik)
 * ===================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Wokwi Online Simulator WiFi Credentials
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// Device Code di BOTEK Console
const char* DEVICE_CODE   = "ESP32_RELAY"; 
const char* MQTT_SERVER   = "iot.botek.my.id"; 
const int   MQTT_PORT     = 1883;

// GPIO Pin Relay Module
const int RELAY_PIN_1 = 26; 

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastTelemetryTime = 0;

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  
  Serial.printf("\n⚡ [INSTANT MQTT INCOM] Topik: %s | Pesan: %s\n", topic, message.c_str());
  
  String topicStr = String(topic);
  bool isOn = (message.equalsIgnoreCase("ON") || message == "1");

  if (topicStr.endsWith("/Relay 1")) {
    digitalWrite(RELAY_PIN_1, isOn ? HIGH : LOW);
    Serial.printf("🔘 Relay 1 diubah ke -> %s\n", isOn ? "ON" : "OFF");
  }
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Menghubungkan ke BOTEK MQTT Broker...");
    String clientId = "WOKWI-ESP32-" + String(random(0xffff), HEX);
    
    String lwtTopic = "botek/" + String(DEVICE_CODE) + "/status";
    
    if (mqttClient.connect(clientId.c_str(), lwtTopic.c_str(), 0, true, "OFFLINE")) {
      Serial.println("\n✅ [CONNECTED] Terhubung ke BOTEK MQTT Broker!");
      
      // Publish Status ONLINE
      mqttClient.publish(lwtTopic.c_str(), "ONLINE", true);
      
      // Subscribe to relay commands
      String subTopic = "botek/" + String(DEVICE_CODE) + "/relay/#";
      mqttClient.subscribe(subTopic.c_str());
      Serial.printf("📡 Subscribed ke: %s\n", subTopic.c_str());
    } else {
      Serial.printf(" Gagal (RC=%d). Coba lagi 3 detik...\n", mqttClient.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN_1, OUTPUT);
  digitalWrite(RELAY_PIN_1, LOW);

  Serial.println("\n--- WOKWI BOTEK IoT SIMULATOR ---");
  Serial.print("Menghubungkan ke WiFi Wokwi-GUEST ");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Wokwi Terhubung!");

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Pengiriman Telemetri Simulasi Suhu Setiap 4 Detik
  unsigned long now = millis();
  if (now - lastTelemetryTime >= 4000) {
    lastTelemetryTime = now;
    
    float simTemp = 26.5 + (random(-15, 15) / 10.0);
    String topic = "botek/" + String(DEVICE_CODE) + "/telemetry/Temperature";
    String payload = String(simTemp, 1);
    
    mqttClient.publish(topic.c_str(), payload.c_str());
    Serial.printf("📊 [TELEMETRY] %s = %s °C\n", topic.c_str(), payload.c_str());
  }
}
