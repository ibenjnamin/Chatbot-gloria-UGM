const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { authenticate } = require('./routes/auth');
const connection = require('./layout/config');
const axios = require('axios');
const multer = require('multer');  // Agregado para manejar archivos
const XLSX = require('xlsx');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

// Configura tu API Key aquí
const OPENAI_API_KEY = process.env.API_KEY;

// Configurar el motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuración de archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Ruta para manejar la carga de archivos Excel
app.get('/download-excel', (req, res) => {
    const query = `
        SELECT 'Alumno' AS tipo, nombre, correo, rol, bloqueado 
        FROM alumnos 
        UNION ALL 
        SELECT 'Docente' AS tipo, nombre, correo, rol, bloqueado 
        FROM docentes
    `;

    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error al obtener los datos:', error);
            res.status(500).send('Error al obtener los datos');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws_data = [
            ['Tipo', 'Usuario', 'Correo', 'Rol', 'Establecimiento', 'Estado']
        ];

        results.forEach(row => {
            ws_data.push([
                row.tipo,
                row.nombre,
                row.correo,
                row.rol,
                'Universidad Gabriela Mistral',
                row.bloqueado ? 'Bloqueado' : 'Activo'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', 'attachment; filename="usuarios.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

// Ruta para el archivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta de autenticación
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;

    authenticate(email, password, (result) => {
        if (result) {
            req.session.user = { email, tipo: result.type };
            if (result.type === 'student') {
                res.redirect('/alumno/home');
            } else if (result.type === 'teacher') {
                res.redirect('/docente/prof');
            } else if (result.type === 'admin') {
                res.redirect('/admin/admin');
            }
        } else {
            res.status(401).send('Credenciales incorrectas');
        }
    });
});

// Rutas de usuarios
app.get('/alumno/home', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;
    const queryMap = {
        student: 'SELECT nombre FROM alumnos WHERE correo = ?',
        teacher: 'SELECT nombre FROM docentes WHERE correo = ?',
        admin: 'SELECT nombre FROM administradores WHERE correo = ?'
    };

    const query = queryMap[tipo];

    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error obteniendo el nombre del usuario:', err);
            return res.status(500).send('Error del servidor');
        }
        
        if (results.length > 0) {
            const nombre = results[0].nombre;
            res.render('alumno/home', { email, tipo, nombre });
        } else {
            res.status(404).send('Usuario no encontrado');
        }
    });
});

app.get('/alumno/chat', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;
    res.render('alumno/chat', { email, tipo });
});

app.get('/alumno/historial', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;
    res.render('alumno/historial', { email, tipo });
});

app.get('/alumno/evaluacion', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;
    res.render('alumno/evaluacion', { email, tipo });
});

// Nuevas rutas para los tipos de usuario
app.get('/docente/prof', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'teacher') {
        return res.status(403).send('Acceso denegado');
    }

    const query = 'SELECT nombre FROM docentes WHERE correo = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error obteniendo el nombre del usuario:', err);
            res.status(500).send('Error del servidor');
        } else {
            if (results.length > 0) {
                const nombre = results[0].nombre;
                res.render('docente/prof', { email, tipo, nombre });
            } else {
                res.status(404).send('Usuario no encontrado');
            }
        }
    });
});

app.get('/docente/p_alum', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'teacher') {
        return res.status(403).send('Acceso denegado');
    }

    const query = 'SELECT id, nombre, correo FROM alumnos';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo los datos de los alumnos:', err);
            return res.status(500).send('Error del servidor');
        }

        res.render('docente/p_alum', { email, tipo, alumnos: results });
    });
});

app.get('/docente/p_est', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'teacher') {
        return res.status(403).send('Acceso denegado');
    }

    const query = 'SELECT nombre FROM alumnos';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo los datos de los alumnos:', err);
            return res.status(500).send('Error del servidor');
        }

        res.render('docente/p_est', { email, tipo, alumnos: results });
    });
});

app.get('/admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    const query = 'SELECT nombre FROM administradores WHERE correo = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error obteniendo el nombre del administrador:', err);
            return res.status(500).send('Error del servidor');
        }

        if (results.length > 0) {
            const nombre = results[0].nombre;
            res.render('admin/admin', { email, tipo, nombre });
        } else {
            res.status(404).send('Administrador no encontrado');
        }
    });
});

app.get('/admin/u_admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    const query = 'SELECT nombre FROM administradores';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo los datos de los administradores:', err);
            return res.status(500).send('Error del servidor');
        }

        res.render('admin/u_admin', { email, tipo, admins: results });
    });
});

app.get('/admin/p_admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('glor-ia.com/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    const query = 'SELECT id, nombre, correo FROM administradores';
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo los datos de los administradores:', err);
            return res.status(500).send('Error del servidor');
        }

        res.render('admin/p_admin', { email, tipo, admins: results });
    });
});

// Ruta para el manejo de archivos
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No se ha subido ningún archivo.');
    }

    // Procesar el archivo Excel subido
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Guardar los datos en la base de datos o procesarlos según sea necesario

    // Eliminar el archivo después de procesarlo
    fs.unlinkSync(filePath);

    res.send('Archivo subido y procesado correctamente.');
});

// Ruta para obtener los datos desde el cliente
app.post('/consultar', async (req, res) => {
    const { id } = req.body;

    try {
        const response = await axios.get(`http://localhost:3000/api/data/${id}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error al consultar los datos:', error);
        res.status(500).send('Error al consultar los datos');
    }
});

// Ruta para mostrar el formulario HTML
app.get('/formulario', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'formulario.html'));
});

// Ruta para manejar los datos del formulario
app.post('/formulario', (req, res) => {
    const { id, name, email } = req.body;

    connection.query(
        'INSERT INTO formulario_data (id, name, email) VALUES (?, ?, ?)',
        [id, name, email],
        (err, results) => {
            if (err) {
                console.error('Error al insertar los datos:', err);
                return res.status(500).send('Error al insertar los datos');
            }
            res.send('Datos guardados correctamente.');
        }
    );
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
