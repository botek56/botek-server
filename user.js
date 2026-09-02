const db = require("./database");
let bcrypt;
try {
    bcrypt = require("bcrypt");
} catch (e) {
    bcrypt = require("bcryptjs");
}

async function createAdmin() {
    try {
        const password = await bcrypt.hash("admin123", 10);
        db.run(
            `INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
            ["admin", password, "admin"],
            function (err) {
                if (err) {
                    console.log("Admin error:", err.message);
                } else {
                    console.log("Admin user ready");
                }
            }
        );
    } catch (err) {
        console.log("Password hash error:", err);
    }
}

// Beri jeda agar tabel database selesai dibuat
setTimeout(() => {
    createAdmin();
}, 1000);