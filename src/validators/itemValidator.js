const { body, query } = require('express-validator');

const tipos = ['Consumible', 'Devolutivo', 'Trasladado', 'Placa SENA', 'Herramienta de equipo', 'Insumo', 'De Uso Controlado'];
const estados = ['Disponible', 'Agotado'];

const itemBody = [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 150}),
    body('descripcion').optional().trim().isLength({ max: 500}),
    body('categoria').isMongoId().withMessage('Categoría inválida'),
    body('aula').isMongoId().withMessage('Aula inválida'),
    body('cantidad_total_stock').isInt({ min: 0 }),
    body('cantidad_disponible').isInt({ min: 0 }),
    body('imagen').optional().trim(),
    body('tipo_categoria').isIn(tipos),
    body('estado').optional().isIn(estados),
];

const itemsQuery = [
    query('categoria').optional().isMongoId(),
    query('aula').optional().isMongoId(),
    query('q').optional().trim().escape()
];

module.exports = {
    itemBody,
    itemsQuery
};