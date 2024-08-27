const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'p3plzcpnl50750', // Cambia esto por el host real de GoDaddy si es diferente
    user: 'AdminUgmia',     // Tu usuario de base de datos
    password: 'benjadar27122002', // Cambia esto por la contraseña real
    database: 'ugm-gloria-ia' // Nombre de tu base de datos
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL server.');
});

module.exports = connection;
