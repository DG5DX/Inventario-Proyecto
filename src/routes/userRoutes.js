const express = require('express');
const {
    getUsers,
    createUser,
    updateUserRole,
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
    body('rol').optional().isIn(['Admin', 'Comun']).withMessage('Rol debe ser Admin o Comun')
];

const updateRoleValidator = [
    body('rol').isIn(['Admin', 'Comun']).withMessage('Rol debe ser Admin o Comun')
];


router.use(authJWT, roleGuard(['Admin']));


router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', createUserValidator, validate, createUser);
router.patch('/:id/role', updateRoleValidator, validate, updateUserRole);

module.exports = router;