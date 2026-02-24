require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db.js');
const User = require('../models/User');
const Zone = require('../models/Zone.js');
const Classroom = require('../models/Classroom');
const Item = require('../models/Item.js');
const logger = require('../config/logger.js');

const seed = async () => {
    await connectDB();
    await Promise.all([
        User.deleteMany({}),
        Zone.deleteMany({}),
        Classroom.deleteMany({}),
        Item.deleteMany({})
    ]);

    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const userPassword = await bcrypt.hash('Usuario123!', 10);

    await User.create([
        {nombre: 'Administrador', email: 'admin@demo.com', passwordHash: adminPassword, rol: 'Admin' },
        { nombre: 'Usuario Demo', email: 'usuario@demo.com', passwordHash: userPassword, rol: 'Comun' }
    ]);

    const zonas = await Zone.create([
    { nombre: 'Electrónica', descripcion: 'Componentes electrónicos' },
    ]);

    const aulas = await Classroom.create([
    { nombre: 'Laboratorio 101', descripcion: 'Laboratorio principal' },
    ]);

    const [electronica, herramientas, material] = zonas;
    const [lab, taller] = aulas;

    const itemsData = [
    { nombre: 'Multímetro', zona: electronica._id, aula: lab._id, cantidad_total_stock: 10, cantidad_disponible: 10, tipo_zona: 'Herramienta de equipo', estado: 'Disponible' },
];

    await Item.insertMany(itemsData);

    logger.info('Seed completado');
    await mongoose.disconnect();
};

seed().catch((error) => {
    logger.error('Error en seed', error);
    mongoose.disconnect();
});