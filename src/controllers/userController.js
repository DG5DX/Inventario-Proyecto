const bcrypt = require('bcryptjs');
const User = require('../models/User.js');

const getUsers = async (req, res, next) => {
    try {
        const users = await User.find()
            .select('-passwordHash')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        next(error);
    }
};

const createUser = async (req, res, next) => {
    try {
        const { nombre, email, password, rol } = req.body;
        
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'Ya existe un usuario con ese email' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const user = await User.create({ 
            nombre, 
            email, 
            passwordHash,
            rol: rol || 'Comun'
        });
        
        const { passwordHash: _, ...userData } = user.toObject();
        
        res.status(201).json(userData);
    } catch (error) {
        next(error);
    }
};

const updateUserRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;
        
        if (!['Admin', 'Comun'].includes(rol)) {
            return res.status(400).json({ message: 'Rol inválido. Debe ser Admin o Comun' });
        }
        
        if (req.user._id.toString() === id && rol === 'Comun') {
            return res.status(400).json({ message: 'No puedes cambiar tu propio rol' });
        }
        
        const user = await User.findByIdAndUpdate(
            id,
            { rol },
            { new: true, runValidators: true }
        ).select('-passwordHash');
        
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        res.json(user);
    } catch (error) {
        next(error);
    }
};

const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-passwordHash');
        
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        res.json(user);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUsers,
    createUser,
    updateUserRole,
    getUser
};