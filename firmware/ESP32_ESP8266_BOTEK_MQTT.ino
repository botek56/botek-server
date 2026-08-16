/*
 * ===================================================================
 *  BOTEK IoT CONSOLE - MASTER FIRMWARE TEMPLATE (MQTT PROTOCOL)
 *  Kompatibel: ESP32 & ESP8266
 *  
 *  Fitur:
 *   1. Ultra Real-Time Sub-Second Communication (~0.01 detik)
 *   2. Auto Reconnect WiFi & MQTT Broker (Port 1883)
 *   3. Instant Relay Control via MQTT Subscription
 *   4. Instant Sensor Telemetry Publishing via MQTT
 *   5. Last Will and Testament (LWT) Status ONLINE/OFFLINE
 * ===================================================================
 */

#if defined(ESP32)
  #include <WiFi.h>
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
#endif

#include <PubSubClient.h>
#include <ArduinoJson.h>

// ===================================================================
// 1. KONFIGURASI WIFI & BOTEK MQTT BROKER
// ===================================================================
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

// Kode Perangkat yang Anda buat di Dashboard BOTEK
const char* DEVICE_CODE   = "ESP32_ROOM_01"; 

// IP Server atau Domain BOTEK IoT Console
const char* MQTT_SERVER   = "iot.botek.my.id"; 
const int   MQTT_PORT     = 1883; // Port TCP MQTT Default

// ===================================================================
// 2. KONFIGURASI PIN HARDWARE (Sesuaikan Dengan PIN ESP Anda)
// ===================================================================
const int RELAY_1_PIN = 26; // GPIO Sakelar Relay 1
const int RELAY_2_PIN = 27; // GPIO Sakelar Relay 2

// Timer Pengiriman Telemetri Sensor (Setiap 3 Detik)
unsigned long lastSensorPublish = 0;
const unsigned long SENSOR_INTERVAL = 3000; 

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Topik MQTT
String topicStatus;
String topicRelaySub;

// ===================================================================
// FUNGSI CALLBACK: RECEIVE INSTANT MQTT COMMAND FROM SERVER / WEB
// ===================================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  
  Serial.printf("\n⚡ [INSTANT MQTT INCOM] Topik: %s | Pesan: %s\n", topic, message.c_str());
  
  String topicStr = String(topic);
  bool isOn = (message.equalsIgnoreCase("ON") || message == "1");

  // Kontrol Sakelar Relay Fisik Berdasarkan Topik
  if (topicStr.endsWith("/Relay 1")) {
    digitalWrite(RELAY_1_PIN, isOn ? HIGH : LOW);
    Serial.printf("🔘 Relay 1 diubah ke %s\n", isOn ? "ON" : "OFF");
  } 
  else if (topicStr.endsWith("/Relay 2")) {
    digitalWrite(RELAY_2_PIN, isOn ? HIGH : LOW);
    Serial.printf("🔘 Relay 2 diubah ke %s\n", isOn ? "ON" : "OFF");
  }
}

// ===================================================================
// FUNGSI RECONNECT MQTT & LAST WILL TESTAMENT (LWT)
// ===================================================================
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Menghubungkan ke BOTEK MQTT Broker...");
    
    String clientId = "BOTEK-ESP-" + String(DEVICE_CODE) + "-" + String(random(0xffff), HEX);
    
    // Config Last Will and Testament (LWT) -> Jika ESP mati, broker set status OFFLINE
    String lwtTopic = "botek/" + String(DEVICE_CODE) + "/status";
    
    if (mqttClient.connect(clientId.c_str(), lwtTopic.c_str(), 0, true, "OFFLINE")) {
      Serial.println("\n✅ [CONNECTED] Berhasil Terhubung ke MQTT Broker!");
      
      // Publish Status ONLINE
      mqttClient.publish(lwtTopic.c_str(), "ONLINE", true);
      
      // Subscribe ke Seluruh Topik Relay Perangkat Ini: botek/{device_code}/relay/#
      topicRelaySub = "botek/" + String(DEVICE_CODE) + "/relay/#";
      mqttClient.subscribe(topicRelaySub.c_str());
      Serial.printf("📡 Subscribed ke: %s\n", topicRelaySub.c_str());
    } else {
      Serial.printf(" Gagal (RC=%d). Coba lagi dalam 3 detik...\n", mqttClient.state());
      delay(3000);
    }
  }
}

// ===================================================================
// FUNGSI PUBLISH DATA SENSOR TELEMETRI
// ===================================================================
void publishSensor(String sensorName, float value) {
  if (mqttClient.connected()) {
    String topic = "botek/" + String(DEVICE_CODE) + "/telemetry/" + sensorName;
    String payload = String(value, 2);
    
    mqttClient.publish(topic.c_str(), payload.c_str());
    Serial.printf("📊 [PUBLISH TELEMETRY] %s = %s\n", topic.c_str(), payload.c_str());
  }
}

// ===================================================================
// SETUP & MAIN LOOP
// ===================================================================
void setup() {
  Serial.begin(115200);
  
  // Setup PIN Output Relay
  pinMode(RELAY_1_PIN, OUTPUT);
  pinMode(RELAY_2_PIN, OUTPUT);
  digitalWrite(RELAY_1_PIN, LOW);
  digitalWrite(RELAY_2_PIN, LOW);

  // Connect WiFi
  Serial.printf("\nMenghubungkan ke WiFi: %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Terhubung!");

  // Setup MQTT Client
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  // 1. Pastikan MQTT Selalu Terhubung
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop(); // Menangani pesan masuk secara instan

  // 2. Publish Data Sensor Telemetri Setiap 3 Detik
  unsigned long now = millis();
  if (now - lastSensorPublish >= SENSOR_INTERVAL) {
    lastSensorPublish = now;

    // TODO: Ganti Nilai Simulasi Di Bawah Ini Dengan Pembacaan Sensor Fisik Anda
    float temperature = 28.5 + (random(-10, 10) / 10.0);
    float humidity    = 62.0 + (random(-20, 20) / 10.0);
    float voltage     = 220.0 + (random(-50, 50) / 10.0);

    publishSensor("Temperature", temperature);
    publishSensor("Humidity", humidity);
    publishSensor("Voltage", voltage);
  }
}
