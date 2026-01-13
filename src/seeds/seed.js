require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db.js');
const User = require('../models/User');
const Category = require('../models/Category.js');
const Classroom = require('../models/Classroom');
const Item = require('../models/Item.js');
const logger = require('../config/logger.js');

const seed = async () => {
    await connectDB();
    await Promise.all([
        User.deleteMany({}),
        Category.deleteMany({}),
        Classroom.deleteMany({}),
        Item.deleteMany({})
    ]);

    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const userPassword = await bcrypt.hash('Usuario123!', 10);

    await User.create([
        {nombre: 'Administrador', email: 'admin@demo.com', passwordHash: adminPassword, rol: 'Admin' },
        { nombre: 'Usuario Demo', email: 'usuario@demo.com', passwordHash: userPassword, rol: 'Comun' }
    ]);

    const categorias = await Category.create([
    { nombre: 'Electrónica', descripcion: 'Componentes electrónicos' },
    ]);

    const aulas = await Classroom.create([
    { nombre: 'Laboratorio 101', descripcion: 'Laboratorio principal' },
    ]);

    const [electronica, herramientas, material] = categorias;
    const [lab, taller] = aulas;

    const itemsData = [
    { nombre: 'Multímetro', categoria: electronica._id, aula: lab._id, cantidad_total_stock: 10, cantidad_disponible: 10, tipo_categoria: 'Herramienta de equipo', estado: 'Disponible' },
];

    await Item.insertMany(itemsData);

    logger.info('Seed completado');
    await mongoose.disconnect();
};

seed().catch((error) => {
    logger.error('Error en seed', error);
    mongoose.disconnect();
});