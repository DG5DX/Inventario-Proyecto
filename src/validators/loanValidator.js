const { body } = require('express-validator');

const createLoanValidator = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Debes incluir al menos un ítem'),
    body('items.*.item')
        .isMongoId()
        .withMessage('ID de ítem inválido'),
    body('items.*.aula')
        .isMongoId()
        .withMessage('ID de aula inválido'),
    body('items.*.cantidad_prestamo')
        .isInt({ min: 1 })
        .withMessage('La cantidad debe ser un entero mayor a 0'),
    body('items.*.observacion_item')
        .optional({ nullable: true, checkFalsy: true })
        .isString().trim()
        .isLength({ max: 300 }).withMessage('Observación del ítem máximo 300 caracteres'),
    body('fecha_sugerida_usuario')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601().toDate()
        .withMessage('Fecha sugerida inválida'),
    body('observacion_solicitud')
        .optional({ nullable: true, checkFalsy: true })
        .isString().trim()
        .isLength({ max: 500 }).withMessage('Observación máximo 500 caracteres'),
    body('destino_salida')
        .notEmpty().withMessage('El destino de salida es obligatorio')
        .isString().trim()
        .isLength({ max: 120 }).withMessage('Destino máximo 120 caracteres'),
];

const approveLoanValidator = [
    body('fecha_estimada')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601().toDate()
        .withMessage('Fecha estimada inválida'),
    body('approvals')
        .optional()
        .isArray(),
    body('approvals.*.loanItemId')
        .optional()
        .isMongoId(),
    body('approvals.*.cantidad_aprobada')
        .optional()
        .isInt({ min: 0 }),
    body('itemsToRemove')
        .optional()
        .isArray(),
    body('itemsToRemove.*')
        .optional()
        .isMongoId(),
    body('observacion_aprobacion')
        .optional({ nullable: true, checkFalsy: true })
        .isString().trim()
        .isLength({ max: 500 }),
];

const delayLoanValidator = [
    body('nueva_fecha_estimada')
        .isISO8601().toDate()
        .withMessage('Nueva fecha inválida'),
];

const rejectLoanValidator = [
    body('observacion_rechazo')
        .optional({ nullable: true, checkFalsy: true })
        .isString().trim()
        .isLength({ max: 500 }).withMessage('Observación máximo 500 caracteres'),
];

module.exports = {
    createLoanValidator,
    approveLoanValidator,
    delayLoanValidator,
    rejectLoanValidator,
};