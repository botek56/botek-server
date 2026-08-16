const db = require("./database");


// tambah icon
db.run(

"ALTER TABLE device_sensors ADD COLUMN icon TEXT",

(err)=>{

if(err){

console.log(
"ICON:",
err.message
);

}
else{

console.log(
"icon berhasil ditambahkan"
);

}

}

);




// tambah sensor_order
db.run(

"ALTER TABLE device_sensors ADD COLUMN sensor_order INTEGER DEFAULT 0",

(err)=>{

if(err){

console.log(
"SENSOR ORDER:",
err.message
);

}
else{

console.log(
"sensor_order berhasil ditambahkan"
);

}

}

);




// tambah created_at
db.run(

"ALTER TABLE device_sensors ADD COLUMN created_at TEXT",

(err)=>{

if(err){

console.log(
"CREATED AT:",
err.message
);

}
else{

console.log(
"created_at berhasil ditambahkan"
);

}

}

);