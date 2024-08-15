const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { authenticate } = require('./routes/auth');
const connection = require('./layout/config');
const axios = require('axios'); // Añade esta línea al principio del archivo

const app = express();
const port = 3000;

// Configura tu API Key aquí
const OPENAI_API_KEY = 'sk-proj-tL4vs4CwQg38LS92aHt5T3BlbkFJ3bmgAIw5ZDgIRueMbUam';

// Configurar el motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));

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

// Ruta para obtener los datos del usuario y renderizar la vista correspondiente
app.get('/alumno/home', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
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
            res.status(500).send('Error del servidor');
        } else {
            if (results.length > 0) {
                const nombre = results[0].nombre;
                let viewName = '';
                switch (tipo) {
                    case 'student':
                        viewName = 'alumno/home';
                        break;
                    case 'teacher':
                        viewName = 'docente/prof';
                        break;
                    case 'admin':
                        viewName = 'admin/admin';
                        break;
                    default:
                        return res.status(500).send('Tipo de usuario no reconocido');
                }
                res.render(viewName, { email, tipo, nombre });
            } else {
                res.status(404).send('Usuario no encontrado');
            }
        }
    });
});

// Nuevas rutas para los tipos de usuario
app.get('/docente/prof', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'teacher') {
        return res.status(403).send('Acceso denegado');
    }

    // Consultar el nombre del usuario desde la base de datos
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

app.get('/admin/admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    // Consultar el nombre del usuario desde la base de datos
    const query = 'SELECT nombre FROM administradores WHERE correo = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error obteniendo el nombre del usuario:', err);
            res.status(500).send('Error del servidor');
        } else {
            if (results.length > 0) {
                const nombre = results[0].nombre;
                res.render('admin/admin', { email, tipo, nombre });
            } else {
                res.status(404).send('Usuario no encontrado');
            }
        }
    });
});

// Ruta para manejar las solicitudes del chatbot
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'Eres Gloria, una paciente de terapia para la Universidad Gabriela Mistral.' },
                { role: 'user', content: userMessage }
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const botMessage = response.data.choices[0].message.content;
        res.json({ reply: botMessage });
    } catch (error) {
        console.error('Error al comunicarse con la API de OpenAI:', error);
        res.status(500).send('Error del servidor');
    }
});


app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);

    // Test de conexión a la base de datos
    connection.query('SELECT 1 + 1 AS solución', (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta de prueba:', err);
        } else {
            console.log('Conexión a la base de datos está funcionando.');
        }
    });
});
