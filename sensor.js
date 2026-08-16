// ==========================
// BOTEK IoT SENSOR SIMULATION
// ==========================

function random(min, max, decimal = 1) {
    return (Math.random() * (max - min) + min).toFixed(decimal);
}

function getSensorData(type = "Monitoring") {
    let data = { time: new Date() };

    // MONITORING SENSOR
    if (type === "Monitoring") {
        data = {
            temperature: random(25, 32, 1),
            humidity: random(50, 80, 0),
            pressure: random(0.9, 1.2, 2),
            gas: random(200, 600, 0),
            light: random(100, 900, 0),
            time: new Date()
        };
    }
    // ENERGY MONITOR
    else if (type === "Energy Monitor") {
        data = {
            voltage: random(210, 230, 1),
            current: random(0.5, 10, 2),
            power: random(50, 1500, 0),
            energy: random(0, 20, 2),
            frequency: random(49, 51, 2),
            time: new Date()
        };
    }
    // DEFAULT
    else {
        data = {
            value: random(0, 100, 1),
            time: new Date()
        };
    }

    return data;
}

module.exports = getSensorData;