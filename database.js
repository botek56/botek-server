const sqlite3 = require("sqlite3").verbose();

// ==========================
// DATABASE CONNECTION
// ==========================
const db = new sqlite3.Database("sensor.db", (err) => {
    if (err) {
        console.log("Database error:", err);
    } else {
        console.log("Database connected");
        // Performance Pragmas
        db.run("PRAGMA journal_mode = WAL;");
        db.run("PRAGMA synchronous = NORMAL;");
        db.run("PRAGMA cache_size = -64000;");
        db.run("PRAGMA temp_store = MEMORY;");
    }
});

// ==========================
// USERS TABLE
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT,
    password TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'CLIENT',
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT
)
`);

db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {});
db.run(`ALTER TABLE users ADD COLUMN full_name TEXT`, (err) => {});
db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'CLIENT'`, (err) => {});
db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'`, (err) => {});
db.run(`ALTER TABLE users ADD COLUMN created_at TEXT`, (err) => {});
db.run(`ALTER TABLE users ADD COLUMN last_login TEXT`, (err) => {});

// ==========================
// DEVICES TABLE
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT UNIQUE,
    device_name TEXT,
    user_id INTEGER DEFAULT 1,
    location TEXT,
    type TEXT,
    sensor_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'OFFLINE',
    last_seen TEXT,
    created_at TEXT
)
`);

db.run(`ALTER TABLE devices ADD COLUMN user_id INTEGER DEFAULT 1`, (err) => {});
db.run(`ALTER TABLE devices ADD COLUMN last_seen TEXT`, (err) => {});
db.run(`ALTER TABLE devices ADD COLUMN created_at TEXT`, (err) => {});

// ==========================
// DEVICE SENSOR CONFIG
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS device_sensors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT,
    sensor_name TEXT,
    sensor_type TEXT,
    unit TEXT,
    icon TEXT DEFAULT '📊',
    sensor_order INTEGER DEFAULT 0,
    value REAL DEFAULT 0,
    mode TEXT DEFAULT 'MANUAL',
    time_on TEXT DEFAULT '06:00',
    time_off TEXT DEFAULT '18:00',
    created_at TEXT
)
`);

db.run(`ALTER TABLE device_sensors ADD COLUMN icon TEXT`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN sensor_order INTEGER DEFAULT 0`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN mode TEXT DEFAULT 'MANUAL'`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN time_on TEXT DEFAULT '06:00'`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN time_off TEXT DEFAULT '18:00'`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN countdown_end TEXT`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN countdown_action TEXT DEFAULT 'OFF'`, (err) => {});
db.run(`ALTER TABLE device_sensors ADD COLUMN created_at TEXT`, (err) => {});

// ==========================
// DEVICE CONTROL RELAY
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS device_controls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT,
    control_name TEXT,
    status TEXT DEFAULT 'OFF',
    created_at TEXT
)
`);

db.run(`ALTER TABLE device_controls ADD COLUMN created_at TEXT`, (err) => {});

db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_device_controls ON device_controls(device_code, control_name)`, (err) => {});

// ==========================
// SENSOR HISTORY
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT,
    sensor_name TEXT,
    value REAL,
    time TEXT
)
`);

// ==========================
// SMART AUTOMATION RULES
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS device_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT,
    rule_name TEXT,
    sensor_name TEXT,
    operator TEXT,
    trigger_value REAL,
    target_relay TEXT,
    target_action TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT
)
`);

// ==========================
// DEVICE SETTINGS (ESP32 CONFIG)
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS device_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT,
    setting_name TEXT,
    setting_value TEXT,
    created_at TEXT
)
`);

// ==========================
// SYSTEM ANNOUNCEMENTS & MAINTENANCE BROADCAST
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS system_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    message TEXT,
    type TEXT DEFAULT 'MAINTENANCE',
    is_active INTEGER DEFAULT 0,
    created_at TEXT
)
`);

// ==========================
// GLOBAL SYSTEM SETTINGS
// ==========================
db.run(`
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
)
`);

// ==========================
// DATABASE PERFORMANCE INDEXES
// ==========================
db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_data_dev_time ON sensor_data(device_code, time DESC)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_data_name ON sensor_data(sensor_name)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_device_sensors_dev ON device_sensors(device_code)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_device_rules_dev ON device_rules(device_code)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

db.serialize(() => {
    // Seed default admin account
    db.run(
        `INSERT OR IGNORE INTO users (id, username, email, password, full_name, role, status, created_at)
         VALUES (1, 'admin', 'admin@botek.my.id', 'admin123', 'Super Admin', 'SUPER_ADMIN', 'ACTIVE', ?)`,
        [new Date().toISOString()]
    );
    db.run(`UPDATE users SET role = 'SUPER_ADMIN' WHERE username = 'admin'`);

    // Update existing devices user_id if null
    db.run(`UPDATE devices SET user_id = 1 WHERE user_id IS NULL OR user_id = 0`);

    // Seed default notification settings
    const defaultSettings = [
        ['admin_email', 'admin@botek.my.id'],
        ['admin_wa_number', ''],
        ['notify_email_enabled', '0'],
        ['notify_wa_enabled', '0'],
        ['smtp_host', 'smtp.gmail.com'],
        ['smtp_port', '465'],
        ['smtp_user', ''],
        ['smtp_pass', ''],
        ['wa_token', ''],
        ['wa_gateway_url', 'https://api.fonnte.com/send']
    ];

    const stmt = db.prepare(`INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)`);
    const nowIso = new Date().toISOString();
    defaultSettings.forEach(([key, val]) => {
        stmt.run(key, val, nowIso);
    });
    stmt.finalize();

    console.log("Database structure & Multi-Tenant seeds ready");
});

module.exports = db;