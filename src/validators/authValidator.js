const { body } = require('express-validator');

const registerValidator = [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Email inválidado').isLength({ max: 350 }),
    body('password').isLength({ min: 8 }).withMessage('Password mínimo 8 caracteres')
];

const loginValidator = [
    body('email').trim().isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Password requerido')
];

module.exports = {
    registerValidator,
    loginValidator
};