const logger = require('../config/logger.js');

const errorHandler = (err, req, res, next) => {
    logger.error(err.message, { stack: err.stack });
    const status = err.status || 500;
    res.status(status).json({
        message: err.message || 'Error interno del servidor'
    });
};

module.exports = errorHandler