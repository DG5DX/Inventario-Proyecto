const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info': 'debug',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM.DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json(),
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, stack, ...meta}) => {
                    const rest = Object.keys(meta).lenght ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} [${level}]: ${stack || message} ${rest}`;
                })
            )
        })
    ]
});

module.exports = logger;