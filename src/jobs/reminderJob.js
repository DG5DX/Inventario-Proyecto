const cron = require('node-cron');
const Loan = require('../models/Loan.js');
const { sendRecordatorio, sendVencimiento, notifyAdminsOverdueLoans } = require('../services/mailService.js');

const scheduleLoanReminders = () => {
    // Recordatorio 24h antes de vencer (9am diario)
    cron.schedule('0 9 * * *', async () => {
        try {
            const now   = new Date();
            const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const loans = await Loan.find({
                estado: { $in: ['Aprobado', 'Aplazado'] },
                fecha_estimada: { $gte: now, $lte: limit }
            })
            .populate('usuario')
            .populate('items.item')
            .populate('items.aula');

            await Promise.all(
                loans
                    .filter(loan => loan.usuario)
                    .map(loan => sendRecordatorio(loan.usuario, loan))
            );
        } catch (err) {
            console.error('Error en job de recordatorios:', err);
        }
    }, { timezone: process.env.TZ || 'America/Bogota' });

    cron.schedule('0 10 * * *', async () => {
        try {
            const now = new Date();
            const overdueLoans = await Loan.find({
                estado: { $in: ['Aprobado', 'Aplazado'] },
                fecha_estimada: { $lt: now }
            })
            .populate('usuario')
            .populate('items.item')
            .populate('items.aula');

            if (overdueLoans.length === 0) return;

            const porUsuario = new Map();
            for (const loan of overdueLoans) {
                if (!loan.usuario) continue;
                const uid = String(loan.usuario._id);
                if (!porUsuario.has(uid)) {
                    porUsuario.set(uid, { usuario: loan.usuario, loans: [] });
                }
                porUsuario.get(uid).loans.push(loan);
            }

            await Promise.all(
                [...porUsuario.values()].map(({ usuario, loans }) =>
                    sendVencimiento(usuario, loans)
                )
            );

            await notifyAdminsOverdueLoans(overdueLoans);

        } catch (err) {
            console.error('Error en job de vencimientos:', err);
        }
    }, { timezone: process.env.TZ || 'America/Bogota' });
};

module.exports = { scheduleLoanReminders };