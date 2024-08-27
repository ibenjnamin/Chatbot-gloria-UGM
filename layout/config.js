// layout/config.js
require('dotenv').config(); // Cargar variables de entorno desde .env

const mysql = require('mysql');
const connection = mysql.createConnection({
    host: process.env.DB_HOST, // Usa la variable de entorno correcta
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
connection.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database.');
});
