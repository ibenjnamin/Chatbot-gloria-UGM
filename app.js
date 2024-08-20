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


const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });


// Configura tu API Key aquí
const OPENAI_API_KEY = 'sk-proj-tL4vs4CwQg38LS92aHt5T3BlbkFJ3bmgAIw5ZDgIRueMbUam';

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
    // Realizar la consulta para obtener datos de alumnos y docentes
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

        // Crear un libro de trabajo y una hoja de cálculo
        const wb = XLSX.utils.book_new();
        
        // Crear los datos para la hoja de cálculo
        const ws_data = [
            ['Tipo', 'Usuario', 'Correo', 'Rol', 'Establecimiento', 'Estado']
        ];

        // Agregar los datos de alumnos y docentes a la hoja
        results.forEach(row => {
            ws_data.push([
                row.tipo,
                row.nombre,
                row.correo,
                row.rol,
                'Universidad Gabriela Mistral', // Valor fijo según tu ejemplo
                row.bloqueado ? 'Bloqueado' : 'Activo'
            ]);
        });

        // Convertir los datos a una hoja de cálculo
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');

        // Escribir el archivo en un buffer
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        // Establecer las cabeceras para descargar el archivo
        res.setHeader('Content-Disposition', 'attachment; filename="usuarios.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Enviar el archivo
        res.send(buffer);
    });
});


// Ruta para la vista de carga de archivos



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

    // Consulta para obtener el nombre del usuario
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
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;
    res.render('alumno/chat', { email, tipo });
});

// Ruta para la vista de historial
app.get('/alumno/historial', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;
    res.render('alumno/historial', { email, tipo });
});

// Ruta para la vista de evaluación
app.get('/alumno/evaluacion', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;
    res.render('alumno/evaluacion', { email, tipo });
});

// Nuevas rutas para los tipos de usuario
// Ruta para la vista de profesor
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

// Ruta para la vista de panel de alumnos
app.get('/docente/p_alum', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'teacher') {
        return res.status(403).send('Acceso denegado');
    }

    // Consultar los datos de los alumnos desde la base de datos
    const query = 'SELECT id, nombre, correo FROM alumnos'; // Solo selecciona los campos necesarios
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo los datos de los alumnos:', err);
            return res.status(500).send('Error del servidor');
        }

        res.render('docente/p_alum', { email, tipo, alumnos: results });
    });
});


// Ruta para la vista de panel de estadísticas
app.get('/docente/p_est', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'teacher') {
        return res.status(403).send('Acceso denegado');
    }

    // Consultar los datos de los alumnos desde la base de datos
    const query = 'SELECT nombre FROM alumnos'; // Solo selecciona los campos necesarios
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error obteniendo los datos de los alumnos:', err);
            return res.status(500).send('Error del servidor');
        }

        res.render('docente/p_est', { email, tipo, alumnos: results });
    });
});

// Ruta para la vista principal del administrador
app.get('/admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    // Puedes obtener datos adicionales para mostrar en la vista, si es necesario
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


// Ruta para la vista de gestión de usuarios en el administrador
app.get('/admin/u_admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    // Consulta para obtener los datos de alumnos y docentes
    const queryAlumnos = 'SELECT nombre AS usuario, correo, rol, bloqueado FROM alumnos';
    const queryDocentes = 'SELECT nombre AS usuario, correo, rol, bloqueado FROM docentes';
    
    connection.query(queryAlumnos, (errAlumnos, resultsAlumnos) => {
        if (errAlumnos) {
            console.error('Error obteniendo datos de alumnos:', errAlumnos);
            return res.status(500).send('Error del servidor');
        }
        
        connection.query(queryDocentes, (errDocentes, resultsDocentes) => {
            if (errDocentes) {
                console.error('Error obteniendo datos de docentes:', errDocentes);
                return res.status(500).send('Error del servidor');
            }

            // Combina los resultados de alumnos y docentes
            const combinedResults = resultsAlumnos.concat(resultsDocentes);
            
            res.render('admin/u_admin', { email, tipo, users: combinedResults });
        });
    });
});

// Función middleware para verificar si el usuario es un administrador
//function checkAdmin(req, res, next) {
    //if (!req.session.user || req.session.user.tipo !== 'admin') {
      //  return res.status(403).send('Acceso denegado. Solo los administradores pueden realizar esta acción.');
    //}
    //next();
//}

// Asegúrate de que el estado del usuario se actualice correctamente
//app.post('/admin/update-user-status', checkAdmin, (req, res) => {
    //const { correo, bloqueado } = req.body;

    // Determina el estado del usuario en función del valor del switch
    //const estado = bloqueado === 'true' ? 1 : 0;

    // Actualiza en la base de datos
    //const query = `UPDATE alumnos SET bloqueado = ? WHERE correo = ?`; // Asumiendo que la tabla es 'alumnos'
    //connection.query(query, [estado, correo], (err, result) => {
        //if (err) {
        //    console.error(err);
        //    return res.status(500).send('Error al actualizar el estado del usuario');
       // }
       // res.send('Estado del usuario actualizado correctamente');
   // });
//});
  




  app.post('/login', (req, res) => {
    const { correo, contrasena } = req.body;
  
    // Verifica si el usuario existe y está bloqueado
    const query = `
      SELECT * FROM ${table}
      WHERE correo = ? AND contrasena = ? AND bloqueado = 0
    `;
    db.query(query, [correo, contrasena], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error en la autenticación');
      }
      if (result.length > 0) {
        // Autenticación exitosa
        req.session.user = result[0];
        res.redirect('/home');
      } else {
        // Usuario no encontrado o bloqueado
        res.status(401).send('Correo o contraseña incorrectos o cuenta bloqueada');
      }
    });
  });
  


// Ruta para la vista de administración de usuarios
app.get('/admin/s_admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    // Renderiza la vista sin consultar la base de datos
    res.render('admin/s_admin', { email, tipo });
});

app.get('/admin/e_admin', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const { email, tipo } = req.session.user;

    if (tipo !== 'admin') {
        return res.status(403).send('Acceso denegado');
    }

    // Renderiza la vista sin consultar la base de datos
    res.render('admin/e_admin', { email, tipo });
});






// Ruta para obtener los usuarios filtrados por año y sección
app.get('/filtrar-usuarios', (req, res) => {
    const { año, seccion } = req.query;

    // Consulta para filtrar por año y sección
    let query = 'SELECT * FROM alumnos WHERE 1=1';
    const queryParams = [];

    if (año) {
        query += ' AND año = ?';
        queryParams.push(año);
    }

    if (seccion) {
        query += ' AND seccion = ?';
        queryParams.push(seccion);
    }

    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error al obtener los usuarios filtrados:', err);
            return res.status(500).send('Error del servidor');
        }

        res.json(results);
    });
});


// Ruta para manejar la inserción de nuevos usuarios
app.post('/add-user', (req, res) => {
    const { nombre, correo, contraseña, rol } = req.body;

    if (!nombre || !correo || !contraseña || !rol) {
        return res.status(400).send('Todos los campos son requeridos');
    }

    let table = '';
    if (rol === 'student') {
        table = 'alumnos';
    } else if (rol === 'teacher') {
        table = 'docentes';
    } else if (rol === 'admin') {
        table = 'administradores';
    } else {
        return res.status(400).send('Rol no válido');
    }

    // Verifica si el usuario ya existe
    const checkQuery = `SELECT * FROM ${table} WHERE correo = ?`;
    connection.query(checkQuery, [correo], (err, results) => {
        if (err) {
            console.error('Error al verificar el usuario:', err);
            return res.status(500).send('Error al verificar el usuario');
        } 
        
        // Si el usuario ya existe, muestra un mensaje de error
        if (results.length > 0) {
            return res.status(409).send('El usuario ya existe');
        }

        // Inserta el nuevo usuario
        const insertQuery = `INSERT INTO ${table} (nombre, correo, contraseña) VALUES (?, ?, ?)`;
        connection.query(insertQuery, [nombre, correo, contraseña], (err) => {
            if (err) {
                console.error('Error al insertar el nuevo usuario:', err);
                return res.status(500).send('Error al insertar el usuario');
            }
            
            // Redirige a la página deseada
            res.redirect('/admin/u_admin.html');
        });
    });
});



//año academico
// Ruta para obtener los usuarios filtrados por año y sección
app.get('/filtrar-usuarios', (req, res) => {
    const { año, seccion } = req.query;

    // Consulta para filtrar por año y sección
    let query = 'SELECT * FROM alumnos WHERE 1=1';
    const queryParams = [];

    if (año) {
        query += ' AND anio_academico = ?';  // Asegúrate de que 'anio_academico' es el nombre correcto
        queryParams.push(año);
    }

    if (seccion) {
        query += ' AND seccion = ?';
        queryParams.push(seccion);
    }

    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error al obtener los usuarios filtrados:', err);
            return res.status(500).send('Error del servidor');
        }

        res.json(results);
    });
});

// Ruta para la vista de panel de alumnos
app.get('/docente/p_alum', (req, res) => {
    const añoSeleccionado = req.query.años || ''; // Obtener el año seleccionado del query string

    let query = 'SELECT * FROM alumnos WHERE 1=1';
    const queryParams = [];

    if (añoSeleccionado && añoSeleccionado !== 'todos') {
        // Si se selecciona un año específico, agregar un filtro a la consulta
        query += ' AND anio_academico = ?';  // Asegúrate de que 'anio_academico' es el nombre correcto
        queryParams.push(añoSeleccionado);
    }

    connection.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error al obtener los usuarios filtrados:', err);
            res.status(500).send('Error en la base de datos');
        } else {
            res.render('p_alum', { alumnos: results });
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

 //Ruta para manejar las solicitudes del chatbot
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const response = await axios.post('https:api.openai.com/v1/chat/completions', {
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

app.use((req, res, next) => {
    console.log(`Ruta solicitada: ${req.url}`);
    next();
});