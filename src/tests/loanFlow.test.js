jest.mock('../services/mailService', () => ({
    sendAprobacion: jest.fn(),
    sendDevolucion: jest.fn(),
    sendAplazado: jest.fn(),
    sendRecordatorio: jest.fn()
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app.js');
const User = require('../models/User.js');
const Category = require('../models/Category.js');
const Classroom = require('../models/Classroom.js');
const Item = require('../models/Item.js');

const crearAdmin = async () => {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    return User.create({ nombre: 'Admin', email: 'admin@test.com', passwordHash, rol: 'Admin' });
};

const crearUsuario = async () => {
    const passwordHash = await bcrypt.hash('User123!', 10);
    return User.create({ nombre: 'User', email: 'user@test.com', passwordHash, rol: 'Comun' });
};

describe('flujo de préstamos', () => {
    test('usuario solicita, admin aprueba y devuelve préstamo', async () => {
        await crearAdmin();
        await crearUsuario();

        const categoria = await Category.create({ nombre: 'TestCat' });
        const aula = await Classroom.create({ nombre: 'TestAula' });
        const item = await Item.create({
            nombre: 'Microscopio',
            categoria: categoria._id,
            aula: aula._id,
            cantidad_total_stock: 5,
            cantidad_disponible: 5,
            tipo_categoria: 'Herramienta de equipo',
            estado: 'Disponible'
        });

        const loginUsuario = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'User123!' })
        .expect(200);

        const userToken = loginUsuario.body.token;

        const prestamo = await request(app)
        .post('/api/prestamos')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ item: item._id.toString(), aula: aula._id.toString(), cantidad_prestamo: 2 })
        .expect(201);

        const loginAdmin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123!' })
        .expect(200);

        const adminToken = loginAdmin.body.token;
        const fechaEstimada = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

        const aprobado = await request(app)
        .post(`/api/prestamos/${prestamo.body._id}/aprobar`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fecha_estimada: fechaEstimada })
        .expect(200);

        expect(aprobado.body.estado).toBe('Aprobado');

        const devuelto = await request(app)
        .post(`/api/prestamos/${prestamo.body._id}/devolver`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

        expect(devuelto.body.estado).toBe('Devuelto');

        const itemActualizado = await Item.findById(item._id);
        expect(itemActualizado.cantidad_disponible).toBe(5);
    });
});