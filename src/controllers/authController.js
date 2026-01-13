const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.js');
const PasswordReset = require('../models/PasswordReset.js');
const { sendPasswordReset } = require('../services/mailService.js');
const logger = require('../config/logger.js');

const signToken = (user) => {
    return jwt.sign({
        sub: user._id,
        rol: user.rol
    }, process.env.JWT_SECRET, { expiresIn: '12h' });
};

const register = async (req, res, next) => {
    try {
        const { nombre, email, password } = req.body;
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'Email ya registrado '});
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ nombre, email, passwordHash });
        const token = signToken(user);
        res.status(201).json({
            token,
            nombre: user.nombre,
            rol: user.rol
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ message: 'Credenciales inválidas'});
        }
        const token = signToken(user);
        res.json({
            token,
            nombre: user.nombre,
            rol: user.rol
        });
    } catch (error) {
        next(error);
    }
};

const me = async (req, res) => {
    const { passwordHash, ...data } = req.user;
    res.json(data);
};

const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        logger.info(`Solicitud de recuperación de contraseña para: ${email}`);
        
        const user = await User.findOne({ email });
        
        const successMessage = 'Si el email existe en nuestro sistema, recibirás un correo con instrucciones para recuperar tu contraseña.';
        
        if (!user) {
            await new Promise(resolve => setTimeout(resolve, 500));
            logger.warn(`Intento de recuperación para email no registrado: ${email}`);
            return res.json({ message: successMessage });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        
        await PasswordReset.updateMany(
            { userId: user._id, used: false },
            { used: true }
        );
        
        await PasswordReset.create({
            userId: user._id,
            token,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });
        
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
        
        logger.info(`Token de recuperación generado para ${email}. Enviando email...`);
        
        await sendPasswordReset(user, resetLink, token);
        
        logger.info(`Email de recuperación enviado exitosamente a ${email}`);
        
        res.json({ message: successMessage });
    } catch (error) {
        logger.error('Error en requestPasswordReset:', error);
        next(error);
    }
};

const verifyResetToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        
        logger.info(`Verificando token de recuperación: ${token.substring(0, 10)}...`);
        
        const resetRequest = await PasswordReset.findOne({
            token,
            used: false,
            expiresAt: { $gt: new Date() }
        }).populate('userId', 'email nombre');
        
        if (!resetRequest) {
            logger.warn(`Token inválido o expirado: ${token.substring(0, 10)}...`);
            return res.status(400).json({ 
                message: 'Token inválido o expirado. Por favor, solicita una nueva recuperación de contraseña.' 
            });
        }
        
        logger.info(`Token válido para usuario: ${resetRequest.userId.email}`);
        
        res.json({ 
            valid: true,
            email: resetRequest.userId.email
        });
    } catch (error) {
        logger.error('Error en verifyResetToken:', error);
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        
        logger.info(`Intento de restablecimiento de contraseña con token: ${token.substring(0, 10)}...`);
        
        const resetRequest = await PasswordReset.findOne({
            token,
            used: false,
            expiresAt: { $gt: new Date() }
        });
        
        if (!resetRequest) {
            logger.warn(`Token inválido o expirado en resetPassword: ${token.substring(0, 10)}...`);
            return res.status(400).json({ 
                message: 'Token inválido o expirado. Por favor, solicita una nueva recuperación de contraseña.' 
            });
        }
        
        const user = await User.findById(resetRequest.userId);
        
        if (!user) {
            logger.error(`Usuario no encontrado para token: ${token.substring(0, 10)}...`);
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        user.passwordHash = passwordHash;
        await user.save();
        
        resetRequest.used = true;
        await resetRequest.save();
        
        logger.info(`Contraseña restablecida exitosamente para usuario: ${user.email}`);
        
        res.json({ 
            message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.' 
        });
    } catch (error) {
        logger.error('Error en resetPassword:', error);
        next(error);
    }
};

module.exports = {
    register,
    login,
    me,
    requestPasswordReset,
    verifyResetToken,
    resetPassword
};