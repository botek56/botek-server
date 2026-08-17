// ======================
// CHECK LOGIN & AUTH
// ======================

window.currentUser = null;

async function checkLogin() {
    try {
        const response = await fetch("/api/session?t=" + Date.now(), { cache: "no-store" });
        const data = await response.json();

        const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname === "/login";

        if (!data.login) {
            if (!isLoginPage) {
                window.location.href = "login.html";
            }
        } else {
            window.currentUser = data.user;
            if (isLoginPage) {
                window.location.href = "index.html";
            } else {
                updateNavUser();
            }
        }
    } catch (err) {
        console.error("Session check error:", err);
        const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname === "/login";
        if (!isLoginPage) {
            window.location.href = "login.html";
        }
    }
}

function updateNavUser() {
    if (window.currentUser) {
        const isAdmin = window.currentUser.role === "SUPER_ADMIN" || window.currentUser.username === "admin";
        const userSpan = document.getElementById("navUsername");
        if (userSpan) {
            const roleBadge = isAdmin 
                ? `<span style="font-size: 10px; background: rgba(245, 158, 11, 0.2); color: var(--blynk-amber); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 6px; border-radius: 10px; margin-left: 4px; font-weight: 800;">ADMIN</span>` 
                : `<span style="font-size: 10px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; border-radius: 10px; margin-left: 4px; font-weight: 700;">KLIEN</span>`;
            
            userSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ` + window.currentUser.username + roleBadge;
            userSpan.style.cursor = "pointer";
            userSpan.title = "Klik untuk ubah password akun Anda";
            userSpan.onclick = openSelfChangePasswordModal;
        }

        // If Super Admin, inject a "👑 Kelola User" button into nav actions if not present
        if (isAdmin) {
            const userArea = document.querySelector(".user-area") || document.querySelector(".nav-menu");
            if (userArea && !document.getElementById("btnAdminPanel")) {
                const btn = document.createElement("button");
                btn.id = "btnAdminPanel";
                btn.type = "button";
                btn.className = "btn-secondary";
                btn.style.cssText = "font-size: 11.5px; padding: 5px 11px; background: rgba(245, 158, 11, 0.18); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); display: inline-flex; align-items: center; gap: 5px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-right: 8px; box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);";
                btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 👑 <span data-i18n="nav_user_management">${typeof t === 'function' ? t('nav_user_management', 'Kelola Pengguna') : 'Kelola Pengguna'}</span>`;
                btn.onclick = openAdminUserModal;
                userArea.insertBefore(btn, userArea.firstChild);
            }
        }

        // Inject Language Switcher pill into navbar if not present
        const userAreaContainer = document.querySelector(".user-area");
        if (userAreaContainer && !document.getElementById("navLangSwitcherContainer")) {
            const langContainer = document.createElement("div");
            langContainer.id = "navLangSwitcherContainer";
            langContainer.style.marginRight = "8px";
            langContainer.style.display = "inline-flex";
            userAreaContainer.insertBefore(langContainer, userAreaContainer.firstChild);
            if (typeof renderLangSwitcher === "function") {
                renderLangSwitcher("navLangSwitcherContainer");
            }
        } else if (typeof renderLangSwitcher === "function") {
            renderLangSwitcher("navLangSwitcherContainer");
        }
    }
}

// Auto update navbar username once DOM is fully loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateNavUser);
} else {
    updateNavUser();
}

// ======================
// SUPER ADMIN USER MANAGEMENT MODAL
// ======================
function formatUserLastLogin(isoStr, isSelf, isOnline) {
    if (isOnline) {
        return `<span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(16, 185, 129, 0.15); color: var(--blynk-green); border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 10px; border-radius: 20px; font-weight: 700; font-size: 11px; text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--blynk-green); box-shadow: 0 0 8px var(--blynk-green);"></span> ${t("online_now", "Sedang Login")}
        </span>`;
    }

    if (!isoStr) {
        return `<span style="color: var(--text-muted); font-size: 12px;">${t("never_seen", "Belum Pernah")}</span>`;
    }

    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
        return `<span style="color: var(--text-muted); font-size: 12px;">-</span>`;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const monthNamesId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentLang = typeof getLanguage === 'function' ? getLanguage() : 'id';
    const month = currentLang === 'en' ? monthNamesEn[d.getMonth()] : monthNamesId[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');

    return `<span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">${day} ${month} ${year}, ${hours}:${mins}</span>`;
}

let adminModalRefreshInterval = null;

function closeAdminUserModal() {
    const modal = document.getElementById("adminUserModal");
    if (modal) modal.style.display = "none";
    if (adminModalRefreshInterval) {
        clearInterval(adminModalRefreshInterval);
        adminModalRefreshInterval = null;
    }
}

async function openAdminUserModal() {
    if (adminModalRefreshInterval) {
        clearInterval(adminModalRefreshInterval);
        adminModalRefreshInterval = null;
    }

    let modal = document.getElementById("adminUserModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "adminUserModal";
        modal.className = "modal-overlay";
        modal.style.display = "none";
        modal.innerHTML = `
        <div class="modal-box" style="max-width: 1380px; width: 96%;">
            <div class="modal-header">
                <h3 style="display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; color: #fff;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-amber)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <span data-i18n="user_mgmt_modal_title">${t("user_mgmt_modal_title", "Manajemen Pengguna BOTEK (Super Admin)")}</span>
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; padding: 2px 8px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: var(--blynk-green); border: 1px solid rgba(16, 185, 129, 0.3); margin-left: 6px; font-weight: 700;">
                        <span class="pulse-dot"></span> LIVE REAL-TIME
                    </span>
                </h3>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" onclick="openAdminBroadcastModal()" style="padding: 6px 12px; border-radius: 8px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Siarkan pengumuman server/maintenance ke semua pengguna">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        <span>Broadcast Maintenance</span>
                    </button>
                    <button type="button" class="modal-close-btn" onclick="closeAdminUserModal()">✖</button>
                </div>
            </div>
            <div class="modal-body" style="padding: 20px 24px;">
                <!-- SERVER SYSTEM HEALTH METRICS -->
                <div id="adminServerStatsContainer" style="margin-bottom: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
                    <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 14px; padding: 14px 16px; position: relative; overflow: hidden;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;" data-i18n="stat_ram">${t("stat_ram", "RAM Server")}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                        </div>
                        <div style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-top: 6px; letter-spacing: -0.5px;" id="statRamVal">- %</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;" id="statRamSub">- GB / - GB</div>
                    </div>
                    <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 14px; padding: 14px 16px; position: relative; overflow: hidden;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;" data-i18n="stat_cpu">${t("stat_cpu", "Beban CPU")}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line></svg>
                        </div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--blynk-amber); margin-top: 6px; letter-spacing: -0.5px;" id="statCpuVal">- %</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;" id="statCpuSub">- Cores Active</div>
                    </div>
                    <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 14px; padding: 14px 16px; position: relative; overflow: hidden;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;" data-i18n="stat_db">${t("stat_db", "Ukuran DB")}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M21 19c0 1.66-4 3-9 3s-9-1.34-9-3"></path></svg>
                        </div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--blynk-green); margin-top: 6px; letter-spacing: -0.5px;" id="statDbVal">- MB</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">sensor.db (SQLite)</div>
                    </div>
                    <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 14px; padding: 14px 16px; position: relative; overflow: hidden;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;" data-i18n="stat_uptime">${t("stat_uptime", "Uptime Server")}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div style="font-size: 20px; font-weight: 800; color: #a855f7; margin-top: 6px; letter-spacing: -0.5px;" id="statUptimeVal">-</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">BOTEK Node.js Engine</div>
                    </div>
                </div>

                <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;" data-i18n="user_mgmt_modal_desc">
                    ${t("user_mgmt_modal_desc", "Daftar seluruh akun Klien & Admin terdaftar pada server BOTEK:")}
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.6px;">
                                <th style="padding: 12px 10px; width: 22%;" data-i18n="col_user">${t("col_user", "Pengguna")}</th>
                                <th style="padding: 12px 10px; width: 14%; white-space: nowrap;" data-i18n="col_role">${t("col_role", "Peran")}</th>
                                <th style="padding: 12px 10px; width: 26%; white-space: nowrap;" data-i18n="col_user_usage">${t("col_user_usage", "Pemakaian User")}</th>
                                <th style="padding: 12px 10px; width: 12%; white-space: nowrap;" data-i18n="col_status">${t("col_status", "Status")}</th>
                                <th style="padding: 12px 10px; width: 14%; white-space: nowrap;" data-i18n="col_last_login">${t("col_last_login", "Terakhir Login")}</th>
                                <th style="padding: 12px 10px; width: 12%; text-align: right; white-space: nowrap;" data-i18n="col_action">${t("col_action", "Aksi")}</th>
                            </tr>
                        </thead>
                        <tbody id="adminUserTableBody">
                            <tr><td colspan="6" style="padding: 20px; text-align: center;">${t("loading_users", "Memuat daftar pengguna...")}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer" style="padding: 14px 24px; display: flex; justify-content: flex-end; border-top: 1px solid var(--border-color);">
                <button class="btn-secondary" onclick="closeAdminUserModal()" data-i18n="cancel_btn">${t("cancel_btn", "Tutup")}</button>
            </div>
        </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = "flex";
    loadAdminUserList();

    adminModalRefreshInterval = setInterval(() => {
        const m = document.getElementById("adminUserModal");
        if (m && m.style.display !== "none") {
            loadAdminUserList();
        } else {
            if (adminModalRefreshInterval) {
                clearInterval(adminModalRefreshInterval);
                adminModalRefreshInterval = null;
            }
        }
    }, 6000);
}

async function loadAdminUserList() {
    const tbody = document.getElementById("adminUserTableBody");
    if (!tbody) return;

    try {
        const response = await fetch("/api/admin/users?_=" + Date.now());
        const data = await response.json();
        const users = data.users || (Array.isArray(data) ? data : []);
        const stats = data.stats;

        if (stats) {
            const ramVal = document.getElementById("statRamVal");
            const ramSub = document.getElementById("statRamSub");
            const cpuVal = document.getElementById("statCpuVal");
            const cpuSub = document.getElementById("statCpuSub");
            const dbVal = document.getElementById("statDbVal");
            const uptimeVal = document.getElementById("statUptimeVal");

            if (ramVal) ramVal.innerText = `${stats.mem_percent}%`;
            if (ramSub) ramSub.innerText = `${stats.used_mem_gb} GB / ${stats.total_mem_gb} GB (Proc: ${stats.process_mem_mb} MB)`;
            if (cpuVal) cpuVal.innerText = `${stats.cpu_percent}%`;
            if (cpuSub) cpuSub.innerText = `${stats.cpu_count} Cores Active`;
            if (dbVal) dbVal.innerText = `${stats.db_size_mb} MB`;
            if (uptimeVal) uptimeVal.innerText = stats.uptime_str;
        }

        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">${t("no_users_found", "Belum ada pengguna terdaftar")}</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isSelf = window.currentUser && window.currentUser.id == u.id;
            const isActive = u.status === "ACTIVE";
            const roleBadge = u.role === "SUPER_ADMIN" 
                ? `<span style="background: rgba(245, 158, 11, 0.15); color: var(--blynk-amber); padding: 4px 10px; border-radius: 20px; font-weight: 800; font-size: 11px; white-space: nowrap; border: 1px solid rgba(245, 158, 11, 0.35); display: inline-block;">SUPER ADMIN</span>` 
                : `<span style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 11px; white-space: nowrap; border: 1px solid rgba(56, 189, 248, 0.3); display: inline-block;">${t("role_client", "KLIEN")}</span>`;

            const safePass = (u.password || '').replace(/'/g, "\\'");

            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 12px 10px; vertical-align: middle;">
                    <div style="font-weight: 700; color: #fff; font-size: 13.5px;">${u.full_name || u.username}</div>
                    <div style="font-size: 11.5px; color: var(--text-muted);">${u.email || '@' + u.username}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: middle;">${roleBadge}</td>
                <td style="padding: 12px 10px; vertical-align: middle;">
                    <div style="display: grid; grid-template-columns: auto auto; gap: 4px 12px; max-width: 220px;">
                        <span style="font-size: 11.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> <b style="color: #fff;">${u.device_count || 0}</b> dev</span>
                        <span style="font-size: 11.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"></path></svg> <b style="color: #fff;">${u.sensor_count || 0}</b> sensor</span>
                        <span style="font-size: 11.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-amber)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> <b style="color: #fff;">${u.rule_count || 0}</b> rule</span>
                        <span style="font-size: 11.5px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> <b style="color: #fff;">${(u.log_count || 0).toLocaleString()}</b> log <span style="font-size: 10.5px; color: #a855f7;">(${u.log_size_mb || 0} MB)</span></span>
                    </div>
                </td>
                <td style="padding: 12px 10px; vertical-align: middle;">
                    <span style="white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: ${isActive ? 'var(--blynk-green)' : '#ef4444'};">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: ${isActive ? 'var(--blynk-green)' : '#ef4444'}; box-shadow: 0 0 8px ${isActive ? 'var(--blynk-green)' : '#ef4444'}; display: inline-block;"></span>
                        ${isActive ? t("status_active", "Aktif") : t("status_inactive", "Suspended")}
                    </span>
                </td>
                <td style="padding: 12px 10px; vertical-align: middle; white-space: nowrap;">
                    ${formatUserLastLogin(u.last_login, isSelf, u.is_online)}
                </td>
                <td style="padding: 12px 10px; vertical-align: middle; text-align: right; white-space: nowrap;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center; flex-wrap: nowrap;">
                        <button class="btn-secondary" onclick="openAdminChangePasswordModal(${u.id}, '${(u.username || '').replace(/'/g, "\\'")}', '${safePass}')" style="font-size: 11px; padding: 5px 9px; background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; white-space: nowrap; font-weight: 600; display: inline-flex; align-items: center;" title="${t("change_user_pass_title", "Ubah Password User")}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M21 2l-2 2m-1.5 1.5L4 19l-2 2 2-2 1.5-1.5M15.5 7.5l3 3M18.5 4.5l3 3"></path><circle cx="7.5" cy="16.5" r="3.5"></circle></svg>${t("password_label", "Kata Sandi")}
                        </button>
                        <button class="btn-secondary" onclick="deleteAdminUserLogs(${u.id}, '${(u.username || '').replace(/'/g, "\\'")}')" style="font-size: 11px; padding: 5px 9px; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px; white-space: nowrap; font-weight: 600; display: inline-flex; align-items: center;" title="${t("clear_user_logs_title", "Bersihkan Log Sensor User")}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>${t("btn_clear_logs", "Hapus Log")}
                        </button>
                        ${isSelf ? `<span style="font-size: 11px; color: var(--text-muted); padding: 0 4px; white-space: nowrap;">(${t("your_account", "Akun Anda")})</span>` : `
                            <button class="btn-secondary" onclick="toggleAdminUserStatus(${u.id})" style="font-size: 11px; padding: 5px 9px; border-radius: 8px; white-space: nowrap; font-weight: 600; display: inline-flex; align-items: center;">
                                ${isActive 
                                    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>${t("btn_deactivate", "Nonaktifkan")}`
                                    : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>${t("btn_activate", "Aktifkan")}`}
                            </button>
                            <button class="btn-secondary" onclick="deleteAdminUser(${u.id}, '${(u.username || '').replace(/'/g, "\\'")}')" style="font-size: 11px; padding: 5px 9px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; white-space: nowrap; font-weight: 600; display: inline-flex; align-items: center;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>${t("btn_delete", "Hapus")}
                            </button>
                        `}
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--danger);">${err.message}</td></tr>`;
    }
}

async function deleteAdminUserLogs(userId, username) {
    const sure = await showConfirmModal({
        title: t("clear_user_logs_title", "Bersihkan Riwayat Log User"),
        message: t("confirm_delete_logs", `Apakah Anda yakin ingin menghapus seluruh riwayat log sensor untuk user "${username}"?`),
        icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
        confirmText: t("btn_clear_logs", "Hapus Log"),
        cancelText: t("cancel_btn", "Batal"),
        isDanger: true
    });

    if (!sure) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/logs`, { method: "DELETE" });
        const res = await response.json();

        if (res.success) {
            if (typeof showToast === "function") {
                showToast(res.message || "Log data sensor berhasil dihapus!", "success");
            }
            loadAdminUserList();
        } else {
            if (typeof showToast === "function") {
                showToast(res.message || "Gagal menghapus log", "error");
            }
        }
    } catch (e) {
        if (typeof showToast === "function") {
            showToast("Gagal menghapus log: " + e.message, "error");
        }
    }
}

function openAdminChangePasswordModal(userId, username, currentPassword) {
    let overlay = document.getElementById("changePasswordModalOverlay");
    if (overlay) overlay.remove();

    const isBcrypt = currentPassword && (currentPassword.startsWith("$2b$") || currentPassword.startsWith("$2a$"));
    const displayOldPass = currentPassword || "(Belum diset)";

    overlay = document.createElement("div");
    overlay.id = "changePasswordModalOverlay";
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="confirm-modal-box" style="max-width: 440px; width: 92%; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="font-weight: 700; font-size: 16px; color: #fff; display: flex; align-items: center; gap: 8px;">
                    🔑 Ubah Password Pengguna
                </div>
                <button type="button" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px;" onclick="document.getElementById('changePasswordModalOverlay').remove()">✖</button>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                Informasi & pembaruan password untuk akun <b style="color: var(--blynk-amber);">${username}</b>:
            </div>
            
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Password Saat Ini / Lama</label>
                <div style="position: relative;">
                    <input type="password" readonly value="${displayOldPass}" id="adminOldPasswordInput" style="width: 100%; padding: 10px 38px 10px 12px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.08); color: #f59e0b; font-weight: 700; font-size: 13px; box-sizing: border-box;">
                    <span onclick="togglePasswordVisibility('adminOldPasswordInput', this)" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); font-size: 14px;">👁️</span>
                </div>
                ${isBcrypt 
                    ? '<div style="font-size: 11px; color: #38bdf8; margin-top: 4px;">🛡️ Password tersimpan dengan enkripsi Hash (Bcrypt). Klik ikon 👁️ untuk melihat string hash.</div>' 
                    : '<div style="font-size: 11px; color: #f59e0b; margin-top: 4px;">⚠️ Password tersimpan dalam teks langsung. Klik 👁️ untuk melihat teks password.</div>'}
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Password Baru</label>
                <div style="position: relative;">
                    <input type="password" id="adminNewPasswordInput" placeholder="Minimal 4 karakter" style="width: 100%; padding: 10px 38px 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; box-sizing: border-box;">
                    <span onclick="togglePasswordVisibility('adminNewPasswordInput', this)" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); font-size: 14px;">👁️</span>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('changePasswordModalOverlay').remove()" style="padding: 8px 16px;">Batal</button>
                <button type="button" class="btn-confirm-primary" id="btnSaveAdminPassword" style="padding: 8px 16px; background: var(--blynk-green); color: #000; font-weight: 700; border: none; border-radius: 8px; cursor: pointer;">Simpan Password</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("btnSaveAdminPassword").onclick = async () => {
        const pass = document.getElementById("adminNewPasswordInput").value;
        if (!pass || pass.trim().length < 4) {
            showToast("Password baru minimal 4 karakter", "error");
            return;
        }

        try {
            const res = await fetch("/api/admin/users/" + userId + "/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: pass.trim() })
            });
            const data = await res.json();
            if (data && data.success) {
                showToast(data.message, "success");
                overlay.remove();
                loadAdminUserList();
            } else {
                showToast(data.message || "Gagal mengubah password", "error");
            }
        } catch (e) {
            showToast("Gagal terhubung ke server", "error");
        }
    };
}

function openSelfChangePasswordModal() {
    let overlay = document.getElementById("selfChangePasswordModalOverlay");
    if (overlay) overlay.remove();

    const username = window.currentUser ? window.currentUser.username : "Anda";

    overlay = document.createElement("div");
    overlay.id = "selfChangePasswordModalOverlay";
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="confirm-modal-box" style="max-width: 420px; width: 90%; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="font-weight: 700; font-size: 16px; color: #fff; display: flex; align-items: center; gap: 8px;">
                    🔑 Ubah Password Akun Saya
                </div>
                <button type="button" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px;" onclick="document.getElementById('selfChangePasswordModalOverlay').remove()">✖</button>
            </div>
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
                Ubah password akun <b style="color: #38bdf8;">${username}</b>:
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Password Saat Ini</label>
                <div style="position: relative;">
                    <input type="password" id="selfOldPasswordInput" placeholder="Masukkan password lama" style="width: 100%; padding: 10px 38px 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; box-sizing: border-box;">
                    <span onclick="togglePasswordVisibility('selfOldPasswordInput', this)" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); font-size: 14px;">👁️</span>
                </div>
            </div>
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">Password Baru</label>
                <div style="position: relative;">
                    <input type="password" id="selfNewPasswordInput" placeholder="Minimal 4 karakter" style="width: 100%; padding: 10px 38px 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; box-sizing: border-box;">
                    <span onclick="togglePasswordVisibility('selfNewPasswordInput', this)" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); font-size: 14px;">👁️</span>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                <button type="button" class="btn-secondary" onclick="document.getElementById('selfChangePasswordModalOverlay').remove()" style="padding: 8px 16px;">Batal</button>
                <button type="button" class="btn-confirm-primary" id="btnSaveSelfPassword" style="padding: 8px 16px; background: var(--blynk-green); color: #000; font-weight: 700; border: none; border-radius: 8px; cursor: pointer;">Perbarui Password</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("btnSaveSelfPassword").onclick = async () => {
        const oldPass = document.getElementById("selfOldPasswordInput").value;
        const newPass = document.getElementById("selfNewPasswordInput").value;

        if (!oldPass) {
            showToast("Masukkan password saat ini", "error");
            return;
        }
        if (!newPass || newPass.trim().length < 4) {
            showToast("Password baru minimal 4 karakter", "error");
            return;
        }

        try {
            const res = await fetch("/api/user/change-password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass.trim() })
            });
            const data = await res.json();
            if (data && data.success) {
                showToast(data.message, "success");
                overlay.remove();
            } else {
                showToast(data.message || "Gagal mengubah password", "error");
            }
        } catch (e) {
            showToast("Gagal terhubung ke server", "error");
        }
    };
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        btn.innerText = "🙈";
    } else {
        input.type = "password";
        btn.innerText = "👁️";
    }
}


async function toggleAdminUserStatus(userId) {
    try {
        const response = await fetch("/api/admin/users/" + userId + "/status", {
            method: "PUT"
        });
        const result = await response.json();
        if (result && result.success) {
            showToast(result.message, "info");
            loadAdminUserList();
        } else {
            showToast(result.message || "Gagal mengubah status", "error");
        }
    } catch (e) {
        console.error("Toggle user status error:", e);
    }
}

async function deleteAdminUser(userId, username) {
    const sure = await showConfirmModal({
        title: "Konfirmasi Hapus Akun",
        message: `Apakah Anda yakin ingin menghapus akun '${username}' secara permanen? Seluruh akses pengguna ini akan dihapus.`,
        icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
        confirmText: "Ya, Hapus Akun",
        cancelText: "Batal",
        isDanger: true
    });

    if (!sure) return;

    try {
        const response = await fetch("/api/admin/users/" + userId, {
            method: "DELETE"
        });
        const result = await response.json();
        if (result && result.success) {
            showToast(result.message, "info");
            loadAdminUserList();
        } else {
            showToast(result.message || "Gagal menghapus pengguna", "error");
        }
    } catch (e) {
        console.error("Delete user error:", e);
        showToast("Gagal terhubung ke server", "error");
    }
}

async function logout() {
    const sure = await showConfirmModal({
        title: "Konfirmasi Logout",
        message: "Apakah Anda yakin ingin keluar dari BOTEK IoT Console?",
        icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
        confirmText: "Ya, Logout",
        cancelText: "Batal",
        isDanger: true
    });

    if (!sure) return;

    try {
        await fetch("/api/logout?_=" + Date.now(), { cache: "no-store" });
    } catch(e) {}

    try {
        sessionStorage.clear();
        localStorage.clear();
        document.cookie = "connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch(e) {}

    window.currentUser = null;
    window.location.href = "/logout";
}

window.logout = logout;

// ======================
// CUSTOM TOAST & POPUP NOTIFICATION SYSTEM
// ======================

function ensureToastContainer() {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = "info", icon = "") {
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `custom-toast ${type}`;

    let iconSymbol = icon;
    if (!iconSymbol) {
        if (type === "success") iconSymbol = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        else if (type === "error") iconSymbol = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        else if (type === "warning") iconSymbol = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-amber)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        else iconSymbol = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blynk-blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <span class="custom-toast-icon">${iconSymbol}</span>
        <div class="custom-toast-content">${message}</div>
        <span class="custom-toast-close" onclick="this.parentElement.remove()">✖</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px) scale(0.95)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Custom Async Confirm Modal Popup
function showConfirmModal({ title = "Konfirmasi Tindakan", message = "Apakah Anda yakin?", icon = "?", confirmText = "Ya, Lanjutkan", cancelText = "Batal", isDanger = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modalBox = document.createElement("div");
        modalBox.className = "confirm-modal-box";

        modalBox.innerHTML = `
            <div class="confirm-modal-icon">${icon}</div>
            <div class="confirm-modal-title">${title}</div>
            <div class="confirm-modal-message">${message}</div>
            <div class="confirm-modal-actions">
                <button type="button" class="btn-secondary cancel-btn">${cancelText}</button>
                <button type="button" class="${isDanger ? 'btn-confirm-danger' : 'btn-confirm-primary'} confirm-btn">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(modalBox);
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        modalBox.querySelector(".cancel-btn").onclick = () => close(false);
        modalBox.querySelector(".confirm-btn").onclick = () => close(true);
        overlay.onclick = (e) => {
            if (e.target === overlay) close(false);
        };
    });
}

// Custom Async Alert Modal Popup
function showAlertModal({ title = "Informasi", message = "", icon = "ℹ️", buttonText = "OK, Mengerti" }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modalBox = document.createElement("div");
        modalBox.className = "confirm-modal-box";

        modalBox.innerHTML = `
            <div class="confirm-modal-icon">${icon}</div>
            <div class="confirm-modal-title">${title}</div>
            <div class="confirm-modal-message">${message}</div>
            <div class="confirm-modal-actions">
                <button type="button" class="btn-confirm-primary confirm-btn">${buttonText}</button>
            </div>
        `;

        overlay.appendChild(modalBox);
        document.body.appendChild(overlay);

        const close = () => {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 200);
            resolve(true);
        };

        modalBox.querySelector(".confirm-btn").onclick = close;
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };
    });
}

// Custom Async Prompt Modal Popup
function showPromptModal({ title = "Ubah Nama", message = "Masukkan nama baru:", defaultValue = "", icon = "✏️", confirmText = "Simpan", cancelText = "Batal" }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modalBox = document.createElement("div");
        modalBox.className = "confirm-modal-box";

        modalBox.innerHTML = `
            <div class="confirm-modal-icon">${icon}</div>
            <div class="confirm-modal-title">${title}</div>
            <div class="confirm-modal-message">${message}</div>
            <div style="margin: 10px 0;">
                <input type="text" class="prompt-input" value="${String(defaultValue).replace(/"/g, '&quot;')}" style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.06); border: 1px solid var(--blynk-green); border-radius: var(--radius-md); color: #ffffff; font-size: 14px; text-align: center; outline: none; box-shadow: 0 0 10px rgba(0, 229, 153, 0.15);">
            </div>
            <div class="confirm-modal-actions">
                <button type="button" class="btn-secondary cancel-btn">${cancelText}</button>
                <button type="button" class="btn-confirm-primary confirm-btn">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(modalBox);
        document.body.appendChild(overlay);

        const input = modalBox.querySelector(".prompt-input");
        setTimeout(() => {
            if (input) {
                input.focus();
                input.select();
            }
        }, 50);

        const close = (result) => {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 200);
            resolve(result);
        };

        modalBox.querySelector(".cancel-btn").onclick = () => close(null);
        modalBox.querySelector(".confirm-btn").onclick = () => {
            const val = input.value.trim();
            close(val ? val : null);
        };
        input.onkeypress = (e) => {
            if (e.key === "Enter") {
                const val = input.value.trim();
                close(val ? val : null);
            }
        };
        overlay.onclick = (e) => {
            if (e.target === overlay) close(null);
        };
    });
}

// Global window.alert replacement with Glassmorphic Center Popup Modal!
window.alert = function(msg) {
    if (!msg) return;
    let icon = "🔔";
    let title = "Pemberitahuan BOTEK IoT";
    let cleanMsg = String(msg);

    if (cleanMsg.includes("✅")) {
        icon = "✅";
        title = "Berhasil";
        cleanMsg = cleanMsg.replace("✅", "").trim();
    } else if (cleanMsg.includes("❌")) {
        icon = "❌";
        title = "Gagal / Error";
        cleanMsg = cleanMsg.replace("❌", "").trim();
    } else if (cleanMsg.includes("Harap") || cleanMsg.includes("Pilih") || cleanMsg.includes("Lengkapi")) {
        icon = "⚠️";
        title = "Perhatian";
    }

    showAlertModal({
        title: title,
        message: cleanMsg,
        icon: icon,
        buttonText: "OK, Mengerti"
    });
};

// Explicit global exports
window.showConfirmModal = showConfirmModal;
window.showAlertModal = showAlertModal;
window.showPromptModal = showPromptModal;

// Global window.prompt override
window.prompt = function(message, defaultValue = "") {
    return showPromptModal({
        title: "Ubah Nama Parameter / Relay",
        message: message || "Masukkan nama baru:",
        defaultValue: defaultValue || "",
        icon: "✏️",
        confirmText: "Simpan Nama Baru",
        cancelText: "Batal"
    });
};

// ======================
// CYBER CLOUD PAGE TRANSITION OVERLAY
// ======================
function initCloudTransition() {
    if (document.getElementById("cloudOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "cloudOverlay";
    overlay.className = "cloud-overlay";
    overlay.innerHTML = `
        <div class="cloud-glow-bar"></div>
        <svg class="cloud-svg cloud-svg-1" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="rgba(15, 23, 42, 0.98)" d="M0,192L48,197.3C96,203,192,213,288,208C384,203,480,181,576,181.3C672,181,768,203,864,208C960,213,1056,203,1152,186.7C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
        <svg class="cloud-svg cloud-svg-2" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="#07090f" d="M0,128L48,149.3C96,171,192,213,288,224C384,235,480,213,576,181.3C672,149,768,107,864,117.3C960,128,1056,192,1152,208C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
    `;
    document.body.appendChild(overlay);

    // Check if coming from login swipe
    if (sessionStorage.getItem("cloudSwipeOut") === "true") {
        sessionStorage.removeItem("cloudSwipeOut");
        overlay.classList.add("active", "swipe-out");
        setTimeout(() => {
            overlay.classList.remove("active", "swipe-out");
        }, 420);
    }
}

function triggerCloudLoginTransition(targetUrl = "index.html") {
    initCloudTransition();
    const overlay = document.getElementById("cloudOverlay");
    if (!overlay) {
        window.location.href = targetUrl;
        return;
    }
    sessionStorage.setItem("cloudSwipeOut", "true");
    overlay.classList.add("active", "swipe-in");
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 380);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initCloudTransition();
        checkSystemAnnouncement();
        setInterval(checkSystemAnnouncement, 15000);
    });
} else {
    initCloudTransition();
    checkSystemAnnouncement();
    setInterval(checkSystemAnnouncement, 15000);
}

// ==========================================
// SYSTEM ANNOUNCEMENT & MAINTENANCE BROADCAST
// ==========================================
async function openAdminBroadcastModal() {
    let modal = document.getElementById("adminBroadcastModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "adminBroadcastModal";
        modal.className = "modal-overlay";
        modal.style.zIndex = "999999";
        modal.innerHTML = `
        <div class="confirm-modal-box" style="max-width: 480px; width: 90%; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                <div style="font-weight: 700; font-size: 16px; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    <span>Pengumuman Sistem & Pemeliharaan Server</span>
                </div>
                <button type="button" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px;" onclick="closeAdminBroadcastModal()">✖</button>
            </div>

            <div style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">
                Siarkan pemberitahuan pemeliharaan (maintenance) atau pengumuman resmi ke seluruh pengguna BOTEK:
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Status Siaran Pengumuman</label>
                <select id="broadcastActiveSelect" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: #0f172a; color: #fff; font-size: 13px; outline: none; cursor: pointer;">
                    <option value="1">Aktifkan Pengumuman (Tampilkan Banner ke User)</option>
                    <option value="0">Nonaktifkan Pengumuman (Sembunyikan Banner)</option>
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Tipe Pengumuman</label>
                <select id="broadcastTypeSelect" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: #0f172a; color: #fff; font-size: 13px; outline: none; cursor: pointer;">
                    <option value="MAINTENANCE">Pemeliharaan Server (Maintenance)</option>
                    <option value="WARNING">Peringatan Penting (Warning)</option>
                    <option value="INFO">Informasi Umum (Info)</option>
                    <option value="SUCCESS">Pembaruan Berhasil (Success)</option>
                </select>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Judul Pengumuman</label>
                <input type="text" id="broadcastTitleInput" placeholder="Contoh: Pemeliharaan Server Rutin" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: #0f172a; color: #fff; font-size: 13px; outline: none;">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">Pesan Pengumuman</label>
                <textarea id="broadcastMessageInput" rows="3" placeholder="Tuliskan rincian pesan untuk pengguna..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: #0f172a; color: #fff; font-size: 13px; outline: none; resize: vertical;"></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-secondary" onclick="closeAdminBroadcastModal()">Batal</button>
                <button type="button" class="btn-login" style="margin-top: 0; width: auto; padding: 10px 20px;" onclick="submitAdminBroadcast()">Siarkan Pengumuman</button>
            </div>
        </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = "flex";

    try {
        const res = await fetch("/api/admin/announcement");
        const data = await res.json();
        if (data && data.announcement) {
            const a = data.announcement;
            document.getElementById("broadcastActiveSelect").value = String(a.is_active ? 1 : 0);
            document.getElementById("broadcastTypeSelect").value = a.type || "MAINTENANCE";
            document.getElementById("broadcastTitleInput").value = a.title || "";
            document.getElementById("broadcastMessageInput").value = a.message || "";
        }
    } catch (e) {
        console.error("Fetch admin announcement error:", e);
    }
}

function closeAdminBroadcastModal() {
    const modal = document.getElementById("adminBroadcastModal");
    if (modal) modal.style.display = "none";
}

async function submitAdminBroadcast() {
    const is_active = parseInt(document.getElementById("broadcastActiveSelect").value, 10);
    const type = document.getElementById("broadcastTypeSelect").value;
    const title = document.getElementById("broadcastTitleInput").value.trim();
    const message = document.getElementById("broadcastMessageInput").value.trim();

    try {
        const response = await fetch("/api/admin/announcement", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active, type, title, message })
        });
        const data = await response.json();

        if (data.success) {
            if (typeof showToast === "function") {
                showToast(data.message || "Pengumuman berhasil diperbarui!", "success");
            } else {
                alert(data.message || "Pengumuman berhasil diperbarui!");
            }
            closeAdminBroadcastModal();
            checkSystemAnnouncement();
        } else {
            if (typeof showToast === "function") {
                showToast(data.message || "Gagal memperbarui pengumuman.", "error");
            }
        }
    } catch (e) {
        console.error("Submit broadcast error:", e);
    }
}

async function checkSystemAnnouncement(forcedData = null) {
    // Disable announcement banner on login & register pages
    if (window.location.pathname.includes("login.html") || 
        window.location.pathname.includes("register.html") || 
        document.querySelector(".login-wrapper") || 
        document.body.classList.contains("login-body")) {
        const existing = document.getElementById("systemAnnouncementBanner");
        if (existing) existing.remove();
        return;
    }

    try {
        let data = forcedData;
        if (!data) {
            const response = await fetch("/api/announcement?_=" + Date.now());
            data = await response.json();
        }

        let banner = document.getElementById("systemAnnouncementBanner");

        if (data && data.active && data.announcement) {
            const a = data.announcement;
            const type = a.type || "MAINTENANCE";

            let bg = "rgba(245, 158, 11, 0.12)";
            let border = "rgba(245, 158, 11, 0.35)";
            let text = "#f59e0b";
            let typeTitle = "PEMELIHARAAN SERVER";

            if (type === "WARNING") {
                bg = "rgba(239, 68, 68, 0.12)";
                border = "rgba(239, 68, 68, 0.35)";
                text = "#ef4444";
                typeTitle = "PERINGATAN SISTEM";
            } else if (type === "INFO") {
                bg = "rgba(56, 189, 248, 0.12)";
                border = "rgba(56, 189, 248, 0.35)";
                text = "#38bdf8";
                typeTitle = "INFORMASI SERVER";
            } else if (type === "SUCCESS") {
                bg = "rgba(16, 185, 129, 0.12)";
                border = "rgba(16, 185, 129, 0.35)";
                text = "#34d399";
                typeTitle = "PEMBARUAN SISTEM";
            }

            const navbar = document.querySelector(".navbar") || document.querySelector("nav");
            const isFixedTop = !navbar;

            if (!banner) {
                banner = document.createElement("div");
                banner.id = "systemAnnouncementBanner";
                banner.style.cssText = `
                    width: 100%;
                    padding: 10px 20px;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-sizing: border-box;
                    position: ${isFixedTop ? 'fixed' : 'relative'};
                    top: 0;
                    left: 0;
                    z-index: 99999;
                    border-bottom: 1px solid ${border};
                    background: ${bg};
                    color: ${text};
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                `;

                if (navbar && navbar.parentNode) {
                    navbar.parentNode.insertBefore(banner, navbar.nextSibling);
                } else {
                    document.body.insertBefore(banner, document.body.firstChild);
                }
            } else {
                banner.style.position = isFixedTop ? 'fixed' : 'relative';
                banner.style.top = '0';
                banner.style.left = '0';
                banner.style.zIndex = '99999';
                banner.style.background = bg;
                banner.style.borderBottom = `1px solid ${border}`;
                banner.style.color = text;
            }

            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                    <div style="font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.3); white-space: nowrap;">
                        ${typeTitle}
                    </div>
                    <div style="line-height: 1.4;">
                        <b>${a.title ? a.title + ': ' : ''}</b>${a.message || ''}
                    </div>
                </div>
                <button type="button" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 16px; padding: 0 6px; opacity: 0.8;" onclick="document.getElementById('systemAnnouncementBanner').remove()">✖</button>
            `;
            banner.style.display = "flex";
        } else {
            if (banner) banner.remove();
        }
    } catch (e) {
        console.error("Fetch announcement error:", e);
    }
}

// Global window exposure
window.openAdminBroadcastModal = openAdminBroadcastModal;
window.closeAdminBroadcastModal = closeAdminBroadcastModal;
window.submitAdminBroadcast = submitAdminBroadcast;
window.checkSystemAnnouncement = checkSystemAnnouncement;