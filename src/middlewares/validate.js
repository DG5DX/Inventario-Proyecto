const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            message: 'Datos inválidos',
            errors: errors.array()
        });
    } 
    return next();
};

module.exports = validate;