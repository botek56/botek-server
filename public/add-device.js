// ==========================
// SENSOR DATABASE CATALOG
// ==========================
const sensorCatalog = [
    { id: "temp", nameKey: "sensor_temp", name: "Temperature", type: "Temperature", unit: "°C", icon: "✦", category: "Monitoring" },
    { id: "hum", nameKey: "sensor_hum", name: "Humidity", type: "Humidity", unit: "%", icon: "◇", category: "Monitoring" },
    { id: "volt", nameKey: "sensor_volt", name: "Voltage", type: "Voltage", unit: "V", icon: "⚡", category: "Energy Monitor" },
    { id: "curr", nameKey: "sensor_curr", name: "Current", type: "Current", unit: "A", icon: "⏚", category: "Energy Monitor" },
    { id: "pow", nameKey: "sensor_pow", name: "Power", type: "Power", unit: "W", icon: "⏻", category: "Energy Monitor" },
    { id: "nrg", nameKey: "sensor_nrg", name: "Energy", type: "Energy", unit: "kWh", icon: "⬚", category: "Energy Monitor" },
    { id: "freq", nameKey: "sensor_freq", name: "Frequency", type: "Frequency", unit: "Hz", icon: "∿", category: "Energy Monitor" },
    { id: "press", nameKey: "sensor_press", name: "Pressure", type: "Pressure", unit: "bar", icon: "▲", category: "Monitoring" },
    { id: "gas", nameKey: "sensor_gas", name: "Gas Quality", type: "Gas", unit: "ppm", icon: "∿", category: "Monitoring" },
    { id: "light", nameKey: "sensor_light", name: "Light Intensity", type: "Light", unit: "Lux", icon: "☼", category: "Monitoring" },
    { id: "dimmer", nameKey: "sensor_dimmer", name: "PWM Dimmer / Speed Control", type: "Dimmer", unit: "%", icon: "🎚️", category: "Control" }
];

let selectedSensorIndices = new Set();
let customSensors = [];
let currentModalTab = "ALL";

// ==========================
// RENDER MAIN FORM SECTIONS
// ==========================
function changeDeviceType() {
    const type = document.getElementById("device_type").value;
    const area = document.getElementById("sensorArea");
    if (!area) return;
    area.innerHTML = "";

    // Keep initial selection empty by default as requested
    selectedSensorIndices.clear();

    renderMainFormSections();
}

function renderMainFormSections() {
    const type = document.getElementById("device_type").value;
    const area = document.getElementById("sensorArea");
    if (!area) return;

    let html = "";

    // 1. SENSOR TELEMETRY SECTION (Popup Button + Chips)
    if (type !== "Relay") {
        html += `
        <div style="margin-bottom: 24px;" class="card" style="background: var(--bg-inner); border: 1px solid var(--border-color); padding: 22px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 15px; margin: 0; color: var(--blynk-green); display: flex; align-items: center; gap: 8px;">
                    <span>❖</span> ${t("sensor_telemetry_title", "Sensor")} (${selectedSensorIndices.size + customSensors.length} ${t("selected_count", "Terpilih")})
                </h3>
                <button type="button" class="btn-secondary" onclick="openSensorModal()">
                    ${t("select_add_sensor_btn", "⊕ Pilih & Tambah Sensor")}
                </button>
            </div>

            <!-- CHIPS DISPLAY OF SELECTED SENSORS -->
            <div class="selected-sensor-tags" id="selectedChipsContainer">
        `;

        if (selectedSensorIndices.size === 0 && customSensors.length === 0) {
            html += `<p style="font-size: 13px; color: var(--text-muted); margin: 6px 0;">${t("no_sensors_selected_desc", "Belum ada sensor terpilih. Klik tombol diatas.")}</p>`;
        } else {
            selectedSensorIndices.forEach(idx => {
                const s = sensorCatalog[idx];
                if (s) {
                    html += `
                    <div class="selected-sensor-chip">
                        <span>${s.icon} <b>${t(s.nameKey || s.name, s.name)}</b> (${s.unit})</span>
                        <span class="remove-chip-btn" title="${t("btn_delete", "Hapus")}" onclick="removeSensorIndex(${idx})">✖</span>
                    </div>
                    `;
                }
            });

            customSensors.forEach((cs, cIdx) => {
                html += `
                <div class="selected-sensor-chip" style="border-color: var(--blynk-amber); color: var(--blynk-amber); background: rgba(245, 158, 11, 0.12);">
                    <span>❖ <b>${cs.name}</b> (${cs.unit})</span>
                    <span class="remove-chip-btn" title="${t("btn_delete", "Hapus")}" onclick="removeCustomSensor(${cIdx})">✖</span>
                </div>
                `;
            });
        }

        html += `
            </div>
        </div>
        `;
    }

    // 2. RELAY CONTROLLER SECTION
    if (type === "Universal Controller" || type === "Relay") {
        html += `
        <div class="card" style="background: var(--bg-inner); border: 1px solid var(--border-color); padding: 22px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                <h3 style="font-size: 15px; margin: 0; color: var(--blynk-green); display: flex; align-items: center; gap: 8px;">
                    <span>⍟</span> ${t("relay_controller_title", "Kontroler Output Relay")}
                </h3>
                ${type === "Universal Controller" ? `
                <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; color: #ffffff; background: rgba(255,255,255,0.05); padding: 6px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border-color);">
                    <input type="checkbox" id="enableRelayCheck" style="width: 18px; height: 18px; accent-color: var(--blynk-green);" onchange="toggleRelayInputs()">
                    <b>${t("enable_relay_check", "Aktifkan Sakelar Relay")}</b>
                </label>
                ` : ''}
            </div>

            <div id="relayInputsBox" style="display: ${type === 'Relay' ? 'block' : 'none'};">
                <div class="form-group" style="max-width: 420px;">
                    <label>${t("relay_count_label", "Jumlah Output Relay")}</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="relayCount" min="1" max="32" placeholder="4" value="4" style="max-width: 120px;">
                        <div class="preset-pills">
                            <button type="button" class="preset-pill" onclick="setRelayCount(1)">1 Channel</button>
                            <button type="button" class="preset-pill" onclick="setRelayCount(2)">2 Channel</button>
                            <button type="button" class="preset-pill active" onclick="setRelayCount(4)">4 Channel</button>
                            <button type="button" class="preset-pill" onclick="setRelayCount(8)">8 Channel</button>
                        </div>
                    </div>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${t("relay_auto_desc", "Sistem akan membuat modul sakelar Relay otomatis (Relay 1, Relay 2, Relay 3, Relay 4...).")}</p>
            </div>
        </div>
        `;
    }

    area.innerHTML = html;
}

// ==========================
// REMOVE SENSOR CHIP
// ==========================
function removeSensorIndex(idx) {
    selectedSensorIndices.delete(idx);
    renderMainFormSections();
}

function removeCustomSensor(cIdx) {
    customSensors.splice(cIdx, 1);
    renderMainFormSections();
}

// ==========================
// MODAL POPUP LOGIC
// ==========================
function openSensorModal() {
    const modal = document.getElementById("sensorModal");
    if (modal) {
        modal.style.display = "flex";
        renderModalSensorGrid();
    }
}

function closeSensorModal() {
    const modal = document.getElementById("sensorModal");
    if (modal) {
        modal.style.display = "none";
        renderMainFormSections();
    }
}

function setModalTab(category) {
    currentModalTab = category;
    document.getElementById("modalTabAll").classList.toggle("active", category === "ALL");
    document.getElementById("modalTabEnergy").classList.toggle("active", category === "Energy Monitor");
    document.getElementById("modalTabEnv").classList.toggle("active", category === "Monitoring");
    filterModalSensors();
}

function filterModalSensors() {
    renderModalSensorGrid();
}

function renderModalSensorGrid() {
    const grid = document.getElementById("modalSensorGrid");
    if (!grid) return;

    const query = (document.getElementById("modalSearchInput")?.value || "").toLowerCase().trim();

    let html = "";
    sensorCatalog.forEach((sensor, index) => {
        const matchesCategory = (currentModalTab === "ALL") || (sensor.category === currentModalTab);
        const matchesQuery = !query || sensor.name.toLowerCase().includes(query) || sensor.type.toLowerCase().includes(query);

        if (matchesCategory && matchesQuery) {
            const isChecked = selectedSensorIndices.has(index);
            html += `
            <label class="sensor-item ${isChecked ? 'is-selected' : ''}">
                <input type="checkbox" onchange="toggleModalSensorCheck(${index}, this.checked)" ${isChecked ? 'checked' : ''}>
                <span class="sensor-icon-box">${sensor.icon}</span>
                <div class="sensor-text">
                    <b>${t(sensor.nameKey || sensor.name, sensor.name)}</b>
                    <span class="sensor-unit-badge">Unit: ${sensor.unit}</span>
                </div>
            </label>
            `;
        }
    });

    // Custom Sensor Option in Modal
    html += `
    <div class="card" style="grid-column: 1/-1; background: var(--bg-inner); border: 1px dashed var(--blynk-green); padding: 18px; margin-top: 10px;">
        <h4 style="font-size: 13.5px; margin-bottom: 10px; color: var(--blynk-green); display: flex; align-items: center; gap: 6px;">
            <span>➕</span> ${t("add_custom_param_title", "Tambah Parameter Custom Baru")}
        </h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <input id="modalCustomName" placeholder="${t("ph_custom_param_name", "Nama Parameter (misal: Level CO2)")}" style="flex: 2; min-width: 160px;">
            <input id="modalCustomUnit" placeholder="${t("ph_custom_param_unit", "Satuan (misal: ppm)")}" style="flex: 1; min-width: 100px;">
            <button type="button" onclick="addCustomSensorFromModal()">+ ${t("btn_add", "Tambah")}</button>
        </div>
    </div>
    `;

    grid.innerHTML = html;

    // Update Counter
    const counter = document.getElementById("modalSelectedCount");
    if (counter) {
        counter.innerText = `${selectedSensorIndices.size + customSensors.length} ${t("sensors_selected_text", "Sensor Dipilih")}`;
    }
}

function toggleModalSensorCheck(index, checked) {
    if (checked) {
        selectedSensorIndices.add(index);
    } else {
        selectedSensorIndices.delete(index);
    }
    renderModalSensorGrid();
}

function addCustomSensorFromModal() {
    const nameEl = document.getElementById("modalCustomName");
    const unitEl = document.getElementById("modalCustomUnit");
    const name = nameEl ? nameEl.value.trim() : "";
    const unit = unitEl ? unitEl.value.trim() : "";

    if (!name || !unit) {
        showToast("Harap isi Nama Parameter dan Satuan Sensor!", "warning");
        return;
    }

    customSensors.push({ name, unit });
    if (nameEl) nameEl.value = "";
    if (unitEl) unitEl.value = "";

    renderModalSensorGrid();
}

function toggleRelayInputs() {
    const check = document.getElementById("enableRelayCheck");
    const box = document.getElementById("relayInputsBox");
    if (check && box) {
        box.style.display = check.checked ? "block" : "none";
    }
}

function setRelayCount(val) {
    const input = document.getElementById("relayCount");
    if (input) input.value = val;
    document.querySelectorAll(".preset-pill").forEach(btn => {
        if (btn.innerText.includes(val + " Channel")) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

// ==========================
// SAVE DEVICE TEMPLATE
// ==========================
async function saveDevice() {
    const device_code = document.getElementById("device_code").value.trim();
    const device_name = document.getElementById("device_name").value.trim();
    const type = document.getElementById("device_type").value;

    if (!device_code || !device_name || !type) {
        showToast("Harap lengkapi Kode Perangkat dan Nama Perangkat", "warning");
        return;
    }

    let sensors = [];

    // 1. COLLECT TELEMETRY SENSORS
    if (type !== "Relay") {
        selectedSensorIndices.forEach(idx => {
            const s = sensorCatalog[idx];
            if (s) {
                sensors.push({
                    name: s.name,
                    type: s.type,
                    unit: s.unit,
                    icon: s.icon
                });
            }
        });

        // Collect Custom Sensors
        customSensors.forEach(cs => {
            sensors.push({
                name: cs.name,
                type: "Custom",
                unit: cs.unit,
                icon: "📊"
            });
        });
    }

    // 2. COLLECT RELAY SENSORS
    const enableRelay = (type === "Relay") || (document.getElementById("enableRelayCheck") && document.getElementById("enableRelayCheck").checked);
    if (enableRelay) {
        const relayCountEl = document.getElementById("relayCount");
        const count = relayCountEl ? parseInt(relayCountEl.value) : 0;
        if (count && count > 0) {
            for (let i = 1; i <= count; i++) {
                sensors.push({
                    name: "Relay " + i,
                    type: "Relay",
                    unit: "ON/OFF",
                    icon: "🔘"
                });
            }
        }
    }

    if (sensors.length === 0) {
        showToast("Harap pilih minimal 1 sensor atau 1 output relay!", "warning");
        return;
    }

    try {
        const response = await fetch("/api/devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_code,
                device_name,
                location: "",
                type,
                sensors
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast("Perangkat " + device_name + " berhasil dibuat!", "success");
            setTimeout(() => {
                window.location.href = "devices.html";
            }, 800);
        } else {
            showToast("Gagal membuat perangkat: " + (data.message || "Unknown error"), "error");
        }
    } catch (err) {
        console.error("Save device error:", err);
        showToast("Gagal terhubung ke server", "error");
    }
}

function generateRandomCode() {
    const rand = Math.floor(10 + Math.random() * 90);
    const el = document.getElementById("device_code");
    if (el) el.value = String(rand).padStart(2, '0');
}

// Auto Initialize Form on Load
window.addEventListener("DOMContentLoaded", () => {
    changeDeviceType();
    generateRandomCode();
});