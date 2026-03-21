const { body } = require('express-validator');

const classroomBody = [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 150 }),
  body('descripcion').optional().trim().isLength({ max: 500 }),
  body('zona').notEmpty().withMessage('La sede (zona) es requerida').isMongoId().withMessage('ID de sede inválido')
];

module.exports = { classroomBody };