const mysql = require('mysql');

// Creando la conexión usando variables de entorno, con fallback a valores predeterminados
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'us-cluster-east-01.k8s.cleardb.net',
  user: process.env.DB_USER || 'ba680eed0c64f0',
  password: process.env.DB_PASSWORD || '03319b61',
  database: process.env.DB_DATABASE || 'heroku_3f1d4ff0bfb4f0c'
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

module.exports = connection;
