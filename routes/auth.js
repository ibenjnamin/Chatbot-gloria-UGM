const connection = require('../layout/config'); // Ajusta la ruta si es necesario

const authenticate = (email, password, callback) => {
    let table;

    if (email.endsWith('@estudiante.ugm.cl')) {
        table = 'alumnos';
    } else if (email.endsWith('@academico.ugm.cl')) {
        table = 'docentes';
    } else if (email.endsWith('@ugm.cl')) {
        table = 'administradores';
    } else {
        console.log('Tipo de usuario no válido');
        return callback(null);
    }

    const sql = `SELECT * FROM ${table} WHERE correo = ?`;
    connection.query(sql, [email], (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta:', err);
            return callback(null);
        }

        if (results.length === 0) {
            console.log('Usuario no encontrado');
            return callback(null);
        }

        const user = results[0];
        console.log('Usuario encontrado:', user);

        if (password === user.contraseña) {
            if (table === 'alumnos') {
                return callback({ type: 'student' });
            } else if (table === 'docentes') {
                return callback({ type: 'teacher' });
            } else if (table === 'administradores') {
                return callback({ type: 'admin' });
            }
        } else {
            console.log('Contraseña incorrecta');
            return callback(null);
        }
    });
};

module.exports = { authenticate };
