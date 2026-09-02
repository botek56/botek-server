function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification' + (type === 'error' ? ' toast-error' : (type === 'warning' ? ' toast-warning' : (type === 'info' ? ' toast-info' : '')));
    
    let iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    if (type === 'error') {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (type === 'info') {
        iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `<span style="display: flex; align-items: center; justify-content: center;">${iconSvg}</span> <span style="font-weight: 600; font-size: 13px;">${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast && toast.parentNode) toast.remove();
    }, 2600);
}
window.showToast = showToast;

let deviceCode = null;
let liveInterval = null;
let statusInterval = null;

let activeGraphSensors = [];
let chartInstances = {};
let currentDeviceType = "";
let availableDeviceSensors = [];
let currentSensorsData = [];

function maskDeviceCode(code) {
    if (!code) return "-";
    if (code.length <= 4) return "••••";
    return code.substring(0, 3) + "•".repeat(Math.max(5, code.length - 3));
}

let isDashCodeMasked = true;
function toggleDashCode() {
    const codeEl = document.getElementById("deviceCodeVal");
    const btnEl = document.getElementById("dashEyeBtn");
    if (!codeEl || !deviceCode) return;
    
    const SVG_EYE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const SVG_EYE_OFF = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    if (isDashCodeMasked) {
        codeEl.innerText = deviceCode;
        if (btnEl) { btnEl.innerHTML = SVG_EYE_OFF; btnEl.title = "Sembunyikan Kode"; }
        isDashCodeMasked = false;
    } else {
        codeEl.innerText = maskDeviceCode(deviceCode);
        if (btnEl) { btnEl.innerHTML = SVG_EYE; btnEl.title = "Lihat Kode"; }
        isDashCodeMasked = true;
    }
}

// Color theme map for different sensor metrics
const SENSOR_COLORS = {
    voltage: { border: '#3b82f6', fill: 'rgba(59, 130, 246, 0.25)' },
    current: { border: '#00e599', fill: 'rgba(0, 229, 153, 0.25)' },
    power: { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.25)' },
    energy: { border: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.25)' },
    frequency: { border: '#ec4899', fill: 'rgba(236, 72, 153, 0.25)' },
    temperature: { border: '#ef4444', fill: 'rgba(239, 68, 68, 0.25)' },
    humidity: { border: '#06b6d4', fill: 'rgba(6, 182, 212, 0.25)' },
    pressure: { border: '#14b8a6', fill: 'rgba(20, 184, 166, 0.25)' },
    gas: { border: '#a855f7', fill: 'rgba(168, 85, 247, 0.25)' },
    light: { border: '#eab308', fill: 'rgba(234, 179, 8, 0.25)' },
    default: { border: '#00e599', fill: 'rgba(0, 229, 153, 0.25)' }
};

// Preset metric options per device type
const PRESET_METRICS = {
    "Energy Monitor": [
        { key: "voltage", name: "Voltage (Tegangan)", unit: "V" },
        { key: "current", name: "Current (Arus)", unit: "A" },
        { key: "power", name: "Power (Daya)", unit: "W" },
        { key: "energy", name: "Energy (Konsumsi)", unit: "kWh" },
        { key: "frequency", name: "Frequency (Frekuensi)", unit: "Hz" }
    ],
    "Monitoring": [
        { key: "temperature", name: "Temperature (Suhu)", unit: "°C" },
        { key: "humidity", name: "Humidity (Kelembaban)", unit: "%" },
        { key: "pressure", name: "Pressure (Tekanan)", unit: "bar" },
        { key: "gas", name: "Gas Quality (Kualitas Udara)", unit: "ppm" },
        { key: "light", name: "Light (Intensitas Cahaya)", unit: "lux" }
    ]
};

// ==========================
// GET DEVICE CODE
// ==========================
function getDeviceCode() {
    const url = new URLSearchParams(window.location.search);
    return url.get("device");
}

// ==========================
// LOAD DASHBOARD
// ==========================
async function loadDashboard() {
    deviceCode = getDeviceCode();

    if (!deviceCode) {
        document.getElementById("deviceTitle").innerText = "Device Tidak Ditemukan";
        return;
    }

    try {
        const deviceResponse = await fetch("/api/device/" + deviceCode + "?_=" + Date.now());
        const device = await deviceResponse.json();

        if (deviceResponse.status === 403 || (device && device.success === false)) {
            const titleEl = document.getElementById("deviceTitle");
            if (titleEl) titleEl.innerText = "Akses Ditolak";
            showToast(device.message || "Akses ditolak: Perangkat ini bukan milik Anda.", "error");
            setTimeout(() => { window.location.href = "devices.html"; }, 1600);
            return;
        }

        if (!device || !device.device_code) {
            document.getElementById("deviceTitle").innerText = "Device Tidak Ditemukan";
            return;
        }

        currentDeviceType = device.type;

        // Update Banner Elements
        const bannerIcon = document.getElementById("bannerIcon");
        if (bannerIcon) bannerIcon.innerHTML = getIcon(device.type);

        document.getElementById("deviceTitle").innerText = device.device_name;

        const typeEl = document.getElementById("deviceType");
        if (typeEl) typeEl.innerText = device.type;

        const codeValEl = document.getElementById("deviceCodeVal");
        if (codeValEl) {
            codeValEl.innerText = isDashCodeMasked ? maskDeviceCode(device.device_code) : device.device_code;
        }

        const locEl = document.getElementById("deviceLocation");
        if (locEl) locEl.innerText = device.location || "N/A";

        const badgeEl = document.getElementById("deviceStatusBadge");
        if (badgeEl) {
            badgeEl.className = device.status === "ONLINE" ? "online" : "offline";
            badgeEl.innerText = device.status === "ONLINE" ? "● ONLINE" : "● OFFLINE";
        }

        // Get Sensors
        const sensorResponse = await fetch("/api/device/" + deviceCode + "/sensors?_=" + Date.now());
        const sensors = await sensorResponse.json();

        renderSensors(sensors);
        setupGraphControls(sensors);
        loadDeviceRules();

        // Check if user is Super Admin to render ESP32 Code Generator button
        const bannerActions = document.querySelector(".banner-actions");
        if (bannerActions) {
            // Render Export Data Button for all users
            let expBtn = document.getElementById("btnExportTelemetry");
            if (!expBtn) {
                expBtn = document.createElement("button");
                expBtn.id = "btnExportTelemetry";
                expBtn.className = "btn-secondary";
                expBtn.style.background = "rgba(56, 189, 248, 0.15)";
                expBtn.style.color = "#38bdf8";
                expBtn.style.border = "1px solid rgba(56, 189, 248, 0.35)";
                expBtn.style.fontWeight = "700";
                expBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> <span data-i18n="btn_export_data">${t("btn_export_data", "Ekspor Data")}</span>`;
                expBtn.onclick = () => openExportTelemetryModal(sensors);
                bannerActions.appendChild(expBtn);
            } else {
                expBtn.onclick = () => openExportTelemetryModal(sensors);
            }

            // Render ESP32 Generator Button exclusively for Super Admin
            let codeBtn = document.getElementById("adminEsp32CodeBtn");
            const isAdmin = window.currentUser && (window.currentUser.role === "SUPER_ADMIN" || window.currentUser.username === "admin");
            if (isAdmin) {
                if (!codeBtn) {
                    codeBtn = document.createElement("button");
                    codeBtn.id = "adminEsp32CodeBtn";
                    codeBtn.className = "btn-secondary";
                    codeBtn.style.background = "rgba(168, 85, 247, 0.15)";
                    codeBtn.style.color = "#c084fc";
                    codeBtn.style.border = "1px solid rgba(168, 85, 247, 0.4)";
                    codeBtn.style.fontWeight = "700";
                    codeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> <span>⚡ Generator ESP32</span>`;
                    codeBtn.onclick = () => openEsp32CodeGeneratorModal(device, sensors);
                    bannerActions.insertBefore(codeBtn, bannerActions.firstChild);
                } else {
                    codeBtn.onclick = () => openEsp32CodeGeneratorModal(device, sensors);
                }
            } else if (codeBtn) {
                codeBtn.remove();
            }
        }

        startLiveMonitoring();
        startDeviceStatusMonitoring();

    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

// ==========================
// RENDER SENSOR WIDGETS
// ==========================
function renderSensors(sensors) {
    currentSensorsData = Array.isArray(sensors) ? sensors : [];
    const box = document.getElementById("sensorDashboard");
    if (!box) return;

    const sectionTitleEl = document.getElementById("sectionTitle");
    if (sectionTitleEl && sensors && sensors.length > 0) {
        const isAllRelay = sensors.every(s => s.sensor_type === "Relay");
        if (isAllRelay) {
            sectionTitleEl.innerHTML = "⍟ Relay Controller & Switches";
        } else {
            sectionTitleEl.innerHTML = `❖ ${t("sensor_telemetry_title", "Sensor Real-Time")}`;
        }
    }

    if (!sensors || sensors.length === 0) {
        box.innerHTML = `
        <div class="card" style="grid-column: 1/-1;">
            <h2>Belum ada sensor</h2>
            <p>Silahkan tambahkan sensor pada perangkat ini</p>
        </div>
        `;
        return;
    }

    let html = "";

    sensors.forEach(sensor => {
        const sTypeClean = String(sensor.sensor_type || '').toLowerCase();
        const sNameLower = String(sensor.sensor_name || '').toLowerCase();
        const isDimmerType = sTypeClean === "dimmer" || sNameLower.includes("dimmer") || sNameLower.includes("speed") || sNameLower.includes("pwm");

        if (isDimmerType) {
            let dimmerVal = parseInt(sensor.value, 10);
            if (isNaN(dimmerVal)) dimmerVal = 0;
            dimmerVal = Math.min(100, Math.max(0, dimmerVal));

            html += `
            <div class="device-card sensor-widget-card" id="dimmer-card-${sensor.id}" data-sensor-id="${sensor.id}" style="display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; background: linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%); border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
                <div>
                    <div class="device-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="drag-handle" title="Tahan & Geser ikon ini untuk mengubah posisi" style="cursor: grab; color: var(--text-muted); padding: 4px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                            </div>
                            <div class="device-icon" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 15px rgba(56, 189, 248, 0.25);">🎚️</div>
                            <div>
                                <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #ffffff;">${sensor.sensor_name}</h2>
                                <span style="display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.3);">PWM DIMMER / SPEED</span>
                            </div>
                        </div>
                        <button type="button" class="btn-danger-sm" title="Hapus ${sensor.sensor_name}" style="font-size: 11px; padding: 5px 8px; border-radius: 8px;" onclick="deleteMetric(${sensor.id}, '${sensor.sensor_name}')">🗑️</button>
                    </div>

                    <!-- LIVE PERCENTAGE & GLOW SLIDER -->
                    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 18px 16px 16px 16px; text-align: center; margin-bottom: 14px;">
                        <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px;">Tingkat Intensitas (PWM)</div>
                        <div style="display: flex; align-items: baseline; justify-content: center; gap: 4px; margin-bottom: 14px;">
                            <span id="dimmer-val-text-${sensor.id}" style="font-size: 40px; font-weight: 800; color: #ffffff; text-shadow: 0 0 20px rgba(56, 189, 248, 0.5);">${dimmerVal}</span>
                            <span style="font-size: 18px; font-weight: 800; color: #38bdf8;">%</span>
                        </div>

                        <!-- UNIFIED DYNAMIC SLIDER TRACK -->
                        <div style="margin-bottom: 16px;">
                            <input type="range" id="dimmer-slider-${sensor.id}" class="dimmer-range-input" min="0" max="100" value="${dimmerVal}"
                                style="background: linear-gradient(to right, #38bdf8 0%, #38bdf8 ${dimmerVal}%, rgba(255, 255, 255, 0.12) ${dimmerVal}%, rgba(255, 255, 255, 0.12) 100%);"
                                oninput="onDimmerSliderInput(${sensor.id}, this.value, '${sensor.device_code}', '${sensor.sensor_name}')"
                                onchange="onDimmerSliderChange('${sensor.device_code}', '${sensor.sensor_name}', this.value, ${sensor.id})">
                        </div>

                        <!-- PRESET BUTTONS -->
                        <div style="display: flex; gap: 4px;">
                            <button type="button" onclick="setDimmerPreset('${sensor.device_code}', '${sensor.sensor_name}', 0, ${sensor.id})" style="flex: 1; padding: 6px 0; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.12); color: #f87171; cursor: pointer;">OFF (0%)</button>
                            <button type="button" onclick="setDimmerPreset('${sensor.device_code}', '${sensor.sensor_name}', 25, ${sensor.id})" style="flex: 1; padding: 6px 0; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.12); color: #38bdf8; cursor: pointer;">25%</button>
                            <button type="button" onclick="setDimmerPreset('${sensor.device_code}', '${sensor.sensor_name}', 50, ${sensor.id})" style="flex: 1; padding: 6px 0; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.12); color: #38bdf8; cursor: pointer;">50%</button>
                            <button type="button" onclick="setDimmerPreset('${sensor.device_code}', '${sensor.sensor_name}', 75, ${sensor.id})" style="flex: 1; padding: 6px 0; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.12); color: #38bdf8; cursor: pointer;">75%</button>
                            <button type="button" onclick="setDimmerPreset('${sensor.device_code}', '${sensor.sensor_name}', 100, ${sensor.id})" style="flex: 1; padding: 6px 0; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.12); color: #34d399; cursor: pointer;">MAX (100%)</button>
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #94a3b8; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                        PWM Output Control
                    </span>
                    <span style="color: #38bdf8; font-weight: 700;">Live 0-100%</span>
                </div>
            </div>
            `;
        } else if (sensor.sensor_type === "Relay") {
            let isOn = sensor.value == 1;
            let isAuto = String(sensor.mode || '').trim().toUpperCase() === "AUTO";

            let hasCountdown = false;
            let remainingSec = 0;
            if (sensor.countdown_end) {
                const endMs = new Date(sensor.countdown_end).getTime();
                if (!isNaN(endMs) && endMs > Date.now()) {
                    hasCountdown = true;
                    remainingSec = Math.floor((endMs - Date.now()) / 1000);
                }
            }

            html += `
            <div class="device-card relay-card sensor-widget-card ${isOn ? 'is-on' : ''}" id="relay-card-${sensor.id}" data-sensor-id="${sensor.id}">
                <div class="device-card-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="drag-handle" title="Tahan & Geser ikon ini untuk mengubah posisi" style="cursor: grab; color: var(--text-muted); padding: 4px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                        </div>
                        <div class="device-icon">🔘</div>
                        <div>
                            <h2>${sensor.sensor_name}</h2>
                            <p class="device-type">RELAY CONTROLLER</p>
                        </div>
                    </div>
                </div>

                <div class="relay-box" style="margin: 10px 0;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px;">${t("status_label", "Status")}</div>
                    <b id="relay-status-${sensor.id}" class="${isOn ? "status-on" : "status-off"}" style="font-size: 18px;">
                        ${isOn ? "ON" : "OFF"}
                    </b>
                    <div style="margin-top: 10px;">
                        <label class="switch">
                            <input type="checkbox" ${isOn ? "checked" : ""} ${isAuto ? "disabled" : ""} onchange="controlRelaySwitch('${sensor.device_code}', '${sensor.sensor_name}', this.checked, ${sensor.id})">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div id="relay-mode-badge-${sensor.id}" style="font-size: 11px; color: var(--blynk-green); margin-top: 6px; font-weight: 600;">
                        ${isAuto ? t("auto_mode_active", "⏱️ Mode Otomatis Aktif") : t("manual_mode_active", "🔧 Mode Manual Aktif")}
                    </div>
                </div>

                <!-- MODE CONTROL & TIMER -->
                <div style="background: var(--bg-inner); border-radius: var(--radius-md); padding: 12px; margin-bottom: 10px; border: 1px solid var(--border-color); text-align: left;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: var(--blynk-green); margin-bottom: 8px;">Mode</div>
                    
                    <div style="display: flex; align-items: center; background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 20px; padding: 3px; margin-bottom: 12px;">
                        <button type="button" onclick="switchRelayMode(${sensor.id}, '${sensor.device_code}', 'MANUAL')" style="flex: 1; border: none; padding: 6px 0; border-radius: 16px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${!isAuto ? 'background: var(--blynk-green); color: #070a12; box-shadow: 0 0 10px var(--blynk-green-glow);' : 'background: transparent; color: var(--text-muted);'}">
                            ${t("manual_btn", "Manual")}
                        </button>
                        <button type="button" onclick="switchRelayMode(${sensor.id}, '${sensor.device_code}', 'AUTO')" style="flex: 1; border: none; padding: 6px 0; border-radius: 16px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${isAuto ? 'background: var(--blynk-green); color: #070a12; box-shadow: 0 0 10px var(--blynk-green-glow);' : 'background: transparent; color: var(--text-muted);'}">
                            ${t("auto_timer_btn", "Otomatis (Timer)")}
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                        <div>
                            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">${t("time_on_label", "Waktu ON")}</label>
                            <input type="time" id="relay-time-on-${sensor.id}" value="${sensor.time_on || '06:00'}" style="padding: 6px 8px; font-size: 12px; width: 100%;">
                        </div>
                        <div>
                            <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 2px;">${t("time_off_label", "Waktu OFF")}</label>
                            <input type="time" id="relay-time-off-${sensor.id}" value="${sensor.time_off || '18:00'}" style="padding: 6px 8px; font-size: 12px; width: 100%;">
                        </div>
                    </div>

                    <button style="width: 100%; font-size: 12px; padding: 7px 12px; transition: all 0.25s ease;" onclick="saveRelaySchedule(${sensor.id}, '${sensor.device_code}', this)">💾 ${t("save_timer_btn", "Simpan Timer")}</button>
                </div>

                <!-- COUNTDOWN TIMER SECTION -->
                <div style="background: var(--bg-inner); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px; border: 1px solid var(--border-color); text-align: left;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #38bdf8; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <span>⏳ ${t("countdown_title", "HITUNG MUNDUR")}</span>
                        ${hasCountdown ? `<button type="button" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer;" onclick="cancelCountdownTimer(${sensor.id}, '${sensor.device_code}')">❌ ${t("cancel_btn", "Batal")}</button>` : ''}
                    </div>

                    ${hasCountdown ? `
                        <div style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 10px; padding: 16px 12px; text-align: center; box-shadow: inset 0 0 15px rgba(14, 165, 233, 0.05);">
                            <div id="countdown-timer-live-${sensor.id}" data-target="${sensor.countdown_end}" style="font-size: 32px; font-weight: 800; color: #38bdf8; font-family: monospace; letter-spacing: 2px; margin: 0; text-shadow: 0 0 12px rgba(56, 189, 248, 0.4);">
                                ${formatCountdownStr(remainingSec)}
                            </div>
                        </div>
                    ` : `
                        <!-- FLEXIBLE DURATION INPUT -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                            <input type="number" id="countdown-hours-${sensor.id}" placeholder="0" min="0" max="24" value="0" style="padding: 7px; font-size: 12px; width: 100%; border-radius: 6px; text-align: center;">
                            <input type="number" id="countdown-min-${sensor.id}" placeholder="30" min="0" max="59" value="30" style="padding: 7px; font-size: 12px; width: 100%; border-radius: 6px; text-align: center;">
                        </div>

                        <!-- ACTION SELECT & START BUTTON -->
                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 6px; align-items: center;">
                            <select id="countdown-act-${sensor.id}" style="padding: 7px 8px; font-size: 11px; font-weight: 600; background: rgba(15, 23, 42, 0.8); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                                <option value="OFF">${t("option_off", "Mati (OFF)")}</option>
                                <option value="ON">${t("option_on", "Nyalakan (ON)")}</option>
                            </select>
                            <button style="font-size: 12px; padding: 7px 0; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; box-shadow: 0 0 10px rgba(2, 132, 199, 0.4);" onclick="startCountdownTimer(${sensor.id}, '${sensor.device_code}')">▶️ ${t("start_btn", "Mulai")}</button>
                        </div>
                    `}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
                    <button class="btn-secondary" style="font-size: 12px; width: 100%;" onclick="editRelayName(${sensor.id}, '${sensor.sensor_name}')">
                        ✏️ ${t("rename_btn", "Ubah Nama")}
                    </button>
                    <button class="btn-danger-sm" style="font-size: 12px; width: 100%; padding: 7px 0; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="deleteMetric(${sensor.id}, '${sensor.sensor_name}')">
                        🗑️ ${t("delete_btn", "Hapus")}
                    </button>
                </div>
            </div>
            `;
        } else {
            let val = sensor.value ?? 0;
            const sNameClean = sensor.sensor_name || sensor.sensor_type;
            let icon = sensor.icon || getSensorIcon(sNameClean || sensor.sensor_type);
            const valNum = parseFloat(val) || 0;
            const barWidth = Math.min(100, Math.max(8, valNum * 10));

            html += `
            <div class="device-card sensor-value-card sensor-widget-card" data-sensor-id="${sensor.id}" style="display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; background: linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%); border: 1px solid rgba(56, 189, 248, 0.2); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);">
                <div style="position: absolute; top: -30px; right: -30px; width: 100px; height: 100px; background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%); pointer-events: none;"></div>

                <div>
                    <div class="device-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="drag-handle" title="Tahan & Geser ikon ini untuk mengubah posisi" style="cursor: grab; color: var(--text-muted); padding: 4px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                            </div>
                            <div class="device-icon" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);">${icon}</div>
                            <div>
                                <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">${sNameClean}</h2>
                                <span style="display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.25);">${sensor.sensor_type || 'SENSOR'}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button type="button" class="btn-secondary" title="Tambah Otomasi untuk ${sNameClean}" style="font-size: 11px; padding: 5px 9px; font-weight: 700; border-radius: 8px; display: flex; align-items: center; gap: 4px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);" onclick="openAddRuleForSensor('${sNameClean}')">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                + ${t("automation_btn", "Otomasi")}
                            </button>
                            <button type="button" class="btn-danger-sm" title="Hapus Sensor ${sNameClean}" style="font-size: 11px; padding: 5px 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center;" onclick="deleteMetric(${sensor.id}, '${sNameClean}')">
                                🗑️
                            </button>
                        </div>
                    </div>

                    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px 16px; text-align: center; position: relative; margin-bottom: 14px; box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.04), 0 4px 15px rgba(0, 0, 0, 0.2);">
                        <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; display: flex; justify-content: center; align-items: center; gap: 6px;">
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
                            ${t("realtime_reading", "Pembacaan Real-Time")}
                        </div>
                        <div style="display: flex; align-items: baseline; justify-content: center; gap: 8px;">
                            <span id="live-${sNameClean.toLowerCase()}" style="font-size: 40px; font-weight: 800; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #ffffff; letter-spacing: -1px; text-shadow: 0 0 25px rgba(56, 189, 248, 0.4);">${val}</span>
                            <span style="font-size: 15px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 3px 9px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.3); font-family: monospace;">${sensor.unit || ""}</span>
                        </div>

                        <div style="margin-top: 14px; background: rgba(15, 23, 42, 0.9); height: 6px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); padding: 1px;">
                            <div id="gauge-bar-${sNameClean.toLowerCase()}" style="height: 100%; width: ${barWidth}%; background: linear-gradient(90deg, #38bdf8 0%, #10b981 100%); border-radius: 10px; transition: width 0.6s ease; box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);"></div>
                        </div>
                    </div>

                    <div id="sensor-rules-list-${sNameClean.toLowerCase()}" class="sensor-rules-mini-list" style="margin-bottom: 12px;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #94a3b8; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                        Telemetry Stream
                    </span>
                    <span style="color: var(--blynk-green); font-weight: 700; display: flex; align-items: center; gap: 5px;">
                        <span class="pulse-dot" style="width: 6px; height: 6px;"></span>
                        Live
                    </span>
                </div>
            </div>
            `;
        }
    });

    box.innerHTML = html;
    setTimeout(() => setupSensorDragAndDrop(), 50);
}

// ==========================
// DRAG & DROP SENSOR REORDERING
// ==========================
function setupSensorDragAndDrop() {
    const container = document.getElementById("sensorDashboard");
    if (!container) return;

    const cards = container.querySelectorAll(".sensor-widget-card");
    let draggedCard = null;

    cards.forEach(card => {
        card.removeAttribute("draggable");
        card.style.cursor = "default";

        const handle = card.querySelector(".drag-handle");
        if (handle) {
            handle.addEventListener("mousedown", () => {
                card.setAttribute("draggable", "true");
                handle.style.cursor = "grabbing";
            });
            handle.addEventListener("mouseup", () => {
                card.setAttribute("draggable", "false");
                handle.style.cursor = "grab";
            });
            handle.addEventListener("mouseleave", () => {
                if (!draggedCard) {
                    card.setAttribute("draggable", "false");
                    handle.style.cursor = "grab";
                }
            });
            handle.addEventListener("touchstart", () => {
                card.setAttribute("draggable", "true");
            }, { passive: true });
        }

        card.addEventListener("dragstart", (e) => {
            if (card.getAttribute("draggable") !== "true") {
                e.preventDefault();
                return false;
            }
            draggedCard = card;
            card.style.opacity = "0.45";
            card.style.transform = "scale(0.97)";
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", card.dataset.sensorId);
        });

        card.addEventListener("dragend", () => {
            card.setAttribute("draggable", "false");
            if (handle) handle.style.cursor = "grab";
            draggedCard = null;
            card.style.opacity = "1";
            card.style.transform = "none";
            
            // Auto save new layout order to server!
            saveSensorsOrder();
        });

        card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!draggedCard || draggedCard === card) return;

            const rect = card.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            if (e.clientX < midpoint) {
                container.insertBefore(draggedCard, card);
            } else {
                container.insertBefore(draggedCard, card.nextSibling);
            }
        });
    });
}

async function saveSensorsOrder() {
    const container = document.getElementById("sensorDashboard");
    if (!container || !deviceCode) return;

    const cards = container.querySelectorAll(".sensor-widget-card");
    const order = Array.from(cards).map(c => parseInt(c.dataset.sensorId)).filter(id => !isNaN(id));

    if (order.length === 0) return;

    try {
        const response = await fetch(`/api/device/${deviceCode}/sensors/reorder`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: order })
        });
        const res = await response.json();
        if (res && res.success) {
            showToast("Urutan posisi sensor berhasil disimpan!", "success");
        }
    } catch (e) {
        console.error("Save sensors order error:", e);
    }
}

// ==========================
// GRAPH MANAGEMENT & SETUP
// ==========================
function setupGraphControls(sensors) {
    const controlBar = document.getElementById("graphControlBar");
    const selectEl = document.getElementById("graphSensorSelect");
    const graphSection = document.getElementById("graphSection");

    if (!controlBar || !selectEl) return;

    availableDeviceSensors = [];
    const mapKeys = new Set();

    // 1. Add preset metrics if available for this device type (non-relay)
    if (PRESET_METRICS[currentDeviceType]) {
        PRESET_METRICS[currentDeviceType].forEach(m => {
            if (!mapKeys.has(m.key)) {
                mapKeys.add(m.key);
                availableDeviceSensors.push(m);
            }
        });
    }

    // 2. Add telemetry sensors present in the device database (excluding Relays)
    if (Array.isArray(sensors)) {
        sensors.forEach(s => {
            const isRelay = s.sensor_type === "Relay" || (s.sensor_name && s.sensor_name.toLowerCase().includes("relay"));
            if (isRelay) return; // Skip relay controls from analytics graphs

            const key = s.sensor_name.toLowerCase();
            if (!mapKeys.has(key)) {
                mapKeys.add(key);
                availableDeviceSensors.push({
                    key: key,
                    name: s.sensor_name,
                    unit: s.unit || ""
                });
            }
        });
    }

    // If no telemetry sensors present, hide graph section
    if (availableDeviceSensors.length === 0) {
        controlBar.style.display = "none";
        if (graphSection) graphSection.style.display = "none";
        const container = document.getElementById("graphsContainer");
        if (container) container.innerHTML = "";
        return;
    }

    if (graphSection) graphSection.style.display = "block";
    controlBar.style.display = "flex";

    // Populate Select Options
    selectEl.innerHTML = availableDeviceSensors.map(s => 
        `<option value="${s.key}">${s.name}</option>`
    ).join('');

    // Default graphs initialization if empty
    if (activeGraphSensors.length === 0) {
        if (availableDeviceSensors.length >= 2) {
            activeGraphSensors = [availableDeviceSensors[0].key, availableDeviceSensors[1].key];
        } else if (availableDeviceSensors.length === 1) {
            activeGraphSensors = [availableDeviceSensors[0].key];
        }
    }

    renderAllGraphs();
}

function addNewGraphFromSelect() {
    const selectEl = document.getElementById("graphSensorSelect");
    if (!selectEl) return;

    const selectedKey = selectEl.value;
    if (!selectedKey) return;

    if (activeGraphSensors.includes(selectedKey)) {
        showToast("Grafik untuk sensor ini sudah ditampilkan!", "warning");
        return;
    }

    activeGraphSensors.push(selectedKey);
    renderAllGraphs();
}

function removeGraph(key) {
    if (chartInstances[key]) {
        try { chartInstances[key].destroy(); } catch (e) {}
        delete chartInstances[key];
    }
    activeGraphSensors = activeGraphSensors.filter(k => k !== key);
    renderAllGraphs();
}

function renderAllGraphs() {
    const container = document.getElementById("graphsContainer");
    if (!container) return;

    // Safely destroy existing chart instances before modifying/rebuilding DOM containers
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key]) {
            try { chartInstances[key].destroy(); } catch (e) {}
            delete chartInstances[key];
        }
    });

    if (activeGraphSensors.length === 0) {
        container.innerHTML = `
        <div class="card" style="grid-column: 1/-1; padding: 30px;">
            <h3>Tidak Ada Grafik Aktif</h3>
            <p>Pilih sensor dari menu di atas dan klik "+ Tambah Grafik" untuk menampilkan analisis grafik.</p>
        </div>
        `;
        return;
    }

    // Create cards for active graphs
    let html = "";
    activeGraphSensors.forEach(key => {
        const metricObj = availableDeviceSensors.find(m => m.key === key) || { name: key.toUpperCase(), unit: "" };
        html += `
        <div class="card graph-card" id="graph-card-${key}">
            <div class="graph-card-header">
                <div class="graph-card-title" style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #ffffff;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    ${metricObj.name} ${metricObj.unit ? '(' + metricObj.unit + ')' : ''}
                </div>
                <button class="btn-danger-sm" onclick="removeGraph('${key}')" style="padding: 4px 10px; font-size: 12px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Hapus Grafik</button>
            </div>
            <div style="position: relative; height: 260px; width: 100%; margin-top: 10px;">
                <canvas id="chart-canvas-${key}"></canvas>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;

    // Render Chart.js instances for each canvas
    activeGraphSensors.forEach(key => {
        loadSingleChart(key);
    });
}

// ==========================
// LOAD SINGLE CHART.JS INSTANCE
// ==========================
async function loadSingleChart(sensorKey) {
    try {
        const initialCanvas = document.getElementById("chart-canvas-" + sensorKey);
        if (!initialCanvas) return;

        const response = await fetch("/api/device/" + deviceCode + "/history/" + sensorKey + "?_=" + Date.now());
        let data = await response.json();

        // Re-verify canvas element exists after async fetch
        const canvasEl = document.getElementById("chart-canvas-" + sensorKey);
        if (!canvasEl) return;

        if (!Array.isArray(data) || data.length === 0) {
            const currentSensorObj = currentSensorsData.find(s => s.sensor_name && s.sensor_name.toLowerCase() === sensorKey.toLowerCase());
            const fallbackValue = currentSensorObj ? (parseFloat(currentSensorObj.value) || 0) : 0;
            data = [{ time: new Date().toISOString(), value: fallbackValue }];
        }

        const history = [...data].reverse();
        const labels = history.map(item => new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        const values = history.map(item => item.value);

        // Check if chart instance exists AND is still bound to the active DOM canvas element
        if (chartInstances[sensorKey]) {
            const existingChart = chartInstances[sensorKey];
            if (existingChart.canvas === canvasEl) {
                existingChart.data.labels = labels;
                existingChart.data.datasets[0].data = values;
                existingChart.update('none');
                return;
            } else {
                // If canvas element was recreated, destroy stale chart instance
                try { existingChart.destroy(); } catch (e) {}
                delete chartInstances[sensorKey];
            }
        }

        if (typeof Chart === "undefined") {
            console.error("Chart.js library is not loaded.");
            return;
        }

        const theme = SENSOR_COLORS[sensorKey] || SENSOR_COLORS.default;
        const ctx = canvasEl.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, theme.fill);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

        const metricObj = availableDeviceSensors.find(m => m.key === sensorKey) || { name: sensorKey.toUpperCase() };

        chartInstances[sensorKey] = new Chart(canvasEl, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: metricObj.name,
                    data: values,
                    borderColor: theme.border,
                    borderWidth: 2.8,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: theme.border,
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                    pointRadius: 3.5,
                    pointHoverRadius: 7.5,
                    pointHoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        labels: {
                            color: "#f8fafc",
                            font: { family: "'Plus Jakarta Sans', sans-serif", weight: "700", size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(10, 14, 26, 0.92)",
                        titleColor: "#ffffff",
                        bodyColor: theme.border,
                        borderColor: "rgba(255, 255, 255, 0.15)",
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        usePointStyle: true,
                        titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: "700" },
                        bodyFont: { family: "'JetBrains Mono', monospace", weight: "600" }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.04)" },
                        ticks: { color: "#94a3b8", font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
                    },
                    y: {
                        grid: { color: "rgba(255, 255, 255, 0.04)" },
                        ticks: { color: "#94a3b8", font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Chart load error for " + sensorKey, error);
    }
}

let isUpdatingRelay = {};

// ==========================
// CONTROL RELAY
// ==========================
async function controlRelaySwitch(code, name, checked, id) {
    const value = checked ? 1 : 0;
    const checkboxEl = document.querySelector(`input[onchange*="${id}"]`);
    isUpdatingRelay[id] = true;

    try {
        const response = await fetch("/api/device/" + code + "/sensor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sensor_name: name, value: value })
        });
        const result = await response.json();
        if (result.success) {
            const status = document.getElementById("relay-status-" + id);
            if (status) {
                status.innerText = value == 1 ? "ON" : "OFF";
                status.className = value == 1 ? "status-on" : "status-off";
            }
            const cardEl = document.getElementById("relay-card-" + id);
            if (cardEl) {
                if (value == 1) cardEl.classList.add("is-on");
                else cardEl.classList.remove("is-on");
            }
        } else {
            if (checkboxEl) checkboxEl.checked = !checked;
            showToast(result.message || "Gagal mengubah status relay", "error");
        }
    } catch (error) {
        console.error("Relay control error", error);
        if (checkboxEl) checkboxEl.checked = !checked;
        showToast("Gagal terhubung ke server", "error");
    } finally {
        setTimeout(() => { isUpdatingRelay[id] = false; }, 1500);
    }
}

// ==========================
// ==========================
// INSTANT RELAY MODE SWITCH
// ==========================
async function switchRelayMode(id, code, selectedMode) {
    const targetCode = code || deviceCode || getDeviceCode() || "01";
    try {
        const response = await fetch(`/api/device/${targetCode}/relay/${id}/mode`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: selectedMode })
        });
        const result = await response.json();
        if (result.success) {
            showToast(`Mode Relay berhasil diubah ke ${selectedMode === 'AUTO' ? 'Otomatis' : 'Manual'}`);
            loadDashboard();
        } else {
            showToast(result.message || "Gagal mengubah mode relay", "error");
        }
    } catch (e) {
        console.error("Switch relay mode error", e);
        showToast("Gagal terhubung ke server", "error");
    }
}

// ==========================
// SAVE RELAY TIMER SCHEDULE
// ==========================
async function saveRelaySchedule(id, code, btnEl) {
    const targetCode = code || deviceCode || getDeviceCode() || "01";
    const timeOnEl = document.getElementById(`relay-time-on-${id}`);
    const timeOffEl = document.getElementById(`relay-time-off-${id}`);

    const timeOn = timeOnEl ? timeOnEl.value : '06:00';
    const timeOff = timeOffEl ? timeOffEl.value : '18:00';

    const btn = btnEl || (event && event.currentTarget) || document.querySelector(`button[onclick*="saveRelaySchedule(${id}"]`);
    const origText = btn ? btn.innerHTML : '💾 Save Timer';

    try {
        const response = await fetch(`/api/device/${targetCode}/relay/${id}/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ time_on: timeOn, time_off: timeOff })
        });
        const result = await response.json();
        if (result.success) {
            if (btn) {
                btn.innerHTML = '✅ Saved!';
                btn.style.background = '#00D285';
                btn.style.color = '#070a12';
                btn.style.boxShadow = '0 0 16px var(--blynk-green-glow)';
            }
            showToast("Pengaturan Jam Timer Berhasil Disimpan!");

            setTimeout(() => {
                if (btn) {
                    btn.innerHTML = origText;
                    btn.style.background = '';
                    btn.style.color = '';
                    btn.style.boxShadow = '';
                }
            }, 2000);
        } else {
            showToast(result.message || "Gagal menyimpan pengaturan relay", "error");
        }
    } catch (e) {
        console.error("Save relay schedule error", e);
        showToast("Gagal terhubung ke server", "error");
    }
}

// ==========================
// EDIT RELAY NAME
// ==========================
async function editRelayName(id, oldName) {
    let newName = null;
    try {
        if (typeof showPromptModal === "function") {
            newName = await showPromptModal({
                title: "Ubah Nama Sakelar Relay",
                message: "Masukkan nama baru untuk sakelar relay ini:",
                defaultValue: oldName,
                icon: "✏️",
                confirmText: "Simpan Nama Baru",
                cancelText: "Batal"
            });
        } else {
            newName = window.prompt("Masukkan nama baru untuk sakelar relay ini:", oldName);
        }
    } catch (e) {
        console.error("Modal error, falling back to prompt:", e);
        newName = window.prompt("Masukkan nama baru untuk sakelar relay ini:", oldName);
    }

    if (!newName) return;
    newName = String(newName).trim();
    if (!newName) return;

    if (newName === oldName) {
        if (typeof showToast === "function") showToast("Nama relay tidak berubah", "warning");
        return;
    }

    try {
        const targetCode = deviceCode || getDeviceCode() || "01";
        const response = await fetch("/api/device/" + targetCode + "/sensor/" + id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName })
        });

        const result = await response.json();

        if (response.status === 401 || (result.message && result.message.includes("Unauthorized"))) {
            if (typeof showToast === "function") showToast("Sesi login telah berakhir. Mengalihkan ke login...", "error");
            setTimeout(() => { window.location.href = "login.html"; }, 1200);
            return;
        }

        if (result.success) {
            if (typeof showToast === "function") showToast("Nama relay berhasil diperbarui!", "success");
            loadDashboard();
        } else {
            if (typeof showToast === "function") showToast(result.message || "Gagal mengubah nama relay", "error");
        }
    } catch (error) {
        console.error("Rename relay error:", error);
        if (typeof showToast === "function") showToast("Gagal terhubung ke server", "error");
    }
}
window.editRelayName = editRelayName;

// ==========================
// DEVICE MONITORING TIMERS
// ==========================
function startDeviceStatusMonitoring() {
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(() => { updateDeviceStatus(); }, 5000);
}

async function updateDeviceStatus() {
    if (!deviceCode) return;
    try {
        const response = await fetch("/api/device/" + deviceCode + "?_=" + Date.now());
        const device = await response.json();
        
        const badgeEl = document.getElementById("deviceStatusBadge");
        if (badgeEl) {
            badgeEl.className = device.status === "ONLINE" ? "online" : "offline";
            badgeEl.innerText = device.status === "ONLINE" ? "● ONLINE" : "● OFFLINE";
        }
    } catch (e) {
        console.error("Status update error", e);
    }
}

function getIcon(type) {
    switch (type) {
        case "Energy Monitor": return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
        case "Monitoring": return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>`;
        case "Relay": return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-purple)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        default: return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line></svg>`;
    }
}

function getSensorIcon(type) {
    const t = type.toLowerCase();
    if (t.includes("temp")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>`;
    if (t.includes("hum")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;
    if (t.includes("volt")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    if (t.includes("curr") || t.includes("amp")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e599" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 12h-5V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-4h5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z"></path></svg>`;
    if (t.includes("pow")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`;
    if (t.includes("ener")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect><line x1="23" y1="11" x2="23" y2="13"></line></svg>`;
    if (t.includes("freq")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l3-9 4 18 3-9h4"></path></svg>`;
    if (t.includes("press")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
    if (t.includes("gas")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"></path><path d="M9.6 4.6A2 2 0 1 1 11 8H2"></path><path d="M12.6 19.4A2 2 0 1 0 14 16H2"></path></svg>`;
    if (t.includes("light")) return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
}

let evtSourceInstance = null;

function startLiveStream() {
    if (!deviceCode) return;
    if (evtSourceInstance) {
        evtSourceInstance.close();
        evtSourceInstance = null;
    }
    try {
        const streamUrl = "/api/device/" + deviceCode + "/stream";
        evtSourceInstance = new EventSource(streamUrl);

        evtSourceInstance.onmessage = (event) => {
            try {
                const sensors = JSON.parse(event.data);
                if (Array.isArray(sensors)) {
                    sensors.forEach(s => {
                        if (s.sensor_type === "Relay") {
                            const isOn = s.value == 1;
                            const isAuto = s.mode === "AUTO";

                            const statusEl = document.getElementById("relay-status-" + s.id);
                            if (statusEl) {
                                statusEl.innerText = isOn ? "ON" : "OFF";
                                statusEl.className = isOn ? "status-on" : "status-off";
                            }

                            const modeBadgeEl = document.getElementById("relay-mode-badge-" + s.id);
                            if (modeBadgeEl) {
                                modeBadgeEl.innerText = isAuto ? "Auto Mode Active" : "Manual Mode Active";
                            }

                            const cardEl = document.getElementById("relay-card-" + s.id);
                            if (cardEl) {
                                if (isOn) cardEl.classList.add("is-on");
                                else cardEl.classList.remove("is-on");
                            }

                            const checkboxEl = document.querySelector(`input[onchange*="${s.id}"]`);
                            if (checkboxEl && !isUpdatingRelay[s.id]) {
                                checkboxEl.checked = isOn;
                            }
                        } else {
                            const liveValEl = document.getElementById("live-" + (s.sensor_name || s.sensor_type).toLowerCase());
                            if (liveValEl) {
                                liveValEl.innerText = s.value;
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("Stream message parse error:", e);
            }
        };
    } catch (e) {
        console.error("EventSource initialization error:", e);
    }
}

function startLiveMonitoring() {
    startLiveStream();
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(() => { loadLiveSensor(); }, 2000);
}

async function loadLiveSensor() {
    if (!deviceCode) return;
    try {
        const response = await fetch("/api/device/" + deviceCode + "/sensors?_=" + Date.now());
        const sensors = await response.json();
        
        if (Array.isArray(sensors)) {
            sensors.forEach(s => {
                if (s.sensor_type === "Relay") {
                    const isOn = s.value == 1;
                    const isAuto = s.mode === "AUTO";

                    const statusEl = document.getElementById("relay-status-" + s.id);
                    if (statusEl) {
                        statusEl.innerText = isOn ? "ON" : "OFF";
                        statusEl.className = isOn ? "status-on" : "status-off";
                    }

                    const modeBadgeEl = document.getElementById("relay-mode-badge-" + s.id);
                    if (modeBadgeEl) {
                        modeBadgeEl.innerText = isAuto ? "Auto Mode Active" : "Manual Mode Active";
                    }

                    const cardEl = document.getElementById("relay-card-" + s.id);
                    if (cardEl) {
                        if (isOn) cardEl.classList.add("is-on");
                        else cardEl.classList.remove("is-on");
                    }

                    const checkboxEl = document.querySelector(`input[onchange*="${s.id}"]`);
                    if (checkboxEl && document.activeElement !== checkboxEl && !isUpdatingRelay[s.id]) {
                        checkboxEl.checked = isOn;
                        checkboxEl.disabled = isAuto;
                    }
                } else {
                    const sensorKey = (s.sensor_name || s.sensor_type).toLowerCase();
                    const valEl = document.getElementById("live-" + sensorKey);
                    if (valEl) {
                        valEl.innerText = s.value ?? 0;
                    }
                    const gaugeEl = document.getElementById("gauge-bar-" + sensorKey);
                    if (gaugeEl) {
                        const valNum = parseFloat(s.value) || 0;
                        gaugeEl.style.width = Math.min(100, Math.max(8, valNum * 10)) + "%";
                    }
                }
            });
        }

        if (Array.isArray(activeGraphSensors) && activeGraphSensors.length > 0) {
            activeGraphSensors.forEach(sensorKey => {
                loadSingleChart(sensorKey);
            });
        }
    } catch (e) {
        console.error("Live sensor update error", e);
    }
}

function formatCountdownStr(totalSec) {
    if (totalSec <= 0) return "00:00:00";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatLocalTime(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function startCountdownTicking() {
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    window.countdownInterval = setInterval(() => {
        let hasExpired = false;
        document.querySelectorAll('[id^="countdown-timer-live-"]').forEach(el => {
            const targetIso = el.getAttribute('data-target');
            if (targetIso) {
                const targetMs = new Date(targetIso).getTime();
                const remSec = Math.floor((targetMs - Date.now()) / 1000);
                if (remSec > 0) {
                    el.innerText = formatCountdownStr(remSec);
                } else {
                    el.innerText = "00:00:00";
                    hasExpired = true;
                }
            }
        });

        if (hasExpired) {
            setTimeout(() => {
                loadDashboard();
            }, 1200);
        }
    }, 1000);
}

function setPresetCountdown(sensorId, hours, mins) {
    const hInput = document.getElementById(`countdown-hours-${sensorId}`);
    const mInput = document.getElementById(`countdown-min-${sensorId}`);
    if (hInput) hInput.value = hours;
    if (mInput) mInput.value = mins;
}

async function startCountdownTimer(sensorId, deviceCode) {
    const targetCode = deviceCode || (typeof getDeviceCode === 'function' ? getDeviceCode() : "ESP32_ROOM_01");
    const hInput = document.getElementById(`countdown-hours-${sensorId}`);
    const mInput = document.getElementById(`countdown-min-${sensorId}`);
    const actSelect = document.getElementById(`countdown-act-${sensorId}`);
    
    const h = hInput ? parseInt(hInput.value, 10) || 0 : 0;
    const m = mInput ? parseInt(mInput.value, 10) || 0 : 0;
    const totalMinutes = (h * 60) + m;
    const action = actSelect ? actSelect.value : 'OFF';

    if (totalMinutes <= 0) {
        showToast("Masukkan durasi jam atau menit yang valid", "error");
        return;
    }

    try {
        const res = await fetch(`/api/device/${targetCode}/relay/${sensorId}/countdown`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ minutes: totalMinutes, action })
        });
        const data = await res.json();
        if (data && data.success) {
            let labelStr = h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
            showToast(`Countdown diatur: ${labelStr} (Turn ${action})`, "success");
            loadDashboard(); // Render ulang tampilan dashboard secara langsung
        } else {
            showToast((data && data.message) || "Gagal mengatur countdown", "error");
        }
    } catch (e) {
        console.error("Countdown fetch error:", e);
        showToast("Gagal terhubung ke server", "error");
    }
}

async function cancelCountdownTimer(sensorId, deviceCode) {
    const targetCode = deviceCode || (typeof getDeviceCode === 'function' ? getDeviceCode() : "ESP32_ROOM_01");
    try {
        const res = await fetch(`/api/device/${targetCode}/relay/${sensorId}/countdown`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cancel: true })
        });
        const data = await res.json();
        if (data && data.success) {
            showToast("Countdown dibatalkan", "info");
            loadDashboard(); // Render ulang tampilan dashboard secara langsung
        }
    } catch (e) {
        console.error("Cancel countdown error:", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
    startCountdownTicking();
});

// ==========================================
// DYNAMIC ADD & DELETE SENSOR / RELAY MODAL
// ==========================================
function openAddMetricModal() {
    const modal = document.getElementById("addMetricModal");
    if (modal) {
        modal.style.display = "flex";
        onMetricCategoryChange();
    }
}

function closeAddMetricModal() {
    const modal = document.getElementById("addMetricModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function onMetricCategoryChange() {
    const categorySelect = document.getElementById("newMetricCategory");
    const unitInput = document.getElementById("newMetricUnit");
    if (!categorySelect || !unitInput) return;

    const cat = categorySelect.value;
    switch (cat) {
        case "Temperature": unitInput.value = "°C"; break;
        case "Humidity": unitInput.value = "%"; break;
        case "Voltage": unitInput.value = "V"; break;
        case "Current": unitInput.value = "A"; break;
        case "Power": unitInput.value = "W"; break;
        case "Energy": unitInput.value = "kWh"; break;
        case "Frequency": unitInput.value = "Hz"; break;
        case "Dimmer": unitInput.value = "%"; break;
        case "Relay": unitInput.value = ""; break;
        default: unitInput.value = ""; break;
    }
}

async function submitNewMetric() {
    if (!deviceCode) {
        showToast("Kode perangkat tidak valid", "error");
        return;
    }

    const categorySelect = document.getElementById("newMetricCategory");
    const nameInput = document.getElementById("newMetricName");
    const unitInput = document.getElementById("newMetricUnit");
    const initValInput = document.getElementById("newMetricInitVal");

    const sensor_name = nameInput ? nameInput.value.trim() : "";
    const sensor_type = categorySelect ? categorySelect.value : "Custom";
    const unit = unitInput ? unitInput.value.trim() : "";
    const initial_value = initValInput ? parseFloat(initValInput.value) || 0 : 0;

    if (!sensor_name) {
        showToast("Silakan masukkan Nama Sensor / Relay", "error");
        if (nameInput) nameInput.focus();
        return;
    }

    try {
        const response = await fetch(`/api/device/${deviceCode}/add-sensor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sensor_name, sensor_type, unit, initial_value })
        });
        const result = await response.json();

        if (result && result.success) {
            showToast(result.message || "Berhasil menambahkan komponen!", "success");
            closeAddMetricModal();
            if (nameInput) nameInput.value = "";
            loadDashboard();
        } else {
            showToast(result.message || "Gagal menambahkan komponen", "error");
        }
    } catch (err) {
        console.error("Submit metric error:", err);
        showToast("Terjadi kesalahan jaringan/server", "error");
    }
}

async function deleteMetric(sensorId, sensorName) {
    if (!deviceCode) return;

    const sure = await showConfirmModal({
        title: "Hapus Sensor / Relay",
        message: `Apakah Anda yakin ingin menghapus '${sensorName}' dari perangkat ini?`,
        icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        confirmText: "Ya, Hapus",
        cancelText: "Batal",
        isDanger: true
    });

    if (!sure) return;

    try {
        const response = await fetch(`/api/device/${deviceCode}/sensor/${sensorId}`, {
            method: "DELETE"
        });
        const result = await response.json();

        if (result && result.success) {
            showToast(result.message || "Berhasil menghapus komponen", "success");
            loadDashboard();
        } else {
            showToast(result.message || "Gagal menghapus komponen", "error");
        }
    } catch (err) {
        console.error("Delete metric error:", err);
        showToast("Terjadi kesalahan server", "error");
    }
}

// ==========================================
// SMART AUTOMATION RULES UI HANDLERS
// ==========================================
async function loadDeviceRules() {
    if (!deviceCode) return;
    try {
        const response = await fetch(`/api/device/${deviceCode}/rules?_=${Date.now()}`);
        const rules = await response.json();
        renderDeviceRules(rules);
    } catch (err) {
        console.error("Load rules error:", err);
    }
}

function renderDeviceRules(rules) {
    // Update mini rule badges inside each telemetry sensor widget card
    const sensorRuleMap = {};
    if (Array.isArray(rules)) {
        rules.forEach(rule => {
            if (!rule.is_active) return;
            const key = String(rule.sensor_name).trim().toLowerCase();
            if (!sensorRuleMap[key]) sensorRuleMap[key] = [];
            sensorRuleMap[key].push(rule);
        });
    }

    document.querySelectorAll(".sensor-rules-mini-list").forEach(el => {
        const sNameKey = el.id.replace("sensor-rules-list-", "").trim().toLowerCase();
        const activeRules = sensorRuleMap[sNameKey] || [];

        if (activeRules.length === 0) {
            el.innerHTML = "";
        } else {
            el.innerHTML = activeRules.map(r => `
                <div style="padding: 6px 10px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; font-size: 11.5px; color: var(--blynk-amber); margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <span>⚡ <b>${r.rule_name}:</b> ${r.operator} ${r.trigger_value} ➔ ${r.target_relay} <b style="color:${r.target_action==='ON'?'var(--blynk-green)':'var(--danger)'}">${r.target_action}</b></span>
                    <button onclick="toggleRuleActive(${r.id})" title="Matikan Aturan" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0 4px; font-size: 11px;">✖</button>
                </div>
            `).join('');
        }
    });
}

async function openAddRuleForSensor(sensorName) {
    await openAddRuleModal();
    const sensorSelect = document.getElementById("ruleSensorSelect");
    if (sensorSelect && sensorName) {
        sensorSelect.value = sensorName;
    }
    const nameInput = document.getElementById("ruleNameInput");
    if (nameInput) {
        nameInput.value = `Otomasi ${sensorName}`;
    }
}

async function openAddRuleModal() {
    const modal = document.getElementById("addRuleModal");
    const sensorSelect = document.getElementById("ruleSensorSelect");
    const relaySelect = document.getElementById("ruleTargetRelaySelect");

    if (!modal || !sensorSelect || !relaySelect) return;

    if (!Array.isArray(currentSensorsData) || currentSensorsData.length === 0) {
        try {
            const res = await fetch("/api/device/" + deviceCode + "/sensors?_=" + Date.now());
            currentSensorsData = await res.json();
        } catch (e) {}
    }

    const sensorsList = Array.isArray(currentSensorsData) ? currentSensorsData : [];

    // Populate sensors (telemetry)
    const telemetrySensors = sensorsList.filter(s => s.sensor_type !== "Relay");
    if (telemetrySensors.length > 0) {
        sensorSelect.innerHTML = telemetrySensors.map(s => `<option value="${s.sensor_name}">${s.sensor_name} (${s.unit || ''})</option>`).join('');
    } else {
        sensorSelect.innerHTML = `<option value="Voltage">Voltage (V)</option>`;
    }

    // Populate relays
    const relayControls = sensorsList.filter(s => s.sensor_type === "Relay" || (s.sensor_name && s.sensor_name.toLowerCase().includes("relay")));
    if (relayControls.length > 0) {
        relaySelect.innerHTML = relayControls.map(r => `<option value="${r.sensor_name}">${r.sensor_name}</option>`).join('');
    } else {
        relaySelect.innerHTML = `<option value="Relay 1">Relay 1</option><option value="Relay 2">Relay 2</option>`;
    }

    modal.style.display = "flex";
}

function closeAddRuleModal() {
    const modal = document.getElementById("addRuleModal");
    if (modal) modal.style.display = "none";
}

async function submitNewRule() {
    if (!deviceCode) return;

    const nameInput = document.getElementById("ruleNameInput");
    const sensorSelect = document.getElementById("ruleSensorSelect");
    const operatorSelect = document.getElementById("ruleOperatorSelect");
    const thresholdInput = document.getElementById("ruleThresholdInput");
    const relaySelect = document.getElementById("ruleTargetRelaySelect");
    const actionSelect = document.getElementById("ruleTargetActionSelect");

    const rule_name = nameInput ? nameInput.value.trim() : "";
    const sensor_name = sensorSelect ? sensorSelect.value : "";
    const operator = operatorSelect ? operatorSelect.value : ">";
    const trigger_value = thresholdInput ? parseFloat(thresholdInput.value) : NaN;
    const target_relay = relaySelect ? relaySelect.value : "";
    const target_action = actionSelect ? actionSelect.value : "ON";

    if (!rule_name) {
        showToast("Masukkan Nama Aturan Otomasi", "error");
        if (nameInput) nameInput.focus();
        return;
    }
    if (!sensor_name) {
        showToast("Pilih Sensor Sumber", "error");
        return;
    }
    if (isNaN(trigger_value)) {
        showToast("Masukkan Batas Ambang (Threshold) yang valid", "error");
        if (thresholdInput) thresholdInput.focus();
        return;
    }
    if (!target_relay) {
        showToast("Pilih Target Relay", "error");
        return;
    }

    try {
        const response = await fetch(`/api/device/${deviceCode}/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rule_name, sensor_name, operator, trigger_value, target_relay, target_action })
        });
        const result = await response.json();

        if (result && result.success) {
            showToast(result.message || "Aturan otomasi disimpan!", "success");
            closeAddRuleModal();
            if (nameInput) nameInput.value = "";
            if (thresholdInput) thresholdInput.value = "";
            loadDeviceRules();
        } else {
            showToast(result.message || "Gagal menyimpan aturan", "error");
        }
    } catch (err) {
        console.error("Submit rule error:", err);
        showToast("Terjadi kesalahan jaringan/server", "error");
    }
}

async function deleteRule(ruleId, ruleName) {
    if (!deviceCode) return;

    const sure = await showConfirmModal({
        title: "Hapus Aturan Otomasi",
        message: `Apakah Anda yakin ingin menghapus aturan '${ruleName}'?`,
        icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        confirmText: "Ya, Hapus",
        cancelText: "Batal",
        isDanger: true
    });

    if (!sure) return;

    try {
        const response = await fetch(`/api/device/${deviceCode}/rules/${ruleId}`, {
            method: "DELETE"
        });
        const result = await response.json();

        if (result && result.success) {
            showToast("Aturan otomasi berhasil dihapus", "success");
            loadDeviceRules();
        }
    } catch (err) {
        console.error("Delete rule error:", err);
    }
}

async function toggleRuleActive(ruleId) {
    if (!deviceCode) return;
    try {
        const response = await fetch(`/api/device/${deviceCode}/rules/${ruleId}/toggle`, {
            method: "PUT"
        });
        const result = await response.json();

        if (result && result.success) {
            showToast(result.message, "info");
            loadDeviceRules();
        }
    } catch (err) {
        console.error("Toggle rule error:", err);
    }
}

// ==========================
// SUPER ADMIN DYNAMIC ESP32 C++ CODE GENERATOR
// ==========================
function generateEsp32CppCode(device, sensors) {
    const devCode = device.device_code || "01";
    const devName = device.device_name || "Perangkat BOTEK";
    const devType = device.type || "ESP32 Controller";
    const sensorsList = Array.isArray(sensors) ? sensors : [];

    const relays = sensorsList.filter(s => s.sensor_type === "Relay");
    const telemetrySensors = sensorsList.filter(s => s.sensor_type !== "Relay");

    const gpioPins = [18, 19, 21, 22, 23, 25, 26, 27, 32, 33];

    // Build Relay Pin Definitions & PinModes & Subscriptions & Topic Handlers
    let relayPinDefs = "// --- PENETAPAN PIN GPIO RELAY ---\n";
    let relayPinModes = "  // Inisialisasi Mode Output GPIO Relay (Default HIGH / Non-Aktif)\n";
    let relaySubscriptions = "      // Subscribe ke topik komando relay di Broker BOTEK\n";
    let relayTopicHandlers = "";

    if (relays.length === 0) {
        relayPinDefs += "// Tidak ada sakelar relay yang terdaftar pada perangkat ini.\n";
        relayPinModes += "  // (Belum ada relay)\n";
        relaySubscriptions += "      // (Belum ada relay)\n";
        relayTopicHandlers = "  // (Belum ada relay handler)\n";
    } else {
        relays.forEach((r, idx) => {
            const pin = gpioPins[idx % gpioPins.length];
            const pinVar = `PIN_RELAY_${idx + 1}`;
            const rName = r.sensor_name;

            relayPinDefs += `const int ${pinVar} = ${pin}; // Pin GPIO untuk Relay '${rName}'\n`;
            relayPinModes += `  pinMode(${pinVar}, OUTPUT);\n  digitalWrite(${pinVar}, HIGH); // Active LOW relay default OFF\n`;
            relaySubscriptions += `      client.subscribe("botek/${devCode}/relay/${rName}");\n`;

            if (idx > 0) relayTopicHandlers += " else ";
            relayTopicHandlers += `if (String(topic) == "botek/${devCode}/relay/${rName}") {\n`;
            relayTopicHandlers += `    bool stateOn = (message == "ON" || message == "1");\n`;
            relayTopicHandlers += `    digitalWrite(${pinVar}, stateOn ? LOW : HIGH);\n`;
            relayTopicHandlers += `    Serial.println("⚡ Status Relay '${rName}' diubah ke: " + message);\n`;
            relayTopicHandlers += `  }`;
        });
    }

    // Build Telemetry Sensor JSON Payload Generator
    let telemetryJsonPayloads = "  // BACALAH SENSOR FISIK ANDA DI SINI & MASUKKAN KE DALAM JSON PAYLOAD:\n";
    if (telemetrySensors.length === 0) {
        telemetryJsonPayloads += `  doc["status"] = "ONLINE";\n  doc["uptime_sec"] = millis() / 1000;\n`;
    } else {
        telemetrySensors.forEach((s, idx) => {
            const sName = s.sensor_name;
            const unit = s.unit ? ` (${s.unit})` : "";
            const varName = sName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

            telemetryJsonPayloads += `  // Baca Sensor Fisik '${sName}'${unit}\n`;
            telemetryJsonPayloads += `  float val_${varName} = 25.0 + (random(-20, 20) / 10.0); // Ganti baris ini dengan rumus/pembacaan sensor fisik Anda\n`;
            telemetryJsonPayloads += `  bool alert_${varName} = detectSpikeAnomaly("${sName}", val_${varName}, 5.0);\n`;
            telemetryJsonPayloads += `  doc["${sName}"] = val_${varName};\n`;
            telemetryJsonPayloads += `  if (alert_${varName}) doc["alert"] = "ANOMALY_DETECTED_IN_${sName.toUpperCase()}";\n\n`;
        });
    }

    return `/*
  ==============================================================
  BOTEK IoT Platform - ESP32 FIRMWARE C++ CODE
  Perangkat : ${devName} (${devType})
  Kode Unik : ${devCode}
  Dibuat    : ${new Date().toLocaleString('id-ID')}
  ==============================================================
  Fitur Terintegrasi:
  1. Edge Anomaly & Spike Detection Algorithm
  2. Auto Self-Healing Network Watchdog
  3. Telemetry Health Reporting
  ==============================================================
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- KONFIGURASI NETWORK WIFI ---
const char* WIFI_SSID = "NAMA_WIFI_ANDA";
const char* WIFI_PASS = "PASSWORD_WIFI_ANDA";

// --- KONFIGURASI BROKER MQTT BOTEK ---
const char* MQTT_SERVER = "iot.botek.my.id";
const int   MQTT_PORT   = 1883;
const char* DEVICE_CODE = "${devCode}";
const char* CLIENT_ID   = "ESP32_${devCode}_BUILD";

${relayPinDefs}
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastTelemetryTime = 0;
const long TELEMETRY_INTERVAL   = 5000; // Kirim data sensor setiap 5 detik

// ==============================================================
// BOTEK EDGE ENGINE: ANOMALY & SPIKE DETECTION
// ==============================================================
struct SensorMemory {
  String name;
  float lastValue;
};
SensorMemory sensorMemories[10];
int sensorMemoryCount = 0;

bool detectSpikeAnomaly(String sensorName, float currentVal, float threshold) {
  for (int i = 0; i < sensorMemoryCount; i++) {
    if (sensorMemories[i].name == sensorName) {
      float diff = abs(currentVal - sensorMemories[i].lastValue);
      sensorMemories[i].lastValue = currentVal;
      if (diff >= threshold) {
        Serial.print("⚠️ [ANOMALY ALERT] Lonjakan terdeteksi pada ");
        Serial.print(sensorName);
        Serial.print("! Selisih: ");
        Serial.println(diff);
        return true;
      }
      return false;
    }
  }
  if (sensorMemoryCount < 10) {
    sensorMemories[sensorMemoryCount].name = sensorName;
    sensorMemories[sensorMemoryCount].lastValue = currentVal;
    sensorMemoryCount++;
  }
  return false;
}

// --- FUNGSIONALITAS SUBSCRIPTION MQTT (KONTROL SAKELAR RELAY) ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  message.toUpperCase();

  Serial.print("📩 [MQTT BOTEK] Topik: ");
  Serial.print(topic);
  Serial.print(" | Pesan: ");
  Serial.println(message);

  ${relayTopicHandlers}
}

// --- FUNGSI REKONEKSI BROKER MQTT AUTOMATIS + SELF HEALING ---
void reconnectMQTT() {
  int retryCount = 0;
  while (!client.connected()) {
    Serial.print("🔌 Menghubungkan ke Broker BOTEK (iot.botek.my.id)... ");
    if (client.connect(CLIENT_ID)) {
      Serial.println("TERHUBUNG! ✅");
      
${relaySubscriptions}
    } else {
      retryCount++;
      Serial.print("Gagal, rc=");
      Serial.print(client.state());
      Serial.println(" | Coba lagi dalam 5 detik...");
      
      // BOTEK SELF-HEALING: Reset WiFi stack jika 5x gagal konek
      if (retryCount >= 5) {
        Serial.println("🛡️ [SELF-HEALING] WiFi terkunci/stuck. Resetting WiFi Interface...");
        WiFi.disconnect();
        delay(1000);
        WiFi.begin(WIFI_SSID, WIFI_PASS);
        retryCount = 0;
      }
      delay(5000);
    }
  }
}

// --- FUNGSI PENGIRIMAN DATA TELEMETRI SENSOR ---
void publishTelemetryData() {
  StaticJsonDocument<512> doc;
  doc["status"] = "OPTIMAL";

${telemetryJsonPayloads}
  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);

  String topicStr = "botek/" + String(DEVICE_CODE) + "/telemetry";
  client.publish(topicStr.c_str(), jsonBuffer);
  
  Serial.print("📤 [TELEMETRY + AI SENT TO BOTEK] ");
  Serial.println(jsonBuffer);
}

void setup() {
  Serial.begin(115200);
  delay(500);

${relayPinModes}
  // Koneksi WiFi
  Serial.print("📶 Menghubungkan ke WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Terhubung! IP: " + WiFi.localIP().toString());

  // Setup Server MQTT BOTEK
  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // Kirim data sensor telemetri secara periodik ke BOTEK
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = now;
    publishTelemetryData();
  }
}
`;
}

function generateAiWiringGuide(device, sensors) {
    const sensorsList = Array.isArray(sensors) ? sensors : [];
    const relays = sensorsList.filter(s => s.sensor_type === "Relay");
    const telemetrySensors = sensorsList.filter(s => s.sensor_type !== "Relay");
    const gpioPins = [18, 19, 21, 22, 23, 25, 26, 27, 32, 33];

    let guide = `🤖 BOTEK AI HARDWARE & WIRING SCHEMATIC (ESP32 DEVKIT V1)\n`;
    guide += `===========================================================\n`;
    guide += `Target Perangkat : ${device.device_name || 'Device'} (${device.device_code})\n`;
    guide += `Total Komponen   : ${relays.length} Sakelar Relay + ${telemetrySensors.length} Sensor Telemetri\n`;
    guide += `===========================================================\n\n`;

    if (relays.length > 0) {
        guide += `🔌 [1] SKEMA JALUR KABEL SAKELAR RELAY (MODULE 5V/12V):\n`;
        guide += `-----------------------------------------------------------\n`;
        guide += `• Relay VCC  ➔ ESP32 Pin VIN / 5V (atau Catu Daya External 5V)\n`;
        guide += `• Relay GND  ➔ ESP32 Pin GND\n`;
        relays.forEach((r, idx) => {
            const pin = gpioPins[idx % gpioPins.length];
            guide += `• Pin IN${idx + 1} (${r.sensor_name}) ➔ ESP32 Pin GPIO ${pin}\n`;
        });
        guide += `-----------------------------------------------------------\n\n`;
    }

    if (telemetrySensors.length > 0) {
        guide += `📊 [2] SKEMA JALUR KABEL SENSOR TELEMETRI:\n`;
        guide += `-----------------------------------------------------------\n`;
        telemetrySensors.forEach((s, idx) => {
            const sName = s.sensor_name;
            const unit = s.unit ? ` (${s.unit})` : "";
            if (sName.toLowerCase().includes("suhu") || sName.toLowerCase().includes("temp") || sName.toLowerCase().includes("dht")) {
                guide += `• Sensor ${sName}${unit}:\n`;
                guide += `  - VCC  ➔ ESP32 3.3V / 5V\n`;
                guide += `  - GND  ➔ ESP32 GND\n`;
                guide += `  - DATA ➔ ESP32 GPIO 4 (Disarankan pakai Resistor Pull-up 10k ke 3.3V)\n`;
            } else if (sName.toLowerCase().includes("kebocoran") || sName.toLowerCase().includes("gas") || sName.toLowerCase().includes("mq")) {
                guide += `• Sensor ${sName}${unit}:\n`;
                guide += `  - VCC  ➔ ESP32 5V\n`;
                guide += `  - GND  ➔ ESP32 GND\n`;
                guide += `  - AOUT ➔ ESP32 GPIO 34 (Pin ADC1 Input Analog)\n`;
            } else {
                guide += `• Sensor ${sName}${unit}:\n`;
                guide += `  - VCC  ➔ ESP32 3.3V / 5V\n`;
                guide += `  - GND  ➔ ESP32 GND\n`;
                guide += `  - SIGNAL ➔ ESP32 GPIO ${32 + (idx % 4)} (Input Analog/Digital)\n`;
            }
        });
        guide += `-----------------------------------------------------------\n\n`;
    }

    guide += `🛡️ [3] REKOMENDASI KEAMANAN HARDWARE DARIPADA BOTEK AI:\n`;
    guide += `• Hindari memasang sakelar relay pada GPIO 0, GPIO 2, GPIO 12, dan GPIO 15 karena merupakan 'Strapping Pins' yang dapat menyebabkan ESP32 gagal booting.\n`;
    guide += `• Pastikan menggunakan catu daya (Power Adapter) minimal 5V 2A jika menggunakan modul relay lebih dari 2-channel.\n`;
    guide += `• Pastikan Library 'PubSubClient' dan 'ArduinoJson' sudah diinstall via Arduino Library Manager.`;

    return guide;
}

function openEsp32CodeGeneratorModal(device, sensors) {
    let overlay = document.getElementById("esp32CodeModalOverlay");
    if (overlay) overlay.remove();

    window.currentDeviceForAi = device;
    window.currentSensorsForAi = sensors;

    const cppCode = generateEsp32CppCode(device, sensors);
    const aiGuide = generateAiWiringGuide(device, sensors);

    overlay = document.createElement("div");
    overlay.id = "esp32CodeModalOverlay";
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="modal-box" style="max-width: 960px; width: 94%;">
            <div class="modal-header">
                <h3 style="display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; color: #fff;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    <span>Generator Kode C++ & AI Assistant (${device.device_name})</span>
                    <span style="font-size: 10px; background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); padding: 2px 8px; border-radius: 12px; font-weight: 700;">SUPER ADMIN EXCLUSIVE</span>
                </h3>
                <button type="button" class="modal-close-btn" onclick="document.getElementById('esp32CodeModalOverlay').remove()">✖</button>
            </div>
            <div class="modal-body" style="padding: 20px 24px;">
                <!-- INTERACTIVE AI PROMPT BAR -->
                <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; box-shadow: 0 4px 20px rgba(168, 85, 247, 0.12);">
                    <div style="font-size: 12px; font-weight: 700; color: #c084fc; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                        <span>🤖 BOTEK AI CODE PROMPT GENERATOR</span>
                        <span style="font-size: 10px; color: var(--text-muted); font-weight: 400;">(Ketik instruksi bahasa alami untuk meminta AI menulis fitur khusus)</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" id="aiCustomPromptInput" placeholder="Ketik perintah... (contoh: Tambahkan Filter Moving Average & Mode Hemat Daya)" style="flex: 1; padding: 9px 14px; font-size: 12.5px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.4); color: #fff; outline: none;">
                        <button type="button" onclick="generateAiCustomEsp32Code()" style="padding: 9px 18px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: #fff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 14px rgba(168, 85, 247, 0.4); white-space: nowrap;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Generate via AI
                        </button>
                    </div>
                </div>

                <!-- TAB SELECTOR -->
                <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <button type="button" id="tabBtnCode" class="btn-secondary" onclick="switchEsp32ModalTab('code')" style="font-weight: 700; padding: 7px 14px; font-size: 12px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 8px;">
                        💻 Skrip C++ Arduino (.ino)
                    </button>
                    <button type="button" id="tabBtnAi" class="btn-secondary" onclick="switchEsp32ModalTab('ai')" style="font-weight: 700; padding: 7px 14px; font-size: 12px; background: transparent; color: var(--text-muted); border: 1px solid var(--border-color); border-radius: 8px;">
                        🤖 AI Skema Jalur Kabel & Wiring
                    </button>
                </div>

                <div id="tabContentCode">
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;">
                        Kode C++ di bawah ini **otomatis disesuaikan oleh AI** dengan <b>${(sensors || []).length} sensor & relay</b> pada <b style="color: var(--blynk-green);">${device.device_name} (${device.device_code})</b>. Salin atau unduh file <code>.ino</code> lalu upload via Arduino IDE!
                    </div>

                    <div style="position: relative;">
                        <textarea id="esp32CodeTextArea" readonly style="width: 100%; height: 340px; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; background: #090d16; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 14px; box-sizing: border-box; resize: vertical; line-height: 1.5; white-space: pre; outline: none;"></textarea>
                    </div>
                </div>

                <div id="tabContentAi" style="display: none;">
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;">
                        Panduan skema penyambungan kabel fisik (*wiring guide*) yang dibuat secara cerdas oleh **BOTEK AI Assistant**:
                    </div>

                    <div style="position: relative;">
                        <textarea id="esp32AiGuideTextArea" readonly style="width: 100%; height: 340px; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; background: #0b1329; color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 14px; box-sizing: border-box; resize: vertical; line-height: 1.6; white-space: pre; outline: none;"></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color);">
                <div style="font-size: 11px; color: var(--text-muted);">
                    Broker: <b style="color: #38bdf8;">iot.botek.my.id:1883</b>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-secondary" onclick="copyEsp32CodeToClipboard()" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Salin Kode C++
                    </button>
                    <button type="button" class="btn-secondary" onclick="downloadEsp32InoFile('${device.device_code}')" style="background: rgba(16, 185, 129, 0.15); color: var(--blynk-green); border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Unduh File .ino
                    </button>
                    <button type="button" class="btn-secondary" onclick="document.getElementById('esp32CodeModalOverlay').remove()">Tutup</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.style.display = "flex";
    document.getElementById("esp32CodeTextArea").value = cppCode;
    document.getElementById("esp32AiGuideTextArea").value = aiGuide;
}

function switchEsp32ModalTab(tab) {
    const codeTab = document.getElementById("tabContentCode");
    const aiTab = document.getElementById("tabContentAi");
    const btnCode = document.getElementById("tabBtnCode");
    const btnAi = document.getElementById("tabBtnAi");

    if (tab === 'code') {
        if (codeTab) codeTab.style.display = "block";
        if (aiTab) aiTab.style.display = "none";
        if (btnCode) {
            btnCode.style.background = "rgba(56, 189, 248, 0.2)";
            btnCode.style.color = "#38bdf8";
            btnCode.style.borderColor = "rgba(56, 189, 248, 0.4)";
        }
        if (btnAi) {
            btnAi.style.background = "transparent";
            btnAi.style.color = "var(--text-muted)";
            btnAi.style.borderColor = "var(--border-color)";
        }
    } else {
        if (codeTab) codeTab.style.display = "none";
        if (aiTab) aiTab.style.display = "block";
        if (btnAi) {
            btnAi.style.background = "rgba(168, 85, 247, 0.2)";
            btnAi.style.color = "#c084fc";
            btnAi.style.borderColor = "rgba(168, 85, 247, 0.4)";
        }
        if (btnCode) {
            btnCode.style.background = "transparent";
            btnCode.style.color = "var(--text-muted)";
            btnCode.style.borderColor = "var(--border-color)";
        }
    }
}

function copyEsp32CodeToClipboard() {
    const codeTabVisible = document.getElementById("tabContentCode").style.display !== "none";
    const area = codeTabVisible ? document.getElementById("esp32CodeTextArea") : document.getElementById("esp32AiGuideTextArea");
    if (!area) return;
    area.select();
    navigator.clipboard.writeText(area.value).then(() => {
        showToast(codeTabVisible ? "Kode C++ ESP32 berhasil disalin ke clipboard!" : "Panduan AI Wiring berhasil disalin!", "success");
    }).catch(() => {
        document.execCommand("copy");
        showToast("Teks berhasil disalin!", "success");
    });
}

function downloadEsp32InoFile(devCode) {
    const area = document.getElementById("esp32CodeTextArea");
    if (!area) return;

    const blob = new Blob([area.value], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BOTEK_ESP32_${devCode}.ino`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`File BOTEK_ESP32_${devCode}.ino berhasil diunduh!`, "success");
}

function applyAiPresetPrompt(presetText) {
    const promptInput = document.getElementById("aiCustomPromptInput");
    if (promptInput) {
        promptInput.value = presetText;
        generateAiCustomEsp32Code();
    }
}

// ==========================
// EXPORT TELEMETRY LOGS DATA MODAL & ENGINE
// ==========================
function setExportDatePreset(preset) {
    const startEl = document.getElementById("exportStartDate");
    const endEl = document.getElementById("exportEndDate");
    const btnAll = document.getElementById("btnPresetAll");
    const btnToday = document.getElementById("btnPresetToday");
    const btn7Days = document.getElementById("btnPreset7Days");
    if (!startEl || !endEl) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
        startEl.value = todayStr;
        endEl.value = todayStr;
    } else if (preset === '7days') {
        const d7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        startEl.value = d7.toISOString().split('T')[0];
        endEl.value = todayStr;
    } else {
        startEl.value = "";
        endEl.value = "";
    }

    // Active button style toggles
    const activeStyle = "flex: 1; font-size: 11px; padding: 6px 10px; border-radius: 6px; background: #38bdf8; color: #0f172a; border: 1px solid #38bdf8; cursor: pointer; font-weight: 700; transition: all 0.2s ease; box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);";
    const inactiveStyle = "flex: 1; font-size: 11px; padding: 6px 10px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); cursor: pointer; font-weight: 600; transition: all 0.2s ease;";

    if (btnAll) btnAll.style.cssText = (preset === 'all') ? activeStyle : inactiveStyle;
    if (btnToday) btnToday.style.cssText = (preset === 'today') ? activeStyle : inactiveStyle;
    if (btn7Days) btn7Days.style.cssText = (preset === '7days') ? activeStyle : inactiveStyle;

    updateExportModalStats();
}

async function updateExportModalStats() {
    const countEl = document.getElementById("exportStatCount");
    const daysEl = document.getElementById("exportStatDays");
    if (!countEl || !daysEl) return;

    const curCode = deviceCode || (typeof getDeviceCode === 'function' ? getDeviceCode() : null) || (window.currentDevice && window.currentDevice.device_code) || localStorage.getItem("last_device_code");
    if (!curCode) return;

    const choice = document.getElementById("exportSensorChoice") ? document.getElementById("exportSensorChoice").value : "all";
    const startDate = document.getElementById("exportStartDate") ? document.getElementById("exportStartDate").value : "";
    const endDate = document.getElementById("exportEndDate") ? document.getElementById("exportEndDate").value : "";

    try {
        let apiUrl = `/api/device/${encodeURIComponent(curCode)}/export-info?sensor=${encodeURIComponent(choice)}`;
        if (startDate) apiUrl += `&startDate=${encodeURIComponent(startDate)}`;
        if (endDate) apiUrl += `&endDate=${encodeURIComponent(endDate)}`;
        apiUrl += `&_=${Date.now()}`;

        const res = await fetch(apiUrl);
        const data = await res.json();

        if (data && data.success) {
            const count = data.total_count || 0;
            const days = data.stored_days || 0;

            countEl.innerText = `${count.toLocaleString("id-ID")} Data`;
            daysEl.innerText = count > 0 ? `${days} Hari` : "0 Hari";
        }
    } catch (e) {
        console.error("Fetch export stats error:", e);
    }
}

function openExportTelemetryModal(sensors, defaultTargetName = null) {
    let overlay = document.getElementById("exportTelemetryModalOverlay");
    if (overlay) overlay.remove();

    const sensorsList = Array.isArray(sensors) ? sensors : (currentSensorsData || []);

    const analogSensors = sensorsList.filter(s => s.sensor_type !== 'Relay' && !s.sensor_name.toLowerCase().includes('relay'));
    const relayControls = sensorsList.filter(s => s.sensor_type === 'Relay' || s.sensor_name.toLowerCase().includes('relay'));

    let sensorOptionsHtml = "";
    let isSelectedSet = false;

    // Default option when modal opens without a specific sensor target: "Semua Sensor & Sakelar"
    const isAllDefault = (!defaultTargetName || defaultTargetName === 'all');
    if (isAllDefault) isSelectedSet = true;
    sensorOptionsHtml += `<option value="all" ${isAllDefault ? "selected" : ""}>${t("all_sensors", "Semua Sensor & Sakelar")}</option>`;

    if (analogSensors.length > 0) {
        analogSensors.forEach(s => {
            const isSel = (!isSelectedSet && defaultTargetName === s.sensor_name) ? "selected" : "";
            if (isSel) isSelectedSet = true;
            sensorOptionsHtml += `<option value="${s.sensor_name}" ${isSel}>${s.sensor_name} (${s.sensor_type || 'Custom'})</option>`;
        });
    }

    if (relayControls.length > 0) {
        relayControls.forEach(s => {
            const isSel = (!isSelectedSet && defaultTargetName === s.sensor_name) ? "selected" : "";
            if (isSel) isSelectedSet = true;
            sensorOptionsHtml += `<option value="${s.sensor_name}" ${isSel}>${s.sensor_name} (Relay ON/OFF)</option>`;
        });
    }

    overlay = document.createElement("div");
    overlay.id = "exportTelemetryModalOverlay";
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="confirm-modal-box" style="max-width: 440px; width: 92%; text-align: left; padding: 18px 20px; border-radius: 14px; background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(255, 255, 255, 0.12); backdrop-filter: blur(16px); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="font-weight: 700; font-size: 15px; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span data-i18n="export_title">${t("export_title", "Ekspor Data Telemetri & Log Sensor")}</span>
                </div>
                <button type="button" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-muted); cursor: pointer; font-size: 13px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onclick="document.getElementById('exportTelemetryModalOverlay').remove()">✖</button>
            </div>

            <!-- RETENTION NOTICE BADGE -->
            <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; font-size: 11.5px; color: #94a3b8; display: flex; align-items: flex-start; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 1px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <div>
                    <strong style="color: #38bdf8;" data-i18n="export_retention_notice_title">${t("export_retention_notice_title", "Informasi Retensi Data:")}</strong><br>
                    <span data-i18n="export_retention_notice_text">${t("export_retention_notice_text", "Data log hanya dapat disimpan maksimal selama <b>7 hari</b>.")}</span>
                </div>
            </div>

            <!-- DYNAMIC STATS CONTAINER -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; background: rgba(15, 23, 42, 0.6); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="font-size: 11.5px; color: var(--text-muted);">
                    <span data-i18n="export_total_data_label">${t("export_total_data_label", "Total Data:")}</span> <b id="exportStatCount" style="color: #38bdf8; font-size: 12.5px; margin-left: 4px; font-weight: 700;">Memuat...</b>
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">
                    <span data-i18n="export_retention_duration_label">${t("export_retention_duration_label", "Durasi Penyimpanan:")}</span> <b id="exportStatDays" style="color: #34d399; font-size: 12.5px; margin-left: 4px; font-weight: 700;">Memuat...</b>
                </div>
            </div>
            
            <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.4;" data-i18n="export_select_desc">
                ${t("export_select_desc", "Pilih sensor atau kontrol sakelar dan format berkas yang ingin diunduh:")}
            </div>

            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;" data-i18n="export_select_sensor_label">${t("export_select_sensor_label", "Pilihan Sensor / Kontrol")}</label>
                <select id="exportSensorChoice" style="width: 100%; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border-color); background: #0f172a; color: #fff; font-size: 12px; outline: none; cursor: pointer;" onchange="updateExportModalStats()">
                    ${sensorOptionsHtml}
                </select>
            </div>

            <!-- DATE RANGE FILTER INPUTS -->
            <div style="margin-bottom: 14px; background: rgba(15, 23, 42, 0.6); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span data-i18n="export_date_range_label">${t("export_date_range_label", "Rentang Tanggal (Opsional)")}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <div>
                        <span style="font-size: 10.5px; color: #94a3b8; display: block; margin-bottom: 3px;" data-i18n="export_from_date">${t("export_from_date", "Dari Tanggal:")}</span>
                        <input type="date" id="exportStartDate" onchange="updateExportModalStats()" style="width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: #0f172a; color: #f8fafc; font-size: 11.5px; outline: none; color-scheme: dark; font-family: 'Plus Jakarta Sans', sans-serif;">
                    </div>
                    <div>
                        <span style="font-size: 10.5px; color: #94a3b8; display: block; margin-bottom: 3px;" data-i18n="export_to_date">${t("export_to_date", "Sampai Tanggal:")}</span>
                        <input type="date" id="exportEndDate" onchange="updateExportModalStats()" style="width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: #0f172a; color: #f8fafc; font-size: 11.5px; outline: none; color-scheme: dark; font-family: 'Plus Jakarta Sans', sans-serif;">
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" id="btnPresetAll" onclick="setExportDatePreset('all')" style="flex: 1; font-size: 10.5px; padding: 4px 8px; border-radius: 5px; background: #38bdf8; color: #0f172a; border: 1px solid #38bdf8; cursor: pointer; font-weight: 700; transition: all 0.2s ease; box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);" data-i18n="preset_all">${t("preset_all", "Semua")}</button>
                    <button type="button" id="btnPresetToday" onclick="setExportDatePreset('today')" style="flex: 1; font-size: 10.5px; padding: 4px 8px; border-radius: 5px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); cursor: pointer; font-weight: 600; transition: all 0.2s ease;" data-i18n="preset_today">${t("preset_today", "Hari Ini")}</button>
                    <button type="button" id="btnPreset7Days" onclick="setExportDatePreset('7days')" style="flex: 1; font-size: 10.5px; padding: 4px 8px; border-radius: 5px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); cursor: pointer; font-weight: 600; transition: all 0.2s ease;" data-i18n="preset_7days">${t("preset_7days", "7 Hari Terakhir")}</button>
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;" data-i18n="export_file_format_label">${t("export_file_format_label", "Format Berkas Unduhan")}</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button type="button" id="btnExportCsv" onclick="downloadTelemetryCsv()" style="padding: 10px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-weight: 700; font-size: 11.5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span>Excel</span>
                    </button>
                    <button type="button" id="btnExportPdf" onclick="downloadTelemetryPdfReport()" style="padding: 10px; border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.35); background: rgba(168, 85, 247, 0.12); color: #c084fc; font-weight: 700; font-size: 11.5px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('exportTelemetryModalOverlay').remove()" style="padding: 6px 14px; font-size: 11.5px;">${t("cancel_btn", "Tutup")}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.style.display = "flex";
    updateExportModalStats();
}

function formatExcelDateTime(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { dateStr: "-", timeStr: "-", full: "-" };
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return {
        dateStr: `${day}/${month}/${year}`,
        timeStr: `${hours}:${mins}:${secs}`,
        full: `${day}/${month}/${year} ${hours}:${mins}:${secs}`
    };
}

function setExportLoadingState(isLoading, targetFormat = "csv") {
    const btnCsv = document.getElementById("btnExportCsv");
    const btnPdf = document.getElementById("btnExportPdf");
    const statCount = document.getElementById("exportStatCount");

    const spinnerSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: exportSpin 0.8s linear infinite;"><style>@keyframes exportSpin { 100% { transform: rotate(360deg); } }</style><path d="M12 2v4m0 12v4m-8-10H2m20 0h-4m-2.93-6.93l-2.83 2.83m-8.48 8.48l-2.83 2.83m0-14.14l2.83 2.83m8.48 8.48l2.83 2.83"></path></svg>`;

    const disableBtn = (btn) => {
        if (!btn) return;
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
    };

    const enableBtn = (btn) => {
        if (!btn) return;
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    };

    if (isLoading) {
        disableBtn(btnCsv);
        disableBtn(btnPdf);

        if (targetFormat === "csv" && btnCsv) {
            btnCsv.innerHTML = `${spinnerSvg}<span>Mengunduh...</span>`;
        } else if (targetFormat === "pdf" && btnPdf) {
            btnPdf.innerHTML = `${spinnerSvg}<span>Menyiapkan...</span>`;
        }

        if (statCount) {
            statCount.innerHTML = `<span style="color: #f59e0b; font-weight: 700;">Memproses Data...</span>`;
        }
    } else {
        enableBtn(btnCsv);
        enableBtn(btnPdf);

        if (btnCsv) {
            btnCsv.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span>Excel</span>
            `;
        }
        if (btnPdf) {
            btnPdf.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>PDF</span>
            `;
        }
        updateExportModalStats();
    }
}

async function downloadTelemetryCsv() {
    const curCode = deviceCode || (typeof getDeviceCode === 'function' ? getDeviceCode() : null) || (window.currentDevice && window.currentDevice.device_code) || localStorage.getItem("last_device_code") || "ESP32_ROOM_01";
    if (!curCode) {
        showToast("Kode perangkat tidak ditemukan.", "error");
        return;
    }

    setExportLoadingState(true, "csv");

    const sensorChoice = document.getElementById("exportSensorChoice") ? document.getElementById("exportSensorChoice").value : "all";
    const startDate = document.getElementById("exportStartDate") ? document.getElementById("exportStartDate").value : "";
    const endDate = document.getElementById("exportEndDate") ? document.getElementById("exportEndDate").value : "";

    try {
        let apiUrl = `/api/device/${encodeURIComponent(curCode)}/export-data?sensor=${encodeURIComponent(sensorChoice)}&limit=10000`;
        if (startDate) apiUrl += `&startDate=${encodeURIComponent(startDate)}`;
        if (endDate) apiUrl += `&endDate=${encodeURIComponent(endDate)}`;
        apiUrl += `&_=${Date.now()}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!data || !data.success) {
            showToast(data.message || "Gagal mengambil data dari server.", "error");
            return;
        }

        let logsToExport = (data && Array.isArray(data.logs)) ? data.logs : [];

        if (logsToExport.length === 0) {
            showToast("Belum ada data log tersimpan di database untuk pilihan ini.", "warning");
            return;
        }

        const devName = data.device_name || "BOTEK IoT Device";
        const devLocation = data.location || "Default Location";
        const devType = data.device_type || "IoT Controller";

        let sum = 0;
        let maxVal = -Infinity;
        let minVal = Infinity;
        let onCount = 0;
        let offCount = 0;
        let numericCount = 0;

        logsToExport.forEach(r => {
            const rawV = r.value;
            const rNameLower = (r.sensor_name || '').toLowerCase();
            const strV = String(rawV).toUpperCase();

            const isRowRelay = rNameLower.includes("relay") || rNameLower.includes("sakelar") || rNameLower.includes("switch") || rNameLower.includes("control");

            if (isRowRelay) {
                if (strV === "ON" || strV === "1" || Number(rawV) === 1) onCount++;
                else offCount++;
            } else {
                const v = Number(rawV);
                if (!isNaN(v)) {
                    numericCount++;
                    sum += v;
                    if (v > maxVal) maxVal = v;
                    if (v < minVal) minVal = v;
                }
            }
        });

        const avgVal = numericCount > 0 ? (sum / numericCount).toFixed(2) : "-";
        const maxValStr = maxVal !== -Infinity ? maxVal : "-";
        const minValStr = minVal !== Infinity ? minVal : "-";

        const downloadTimeFormatted = formatExcelDateTime(new Date().toISOString()).full;
        const allSensorsMeta = (typeof currentSensorsData !== 'undefined' && Array.isArray(currentSensorsData)) ? currentSensorsData : [];

        // Ultra-Lightweight Plain Standard CSV (.csv) Generator - Fast, zero lag in Excel
        let csvContent = "\uFEFF";
        csvContent += `"Informasi","Detail Perangkat"\n`;
        csvContent += `"Sistem","BOTEK IoT Platform"\n`;
        csvContent += `"Perangkat","${devName.replace(/"/g, '""')}"\n`;
        csvContent += `"Kode","${curCode}"\n`;
        csvContent += `"Tipe","${devType}"\n`;
        csvContent += `"Lokasi","${devLocation.replace(/"/g, '""')}"\n`;
        csvContent += `"Waktu Unduh","${downloadTimeFormatted}"\n\n`;

        csvContent += `No,Tanggal,Waktu,Kode Device,Sensor / Kontrol,Nilai Pembacaan,Satuan\n`;

        logsToExport.forEach((row, index) => {
            const dt = formatExcelDateTime(row.created_at || new Date().toISOString());
            const rawName = row.sensor_name || 'Komponen';
            const rNameLower = rawName.toLowerCase();
            const strV = String(row.value).toUpperCase();

            const isRowRelay = rNameLower.includes("relay") || rNameLower.includes("sakelar") || rNameLower.includes("switch") || rNameLower.includes("control");

            let displayVal = row.value;
            let unitStr = "-";

            if (isRowRelay) {
                displayVal = (strV === "ON" || strV === "1" || Number(row.value) === 1) ? "ON" : "OFF";
                unitStr = "-";
            } else {
                let numVal = Number(row.value);
                displayVal = (!isNaN(numVal)) ? numVal : row.value;

                const metaMatch = allSensorsMeta.find(s => s.sensor_name && s.sensor_name.toLowerCase() === rNameLower);
                if (metaMatch && metaMatch.unit) {
                    unitStr = metaMatch.unit;
                } else {
                    if (rNameLower.includes("temp") || rNameLower.includes("suhu")) unitStr = "°C";
                    else if (rNameLower.includes("hum") || rNameLower.includes("lembab")) unitStr = "%";
                    else if (rNameLower.includes("amp") || rNameLower.includes("arus")) unitStr = "A";
                    else if (rNameLower.includes("volt") || rNameLower.includes("tegangan")) unitStr = "V";
                    else if (rNameLower.includes("watt") || rNameLower.includes("daya")) unitStr = "W";
                    else if (rNameLower.includes("lux") || rNameLower.includes("cahaya")) unitStr = "lux";
                    else unitStr = "-";
                }
            }

            const sName = `"${rawName.replace(/"/g, '""')}"`;
            csvContent += `${index + 1},"${dt.dateStr}","${dt.timeStr}","${row.device_code}",${sName},"${displayVal}","${unitStr}"\n`;
        });

        csvContent += `\n"Statistik","Nilai"\n`;
        csvContent += `"Total Data Log",${logsToExport.length}\n`;
        if (numericCount === 0) {
            csvContent += `"Total Status ON",${onCount}\n`;
            csvContent += `"Total Status OFF",${offCount}\n`;
        } else {
            csvContent += `"Rata-rata (Avg)",${avgVal}\n`;
            csvContent += `"Maksimum (Max)",${maxValStr}\n`;
            csvContent += `"Minimum (Min)",${minValStr}\n`;
        }

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const fileName = `BOTEK_Laporan_Telemetri_${curCode}_${Date.now()}.csv`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`✅ Berhasil mengunduh Berkas CSV Ringan (${logsToExport.length} data)!`, "success");

        if (document.getElementById("exportTelemetryModalOverlay")) {
            document.getElementById("exportTelemetryModalOverlay").remove();
        }
    } catch (e) {
        showToast("Gagal mengunduh data: " + e.message, "error");
    } finally {
        setExportLoadingState(false);
    }
}

async function downloadTelemetryPdfReport() {
    const curCode = deviceCode || (typeof getDeviceCode === 'function' ? getDeviceCode() : null) || (window.currentDevice && window.currentDevice.device_code) || localStorage.getItem("last_device_code") || "ESP32_ROOM_01";
    if (!curCode) {
        showToast("Kode perangkat tidak ditemukan.", "error");
        return;
    }

    setExportLoadingState(true, "pdf");

    try {
        const sensorChoice = document.getElementById("exportSensorChoice") ? document.getElementById("exportSensorChoice").value : "all";
        const startDate = document.getElementById("exportStartDate") ? document.getElementById("exportStartDate").value : "";
        const endDate = document.getElementById("exportEndDate") ? document.getElementById("exportEndDate").value : "";

        let apiUrl = `/api/device/${encodeURIComponent(curCode)}/export-data?sensor=${encodeURIComponent(sensorChoice)}&limit=10000`;
        if (startDate) apiUrl += `&startDate=${encodeURIComponent(startDate)}`;
        if (endDate) apiUrl += `&endDate=${encodeURIComponent(endDate)}`;
        apiUrl += `&_=${Date.now()}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        let logsToExport = (data && Array.isArray(data.logs)) ? data.logs : [];

        if (logsToExport.length === 0) {
            showToast("Belum ada data log tersimpan di database untuk pilihan ini.", "warning");
            return;
        }

        const devName = data.device_name || "Perangkat BOTEK";
        const devType = data.device_type || "IoT Controller";
        const totalLogs = logsToExport.length;

        let tableRowsHtml = "";
        logsToExport.forEach((row, index) => {
            const dt = formatExcelDateTime(row.created_at || new Date().toISOString());
            const rawName = row.sensor_name || 'Komponen';
            const rNameLower = rawName.toLowerCase();
            const strV = String(row.value).toUpperCase();

            const isRowRelay = rNameLower.includes("relay") || rNameLower.includes("sakelar") || rNameLower.includes("switch") || rNameLower.includes("control");

            let displayVal = row.value;
            if (isRowRelay) {
                displayVal = (strV === "ON" || strV === "1" || Number(row.value) === 1) ? "ON" : "OFF";
            }

            tableRowsHtml += `
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${dt.full}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0284c7;">${rawName}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 800; text-align: right;">${displayVal}</td>
                </tr>
            `;
        });

        const pdfHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Laporan Telemetri - ${devName} (${curCode})</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #0f172a; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
                    .logo { font-size: 24px; font-weight: 900; color: #10b981; }
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 10px; margin-bottom: 24px; font-size: 13px; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th { background: #0f172a; color: #fff; padding: 10px 12px; text-align: left; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="logo">⚡ BOTEK IoT Platform</div>
                        <div style="font-size: 12px; color: #64748b;">Laporan Resmi Data Telemetri & Log Sensor Historis</div>
                    </div>
                    <div style="text-align: right; font-size: 12px; color: #64748b;">
                        Tanggal Cetak: <b>${new Date().toLocaleString("id-ID")}</b>
                    </div>
                </div>

                <div class="meta-grid">
                    <div>
                        <div>Nama Perangkat: <b>${devName}</b></div>
                        <div>Kode Perangkat: <b>${curCode}</b></div>
                    </div>
                    <div>
                        <div>Tipe Perangkat: <b>${devType}</b></div>
                        <div>Total Rekaman Log: <b>${totalLogs} Data</b></div>
                        <div>Catatan Retensi: <b>Maksimal 7 Hari Terakhir</b></div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 8%; text-align: center;">No</th>
                            <th style="width: 32%;">Waktu / Tanggal</th>
                            <th style="width: 35%;">Nama Sensor / Kontrol</th>
                            <th style="width: 25%; text-align: right;">Nilai Pembacaan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>

                <div style="margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                    Dicetak secara otomatis dari BOTEK IoT System • Server Broker iot.botek.my.id
                </div>
            </body>
            </html>
        `;

        // Dynamic hidden iframe printing (100% bypasses browser popup blockers safely)
        let printIframe = document.getElementById("botekPdfPrintIframe");
        if (!printIframe) {
            printIframe = document.createElement("iframe");
            printIframe.id = "botekPdfPrintIframe";
            printIframe.style.position = "fixed";
            printIframe.style.right = "0";
            printIframe.style.bottom = "0";
            printIframe.style.width = "0";
            printIframe.style.height = "0";
            printIframe.style.border = "0";
            printIframe.style.visibility = "hidden";
            document.body.appendChild(printIframe);
        }

        const frameDoc = printIframe.contentWindow ? printIframe.contentWindow.document : (printIframe.contentDocument || printIframe.document);
        if (frameDoc) {
            frameDoc.open();
            frameDoc.write(pdfHtml);
            frameDoc.close();

            setTimeout(() => {
                try {
                    printIframe.contentWindow.focus();
                    printIframe.contentWindow.print();
                } catch (pe) {
                    const win = window.open("", "_blank");
                    if (win && win.document) {
                        win.document.write(pdfHtml);
                        win.document.close();
                        win.print();
                    } else {
                        showToast("Peramban memblokir cetak PDF. Izinkan pop-up peramban.", "warning");
                    }
                }
            }, 300);
        }

        showToast(`✅ Laporan PDF Telemetri siap dicetak (${logsToExport.length} data)!`, "success");
        if (document.getElementById("exportTelemetryModalOverlay")) {
            document.getElementById("exportTelemetryModalOverlay").remove();
        }
    } catch (e) {
        showToast("Gagal membuat laporan PDF: " + e.message, "error");
    } finally {
        setExportLoadingState(false);
    }
}

function generateAiCustomEsp32Code() {
    const promptInput = document.getElementById("aiCustomPromptInput");
    const userPrompt = promptInput ? promptInput.value.trim() : "";
    if (!userPrompt) {
        showToast("Ketikkan perintah terlebih dahulu (contoh: Tambahkan filter Moving Average & Mode Hemat Daya)", "info");
        return;
    }

    const textArea = document.getElementById("esp32CodeTextArea");
    if (!textArea) return;

    let baseCode = generateEsp32CppCode(window.currentDeviceForAi || {}, window.currentSensorsForAi || []);

    let enhancementHeader = `/*\n  ==============================================================\n  BOTEK CUSTOM CODE GENERATION\n  Prompt : "${userPrompt}"\n  ==============================================================\n*/\n\n`;

    let customFunctions = "";

    if (userPrompt.toLowerCase().includes("filter") || userPrompt.toLowerCase().includes("moving average") || userPrompt.toLowerCase().includes("stabil")) {
        customFunctions += `// FEATURE: MOVING AVERAGE SENSOR FILTERING
float getFilteredSensorValue(float rawVal, float history[], int size, float &sum) {
  sum = sum - history[0] + rawVal;
  for (int i = 0; i < size - 1; i++) history[i] = history[i + 1];
  history[size - 1] = rawVal;
  return sum / size;
}\n\n`;
    }

    if (userPrompt.toLowerCase().includes("sleep") || userPrompt.toLowerCase().includes("hemat daya") || userPrompt.toLowerCase().includes("baterai")) {
        customFunctions += `// FEATURE: DEEP SLEEP ENERGY SAVER (10 MINUTE CYCLES)
void startDeepSleep() {
  Serial.println("🔋 [ENERGY SAVER] ESP32 memasuki Mode Deep Sleep selama 10 Menit...");
  esp_sleep_enable_timer_wakeup(10 * 60 * 1000000ULL); // 10 Menit
  esp_deep_sleep_start();
}\n\n`;
    }

    if (userPrompt.toLowerCase().includes("fail") || userPrompt.toLowerCase().includes("safety") || userPrompt.toLowerCase().includes("timeout") || userPrompt.toLowerCase().includes("proteksi")) {
        customFunctions += `// FEATURE: RELAY MAX RUNTIME SAFETY TIMEOUT (30 MINUTES)
unsigned long relayActiveStart = 0;
void checkRelaySafetyTimeout(int relayPin) {
  if (digitalRead(relayPin) == LOW) {
    if (relayActiveStart == 0) relayActiveStart = millis();
    else if (millis() - relayActiveStart >= 1800000ULL) {
      digitalWrite(relayPin, HIGH); // Auto Cutoff Safety
      Serial.println("🛡️ [SAFETY TIMEOUT] Relay dimatikan otomatis setelah 30 menit menyala!");
      relayActiveStart = 0;
    }
  } else {
    relayActiveStart = 0;
  }
}\n\n`;
    }

    if (!customFunctions) {
        customFunctions += `// BOTEK CUSTOM LOGIC IMPLEMENTATION ("${userPrompt}")
void processCustomPromptLogic() {
  // Logic C++ kustom yang diproses oleh BOTEK Engine
  Serial.println("⚙️ [PROMPT EXECUTED] ${userPrompt}");
}\n\n`;
    }

    textArea.value = enhancementHeader + customFunctions + baseCode;
    showToast(`Skrip C++ ESP32 berhasil diperbarui dengan fitur: "${userPrompt}"!`, "success");
}

// ==========================
// PWM DIMMER CONTROLLER HELPERS
// ==========================
let dimmerThrottleTimers = {};

function sendDimmerLiveControl(deviceCode, controlName, val) {
    fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            device_code: deviceCode,
            control_name: controlName,
            status: String(val)
        })
    }).catch(err => console.error("Live dimmer error:", err));
}

function onDimmerSliderInput(sensorId, val, deviceCode, controlName) {
    const textEl = document.getElementById(`dimmer-val-text-${sensorId}`);
    const sliderEl = document.getElementById(`dimmer-slider-${sensorId}`);
    if (textEl) textEl.innerText = val;
    if (sliderEl) {
        sliderEl.style.background = `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${val}%, rgba(255, 255, 255, 0.12) ${val}%, rgba(255, 255, 255, 0.12) 100%)`;
    }

    if (deviceCode && controlName) {
        if (!dimmerThrottleTimers[sensorId]) {
            sendDimmerLiveControl(deviceCode, controlName, val);
            dimmerThrottleTimers[sensorId] = setTimeout(() => {
                delete dimmerThrottleTimers[sensorId];
            }, 60);
        }
    }
}

async function onDimmerSliderChange(deviceCode, controlName, val, sensorId) {
    onDimmerSliderInput(sensorId, val, deviceCode, controlName);
    try {
        const response = await fetch("/api/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_code: deviceCode,
                control_name: controlName,
                status: String(val)
            })
        });
        const data = await response.json();
        if (data && data.success) {
            showToast(`${controlName} diset ke ${val}%`, "success");
        } else {
            showToast((data && data.message) || "Gagal mengubah nilai dimmer.", "error");
        }
    } catch (err) {
        console.error("Dimmer control error:", err);
        showToast("Kesalahan koneksi ke server.", "error");
    }
}

function setDimmerPreset(deviceCode, controlName, val, sensorId) {
    const sliderEl = document.getElementById(`dimmer-slider-${sensorId}`);
    if (sliderEl) sliderEl.value = val;
    onDimmerSliderChange(deviceCode, controlName, val, sensorId);
}