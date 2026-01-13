const { body } = require('express-validator');

const createLoanValidator = [
    body('item').isMongoId().withMessage('Ítem inválido'),
    body('aula').isMongoId().withMessage('Aula inválida'),
    body('cantidad_prestamo').isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0')
];

const approveLoanValidator = [
    body('fecha_estimada').isISO8601().toDate().withMessage('Fecha estimada inválida')
];

const delayLoanValidator = [
    body('nueva_fecha_estimada').isISO8601().toDate().withMessage('Nueva fecha inválida')
];

module.exports = {
    createLoanValidator,
    approveLoanValidator,
    delayLoanValidator
};