const cron = require('node-cron');
const Loan = require('../models/Loan.js');
const { sendRecordatorio } = require('../services/mailService.js');

const scheduleLoanReminders = () => {
    return cron.schedule('0 9 * * *', async () => {
        const now = new Date();
        const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const loans = await Loan.find({
            estado: 'Aprobado',
            fecha_estimada: { $gte: now, $lte: limit }
        }).populate(['usuario', 'item']);

        await Promise.all(loans.map((loan) => sendRecordatorio(loan.usuario, loan, loan.item)));
    }, {
        timezone: process.env.TZ || 'America/Bogota'
    });
};

module.exports = {
    scheduleLoanReminders
};