const bcrypt = require('bcryptjs');
const User = require('../models/User.js');
const Classroom = require('../models/Classroom.js');

// Jerarquía de roles: SuperAdmin > Admin > Comun
const ROLE_HIERARCHY = { SuperAdmin: 3, Admin: 2, Comun: 1 };

const canManage = (actorRol, targetRol) =>
    (ROLE_HIERARCHY[actorRol] ?? 0) > (ROLE_HIERARCHY[targetRol] ?? 0);

// ── GET /users ─────────────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
    try {
        const users = await User.find()
            .select('-passwordHash')
            .populate('ambientes_asignados', 'nombre descripcion zona')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        next(error);
    }
};

// ── GET /users/:id ─────────────────────────────────────────────────────────────
const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-passwordHash')
            .populate('ambientes_asignados', 'nombre descripcion zona');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user);
    } catch (error) {
        next(error);
    }
};

// ── POST /users ────────────────────────────────────────────────────────────────
const createUser = async (req, res, next) => {
    try {
        const { nombre, email, password, rol } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Ya existe un usuario con ese email' });

        const rolSolicitado = rol || 'Comun';
        if (!canManage(req.user.rol, rolSolicitado)) {
            return res.status(403).json({
                message: `No tienes permiso para crear usuarios con rol "${rolSolicitado}"`
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ nombre, email, passwordHash, rol: rolSolicitado });
        const { passwordHash: _, ...userData } = user.toObject();
        res.status(201).json(userData);
    } catch (error) {
        next(error);
    }
};

// ── PATCH /users/:id/role ──────────────────────────────────────────────────────
const updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;

        if (req.user.rol !== 'SuperAdmin') {
            return res.status(403).json({
                message: 'Solo el SuperAdmin puede asignar o modificar roles de usuario'
            });
        }
        if (req.user._id.toString() === id) {
            return res.status(400).json({ message: 'No puedes cambiar tu propio rol' });
        }

        const target = await User.findById(id).select('-passwordHash');
        if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
        if (target.rol === 'SuperAdmin') {
            return res.status(403).json({ message: 'No puedes modificar el rol de otro SuperAdmin' });
        }
        if (rol === 'SuperAdmin') {
            return res.status(403).json({ message: 'No se puede asignar el rol SuperAdmin desde esta acción' });
        }

        // Si se degrada a Comun, limpiar ambientes asignados
        if (rol === 'Comun') {
            target.ambientes_asignados = [];
        }

        target.rol = rol;
        await target.save();
        res.json(target);
    } catch (error) {
        next(error);
    }
};

// ── PATCH /users/:id/ambientes ─────────────────────────────────────────────────
/**
 * Asigna o reemplaza la lista de ambientes de un Admin.
 * Solo SuperAdmin puede usar este endpoint.
 * Body: { ambientes: [aulaId, aulaId, ...] }
 */
const updateUserAmbientes = async (req, res, next) => {
    try {
        if (req.user.rol !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Solo el SuperAdmin puede asignar ambientes' });
        }

        const target = await User.findById(req.params.id).select('-passwordHash');
        if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });
        if (target.rol !== 'Admin') {
            return res.status(400).json({ message: 'Solo se pueden asignar ambientes a usuarios con rol Admin' });
        }

        const { ambientes } = req.body;
        if (!Array.isArray(ambientes)) {
            return res.status(400).json({ message: 'El campo ambientes debe ser un array de IDs' });
        }

        // Validar que todos los IDs existen
        if (ambientes.length > 0) {
            const count = await Classroom.countDocuments({ _id: { $in: ambientes } });
            if (count !== ambientes.length) {
                return res.status(400).json({ message: 'Uno o más ambientes no existen' });
            }
        }

        target.ambientes_asignados = ambientes;
        await target.save();

        const populated = await User.findById(target._id)
            .select('-passwordHash')
            .populate('ambientes_asignados', 'nombre descripcion zona');
        res.json(populated);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUsers,
    createUser,
    updateUserRole,
    updateUserAmbientes,
    getUser
};