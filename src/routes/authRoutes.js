const express = require('express');
const { register, login, me, requestPasswordReset, verifyResetToken, resetPassword } = require('../controllers/authController.js');
const authJWT = require('../middlewares/authJWT.js');
const validate = require('../middlewares/validate.js');
const { registerValidator, loginValidator } = require('../validators/authValidator.js');
const { body } = require('express-validator');

const router = express.Router();

const resetRequestValidator = [
    body('email').trim().isEmail().withMessage('Email inválido')
];

const resetPasswordValidator = [
    body('token').notEmpty().withMessage('Token requerido'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password mínimo 8 caracteres')
];

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.get('/me', authJWT, me);

router.post('/request-password-reset', resetRequestValidator, validate, requestPasswordReset);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

module.exports = router;