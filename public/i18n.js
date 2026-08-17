// ===================================================================
// BOTEK IoT Console - Internationalization (i18n) Engine (ID / EN)
// ===================================================================

const i18nTranslations = {
    id: {
        // Navigation
        nav_home: "Beranda",
        nav_devices: "Perangkat",
        nav_history: "Riwayat Log",
        nav_add_device: "+ Tambah Perangkat",
        nav_user_management: "Kelola Pengguna",
        nav_logout: "Keluar",
        
        // Super Admin User Management Modal
        user_mgmt_modal_title: "Manajemen Pengguna BOTEK (Super Admin)",
        user_mgmt_modal_desc: "Daftar seluruh akun Klien & Admin terdaftar pada server BOTEK:",
        col_user: "Pengguna",
        col_role: "Peran",
        col_device: "Perangkat",
        col_status: "Status",
        col_last_login: "Terakhir Login",
        col_action: "Aksi",
        loading_users: "Memuat daftar pengguna...",
        no_users_found: "Belum ada pengguna terdaftar",
        role_client: "KLIEN",
        unit_label: "unit",
        status_active: "Aktif",
        status_inactive: "Nonaktif",
        your_account: "Akun Anda",
        online_now: "Sedang Login",
        btn_deactivate: "Nonaktifkan",
        btn_activate: "Aktifkan",
        change_user_pass_title: "Ubah Kata Sandi Pengguna",

        // Header & Subtitles
        console_subtitle: "Sistem Manajemen & Kontrol Perangkat IoT Real-time",
        my_devices_subtitle: "Kelola dan pantau seluruh perangkat IoT terhubung Anda",
        add_device_subtitle: "Buat template perangkat IoT Universal dengan kombinasi Sensor & Sakelar Relay",
        history_subtitle: "Log data dan riwayat sensor terdaftar",
        sensor_telemetry_title: "Sensor Real-Time",
        telemetry_analytics_title: "Analitik & Grafik Sensor",
        search_device_title: "CARI PERANGKAT",
        device_info_title: "Informasi Perangkat",

        // Device Category Dropdown Options
        type_universal: "Universal Hybrid (Sensor + Sakelar Relay)",
        type_energy: "Energy Monitor (Tegangan, Arus, Daya)",
        type_env: "Environmental Monitoring (Suhu, Kelembaban)",
        type_relay: "Relay / Switch Controller (Khusus Sakelar)",

        // Dashboard Relay & Sensor Widgets
        status_label: "Status",
        auto_mode_active: "⏱️ Mode Otomatis Aktif",
        manual_mode_active: "🔧 Mode Manual Aktif",
        manual_btn: "Manual",
        auto_timer_btn: "Otomatis (Timer)",
        time_on_label: "Waktu ON",
        time_off_label: "Waktu OFF",
        save_timer_btn: "Simpan Timer",
        countdown_title: "HITUNG MUNDUR",
        option_off: "Mati (OFF)",
        option_on: "Nyalakan (ON)",
        start_btn: "Mulai",
        rename_btn: "Ubah Nama",
        automation_btn: "Otomasi",
        realtime_reading: "Pembacaan Real-Time",

        // Sensor Catalog Names
        sensor_temp: "Suhu (Temperature)",
        sensor_hum: "Kelembaban (Humidity)",
        sensor_volt: "Tegangan (Voltage)",
        sensor_curr: "Arus (Current)",
        sensor_pow: "Daya (Power)",
        sensor_nrg: "Konsumsi Energi (Energy)",
        sensor_freq: "Frekuensi (Frequency)",
        sensor_press: "Tekanan (Pressure)",
        sensor_gas: "Kualitas Udara (Gas Quality)",
        sensor_light: "Intensitas Cahaya (Light Intensity)",
        sensor_dimmer: "Dimmer PWM / Kecepatan Kipas",
        
        // Dynamic Add Device Section
        selected_count: "Terpilih",
        select_add_sensor_btn: "⊕ Pilih & Tambah Sensor",
        no_sensors_selected_desc: "Belum ada sensor terpilih. Klik tombol <b>⊕ Pilih & Tambah Sensor</b> di atas.",
        relay_controller_title: "Kontroler Output Relay",
        enable_relay_check: "Aktifkan Sakelar Relay",
        relay_count_label: "Jumlah Output Relay",
        relay_auto_desc: "Sistem akan membuat modul sakelar Relay otomatis (Relay 1, Relay 2, Relay 3, Relay 4...).",
        add_custom_param_title: "➕ Tambah Parameter Custom Baru",
        ph_custom_param_name: "Nama Parameter (misal: Level CO2)",
        ph_custom_param_unit: "Satuan (misal: ppm)",
        btn_add: "Tambah",
        sensors_selected_text: "Sensor Dipilih",
        fill_param_warning: "Harap isi Nama Parameter dan Satuan Sensor!",
        fill_device_info_warning: "Harap lengkapi Kode Perangkat dan Nama Perangkat!",

        // Table & Card Labels
        total_devices: "Total Perangkat",
        online_devices: "Perangkat Terhubung",
        offline_devices: "Perangkat Terputus",
        registered_devices: "Daftar Perangkat Terdaftar",
        search_device_ph: "Cari kode, nama perangkat, atau pemilik...",
        open_dashboard_btn: "BUKA DASHBOARD ➔",
        delete_device_btn: "Hapus Unit",
        last_seen_label: "Terlihat",
        never_seen: "Belum Pernah",
        just_now: "Baru saja",
        ago_m: "m lalu",
        ago_h: "j lalu",
        ago_d: "hr lalu",
        total_sensors_label: "Total Sensor",
        last_active_label: "Terakhir Aktif",
        hide_code: "Sembunyikan Kode",
        show_code: "Lihat Kode",
        no_devices_found: "Tidak Ada Perangkat Ditemukan",
        no_devices_desc: "Coba sesuaikan kata kunci pencarian Anda.",
        
        // Buttons
        back_to_devices: "Kembali ke Perangkat",
        back_btn: "Kembali",
        refresh_btn: "Segarkan",
        add_graph_btn: "Tambah Grafik",
        select_sensor: "Pilih Sensor:",
        random_code_btn: "🎲 Acak Kode Unik",
        save_device_btn: "SIMPAN TEMPLATE PERANGKAT",

        // History Table Columns
        time_col: "Waktu",
        temp_col: "Suhu",
        hum_col: "Kelembaban",
        
        // Login & Register Page
        login_title: "Masuk ke Konsol",
        login_subtitle: "Portal Konsol IoT & Manajemen Perangkat",
        login_btn: "MASUK KE KONSOL",
        no_account: "Belum punya akun Klien?",
        register_link: "Daftar Akun Baru",
        register_title: "Daftar Akun Klien Baru",
        register_btn: "Daftar Sekarang",
        cancel_btn: "Tutup",
        
        // Form Labels
        login_username_label: "Username / Email",
        username_label: "Nama Pengguna",
        full_name_label: "Nama Lengkap",
        email_label: "Alamat Email",
        password_label: "Kata Sandi",
        confirm_password_label: "Konfirmasi Kata Sandi",
        old_password_label: "Kata Sandi Saat Ini",
        new_password_label: "Kata Sandi Baru",
        device_code_label: "Kode Perangkat",
        device_name_label: "Nama Perangkat",
        device_type_label: "Kategori Perangkat",
        
        // Placeholders
        ph_login_username: "Masukkan nama pengguna atau email",
        ph_username: "Masukkan nama pengguna",
        ph_full_name: "Masukkan nama lengkap",
        ph_email: "Masukkan alamat email",
        ph_password: "Masukkan kata sandi",
        ph_old_password: "Masukkan kata sandi saat ini",
        ph_new_password: "Masukkan kata sandi baru (min. 4 karakter)",
        ph_device_code: "Masukkan kode perangkat (contoh: 01, 02)",
        ph_device_name: "Masukkan nama perangkat",
        ph_sensor_name: "Masukkan nama sensor / relay",
        ph_rule_name: "Masukkan nama aturan otomasi",
        ph_search_device: "Cari nama perangkat, ID, atau nama pemilik...",
        
        // Device Badges & Status
        owner_label: "Pemilik",
        status_online: "ONLINE",
        status_offline: "OFFLINE",
        active_mode: "Mode Aktif",
        manual_mode: "Mode Manual",
        auto_mode: "Mode Otomatis",
        
        // Action Buttons & Titles
        btn_save: "Simpan",
        btn_add_sensor: "Tambah Sensor / Kontrol",
        btn_add_rule: "⚡ Buat Aturan Otomasi",
        btn_edit: "Ubah",
        btn_delete: "Hapus",
        btn_change_password: "🔑 Ubah Kata Sandi",

        // Toast & Alert Messages
        msg_required_fields: "Seluruh kolom wajib diisi",
        msg_password_mismatch: "Konfirmasi kata sandi tidak cocok dengan kata sandi",
        msg_access_denied: "Akses Ditolak: Perangkat ini bukan milik Anda",
        msg_login_expired: "Sesi telah berakhir. Mengalihkan ke halaman masuk...",
        msg_success_register: "Pendaftaran berhasil! Silakan masuk dengan akun baru Anda.",
        msg_success_saved: "Berhasil disimpan!",
        msg_login_success: "Login berhasil! Mengalihkan...",
        msg_login_failed: "Username atau password salah",
        msg_conn_error: "Gagal terhubung ke server",

        // Get App Modal
        get_app_btn: "Dapatkan Aplikasi",
        get_app_modal_title: "Unduh & Install BOTEK App",
        get_app_modal_desc: "Pilih platform perangkat Anda untuk meng-install aplikasi BOTEK IoT:",
        platform_windows_desc: "Aplikasi Windows Desktop Mandiri (PWA)",
        platform_android_desc: "Aplikasi Android Native / PWA",
        platform_ios_desc: "Aplikasi iPhone & iPad (Safari)",
        btn_install_now: "Install Aplikasi Sekarang",
        guide_android: "Buka Chrome ➔ Klik Menu (⋮) ➔ Tambahkan ke Layar Utama / Install App",
        guide_ios: "Buka Safari ➔ Klik Tombol Bagikan (Share) ➔ Tambahkan ke Layar Utama",
        pwa_manual_guide: "Klik menu browser (⋮) atau ikon Install di address bar untuk memasang aplikasi",

        // Server Health Metrics
        stat_ram: "RAM Server",
        stat_cpu: "Beban CPU",
        stat_db: "Ukuran DB",
        stat_uptime: "Uptime Server",
        col_user_usage: "Pemakaian User",
        btn_clear_logs: "Hapus Log",
        clear_user_logs_title: "Bersihkan Riwayat Log User",
        confirm_delete_logs: "Apakah Anda yakin ingin menghapus seluruh riwayat log sensor untuk user ini?",
        btn_export_data: "Ekspor Data",
        export_title: "Ekspor Data Telemetri & Log Sensor",
        export_format_csv: "Excel / CSV (.csv)",
        export_format_pdf: "Laporan PDF (Siap Cetak)",
        export_date_range_label: "Rentang Tanggal (Opsional)",
        export_from_date: "Dari Tanggal:",
        export_to_date: "Sampai Tanggal:",
        preset_all: "Semua",
        preset_today: "Hari Ini",
        preset_7days: "7 Hari Terakhir",
        export_retention_notice_title: "Informasi Retensi Data:",
        export_retention_notice_text: "Data log hanya dapat disimpan maksimal selama <b>7 hari</b>.",
        export_total_data_label: "Total Data:",
        export_retention_duration_label: "Durasi Penyimpanan:",
        export_select_desc: "Pilih sensor atau kontrol sakelar dan format berkas yang ingin diunduh:",
        export_select_sensor_label: "Pilihan Sensor / Kontrol",
        export_file_format_label: "Format Berkas Unduhan",
    },

    en: {
        // Navigation
        nav_home: "Home",
        nav_devices: "Devices",
        nav_history: "Log History",
        nav_add_device: "+ Add Device",
        nav_user_management: "User Management",
        nav_logout: "Logout",

        // Super Admin User Management Modal
        user_mgmt_modal_title: "BOTEK User Management (Super Admin)",
        user_mgmt_modal_desc: "List of all registered Client & Admin accounts on BOTEK server:",
        col_user: "USER",
        col_role: "ROLE",
        col_device: "DEVICE",
        col_status: "STATUS",
        col_last_login: "LAST LOGIN",
        col_action: "ACTION",
        loading_users: "Loading user list...",
        no_users_found: "No registered users found",
        role_client: "CLIENT",
        unit_label: "units",
        status_active: "Active",
        status_inactive: "Inactive",
        your_account: "Your Account",
        online_now: "Online Now",
        btn_deactivate: "Deactivate",
        btn_activate: "Activate",
        change_user_pass_title: "Change User Password",
        
        // Header & Subtitles
        console_subtitle: "Real-time IoT Device Control & Management System",
        my_devices_subtitle: "Manage and monitor all your connected IoT hardware templates",
        add_device_subtitle: "Create Universal IoT device templates combining Sensors & Relay Switches",
        history_subtitle: "Data log and registered sensor history",
        sensor_telemetry_title: "Real-Time Sensors",
        telemetry_analytics_title: "Sensor Analytics & Graphs",
        search_device_title: "SEARCH DEVICE",
        device_info_title: "Device Information",

        // Device Category Dropdown Options
        type_universal: "Universal Hybrid (Sensors + Relay Switches)",
        type_energy: "Energy Monitor (Voltage, Current, Power)",
        type_env: "Environmental Monitoring (Temperature, Humidity)",
        type_relay: "Relay / Switch Controller (Switches Only)",

        // Dashboard Relay & Sensor Widgets
        status_label: "Status",
        auto_mode_active: "⏱️ Auto Mode Active",
        manual_mode_active: "🔧 Manual Mode Active",
        manual_btn: "Manual",
        auto_timer_btn: "Auto (Timer)",
        time_on_label: "ON Time",
        time_off_label: "OFF Time",
        save_timer_btn: "Save Timer",
        countdown_title: "COUNTDOWN",
        option_off: "Off (OFF)",
        option_on: "On (ON)",
        start_btn: "Start",
        rename_btn: "Rename",
        automation_btn: "Automation",
        realtime_reading: "Real-Time Reading",

        // Sensor Catalog Names
        sensor_temp: "Temperature",
        sensor_hum: "Humidity",
        sensor_volt: "Voltage",
        sensor_curr: "Current",
        sensor_pow: "Power",
        sensor_nrg: "Energy Consumption",
        sensor_freq: "Frequency",
        sensor_press: "Pressure",
        sensor_gas: "Gas Quality",
        sensor_light: "Light Intensity",
        sensor_dimmer: "PWM Dimmer / Speed Control",
        
        // Dynamic Add Device Section
        selected_count: "Selected",
        select_add_sensor_btn: "⊕ Select & Add Sensors",
        no_sensors_selected_desc: "No sensors selected yet. Click the <b>⊕ Select & Add Sensors</b> button above.",
        relay_controller_title: "Output Relay Controller",
        enable_relay_check: "Enable Relay Switch",
        relay_count_label: "Number of Relay Outputs",
        relay_auto_desc: "The system will automatically generate Relay switch modules (Relay 1, Relay 2, Relay 3, Relay 4...).",
        add_custom_param_title: "➕ Add New Custom Parameter",
        ph_custom_param_name: "Parameter Name (e.g. CO2 Level)",
        ph_custom_param_unit: "Unit (e.g. ppm)",
        btn_add: "Add",
        sensors_selected_text: "Sensors Selected",
        fill_param_warning: "Please fill in Parameter Name and Sensor Unit!",
        fill_device_info_warning: "Please complete Device Code and Device Name!",

        // Table & Card Labels
        total_devices: "Total Devices",
        online_devices: "Online Devices",
        offline_devices: "Offline Devices",
        registered_devices: "Registered Devices Catalog",
        search_device_ph: "Search device code, name, or owner...",
        open_dashboard_btn: "OPEN DASHBOARD ➔",
        delete_device_btn: "Delete Unit",
        last_seen_label: "Last Seen",
        never_seen: "Never",
        just_now: "Just now",
        ago_m: "m ago",
        ago_h: "h ago",
        ago_d: "d ago",
        total_sensors_label: "Total Sensors",
        last_active_label: "Last Active",
        hide_code: "Show Code",
        show_code: "Hide Code",
        no_devices_found: "No Devices Found",
        no_devices_desc: "Try adjusting your search query or filter selection.",

        // Buttons
        back_to_devices: "Back to Devices",
        back_btn: "Back",
        refresh_btn: "Refresh",
        add_graph_btn: "Add Graph",
        select_sensor: "Select Sensor:",
        random_code_btn: "🎲 Random Unique Code",
        save_device_btn: "SAVE DEVICE TEMPLATE",

        // History Table Columns
        time_col: "Time",
        temp_col: "Temperature",
        hum_col: "Humidity",
        
        // Login & Register Page
        login_title: "Sign In to Console",
        login_subtitle: "IoT Console & Device Management Portal",
        login_btn: "LOGIN TO CONSOLE",
        no_account: "Don't have a Client account?",
        register_link: "Register New Account",
        register_title: "Register New Client Account",
        register_btn: "Register Now",
        cancel_btn: "Close",
        
        // Form Labels
        login_username_label: "Username / Email",
        username_label: "Username",
        full_name_label: "Full Name",
        email_label: "Email Address",
        password_label: "Password",
        confirm_password_label: "Confirm Password",
        old_password_label: "Current Password",
        new_password_label: "New Password",
        device_code_label: "Device Code",
        device_name_label: "Device Name",
        device_type_label: "Device Category",
        
        // Placeholders
        ph_login_username: "Enter username or email",
        ph_username: "Enter username",
        ph_full_name: "Enter full name",
        ph_email: "Enter email address",
        ph_password: "Enter password",
        ph_old_password: "Enter current password",
        ph_new_password: "Enter new password (min. 4 chars)",
        ph_device_code: "Enter device code (e.g. 01, 02)",
        ph_device_name: "Enter device name",
        ph_sensor_name: "Enter sensor / relay name",
        ph_rule_name: "Enter automation rule name",
        ph_search_device: "Search device name, ID, or owner name...",
        
        // Device Badges & Status
        owner_label: "Owner",
        status_online: "ONLINE",
        status_offline: "OFFLINE",
        active_mode: "Active Mode",
        manual_mode: "Manual Mode",
        auto_mode: "Auto Mode",
        
        // Action Buttons & Titles
        btn_save: "Save",
        btn_add_sensor: "Add Sensor / Control",
        btn_add_rule: "⚡ Create Automation Rule",
        btn_edit: "Edit",
        btn_delete: "Delete",
        btn_change_password: "🔑 Change Password",

        // Toast & Alert Messages
        msg_required_fields: "All fields are required",
        msg_password_mismatch: "Password confirmation does not match",
        msg_access_denied: "Access Denied: This device does not belong to you",
        msg_login_expired: "Session expired. Redirecting to login...",
        msg_success_register: "Registration successful! Please login with your new account.",
        msg_success_saved: "Successfully saved!",
        msg_login_success: "Login successful! Redirecting...",
        msg_login_failed: "Invalid username or password",
        msg_conn_error: "Failed to connect to server",

        // Get App Modal
        get_app_btn: "Get App",
        get_app_modal_title: "Download & Install BOTEK App",
        get_app_modal_desc: "Select your device platform to install BOTEK IoT application:",
        platform_windows_desc: "Windows Standalone Desktop App (PWA)",
        platform_android_desc: "Android Native / PWA Mobile App",
        platform_ios_desc: "iPhone & iPad Safari Web App",
        btn_install_now: "Install App Now",
        guide_android: "Open Chrome ➔ Tap Menu (⋮) ➔ Add to Home Screen / Install App",
        guide_ios: "Open Safari ➔ Tap Share Button ➔ Add to Home Screen",
        pwa_manual_guide: "Click browser menu (⋮) or Install icon in address bar to install app",

        // Server Health Metrics
        stat_ram: "Server RAM",
        stat_cpu: "CPU Load",
        stat_db: "Database Size",
        stat_uptime: "Server Uptime",
        col_user_usage: "User Usage",
        btn_clear_logs: "Clear Logs",
        clear_user_logs_title: "Clear User Sensor Log History",
        confirm_delete_logs: "Are you sure you want to delete all sensor log history for this user?",
        btn_export_data: "Export Data",
        export_title: "Export Sensor Telemetry & Log Data",
        export_format_csv: "Excel / CSV (.csv)",
        export_format_pdf: "PDF Report (Printable)",
        export_date_range_label: "Date Range (Optional)",
        export_from_date: "From Date:",
        export_to_date: "To Date:",
        preset_all: "All Time",
        preset_today: "Today",
        preset_7days: "Last 7 Days",
        export_retention_notice_title: "Data Retention Notice:",
        export_retention_notice_text: "Log data is stored for a maximum of <b>7 days</b>.",
        export_total_data_label: "Total Data:",
        export_retention_duration_label: "Storage Duration:",
        export_select_desc: "Select sensor or switch control and file format to download:",
        export_select_sensor_label: "Select Sensor / Control",
        export_file_format_label: "Download File Format",
    }
};

function getLanguage() {
    return localStorage.getItem("botek_lang") || "en";
}

function setLanguage(lang) {
    if (lang !== "id" && lang !== "en") lang = "en";
    localStorage.setItem("botek_lang", lang);
    applyTranslations();
    updateSwitcherUI();
}

function t(key, defaultVal) {
    const currentLang = getLanguage();
    if (i18nTranslations[currentLang] && i18nTranslations[currentLang][key]) {
        return i18nTranslations[currentLang][key];
    }
    if (i18nTranslations.en && i18nTranslations.en[key]) {
        return i18nTranslations.en[key];
    }
    if (i18nTranslations.id && i18nTranslations.id[key]) {
        return i18nTranslations.id[key];
    }
    return defaultVal || key;
}

function applyTranslations() {
    const currentLang = getLanguage();
    document.documentElement.lang = currentLang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (key && i18nTranslations[currentLang] && i18nTranslations[currentLang][key]) {
            el.innerText = i18nTranslations[currentLang][key];
        }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key && i18nTranslations[currentLang] && i18nTranslations[currentLang][key]) {
            el.setAttribute("placeholder", i18nTranslations[currentLang][key]);
        }
    });
}

function updateSwitcherUI() {
    const currentLang = getLanguage();
    document.querySelectorAll(".lang-btn").forEach(btn => {
        const btnLang = btn.getAttribute("data-lang");
        if (btnLang === currentLang) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

function renderLangSwitcher(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentLang = getLanguage();
    container.innerHTML = `
        <div class="lang-switcher-pill">
            <button type="button" class="lang-btn ${currentLang === 'id' ? 'active' : ''}" data-lang="id" onclick="setLanguage('id')">ID</button>
            <button type="button" class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" onclick="setLanguage('en')">EN</button>
        </div>
    `;
}

// Auto Initialize on DOM load & Register PWA Service Worker
document.addEventListener("DOMContentLoaded", () => {
    applyTranslations();
    updateSwitcherUI();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('BOTEK PWA Service Worker Registered:', reg.scope);
        }).catch(err => {
            console.error('Service Worker registration failed:', err);
        });
    }
});
