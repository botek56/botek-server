let labels = [];
let temperatureData = [];
let chart = null;

// Load navbar if element exists
const navEl = document.getElementById("navbar");
if (navEl) {
    fetch("navbar.html")
        .then(response => response.text())
        .then(data => {
            navEl.innerHTML = data;
        })
        .catch(err => console.log("Navbar load error:", err));
}

// Chart initialization if canvas exists
const chartCanvas = document.getElementById("temperatureChart");
if (chartCanvas && typeof Chart !== "undefined") {
    const ctx = chartCanvas.getContext("2d");
    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Temperature °C",
                data: temperatureData,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true
        }
    });

    setInterval(updateSensor, 4000);
}

async function updateSensor() {
    try {
        const response = await fetch("/api/sensor");
        if (!response.ok) return;
        const data = await response.json();

        const tempEl = document.getElementById("temperature");
        if (tempEl && data.temperature) tempEl.innerHTML = data.temperature + " °C";

        const humEl = document.getElementById("humidity");
        if (humEl && data.humidity) humEl.innerHTML = data.humidity + " %";

        if (chart && data.temperature) {
            labels.push(new Date().toLocaleTimeString());
            temperatureData.push(data.temperature);

            if (labels.length > 10) {
                labels.shift();
                temperatureData.shift();
            }

            chart.update();
        }
    } catch (err) {
        console.log("Sensor update error:", err);
    }
}

async function lampOn() {
    try {
        const response = await fetch("/api/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_code: "DEMO-01",
                control_name: "Lamp",
                status: "ON"
            })
        });
        const data = await response.json();
        const lampEl = document.getElementById("lampStatus");
        if (lampEl) {
            lampEl.innerHTML = "🟢 Lamp " + (data.status || "ON");
        }
    } catch (err) {
        console.error("Control error:", err);
        const lampEl = document.getElementById("lampStatus");
        if (lampEl) lampEl.innerHTML = "🟢 Lamp ON";
    }
}

async function lampOff() {
    try {
        const response = await fetch("/api/control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                device_code: "DEMO-01",
                control_name: "Lamp",
                status: "OFF"
            })
        });
        const data = await response.json();
        const lampEl = document.getElementById("lampStatus");
        if (lampEl) {
            lampEl.innerHTML = "🔴 Lamp " + (data.status || "OFF");
        }
    } catch (err) {
        console.error("Control error:", err);
        const lampEl = document.getElementById("lampStatus");
        if (lampEl) lampEl.innerHTML = "🔴 Lamp OFF";
    }
}