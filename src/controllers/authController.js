const bcrypt        = require('bcryptjs');
const jwt           = require('jsonwebtoken');
const crypto        = require('crypto');
const User          = require('../models/User.js');
const PasswordReset = require('../models/PasswordReset.js');
const { sendPasswordReset, sendEmailHintToUser } = require('../services/mailService.js');
const logger        = require('../config/logger.js');

const signToken = (user) =>
    jwt.sign({ sub: user._id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '12h' });

// ── register ──────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
    try {
        const { nombre, email, password } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Email ya registrado' });
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ nombre, email, passwordHash });
        const token = signToken(user);
        res.status(201).json({ token, nombre: user.nombre, rol: user.rol });
    } catch (error) { next(error); }
};

// ── login ─────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return res.status(401).json({ message: 'Credenciales inválidas' });
        const token = signToken(user);
        res.json({ token, nombre: user.nombre, rol: user.rol });
    } catch (error) { next(error); }
};

// ── me — incluye ambientes_asignados para Admins ──────────────────────────────
const me = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-passwordHash')
            .populate({
                path: 'ambientes_asignados',
                select: '_id nombre zona',
                populate: { path: 'zona', select: '_id nombre' }
            });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user);
    } catch (err) {
        const { passwordHash, ...data } = req.user;
        res.json(data);
    }
};

// ── requestPasswordReset ──────────────────────────────────────────────────────
const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        logger.info(`Solicitud de recuperación de contraseña para: ${email}`);
        const user = await User.findOne({ email });
        const successMessage = 'Si el email existe en nuestro sistema, recibirás un correo con instrucciones.';
        if (!user) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return res.json({ message: successMessage });
        }
        const token = crypto.randomBytes(32).toString('hex');
        await PasswordReset.updateMany({ userId: user._id, used: false }, { used: true });
        await PasswordReset.create({
            userId: user._id, token,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });
        const rawUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
        const frontendUrl = rawUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;
        logger.info(`🔗 Reset link: ${resetLink}`);
        setImmediate(async () => {
            try { await sendPasswordReset(user, resetLink); } catch (e) { logger.error(e.message); }
        });
        res.json({ message: successMessage });
    } catch (error) { next(error); }
};

// ── verifyResetToken ──────────────────────────────────────────────────────────
const verifyResetToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        const resetRequest = await PasswordReset.findOne({
            token, used: false, expiresAt: { $gt: new Date() }
        }).populate('userId', 'email nombre');
        if (!resetRequest) return res.status(400).json({ message: 'Token inválido o expirado.' });
        res.json({ valid: true, email: resetRequest.userId.email });
    } catch (error) { next(error); }
};

// ── resetPassword ─────────────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        const resetRequest = await PasswordReset.findOne({
            token, used: false, expiresAt: { $gt: new Date() }
        });
        if (!resetRequest) return res.status(400).json({ message: 'Token inválido o expirado.' });
        const user = await User.findById(resetRequest.userId);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        user.passwordHash = await bcrypt.hash(newPassword, 10);
        await user.save();
        resetRequest.used = true;
        await resetRequest.save();
        res.json({ message: 'Contraseña restablecida exitosamente.' });
    } catch (error) { next(error); }
};

// ── hintEmail ─────────────────────────────────────────────────────────────────
const maskEmail = (email) => {
    const [local, domain] = email.split('@');
    const visible = Math.max(2, Math.floor(local.length / 3));
    return local.slice(0, visible) + '*'.repeat(local.length - visible) + '@' + domain;
};

const hintEmail = async (req, res, next) => {
    try {
        const { nombre } = req.body;
        if (!nombre || nombre.trim().length < 2)
            return res.status(400).json({ message: 'Nombre requerido (mínimo 2 caracteres)' });
        const regex = new RegExp(nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const users = await User.find({ nombre: regex }).select('nombre email').limit(5).lean();
        const hints = users.map(u => ({ userId: u._id, nombre: u.nombre, emailHint: maskEmail(u.email) }));
        res.json({ hints });
    } catch (error) { next(error); }
};

const sendEmailHint = async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId requerido' });
        const user = await User.findById(userId).select('nombre email').lean();
        if (user) {
            setImmediate(async () => {
                try { await sendEmailHintToUser(user); } catch (err) { logger.error(err.message); }
            });
        }
        res.json({ sent: true });
    } catch (error) { next(error); }
};

module.exports = {
    register, login, me,
    requestPasswordReset, verifyResetToken, resetPassword,
    hintEmail, sendEmailHint,
};