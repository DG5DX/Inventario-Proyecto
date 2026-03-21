const { body, query } = require('express-validator');

const tipos = ['Consumible', 'De Uso Controlado', 'Equipo O Maquinaria'];
const estados = ['Disponible', 'Agotado'];

const itemBody = [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 150 }),
    body('descripcion').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }),
    body('zona').isMongoId().withMessage('Zona inválida'),
    body('aula').isMongoId().withMessage('Aula inválida'),
    body('cantidad_total_stock').isInt({ min: 0 }),
    body('cantidad_disponible').isInt({ min: 0 }),
    body('imagen').optional({ nullable: true, checkFalsy: true }).trim(),
    body('numero_placa').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
    body('tipo_categoria').isIn(tipos).withMessage('Tipo de categoría inválido'),
    body('estado').optional().isIn(estados),
    body('cuentadante').isMongoId().withMessage('Cuentadante inválido o requerido'),
];

const itemsQuery = [
    query('zona').optional().isMongoId(),
    query('aula').optional().isMongoId(),
    query('q').optional().trim().escape()
];

module.exports = {
    itemBody,
    itemsQuery
};