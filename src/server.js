require('dotenv').config();
const http = require('http');
const app = require('./app.js');
const { connectDB } = require('./config/db.js');
const logger = require('./config/logger.js');
const { scheduleLoanReminders } = require('./jobs/reminderJob.js')

const PORT = process.env.PORT || 3000;

const start = async () => {
    try {
        await connectDB();
        const server = http.createServer(app);
        server.listen(PORT, () => {
            logger.info(`Servidor escuchando en puerto ${PORT}`);
        });
        scheduleLoanReminders();
    } catch (error) {
        logger.error('No se pudo iniciar el servidor', error);
        process.exit(1);
    }
};

start();

process.on('unhandledRejection', (reason) => {
    logger.error('Excepción no controlada', reason);
    process.exit(1);
});