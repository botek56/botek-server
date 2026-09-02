const express = require("express");
const session = require("express-session");
let bcrypt;
try {
    bcrypt = require("bcrypt");
} catch (e) {
    bcrypt = require("bcryptjs");
}

const db = require("./database");
require("./user");
const getSensorData = require("./sensor");

const net = require("net");
const http = require("http");
const WebSocket = require("ws");
const aedesPackage = require("aedes");
const createAedes = aedesPackage.Aedes || aedesPackage.createBroker || aedesPackage;

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Embedded Aedes MQTT Broker
const aedes = (typeof createAedes === 'function' && !createAedes.prototype) ? createAedes() : new createAedes();

// 1. MQTT TCP Broker for ESP32/ESP8266 Hardware (Port 1883)
const mqttPort = process.env.MQTT_PORT || 1883;
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(mqttPort, () => {
    console.log(`📡 MQTT TCP Broker listening on port ${mqttPort}`);
});

// 2. MQTT WebSocket Broker for Web Dashboard & Cloudflare Tunnel (Port 8883 & HTTP /mqtt)
const wsPort = process.env.MQTT_WS_PORT || 8883;
const wsServer = http.createServer();
const wss = new WebSocket.Server({ server: wsServer });

wss.on("connection", (socket) => {
    const stream = WebSocket.createWebSocketStream(socket);
    aedes.handle(stream);
});

wsServer.listen(wsPort, () => {
    console.log(`🌐 MQTT WebSocket Broker listening on port ${wsPort}`);
});

const wsClients = new Set();

function broadcastWsJson(deviceCode, controlName, status) {
    const payloadStr = JSON.stringify({
        device_code: deviceCode,
        control_name: controlName,
        status: status
    });
    wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            // Filter: Only broadcast to WebSocket clients associated with this specific deviceCode
            if (client.deviceCode && client.deviceCode !== deviceCode) {
                return;
            }
            try { client.send(payloadStr); } catch (e) {}
        }
    });
}

// Helper to publish MQTT & WebSocket messages to connected clients
function publishMqtt(topic, payload) {
    aedes.publish({
        topic: topic,
        payload: String(payload),
        qos: 0,
        retain: false
    });

    const parts = topic.split("/");
    if (parts.length === 4 && parts[0] === "botek" && parts[2] === "relay") {
        broadcastWsJson(parts[1], parts[3], String(payload));
    }
}

// Event Listener Koneksi & Diskonsep Hardware ESP32 (MQTT)
aedes.on("clientReady", (client) => {
    if (client && client.id) {
        console.log(`🔌 [MQTT CONNECT] Client Connected: ${client.id}`);
        db.run(
            `UPDATE devices SET status='ONLINE', last_seen=? WHERE device_code=? OR ? LIKE '%' || device_code || '%'`,
            [new Date().toISOString(), client.id, client.id],
            (err) => {
                if (!err) {
                    db.all(`SELECT device_code FROM devices WHERE device_code=? OR ? LIKE '%' || device_code || '%'`, [client.id, client.id], (e, rows) => {
                        if (!e && rows) rows.forEach(r => broadcastDeviceUpdate(r.device_code));
                    });
                }
            }
        );
    }
});

aedes.on("clientDisconnect", (client) => {
    if (client && client.id) {
        console.log(`🔌 [MQTT DISCONNECT] Client Disconnected: ${client.id}`);
        db.run(
            `UPDATE devices SET status='OFFLINE', last_seen=? WHERE device_code=? OR ? LIKE '%' || device_code || '%'`,
            [new Date().toISOString(), client.id, client.id],
            (err) => {
                if (!err) {
                    db.all(`SELECT device_code FROM devices WHERE device_code=? OR ? LIKE '%' || device_code || '%'`, [client.id, client.id], (e, rows) => {
                        if (!e && rows) rows.forEach(r => broadcastDeviceUpdate(r.device_code));
                    });
                }
            }
        );
    }
});

// Sync MQTT Messages with SQLite Database & Web Clients
aedes.on("publish", (packet, client) => {
    if (!packet || !packet.topic) return;
    const topic = packet.topic;
    if (topic.startsWith("$SYS/")) return;

    if (client && client.id) {
        db.run(
            `UPDATE devices SET status='ONLINE', last_seen=? WHERE device_code=? OR ? LIKE '%' || device_code || '%'`,
            [new Date().toISOString(), client.id, client.id]
        );
    }

    const payloadStr = packet.payload ? packet.payload.toString().trim() : "";
    const parts = topic.split("/");

    // Format: botek/{device_code}/telemetry/{sensor_name}
    if (parts.length === 4 && parts[0] === "botek" && parts[2] === "telemetry") {
        const deviceCode = parts[1];
        const sensorName = parts[3];
        const valueNum = parseFloat(payloadStr);

        if (!isNaN(valueNum)) {
            db.run(
                `UPDATE device_sensors SET value=? WHERE device_code=? AND sensor_name=?`,
                [valueNum, deviceCode, sensorName]
            );
            db.run(
                `UPDATE devices SET status='ONLINE', last_seen=? WHERE device_code=?`,
                [new Date().toISOString(), deviceCode]
            );
            saveSensorHistory(deviceCode, sensorName, valueNum);
            broadcastDeviceUpdate(deviceCode);
        }
    }

    // Format: botek/{device_code}/relay/{control_name}
    if (parts.length === 4 && parts[0] === "botek" && parts[2] === "relay") {
        const deviceCode = parts[1];
        const controlName = parts[3];
        const status = payloadStr.toUpperCase() === "ON" ? "ON" : "OFF";
        const numericVal = status === "ON" ? 1 : 0;

        db.run(
            `UPDATE device_sensors SET value=? WHERE device_code=? AND sensor_name=?`,
            [numericVal, deviceCode, controlName]
        );
        db.run(
            `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
             VALUES (
                (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                ?, ?, ?, ?
             )`,
            [deviceCode, controlName, deviceCode, controlName, status, new Date().toISOString()]
        );
        saveSensorHistory(deviceCode, controlName, numericVal);
        broadcastDeviceUpdate(deviceCode);
    }

    // Format: botek/{device_code}/status
    if (parts.length === 3 && parts[0] === "botek" && parts[2] === "status") {
        const deviceCode = parts[1];
        const statusStr = payloadStr.toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE";
        db.run(
            `UPDATE devices SET status=?, last_seen=? WHERE device_code=?`,
            [statusStr, new Date().toISOString(), deviceCode],
            (err) => {
                if (!err) broadcastDeviceUpdate(deviceCode);
            }
        );
    }
});

app.set("trust proxy", 1);

// Disable caching globally for all endpoints, JS, CSS, HTML
app.use((req, res, next) => {
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
    next();
});

// ==========================
// MIDDLEWARE
// ==========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const Store = session.Store;
class SQLiteSessionStore extends Store {
    constructor() {
        super();
        db.run(`CREATE TABLE IF NOT EXISTS user_sessions (sid TEXT PRIMARY KEY, sess TEXT, expired TEXT)`);
    }

    get(sid, callback) {
        db.get(`SELECT sess, expired FROM user_sessions WHERE sid=?`, [sid], (err, row) => {
            if (err) return callback(err);
            if (!row) return callback(null, null);
            if (new Date(row.expired) < new Date()) {
                db.run(`DELETE FROM user_sessions WHERE sid=?`, [sid]);
                return callback(null, null);
            }
            try {
                const sess = JSON.parse(row.sess);
                callback(null, sess);
            } catch (e) {
                callback(e);
            }
        });
    }

    set(sid, sess, callback) {
        const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 1000 * 60 * 60 * 24 * 365;
        const expired = new Date(Date.now() + maxAge).toISOString();
        const sessStr = JSON.stringify(sess);

        db.run(
            `INSERT INTO user_sessions (sid, sess, expired) VALUES (?, ?, ?)
             ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expired=excluded.expired`,
            [sid, sessStr, expired],
            (err) => {
                if (callback) callback(err);
            }
        );
    }

    destroy(sid, callback) {
        db.run(`DELETE FROM user_sessions WHERE sid=?`, [sid], (err) => {
            if (callback) callback(err);
        });
    }
}

app.use(
    session({
        store: new SQLiteSessionStore(),
        secret: process.env.SESSION_SECRET || "BOTEK-IOT-SECRET",
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 Tahun Persisten
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

// Root Domain Handler (Redirect unauthenticated users to login.html)
app.get("/", (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect("/login.html");
    }
    res.sendFile(__dirname + "/public/index.html");
});

const userActiveSessions = new Map();

app.use((req, res, next) => {
    if (req.session && req.session.user && req.session.user.id) {
        userActiveSessions.set(Number(req.session.user.id), Date.now());
    }
    next();
});

app.use(express.static("public"));

// Middleware Autentikasi
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: "Unauthorized. Silakan login terlebih dahulu."
    });
}

// Auto Sync missing device_controls on startup
db.serialize(() => {
    db.all(
        `SELECT device_code, sensor_name FROM device_sensors WHERE sensor_type IN ('Relay', 'Control', 'Switch')`,
        [],
        (err, rows) => {
            if (!err && Array.isArray(rows)) {
                rows.forEach(row => {
                    db.run(
                        `INSERT OR IGNORE INTO device_controls (device_code, control_name, status, created_at) VALUES (?, ?, 'OFF', ?)`,
                        [row.device_code, row.sensor_name, new Date().toISOString()],
                        (err) => {
                            if (err) console.error("Auto sync error:", err.message);
                        }
                    );
                });
            }
        }
    );
});

// ==========================
// REAL-TIME SSE STREAMING (INSTANT PUSH TO DASHBOARD)
// ==========================
const sseClients = new Map();

function broadcastDeviceUpdate(deviceCode) {
    if (!deviceCode) return;
    const clients = sseClients.get(deviceCode);
    if (!clients || clients.length === 0) return;

    db.all(
        `SELECT * FROM device_sensors WHERE device_code=? ORDER BY sensor_order ASC`,
        [deviceCode],
        (err, rows) => {
            if (!err && rows) {
                const payload = `data: ${JSON.stringify(rows)}\n\n`;
                clients.forEach(res => {
                    try { res.write(payload); } catch (e) {}
                });
            }
        }
    );
}

app.get("/api/device/:code/stream", requireAuth, (req, res) => {
    const codeParam = req.params.code;
    verifyDeviceOwnership(req, res, codeParam, (err, dev) => {
        const realCode = dev.device_code;

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        if (!sseClients.has(realCode)) {
            sseClients.set(realCode, []);
        }
        const clients = sseClients.get(realCode);
        clients.push(res);

        // Send initial state immediately
        db.all(
            `SELECT * FROM device_sensors WHERE device_code=? ORDER BY sensor_order ASC`,
            [realCode],
            (err2, rows) => {
                if (!err2 && rows) {
                    res.write(`data: ${JSON.stringify(rows)}\n\n`);
                }
            }
        );

        req.on("close", () => {
            const idx = clients.indexOf(res);
            if (idx !== -1) clients.splice(idx, 1);
        });
    });
});

// ==========================
// AUTHENTICATION & MULTI-TENANT ROUTES
// ==========================
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ success: false, message: "Username dan password harus diisi" });
    }

    const uClean = String(username).trim();
    db.get(`SELECT * FROM users WHERE username=? OR email=?`, [uClean, uClean], async (err, user) => {
        if (err) {
            return res.json({ success: false, message: err.message });
        }

        if (!user) {
            return res.json({ success: false, message: "Username atau email tidak ditemukan" });
        }

        if (user.status === 'SUSPENDED') {
            return res.json({ success: false, message: "Akun Anda dinonaktifkan oleh Admin. Silakan hubungi pengelola BOTEK." });
        }

        let valid = false;
        if (user.password && (user.password.startsWith("$2b$") || user.password.startsWith("$2a$"))) {
            valid = await bcrypt.compare(password, user.password);
        } else {
            valid = (password === user.password);
        }

        if (!valid) {
            return res.json({ success: false, message: "Password salah" });
        }

        const loginTime = new Date().toISOString();
        db.run(`UPDATE users SET last_login=? WHERE id=?`, [loginTime, user.id]);

        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name || user.username,
            email: user.email || "",
            role: user.role || "CLIENT",
            status: user.status || "ACTIVE",
            last_login: loginTime
        };

        res.json({
            success: true,
            user: req.session.user
        });
    });
});

app.post("/api/register", async (req, res) => {
    const { username, email, full_name, password } = req.body;

    if (!username || !email || !password) {
        return res.json({ success: false, message: "Username, email, dan password wajib diisi" });
    }

    const uClean = String(username).trim();
    const eClean = String(email || "").trim();
    const fClean = String(full_name || username).trim();

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const nowIso = new Date().toISOString();

        db.run(
            `INSERT INTO users (username, email, password, full_name, role, status, created_at)
             VALUES (?, ?, ?, ?, 'CLIENT', 'ACTIVE', ?)`,
            [uClean, eClean, hashedPassword, fClean, nowIso],
            function (err) {
                if (err) {
                    if (err.message && err.message.includes("UNIQUE")) {
                        return res.json({ success: false, message: "Username atau email sudah digunakan" });
                    }
                    return res.json({ success: false, message: err.message });
                }

                res.json({ success: true, message: "Pendaftaran berhasil! Silakan login dengan akun baru Anda." });
            }
        );
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.get("/api/session", (req, res) => {
    if (req.session.user) {
        res.json({ login: true, user: req.session.user });
    } else {
        res.json({ login: false });
    }
});

app.get("/logout", (req, res) => {
    if (req.session && req.session.user && req.session.user.id) {
        userActiveSessions.delete(Number(req.session.user.id));
    }
    if (req.session) {
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.redirect("/login.html");
        });
    } else {
        res.clearCookie("connect.sid");
        res.redirect("/login.html");
    }
});

app.get("/api/logout", (req, res) => {
    if (req.session && req.session.user && req.session.user.id) {
        userActiveSessions.delete(Number(req.session.user.id));
    }
    if (req.session) {
        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.json({ success: true });
        });
    } else {
        res.clearCookie("connect.sid");
        res.json({ success: true });
    }
});

const os = require("os");
const fs = require("fs");

function getServerSystemStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    const processMemMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 10) / 10;
    const totalMemGb = Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10;
    const usedMemGb = Math.round(usedMem / (1024 * 1024 * 1024) * 10) / 10;

    let dbSizeMb = 0;
    try {
        if (fs.existsSync("sensor.db")) {
            dbSizeMb = Math.round((fs.statSync("sensor.db").size / (1024 * 1024)) * 100) / 100;
        }
    } catch (e) {}

    const cpus = os.cpus();
    const cpuCount = cpus ? cpus.length : 1;
    const loadAvg = os.loadavg()[0] || 0;
    let cpuPercent = Math.min(100, Math.round((loadAvg / cpuCount) * 100));
    if (cpuPercent === 0) cpuPercent = 5;

    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const uptimeStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;

    return {
        cpu_percent: cpuPercent,
        mem_percent: memPercent,
        used_mem_gb: usedMemGb,
        total_mem_gb: totalMemGb,
        process_mem_mb: processMemMb,
        db_size_mb: dbSizeMb,
        uptime_str: uptimeStr,
        cpu_count: cpuCount
    };
}

// ==========================
// SUPER ADMIN USER MANAGEMENT ENDPOINTS
// ==========================
app.get("/api/admin/users", requireAuth, (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    db.all(
        `SELECT users.id, users.username, users.email, users.full_name, users.role, users.status, users.password, users.created_at, users.last_login,
                (SELECT COUNT(*) FROM devices WHERE devices.user_id = users.id) as device_count,
                (SELECT COUNT(*) FROM device_sensors WHERE device_sensors.device_code IN (SELECT device_code FROM devices WHERE user_id = users.id)) as sensor_count,
                (SELECT COUNT(*) FROM device_rules WHERE device_rules.device_code IN (SELECT device_code FROM devices WHERE user_id = users.id)) as rule_count,
                (SELECT COUNT(*) FROM sensor_data WHERE sensor_data.device_code IN (SELECT device_code FROM devices WHERE user_id = users.id)) as log_count
         FROM users
         ORDER BY users.id ASC`,
        [],
        (err, rows) => {
            if (err) return res.json({ success: false, message: err.message });
            const now = Date.now();
            const users = (rows || []).map(u => {
                const lastActive = userActiveSessions.get(Number(u.id)) || 0;
                // Active in last 60 seconds
                const isOnline = (now - lastActive) < 60000;
                const logCount = u.log_count || 0;
                const logSizeMb = logCount ? Math.max(0.01, Math.round((logCount * 60 / (1024 * 1024)) * 100) / 100) : 0;
                return {
                    ...u,
                    is_online: isOnline,
                    log_size_mb: logSizeMb
                };
            });
            res.json({
                users: users,
                stats: getServerSystemStats()
            });
        }
    );
});

// Clear user sensor logs endpoint (Super Admin)
app.delete("/api/admin/users/:id/logs", requireAuth, (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    const targetUserId = req.params.id;

    db.all(`SELECT device_code FROM devices WHERE user_id=?`, [targetUserId], (err, devices) => {
        if (err) return res.json({ success: false, message: err.message });
        
        const deviceCodes = (devices || []).map(d => d.device_code);
        if (deviceCodes.length === 0) {
            return res.json({ success: true, message: "User tidak memiliki perangkat atau data log sensor" });
        }

        const placeholders = deviceCodes.map(() => "?").join(",");
        db.run(`DELETE FROM sensor_data WHERE device_code IN (${placeholders})`, deviceCodes, function(err) {
            if (err) return res.json({ success: false, message: err.message });
            res.json({ success: true, message: `Berhasil menghapus ${this.changes || 0} baris log data sensor` });
        });
    });
});

app.put("/api/admin/users/:id/status", requireAuth, (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    const userId = req.params.id;
    if (userId == req.session.user.id) {
        return res.json({ success: false, message: "Tidak dapat mengubah status akun Super Admin sendiri" });
    }

    db.run(
        `UPDATE users SET status = CASE WHEN status='ACTIVE' THEN 'SUSPENDED' ELSE 'ACTIVE' END WHERE id=?`,
        [userId],
        function (err) {
            if (err) return res.json({ success: false, message: err.message });
            res.json({ success: true, message: "Status akun pengguna berhasil diperbarui" });
        }
    );
});

app.delete("/api/admin/users/:id", requireAuth, (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    const userId = req.params.id;
    if (userId == req.session.user.id) {
        return res.json({ success: false, message: "Tidak dapat menghapus akun Super Admin sendiri" });
    }

    // Find and cascade delete all devices, sensors, controls, rules, and telemetry log data owned by this user
    db.all(`SELECT device_code, id FROM devices WHERE user_id = ?`, [userId], (err, devRows) => {
        if (!err && Array.isArray(devRows) && devRows.length > 0) {
            devRows.forEach(dev => {
                const code = dev.device_code;
                db.run(`DELETE FROM device_sensors WHERE device_code=?`, [code]);
                db.run(`DELETE FROM device_controls WHERE device_code=?`, [code]);
                db.run(`DELETE FROM device_rules WHERE device_code=?`, [code]);
                db.run(`DELETE FROM sensor_data WHERE device_code=?`, [code]);
            });
        }

        // Delete user's devices
        db.run(`DELETE FROM devices WHERE user_id = ?`, [userId], () => {
            // Delete user account
            db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err2) {
                if (err2) return res.json({ success: false, message: err2.message });
                res.json({ success: true, message: "Akun pengguna beserta seluruh perangkat dan data log terkait berhasil dihapus secara permanen." });
            });
        });
    });
});

app.put("/api/admin/users/:id/password", requireAuth, async (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
        return res.json({ success: false, message: "Password baru minimal harus 4 karakter" });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
        db.run(
            `UPDATE users SET password=? WHERE id=?`,
            [hashedPassword, userId],
            function (err) {
                if (err) return res.json({ success: false, message: err.message });
                if (this.changes === 0) return res.json({ success: false, message: "Pengguna tidak ditemukan" });
                res.json({ success: true, message: "Password pengguna berhasil diperbarui!" });
            }
        );
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// ==========================
// SYSTEM ANNOUNCEMENT & MAINTENANCE BROADCAST ROUTES
// ==========================
app.get("/api/announcement", (req, res) => {
    db.get(
        `SELECT * FROM system_announcements WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
        [],
        (err, row) => {
            if (err || !row) {
                return res.json({ success: true, active: false, announcement: null });
            }
            res.json({ success: true, active: true, announcement: row });
        }
    );
});

app.get("/api/admin/announcement", requireAuth, (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    db.get(
        `SELECT * FROM system_announcements ORDER BY id DESC LIMIT 1`,
        [],
        (err, row) => {
            res.json({ success: true, announcement: row || null });
        }
    );
});

app.post("/api/admin/announcement", requireAuth, (req, res) => {
    if (req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses khusus Super Admin" });
    }

    const { title, message, type, is_active } = req.body;
    const activeState = is_active ? 1 : 0;

    // Deactivate previous announcements
    db.run(`UPDATE system_announcements SET is_active = 0`, [], (err) => {
        db.run(
            `INSERT INTO system_announcements (title, message, type, is_active, created_at) VALUES (?, ?, ?, ?, ?)`,
            [
                title || "Pengumuman Server",
                message || "",
                type || "MAINTENANCE",
                activeState,
                new Date().toISOString()
            ],
            function (err2) {
                if (err2) return res.json({ success: false, message: err2.message });

                // Broadcast live announcement update to all connected WebSocket clients
                const wsPayload = JSON.stringify({
                    type: "SYSTEM_ANNOUNCEMENT",
                    active: activeState === 1,
                    announcement: activeState === 1 ? { title, message, type } : null
                });
                wsClients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        try { client.send(wsPayload); } catch (e) {}
                    }
                });

                res.json({
                    success: true,
                    message: activeState 
                        ? "Pengumuman berhasil disiarkan ke seluruh pengguna secara live!" 
                        : "Pengumuman berhasil dinonaktifkan."
                });
            }
        );
    });
});

app.put("/api/user/change-password", requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 4) {
        return res.json({ success: false, message: "Password baru minimal harus 4 karakter" });
    }

    db.get(`SELECT * FROM users WHERE id=?`, [userId], async (err, user) => {
        if (err || !user) {
            return res.json({ success: false, message: "Pengguna tidak ditemukan" });
        }

        let valid = false;
        if (user.password && (user.password.startsWith("$2b$") || user.password.startsWith("$2a$"))) {
            valid = await bcrypt.compare(oldPassword || "", user.password);
        } else {
            valid = (oldPassword === user.password);
        }

        if (!valid) {
            return res.json({ success: false, message: "Password lama Anda tidak sesuai" });
        }

        try {
            const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
            db.run(`UPDATE users SET password=? WHERE id=?`, [hashedPassword, userId], (err2) => {
                if (err2) return res.json({ success: false, message: err2.message });
                res.json({ success: true, message: "Password Anda berhasil diperbarui!" });
            });
        } catch (e) {
            res.json({ success: false, message: e.message });
        }
    });
});


// ==========================
// HELPER: SAVE SENSOR HISTORY & EVALUATE AUTOMATION RULES
// ==========================
function saveSensorHistory(device_code, sensor_name, value) {
    const valNum = Number(value);
    db.run(
        `INSERT INTO sensor_data (device_code, sensor_name, value, time) VALUES (?, ?, ?, ?)`,
        [device_code, sensor_name, valNum, new Date().toISOString()],
        (err) => {
            if (err) {
                console.log("History error:", err.message);
            }
        }
    );

    // Update last known value in device_sensors table for persistent UI state across refresh & logout
    db.run(
        `UPDATE device_sensors SET value=? WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
        [valNum, device_code, sensor_name, sensor_name]
    );

    // Evaluate Smart Automation Rules for this sensor reading
    evaluateDeviceRules(device_code, sensor_name, valNum);
}

// ==========================================
// SMART RULES EVALUATOR ENGINE
// ==========================================
function evaluateDeviceRules(deviceCode, sensorName, valueNum) {
    if (!deviceCode || !sensorName || isNaN(valueNum)) return;

    db.all(
        `SELECT * FROM device_rules WHERE device_code=? AND is_active=1 AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
        [deviceCode, sensorName, sensorName],
        (err, rules) => {
            if (err || !Array.isArray(rules) || rules.length === 0) return;

            rules.forEach(rule => {
                let triggered = false;
                const val = parseFloat(valueNum);
                const threshold = parseFloat(rule.trigger_value);

                switch (rule.operator) {
                    case '>':  triggered = val > threshold; break;
                    case '>=': triggered = val >= threshold; break;
                    case '<':  triggered = val < threshold; break;
                    case '<=': triggered = val <= threshold; break;
                    case '==': triggered = Math.abs(val - threshold) < 0.01; break;
                }

                if (triggered) {
                    const targetRelay = rule.target_relay;
                    const targetAction = String(rule.target_action).toUpperCase() === "ON" ? "ON" : "OFF";
                    const numericVal = targetAction === "ON" ? 1 : 0;

                    // Check current relay status
                    db.get(
                        `SELECT value FROM device_sensors WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
                        [deviceCode, targetRelay, targetRelay],
                        (err, sRow) => {
                            const currentStatus = (sRow && sRow.value == 1) ? "ON" : "OFF";

                            // Only trigger if state actually changes
                            if (currentStatus !== targetAction) {
                                console.log(`⚡ [AUTOMATION RULE TRIGGERED] Rule: "${rule.rule_name}" | Device: ${deviceCode} | Sensor ${sensorName}=${valueNum} (${rule.operator} ${threshold}) -> Set ${targetRelay} to ${targetAction}`);

                                // 1. Update DB
                                db.run(
                                    `UPDATE device_sensors SET value=? WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
                                    [numericVal, deviceCode, targetRelay, targetRelay]
                                );
                                db.run(
                                    `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                                     VALUES (
                                        (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                                        ?, ?, ?, ?
                                     )`,
                                    [deviceCode, targetRelay, deviceCode, targetRelay, targetAction, new Date().toISOString()]
                                );

                                // 2. Broadcast via MQTT & WebSocket to ESP32 hardware
                                publishMqtt("botek/" + deviceCode + "/relay/" + targetRelay, targetAction);
                                broadcastDeviceUpdate(deviceCode);
                            }
                        }
                    );
                }
            });
        }
    );
}

// ==========================
// DEVICE OWNERSHIP ISOLATION HELPER
// ==========================
function verifyDeviceOwnership(req, res, deviceCodeParam, callback) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized. Silakan login terlebih dahulu." });
    }

    const userId = req.session.user.id;
    const userRole = req.session.user.role || "CLIENT";

    db.get(
        `SELECT * FROM devices WHERE (device_code=? OR id=? OR device_name=?) AND (user_id=? OR ?='SUPER_ADMIN') ORDER BY id ASC LIMIT 1`,
        [deviceCodeParam, deviceCodeParam, deviceCodeParam, userId, userRole],
        (err, device) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            if (!device) {
                return res.status(404).json({ success: false, message: "Perangkat tidak ditemukan atau Anda tidak memiliki akses." });
            }

            callback(null, device);
        }
    );
}

// ==========================
// DEVICE ROUTES (MULTI-TENANT ISOLATED)
// ==========================
app.get("/api/devices", requireAuth, (req, res) => {
    const connectedClientIds = Object.keys(aedes.clients || {});
    const userRole = req.session.user.role || "CLIENT";
    const userId = req.session.user.id;

    let sql = `SELECT devices.*, users.username as owner_username, users.full_name as owner_name FROM devices LEFT JOIN users ON devices.user_id = users.id WHERE devices.user_id = ? ORDER BY devices.id DESC`;
    let params = [userId];

    if (userRole === "SUPER_ADMIN") {
        sql = `SELECT devices.*, users.username as owner_username, users.full_name as owner_name FROM devices LEFT JOIN users ON devices.user_id = users.id ORDER BY devices.id DESC`;
        params = [];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (Array.isArray(rows)) {
            rows.forEach(device => {
                const isMqttConnected = connectedClientIds.some(cid => 
                    cid && (cid === device.device_code || cid.includes(device.device_code))
                );
                if (isMqttConnected && device.status !== "ONLINE") {
                    device.status = "ONLINE";
                    db.run(`UPDATE devices SET status='ONLINE', last_seen=? WHERE id=?`, [new Date().toISOString(), device.id]);
                }
            });
        }
        res.json(rows);
    });
});

// Live Sensor Endpoint (Bisa dipanggil oleh Perangkat/Dashboard)
app.get("/api/device/:code/live", (req, res) => {
    const code = req.params.code;

    db.get(`SELECT * FROM devices WHERE device_code=?`, [code], (err, device) => {
        if (err) {
            return res.json({ success: false, message: err.message });
        }
        if (!device) {
            return res.json({ success: false, message: "Device tidak ditemukan" });
        }

        const data = getSensorData(device.type);

        res.json({
            success: true,
            type: device.type,
            data: data
        });
    });
});

app.get("/api/device/:code/sensors", requireAuth, (req, res) => {
    const codeParam = req.params.code;
    verifyDeviceOwnership(req, res, codeParam, (err, dev) => {
        const realCode = dev.device_code;
        db.all(
            `SELECT * FROM device_sensors WHERE device_code=? ORDER BY sensor_order ASC, id ASC`,
            [realCode],
            (err2, rows) => {
                if (err2) {
                    return res.status(500).json({ success: false, message: err2.message });
                }
                res.json(rows || []);
            }
        );
    });
});

// Reorder sensors API endpoint
app.put("/api/device/:code/sensors/reorder", requireAuth, (req, res) => {
    const codeParam = req.params.code;
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
        return res.json({ success: false, message: "Data urutan sensor tidak valid" });
    }

    verifyDeviceOwnership(req, res, codeParam, (err, dev) => {
        const realCode = dev.device_code;
        
        db.serialize(() => {
            const stmt = db.prepare(`UPDATE device_sensors SET sensor_order=? WHERE device_code=? AND id=?`);
            order.forEach((sensorId, idx) => {
                stmt.run([idx + 1, realCode, sensorId]);
            });
            stmt.finalize((err2) => {
                if (err2) {
                    return res.json({ success: false, message: err2.message });
                }
                broadcastDeviceUpdate(realCode);
                res.json({ success: true, message: "Urutan tata letak sensor berhasil disimpan!" });
            });
        });
    });
});

// ==========================
// EXPORT TELEMETRY LOGS DATA
// ==========================
// ==========================
// EXPORT TELEMETRY LOGS DATA
// ==========================
app.get("/api/device/:code/export-data", (req, res) => {
    const codeParam = req.params.code;
    const { sensor, startDate, endDate } = req.query;

    verifyDeviceOwnership(req, res, codeParam, (err, dev) => {
        if (err || !dev) {
            return; // verifyDeviceOwnership handles status code & response
        }

        const realCode = dev.device_code;
        let sensorFilter = (sensor && sensor !== "all" && sensor !== "Semua Sensor & Sakelar") ? sensor.trim() : null;

        let sql = `SELECT id, device_code, sensor_name, value, COALESCE(time, datetime('now','localtime')) as created_at FROM sensor_data WHERE device_code=?`;
        let params = [realCode];

        if (sensorFilter) {
            let cleanBase = sensorFilter.split('(')[0].trim();
            sql += ` AND (LOWER(sensor_name) = LOWER(?) OR LOWER(sensor_name) = LOWER(?) OR LOWER(sensor_name) LIKE LOWER(?))`;
            params.push(sensorFilter, cleanBase, `%${cleanBase}%`);
        }

        if (startDate && startDate.trim()) {
            sql += ` AND substr(COALESCE(time, datetime('now','localtime')), 1, 10) >= ?`;
            params.push(startDate.trim());
        }
        if (endDate && endDate.trim()) {
            sql += ` AND substr(COALESCE(time, datetime('now','localtime')), 1, 10) <= ?`;
            params.push(endDate.trim());
        }

        sql += ` ORDER BY id ASC`;

        db.all(sql, params, (err2, rows) => {
            let logsToReturn = (!err2 && rows && Array.isArray(rows)) ? rows : [];

            res.json({
                success: true,
                device_name: dev.device_name,
                device_code: dev.device_code,
                device_type: dev.type,
                location: dev.location,
                logs: logsToReturn
            });
        });
    });
});

// ==========================
// EXPORT METADATA STATS API (TOTAL LOGS & DAYS STORED)
// ==========================
app.get("/api/device/:code/export-info", requireAuth, (req, res) => {
    const codeParam = req.params.code;
    const { sensor, startDate, endDate } = req.query;

    verifyDeviceOwnership(req, res, codeParam, (err, dev) => {
        if (err || !dev) return;

        const realCode = dev.device_code;
        let sensorFilter = (sensor && sensor !== "all" && sensor !== "Semua Sensor & Sakelar") ? sensor.trim() : null;

        let sql = `
            SELECT 
                COUNT(*) as total_count,
                MIN(COALESCE(time, datetime('now','localtime'))) as oldest_time,
                MAX(COALESCE(time, datetime('now','localtime'))) as newest_time
            FROM sensor_data WHERE device_code=?
        `;
        let params = [realCode];

        if (sensorFilter) {
            let cleanBase = sensorFilter.split('(')[0].trim();
            sql += ` AND (LOWER(sensor_name) = LOWER(?) OR LOWER(sensor_name) = LOWER(?) OR LOWER(sensor_name) LIKE LOWER(?))`;
            params.push(sensorFilter, cleanBase, `%${cleanBase}%`);
        }

        if (startDate && startDate.trim()) {
            sql += ` AND substr(COALESCE(time, datetime('now','localtime')), 1, 10) >= ?`;
            params.push(startDate.trim());
        }
        if (endDate && endDate.trim()) {
            sql += ` AND substr(COALESCE(time, datetime('now','localtime')), 1, 10) <= ?`;
            params.push(endDate.trim());
        }

        db.get(sql, params, (err2, row) => {
            if (err2 || !row) {
                return res.json({ success: true, total_count: 0, stored_days: 0 });
            }

            let totalCount = row.total_count || 0;
            let storedDays = 0;

            if (totalCount > 0 && row.oldest_time) {
                const oldest = new Date(row.oldest_time).getTime();
                const newest = row.newest_time ? new Date(row.newest_time).getTime() : Date.now();
                const diffMs = Math.max(0, newest - oldest);
                storedDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            }

            res.json({
                success: true,
                total_count: totalCount,
                stored_days: storedDays
            });
        });
    });
});

// ==========================
// 7-DAY AUTOMATIC TELEMETRY DATA RETENTION CLEANUP ENGINE
// ==========================
function cleanupOldTelemetryLogs() {
    const cutoff7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
        `DELETE FROM sensor_data WHERE time < ? OR time IS NULL`,
        [cutoff7Days],
        function (err) {
            if (err) {
                console.error("Data retention cleanup error:", err.message);
            } else if (this.changes > 0) {
                console.log(`🧹 [RETENTION ENGINE] Automatic 7-day cleanup deleted ${this.changes} log records older than 7 days.`);
            }
        }
    );
}

// Run 7-day retention cleanup on startup & every 4 hours
cleanupOldTelemetryLogs();
setInterval(cleanupOldTelemetryLogs, 4 * 60 * 60 * 1000);



app.get("/api/admin/export-all-data", requireAuth, (req, res) => {
    if (!req.session || !req.session.user || req.session.user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ success: false, message: "Akses ditolak. Fitur ini khusus Super Admin." });
    }
    const limit = parseInt(req.query.limit, 10) || 5000;
    const sql = `
        SELECT sensor_data.id, sensor_data.device_code, sensor_data.sensor_name, sensor_data.value, sensor_data.created_at,
               devices.device_name, users.username as owner_username
        FROM sensor_data
        LEFT JOIN devices ON sensor_data.device_code = devices.device_code
        LEFT JOIN users ON devices.user_id = users.id
        ORDER BY sensor_data.id DESC
        LIMIT ?
    `;

    db.all(sql, [limit], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({
            success: true,
            total_records: (rows || []).length,
            logs: rows || []
        });
    });
});

app.get("/api/device/:code/history/:sensor", requireAuth, (req, res) => {
    const { code, sensor } = req.params;
    verifyDeviceOwnership(req, res, code, (err, dev) => {
        const realCode = dev.device_code;
        db.all(
            `SELECT * FROM sensor_data WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?)) ORDER BY id DESC LIMIT 50`,
            [realCode, sensor, sensor],
            (err2, rows) => {
                if (err2) {
                    return res.json({ success: false, message: err2.message });
                }
                res.json(rows);
            }
        );
    });
});

app.post("/api/devices", requireAuth, (req, res) => {
    const { device_code, device_name, location, type, sensors } = req.body;
    const userId = req.session.user.id;

    if (!device_code || !device_name || !type) {
        return res.json({ success: false, message: "Data device belum lengkap" });
    }

    db.run(
        `INSERT INTO devices (device_code, device_name, user_id, location, type, sensor_count, status, last_seen, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            device_code,
            device_name,
            userId,
            location,
            type,
            sensors ? sensors.length : 0,
            "OFFLINE",
            null,
            new Date().toISOString()
        ],
        function (err) {
            if (err) {
                if (err.message && err.message.includes("UNIQUE")) {
                    return res.json({
                        success: false,
                        message: `Kode Perangkat '${device_code}' sudah terdaftar di sistem BOTEK. Silakan gunakan Kode Perangkat unik lainnya (contoh: 02, 03, atau 05).`
                    });
                }
                return res.json({ success: false, message: err.message });
            }

            if (sensors && sensors.length) {
                sensors.forEach((sensor, index) => {
                    db.run(
                        `INSERT INTO device_sensors (device_code, sensor_name, sensor_type, unit, icon, sensor_order, value, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            device_code,
                            sensor.name,
                            sensor.type,
                            sensor.unit,
                            sensor.icon || "📊",
                            index + 1,
                            0,
                            new Date().toISOString()
                        ]
                    );

                    // Auto Insert ke device_controls jika tipe Relay/Control/Switch
                    if (sensor.type === "Relay" || sensor.type === "Control" || sensor.type === "Switch") {
                        db.run(
                            `INSERT OR IGNORE INTO device_controls (device_code, control_name, status, created_at) VALUES (?, ?, 'OFF', ?)`,
                            [device_code, sensor.name, new Date().toISOString()]
                        );
                    }
                });
            }

            res.json({ success: true, message: "Device berhasil dibuat" });
        }
    );
});

app.delete("/api/devices/:id", requireAuth, (req, res) => {
    const id = req.params.id;

    verifyDeviceOwnership(req, res, id, (err, device) => {
        const code = device.device_code;
        db.run(`DELETE FROM device_sensors WHERE device_code=?`, [code]);
        db.run(`DELETE FROM device_controls WHERE device_code=?`, [code]);
        db.run(`DELETE FROM device_rules WHERE device_code=?`, [code]);
        db.run(`DELETE FROM sensor_data WHERE device_code=?`, [code]);
        db.run(`DELETE FROM devices WHERE id=?`, [id], function (err2) {
            if (err2) {
                return res.json({ success: false, message: err2.message });
            }
            res.json({ success: true, message: "Device berhasil dihapus" });
        });
    });
});

// ==========================
// RELAY & CONTROL ROUTES (OWNERSHIP ISOLATED)
// ==========================
app.post("/api/device/:code/sensor", requireAuth, (req, res) => {
    const codeParam = req.params.code;
    const { sensor_name, value } = req.body;

    if (!sensor_name) {
        return res.json({ success: false, message: "Sensor name kosong" });
    }

    verifyDeviceOwnership(req, res, codeParam, (err, dev) => {
        const code = dev.device_code;

        db.get(
            `SELECT mode FROM device_sensors WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
            [code, sensor_name, sensor_name],
            (err2, row) => {
                if (row && row.mode === "AUTO") {
                    return res.json({
                        success: false,
                        message: "Relay dalam mode OTOMATIS (Timer). Sakelar manual terkunci. Silakan ubah ke mode Manual terlebih dahulu."
                    });
                }

                const status = (value == 1 || value === "ON" || value === true) ? "ON" : "OFF";
                const numericVal = status === "ON" ? 1 : 0;

                db.run(
                    `UPDATE device_sensors SET value=? WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
                    [numericVal, code, sensor_name, sensor_name],
                    function (err3) {
                        if (err3) {
                            return res.json({ success: false, message: err3.message });
                        }

                        db.run(
                            `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                             VALUES (
                                (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                                ?, ?, ?, ?
                             )`,
                            [code, sensor_name, code, sensor_name, status, new Date().toISOString()],
                            (err4) => {
                                if (err4) {
                                    return res.json({ success: false, message: err4.message });
                                }
                                saveSensorHistory(code, sensor_name, numericVal);
                                // Broadcast via MQTT & SSE
                                publishMqtt("botek/" + code + "/relay/" + sensor_name, status);
                                broadcastDeviceUpdate(code);
                                res.json({ success: true, status: status });
                            }
                        );
                    }
                );
            }
        );
    });
});

// ==========================
// RENAME RELAY / SENSOR ROUTE
// ==========================
app.put("/api/device/:code/sensor/:id", requireAuth, (req, res) => {
    const sensorId = req.params.id;
    const nameVal = req.body.name || req.body.sensor_name;

    if (!nameVal || !String(nameVal).trim()) {
        return res.json({ success: false, message: "Nama relay tidak boleh kosong" });
    }

    const newName = String(nameVal).trim();

    // Query sensor directly by its primary key ID
    db.get(
        `SELECT sensor_name, device_code FROM device_sensors WHERE id=?`,
        [sensorId],
        (err, row) => {
            if (err || !row) {
                return res.json({ success: false, message: "Sensor tidak ditemukan" });
            }

            const oldName = row.sensor_name;
            const devCode = row.device_code;

            db.run(
                `UPDATE device_sensors SET sensor_name=? WHERE id=?`,
                [newName, sensorId],
                function (err) {
                    if (err) {
                        return res.json({ success: false, message: err.message });
                    }

                    // Update device_controls
                    db.run(
                        `UPDATE device_controls SET control_name=? WHERE device_code=? AND control_name=?`,
                        [newName, devCode, oldName]
                    );

                    // Update sensor_data history
                    db.run(
                        `UPDATE sensor_data SET sensor_name=? WHERE device_code=? AND sensor_name=?`,
                        [newName, devCode, oldName]
                    );

                    res.json({ success: true, message: "Nama relay berhasil diperbarui" });
                }
            );
        }
    );
});

// ==========================
// ADD NEW SENSOR / RELAY TO DEVICE
// ==========================
app.post("/api/device/:code/add-sensor", requireAuth, (req, res) => {
    const code = req.params.code;
    const { sensor_name, sensor_type, unit, initial_value } = req.body;

    if (!sensor_name || !sensor_type) {
        return res.json({ success: false, message: "Nama dan Tipe sensor wajib diisi" });
    }

    const cleanName = String(sensor_name).trim();
    const cleanType = String(sensor_type).trim();
    const cleanUnit = unit ? String(unit).trim() : "";
    const initVal = parseFloat(initial_value) || 0;

    // Check if device exists
    db.get(`SELECT device_code FROM devices WHERE device_code=?`, [code], (err, devRow) => {
        if (err || !devRow) {
            return res.json({ success: false, message: "Device tidak ditemukan" });
        }

        // Check max sensor order
        db.get(`SELECT MAX(sensor_order) as maxOrder FROM device_sensors WHERE device_code=?`, [code], (err, orderRow) => {
            const nextOrder = (orderRow && orderRow.maxOrder) ? (orderRow.maxOrder + 1) : 1;
            const nowIso = new Date().toISOString();

            db.run(
                `INSERT INTO device_sensors (device_code, sensor_name, sensor_type, unit, icon, sensor_order, value, mode, time_on, time_off, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', '06:00', '18:00', ?)`,
                [code, cleanName, cleanType, cleanUnit, cleanType === 'Relay' ? '⍟' : '📊', nextOrder, initVal, nowIso],
                function (err) {
                    if (err) {
                        return res.json({ success: false, message: err.message });
                    }

                    const newSensorId = this.lastID;

                    // If Relay type, register in device_controls as well
                    if (cleanType === "Relay") {
                        db.run(
                            `INSERT INTO device_controls (device_code, control_name, status, created_at) VALUES (?, ?, 'OFF', ?)`,
                            [code, cleanName, nowIso]
                        );
                    }

                    broadcastDeviceUpdate(code);
                    res.json({ success: true, message: `Sensor '${cleanName}' berhasil ditambahkan`, id: newSensorId });
                }
            );
        });
    });
});

// ==========================
// DELETE SENSOR / RELAY FROM DEVICE
// ==========================
app.delete("/api/device/:code/sensor/:id", requireAuth, (req, res) => {
    const code = req.params.code;
    const sensorId = req.params.id;

    db.get(`SELECT sensor_name FROM device_sensors WHERE id=? AND device_code=?`, [sensorId, code], (err, row) => {
        if (err || !row) {
            return res.json({ success: false, message: "Sensor tidak ditemukan" });
        }

        const sName = row.sensor_name;

        db.run(`DELETE FROM device_sensors WHERE id=? AND device_code=?`, [sensorId, code], function (err) {
            if (err) {
                return res.json({ success: false, message: err.message });
            }

            db.run(`DELETE FROM device_controls WHERE device_code=? AND control_name=?`, [code, sName]);
            db.run(`DELETE FROM sensor_data WHERE device_code=? AND sensor_name=?`, [code, sName]);

            broadcastDeviceUpdate(code);
            res.json({ success: true, message: `Sensor '${sName}' berhasil dihapus` });
        });
    });
});

// ==========================
// AUTOMATION RULES API ENDPOINTS
// ==========================
app.get("/api/device/:code/rules", requireAuth, (req, res) => {
    const code = req.params.code;
    db.all(`SELECT * FROM device_rules WHERE device_code=? ORDER BY id DESC`, [code], (err, rows) => {
        if (err) return res.json({ success: false, message: err.message });
        res.json(rows || []);
    });
});

app.post("/api/device/:code/rules", requireAuth, (req, res) => {
    const code = req.params.code;
    const { rule_name, sensor_name, operator, trigger_value, target_relay, target_action } = req.body;

    if (!rule_name || !sensor_name || !operator || trigger_value === undefined || !target_relay || !target_action) {
        return res.json({ success: false, message: "Data aturan otomasi belum lengkap" });
    }

    const cleanRuleName = String(rule_name).trim();
    const cleanSensor = String(sensor_name).trim();
    const cleanOp = String(operator).trim();
    const trigVal = parseFloat(trigger_value) || 0;
    const cleanRelay = String(target_relay).trim();
    const cleanAction = String(target_action).toUpperCase() === "ON" ? "ON" : "OFF";
    const nowIso = new Date().toISOString();

    db.run(
        `INSERT INTO device_rules (device_code, rule_name, sensor_name, operator, trigger_value, target_relay, target_action, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [code, cleanRuleName, cleanSensor, cleanOp, trigVal, cleanRelay, cleanAction, nowIso],
        function (err) {
            if (err) return res.json({ success: false, message: err.message });
            res.json({ success: true, message: "Aturan otomasi berhasil ditambahkan", id: this.lastID });
        }
    );
});

app.delete("/api/device/:code/rules/:id", requireAuth, (req, res) => {
    const { code, id } = req.params;
    db.run(`DELETE FROM device_rules WHERE id=? AND device_code=?`, [id, code], function (err) {
        if (err) return res.json({ success: false, message: err.message });
        res.json({ success: true, message: "Aturan otomasi berhasil dihapus" });
    });
});

app.put("/api/device/:code/rules/:id/toggle", requireAuth, (req, res) => {
    const { code, id } = req.params;
    db.run(
        `UPDATE device_rules SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=? AND device_code=?`,
        [id, code],
        function (err) {
            if (err) return res.json({ success: false, message: err.message });
            res.json({ success: true, message: "Status aturan otomasi diperbarui" });
        }
    );
});

app.get("/api/device/:code/controls", (req, res) => {
    const code = req.params.code;

    db.all(`SELECT * FROM device_controls WHERE device_code=?`, [code], (err, rows) => {
        if (err) {
            return res.json({ success: false, message: err.message });
        }
        res.json(rows);
    });
});

app.get("/api/device/:code", requireAuth, (req, res) => {
    const code = req.params.code;
    verifyDeviceOwnership(req, res, code, (err, row) => {
        res.json(row);
    });
});

app.post("/api/control", requireAuth, (req, res) => {
    const { device_code, control_name, status } = req.body;

    verifyDeviceOwnership(req, res, device_code, (err, dev) => {
        const realCode = dev.device_code;
        db.get(
            `SELECT mode FROM device_sensors WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
            [realCode, control_name, control_name],
            (err2, row) => {
                if (row && row.mode === "AUTO") {
                    return res.json({
                        success: false,
                        message: "Relay/Kontrol dalam mode OTOMATIS (Timer). Sakelar manual terkunci. Silahkan ubah ke mode Manual terlebih dahulu."
                    });
                }

                db.run(
                    `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                     VALUES (
                        (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                        ?, ?, ?, ?
                     )`,
                    [realCode, control_name, realCode, control_name, String(status), new Date().toISOString()],
                    function (err3) {
                        if (err3) {
                            return res.json({ success: false, message: err3.message });
                        }

                        // Update last known value in device_sensors table for persistent UI state
                        db.run(
                            `UPDATE device_sensors SET value=? WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
                            [String(status), realCode, control_name, control_name]
                        );

                        // Save history log for numeric Dimmer / PWM status or ON/OFF
                        let numVal = Number(status);
                        if (!isNaN(numVal)) {
                            saveSensorHistory(realCode, control_name, numVal);
                        } else if (String(status).toUpperCase() === "ON") {
                            saveSensorHistory(realCode, control_name, 1);
                        } else if (String(status).toUpperCase() === "OFF") {
                            saveSensorHistory(realCode, control_name, 0);
                        }

                        // Broadcast control action to ESP32 hardware via MQTT & WebSocket, and update web UI
                        publishMqtt("botek/" + realCode + "/relay/" + control_name, String(status));
                        broadcastDeviceUpdate(realCode);

                        res.json({ success: true, status: String(status) });
                    }
                );
            }
        );
    });
});

function normalizeTimeStr(t) {
    if (!t) return "00:00";
    const parts = String(t).trim().split(":");
    if (parts.length < 2) return "00:00";
    const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
    const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
    return `${h}:${m}`;
}

app.put("/api/device/:code/relay/:id/mode", requireAuth, (req, res) => {
    const { code, id } = req.params;
    const { mode } = req.body;

    if (!mode) {
        return res.json({ success: false, message: "Mode kosong" });
    }

    verifyDeviceOwnership(req, res, code, (err, dev) => {
        db.run(
            `UPDATE device_sensors SET mode=? WHERE id=? AND device_code=?`,
            [mode, id, dev.device_code],
            function (err2) {
                if (err2) {
                    return res.json({ success: false, message: err2.message });
                }
                evaluateAutoRelays();
                res.json({ success: true, message: "Mode relay berhasil diubah" });
            }
        );
    });
});

app.put("/api/device/:code/relay/:id/config", requireAuth, (req, res) => {
    const { code, id } = req.params;
    const { mode, time_on, time_off } = req.body;

    const normTimeOn = normalizeTimeStr(time_on || '06:00');
    const normTimeOff = normalizeTimeStr(time_off || '18:00');

    verifyDeviceOwnership(req, res, code, (err, dev) => {
        const sql = mode 
            ? `UPDATE device_sensors SET mode=?, time_on=?, time_off=? WHERE id=? AND device_code=?` 
            : `UPDATE device_sensors SET time_on=?, time_off=? WHERE id=? AND device_code=?`;
        const params = mode 
            ? [mode, normTimeOn, normTimeOff, id, dev.device_code] 
            : [normTimeOn, normTimeOff, id, dev.device_code];

        db.run(sql, params, function (err2) {
            if (err2) {
                return res.json({ success: false, message: err2.message });
            }
            evaluateAutoRelays();
            res.json({ success: true, message: "Pengaturan jam timer berhasil disimpan" });
        });
    });
});

// ==========================
// AUTO OFFLINE DETECTOR
// ==========================
function checkDeviceOffline() {
    const limitTime = 15000; // 15 detik timeout jika hardware tidak terhubung/pings
    const now = Date.now();
    const connectedClientIds = Object.keys(aedes.clients || {});

    // Kumpulkan seluruh deviceCode yang terhubung via WebSocket
    const connectedWsDeviceCodes = new Set();
    wsClients.forEach(s => {
        if (s.deviceCode && s.readyState === WebSocket.OPEN) {
            connectedWsDeviceCodes.add(s.deviceCode);
        }
    });

    db.all(`SELECT * FROM devices`, [], (err, devices) => {
        if (err || !Array.isArray(devices)) return;

        devices.forEach(device => {
            const isMqttConnected = connectedClientIds.some(cid => 
                cid && (cid === device.device_code || cid.includes(device.device_code))
            );
            const isWsConnected = connectedWsDeviceCodes.has(device.device_code);
            const isConnected = isMqttConnected || isWsConnected;

            if (isConnected) {
                if (device.status !== "ONLINE") {
                    db.run(
                        `UPDATE devices SET status='ONLINE', last_seen=? WHERE id=?`,
                        [new Date().toISOString(), device.id],
                        (err) => {
                            if (!err) broadcastDeviceUpdate(device.device_code);
                        }
                    );
                }
            } else {
                const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : 0;
                const difference = now - lastSeen;

                if (difference > limitTime && device.status !== "OFFLINE") {
                    db.run(
                        `UPDATE devices SET status=? WHERE device_code=?`,
                        ["OFFLINE", device.device_code],
                        (err) => {
                            if (!err) broadcastDeviceUpdate(device.device_code);
                        }
                    );
                    console.log("Device OFFLINE:", device.device_code);
                }
            }
        });
    });
}

setInterval(checkDeviceOffline, 10000);

// ==========================
// AUTOMATIC RELAY SCHEDULER JOB (EDGE-TRIGGER / MENIT TEPAT)
// ==========================
const autoTimerExecuted = new Map();

function evaluateAutoRelays() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    db.all(
        `SELECT * FROM device_sensors WHERE sensor_type='Relay' AND mode='AUTO'`,
        [],
        (err, relays) => {
            if (err || !Array.isArray(relays)) return;

            relays.forEach(relay => {
                const timeOn = normalizeTimeStr(relay.time_on || '06:00');
                const timeOff = normalizeTimeStr(relay.time_off || '18:00');
                
                const relayKey = `${relay.device_code}_${relay.sensor_name}`;
                const executedKey = autoTimerExecuted.get(relayKey);

                // 1. Pemicu Tepat Pada Menit Jam ON (Misal 06:00)
                if (currentTimeStr === timeOn && executedKey !== `ON_${currentTimeStr}`) {
                    autoTimerExecuted.set(relayKey, `ON_${currentTimeStr}`);
                    
                    db.run(`UPDATE device_sensors SET value=1 WHERE id=?`, [relay.id]);
                    db.run(
                        `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                         VALUES (
                            (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                            ?, ?, ?, ?
                         )`,
                        [
                            relay.device_code,
                            relay.sensor_name,
                            relay.device_code,
                            relay.sensor_name,
                            'ON',
                            new Date().toISOString()
                        ]
                    );

                    const topic = `botek/${relay.device_code}/relay/${relay.sensor_name}`;
                    publishMqtt(topic, 'ON');
                    broadcastDeviceUpdate(relay.device_code);
                    console.log(`⏰ [AUTO TIMER EDGE] ${relay.device_code} - ${relay.sensor_name} -> ON (Jam ${currentTimeStr})`);
                }
                // 2. Pemicu Tepat Pada Menit Jam OFF (Misal 18:00)
                else if (currentTimeStr === timeOff && executedKey !== `OFF_${currentTimeStr}`) {
                    autoTimerExecuted.set(relayKey, `OFF_${currentTimeStr}`);
                    
                    db.run(`UPDATE device_sensors SET value=0 WHERE id=?`, [relay.id]);
                    db.run(
                        `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                         VALUES (
                            (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                            ?, ?, ?, ?
                         )`,
                        [
                            relay.device_code,
                            relay.sensor_name,
                            relay.device_code,
                            relay.sensor_name,
                            'OFF',
                            new Date().toISOString()
                        ]
                    );

                    const topic = `botek/${relay.device_code}/relay/${relay.sensor_name}`;
                    publishMqtt(topic, 'OFF');
                    broadcastDeviceUpdate(relay.device_code);
                    console.log(`⏰ [AUTO TIMER EDGE] ${relay.device_code} - ${relay.sensor_name} -> OFF (Jam ${currentTimeStr})`);
                }
            });
        }
    );
}

setInterval(evaluateAutoRelays, 2000);
evaluateAutoRelays();

// ==========================
// COUNTDOWN / SLEEP TIMER SCHEDULER
// ==========================
function evaluateCountdownTimers() {
    const nowMs = Date.now();

    db.all(
        `SELECT * FROM device_sensors WHERE sensor_type='Relay' AND countdown_end IS NOT NULL AND countdown_end != ''`,
        [],
        (err, relays) => {
            if (err || !Array.isArray(relays)) return;

            relays.forEach(relay => {
                const targetMs = new Date(relay.countdown_end).getTime();
                if (isNaN(targetMs)) return;

                if (nowMs >= targetMs) {
                    const targetAction = (relay.countdown_action || 'OFF').toUpperCase();
                    const targetValue = targetAction === 'ON' ? 1 : 0;

                    db.run(
                        `UPDATE device_sensors SET value=?, countdown_end=NULL, countdown_action=NULL WHERE id=?`,
                        [targetValue, relay.id]
                    );

                    db.run(
                        `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                         VALUES (
                            (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                            ?, ?, ?, ?
                         )`,
                        [
                            relay.device_code,
                            relay.sensor_name,
                            relay.device_code,
                            relay.sensor_name,
                            targetAction,
                            new Date().toISOString()
                        ]
                    );

                    const topic = `botek/${relay.device_code}/relay/${relay.sensor_name}`;
                    publishMqtt(topic, targetAction);
                    broadcastDeviceUpdate(relay.device_code);
                    console.log(`⏳ [COUNTDOWN EXPIRED] ${relay.device_code} - ${relay.sensor_name} -> ${targetAction}`);
                }
            });
        }
    );
}

setInterval(evaluateCountdownTimers, 1000);

// API Endpoint Countdown / Sleep Timer
app.post(["/api/sensor/:id/countdown", "/api/device/:code/relay/:id/countdown"], (req, res) => {
    const sensorId = req.params.id;
    const { minutes, action, cancel } = req.body;

    if (cancel) {
        db.run(
            `UPDATE device_sensors SET countdown_end=NULL, countdown_action=NULL WHERE id=?`,
            [sensorId],
            function(err) {
                if (err) return res.json({ success: false, message: err.message });
                db.get(`SELECT device_code FROM device_sensors WHERE id=?`, [sensorId], (e, row) => {
                    if (row) broadcastDeviceUpdate(row.device_code);
                });
                return res.json({ success: true, message: "Countdown dibatalkan" });
            }
        );
        return;
    }

    const minNum = parseInt(minutes, 10);
    if (isNaN(minNum) || minNum <= 0) {
        return res.json({ success: false, message: "Durasi menit tidak valid" });
    }

    const targetAction = (action || 'OFF').toUpperCase();
    const targetMs = Date.now() + (minNum * 60 * 1000);
    const targetIso = new Date(targetMs).toISOString();

    db.run(
        `UPDATE device_sensors SET countdown_end=?, countdown_action=? WHERE id=?`,
        [targetIso, targetAction, sensorId],
        function(err) {
            if (err) return res.json({ success: false, message: err.message });
            db.get(`SELECT device_code FROM device_sensors WHERE id=?`, [sensorId], (e, row) => {
                if (row) broadcastDeviceUpdate(row.device_code);
            });
            return res.json({
                success: true,
                message: `Countdown diatur ${minNum} menit`,
                countdown_end: targetIso,
                countdown_action: targetAction,
                minutes: minNum
            });
        }
    );
});

app.get("/test-server", (req, res) => {
    res.send("BOTEK SERVER PM2 AKTIF");
});

// ==========================
// GLOBAL ERROR PROTECTION
// ==========================
process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT ERROR:", err.message);
});

process.on("unhandledRejection", (err) => {
    console.log("UNHANDLED ERROR:", err);
});

// ==========================
// SERVER START & WEBSOCKET CLOUDFLARE ATTACHMENT
// ==========================
const mainServer = http.createServer(app);
const wssMain = new WebSocket.Server({ server: mainServer, path: "/mqtt" });

wssMain.on("connection", (socket) => {
    wsClients.add(socket);
    socket.isAlive = true;

    socket.on("pong", () => {
        socket.isAlive = true;
    });

    socket.on("message", (data, isBinary) => {
        socket.isAlive = true;
        const str = data ? data.toString().trim() : "";
        if (str.startsWith("{") && str.endsWith("}")) {
            try {
                const json = JSON.parse(str);
                const code = json.device_code;
                if (!code) return;

                socket.deviceCode = code;
                const nowIso = new Date().toISOString();

                // 1. Handle Telemetry Sensor Data (e.g. Voltage, Temperature, Humidity)
                const sensorName = json.sensor_name || json.metric || json.control_name;
                const rawVal = json.value !== undefined ? json.value : json.val;

                if (sensorName && rawVal !== undefined) {
                    const sNameClean = String(sensorName).trim();
                    const valueNum = parseFloat(rawVal);

                    if (!isNaN(valueNum)) {
                        db.run(
                            `UPDATE device_sensors SET value=? WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
                            [valueNum, code, sNameClean, sNameClean]
                        );
                        db.run(
                            `UPDATE devices SET status='ONLINE', last_seen=? WHERE device_code=?`,
                            [nowIso, code],
                            (err) => {
                                if (!err) broadcastDeviceUpdate(code);
                            }
                        );
                        saveSensorHistory(code, sNameClean, valueNum);
                    }
                }

                // 2. Handle Relay Control Data (e.g. Relay 1, Relay 2 ON/OFF)
                if (json.control_name && json.status) {
                    const controlName = String(json.control_name).trim();
                    const status = String(json.status).toUpperCase() === "ON" ? "ON" : "OFF";
                    const numericVal = status === "ON" ? 1 : 0;

                    db.run(
                        `UPDATE device_sensors SET value=? WHERE device_code=? AND (sensor_name=? OR LOWER(sensor_name)=LOWER(?))`,
                        [numericVal, code, controlName, controlName]
                    );
                    db.run(
                        `INSERT OR REPLACE INTO device_controls (id, device_code, control_name, status, created_at)
                         VALUES (
                            (SELECT id FROM device_controls WHERE device_code=? AND control_name=?),
                            ?, ?, ?, ?
                         )`,
                        [code, controlName, code, controlName, status, nowIso]
                    );
                    db.run(
                        `UPDATE devices SET status='ONLINE', last_seen=? WHERE device_code=?`,
                        [nowIso, code],
                        (err) => {
                            if (!err) broadcastDeviceUpdate(code);
                        }
                    );
                }
            } catch (e) {
                console.error("WSS JSON parse error:", e);
            }
        }
    });

    socket.on("close", () => {
        wsClients.delete(socket);
    });

    socket.on("error", () => {
        wsClients.delete(socket);
    });
});

// Periodic WebSocket Heartbeat Ping to eliminate dead/unplugged half-open TCP sockets (Every 10 seconds)
setInterval(() => {
    wssMain.clients.forEach((socket) => {
        if (socket.isAlive === false) {
            if (socket.deviceCode) {
                console.log(`🔌 [WS TIMEOUT] Dead WebSocket socket terminated for device: ${socket.deviceCode}`);
            }
            wsClients.delete(socket);
            return socket.terminate();
        }
        socket.isAlive = false;
        try { socket.ping(); } catch (e) {}
    });
}, 10000);

mainServer.listen(PORT, "0.0.0.0", () => {
    console.log(`
=================================
BOTEK IoT RUNNING
PORT        : ${PORT}
MQTT TCP    : ${mqttPort}
MQTT WS     : ${wsPort} & WSS /mqtt
=================================
    `);
});
