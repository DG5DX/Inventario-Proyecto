const { body } = require('express-validator');

const zoneBody = [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 150}),
    body('descripcion').optional().trim().isLength({ max: 500 })
];

module.exports = { zoneBody };