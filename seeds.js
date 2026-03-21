/**
 * seeds.js — Datos iniciales para desarrollo y pruebas
 *
 * Uso:
 *   node seeds.js                        # Sembrar sin borrar datos existentes
 *   node seeds.js --reset                # Limpiar toda la BD y resembrar
 *   node seeds.js --only=users           # Solo sembrar usuarios
 *
 * ADVERTENCIA: No ejecutar contra base de datos de producción sin
 *              establecer SEEDS_ALLOW_CLOUD=true en el .env.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// Modelos 
const User        = require('./src/models/User.js');

// Argumentos CLI
const args  = process.argv.slice(2);
const reset = args.includes('--reset');
const only  = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '') || null;

// Helpers 
const hash = (plain) => bcrypt.hash(plain, 10);
const log  = (msg)   => console.log(`  ✔  ${msg}`);
const warn = (msg)   => console.warn(`  ⚠  ${msg}`);

// DATOS SEMILLA

// Usuarios 
const USERS_DATA = [
    {
        nombre:   'Super Administrador',
        email:    'superadmin@inventario.com',
        password: 'SuperAdmin123!',
        rol:      'SuperAdmin',
    },
    {
        nombre:   'Administrador Principal',
        email:    'admin@inventario.com',
        password: 'Admin1234!',
        rol:      'Admin',
    },
];

// FUNCIONES DE SEED

async function seedUsers() {
    console.log('\n👤 Sembrando usuarios...');
    let created = 0, skipped = 0;

    for (const u of USERS_DATA) {
        const exists = await User.findOne({ email: u.email });
        if (exists) { warn(`Usuario ya existe: ${u.email}`); skipped++; continue; }
        const passwordHash = await hash(u.password);
        await User.create({ nombre: u.nombre, email: u.email, passwordHash, rol: u.rol });
        log(`Creado [${u.rol.padEnd(10)}] ${u.nombre} — ${u.email}`);
        created++;
    }
    console.log(`   → ${created} creados, ${skipped} omitidos`);
}

async function resetDB() {
    console.log('\n🗑️  Limpiando base de datos...');
    await User.deleteMany({});
    console.log('   Base de datos limpia.');
}

// EJECUCIÓN PRINCIPAL

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('❌ MONGO_URI no definido en .env');
        process.exit(1);
    }

    // Protección contra ejecución accidental en producción (MongoDB Atlas)
    if (uri.includes('mongodb.net') && !uri.includes('localhost')) {
        if (process.env.SEEDS_ALLOW_CLOUD !== 'true') {
            console.error('❌ Se detectó una URI de nube (MongoDB Atlas).');
            console.error('   Agrega SEEDS_ALLOW_CLOUD=true al .env para confirmar.');
            process.exit(1);
        }
        console.warn('⚠️  Ejecutando seeds contra MongoDB Atlas. Asegúrate de que es un entorno de prueba.');
    }

    console.log('🌱 Iniciando seed del sistema de inventario SENA...');
    console.log(`   URI: ${uri.replace(/:[^@]+@/, ':****@')}`);

    await mongoose.connect(uri);
    console.log('   Conectado a MongoDB ✓\n');

    if (reset) await resetDB();

    // Semillas independientes
    if (!only || only === 'users') await seedUsers();

    //  Resumen final 
    console.log('\n✅ Seed completado exitosamente.\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📋 Credenciales de acceso:');
    console.log('   SuperAdmin → superadmin@inventario.com  / SuperAdmin123!');
    console.log('   Admin      → admin@inventario.com       / Admin1234!');
    console.log('═══════════════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Error en el seed:', err.message);
    mongoose.disconnect();
    process.exit(1);
});