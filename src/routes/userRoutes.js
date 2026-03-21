const express = require('express');
const {
    getUsers,
    createUser,
    updateUserRole,
    updateUserAmbientes,
    getUser
} = require('../controllers/userController.js');
const authJWT = require('../middlewares/authJWT.js');
const roleGuard = require('../middlewares/roleGuard.js');
const validate = require('../middlewares/validate.js');
const { body } = require('express-validator');

const router = express.Router();

const createUserValidator = [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Email inválido').isLength({ max: 350 }),
    body('password').isLength({ min: 8 }).withMessage('Password mínimo 8 caracteres'),
    body('rol').optional().isIn(['SuperAdmin', 'Admin', 'Comun']).withMessage('Rol inválido')
];

const updateRoleValidator = [
    body('rol').isIn(['SuperAdmin', 'Admin', 'Comun']).withMessage('Rol inválido')
];

const updateAmbientesValidator = [
    body('ambientes')
        .isArray().withMessage('ambientes debe ser un array')
        .custom(arr => arr.every(id => typeof id === 'string' && id.length === 24))
        .withMessage('Todos los IDs de ambientes deben ser válidos')
];

router.use(authJWT, roleGuard(['SuperAdmin', 'Admin']));

router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', createUserValidator, validate, createUser);

// Solo SuperAdmin puede cambiar roles y asignar ambientes
router.patch('/:id/role', roleGuard(['SuperAdmin']), updateRoleValidator, validate, updateUserRole);
router.patch('/:id/ambientes', roleGuard(['SuperAdmin']), updateAmbientesValidator, validate, updateUserAmbientes);

module.exports = router;