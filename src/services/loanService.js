const mongoose = require('mongoose');
const Loan = require('../models/Loan.js');
const Item = require('../models/Item.js');
const User = require('../models/User.js'); 
const Classroom = require('../models/Classroom.js'); 
const logger = require('../config/logger.js'); 
const {
    sendAprobacion,
    sendDevolucion,
    sendAplazado,
    notifyAdminsNewLoan
} = require('./mailService.js');  

const createLoan = async (userId, { item, aula, cantidad_prestamo }) => {
    logger.info(`Creando nueva solicitud de préstamo para usuario: ${userId}`);
    
    const loan = await Loan.create({
        usuario: userId,
        item,
        aula,
        cantidad_prestamo
    });

    logger.info(`Préstamo creado con ID: ${loan._id}`);

    try {
        const [user, itemData, aulaData] = await Promise.all([
            User.findById(userId).lean(),
            Item.findById(item).lean(),
            Classroom.findById(aula).lean()
        ]);

        if (!user || !itemData || !aulaData) {
            logger.warn('No se pudo cargar información completa para notificación a admins');
        } else {
            logger.info('Notificando a administradores sobre nueva solicitud...');
            await notifyAdminsNewLoan(user, loan, itemData, aulaData);
        }
    } catch (emailError) {
        logger.error('Error al notificar administradores, pero préstamo creado exitosamente:', emailError);
    }

    return loan;
};

const approveLoan = async (loanId, fechaEstimada) => {
    logger.info(`Iniciando aprobación de préstamo: ${loanId}`);
    
    const loan = await Loan.findById(loanId);
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    if (loan.estado !== 'Pendiente') throw Object.assign(new Error('El préstamo no está pendiente'), { status: 400 });
    if (!fechaEstimada) throw Object.assign(new Error('La fecha estimada es obligatoria'), { status: 400 });

    logger.info(`Préstamo encontrado. Estado actual: ${loan.estado}`);

    const item = await Item.findById(loan.item);
    if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
    
    logger.info(`Ítem encontrado: ${item.nombre}. Stock disponible: ${item.cantidad_disponible}`);
    
    if (loan.cantidad_prestamo > item.cantidad_disponible) {
        throw Object.assign(new Error('Stock insuficiente'), { status: 400 });
    }

    loan.estado = 'Aprobado';
    loan.fecha_prestamo = new Date();
    loan.fecha_estimada = fechaEstimada;
    await loan.save();
    
    logger.info('Préstamo marcado como aprobado');

    item.cantidad_disponible -= loan.cantidad_prestamo;
    if (item.cantidad_disponible < 0) {
        loan.estado = 'Pendiente';
        loan.fecha_prestamo = null;
        loan.fecha_estimada = null;
        await loan.save();
        throw Object.assign(new Error('Stock insuficiente'), { status: 400 });
    }
    await item.save();
    
    logger.info(`Stock actualizado. Nuevo stock disponible: ${item.cantidad_disponible}`);

    try {
        const populated = await Loan.findById(loan._id).populate(['usuario', 'item', 'aula']);
        await sendAprobacion(populated.usuario, populated, populated.item);
        logger.info(`Email de aprobación enviado a ${populated.usuario.email}`);
    } catch (emailError) {
        logger.error('Error enviando email de aprobación:', emailError);
    }

    return loan;
};

const rejectLoan = async (loanId) => {
    logger.info(`Rechazando préstamo: ${loanId}`);
    
    const loan = await Loan.findById(loanId);
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    if (loan.estado !== 'Pendiente') throw Object.assign(new Error('El préstamo no está pendiente'), { status: 400 });
    
    loan.estado = 'Rechazado';
    await loan.save();
    
    logger.info('Préstamo rechazado exitosamente');
    
    return loan;
};

const returnLoan = async (loanId) => {
    logger.info(`Iniciando devolución de préstamo: ${loanId}`);
    
    const loan = await Loan.findById(loanId);
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    
    logger.info(`Préstamo encontrado. Estado actual: ${loan.estado}`);
    
    if (!['Aprobado', 'Aplazado'].includes(loan.estado)) {
        throw Object.assign(new Error('El préstamo no se puede devolver'), { status: 400 });
    }

    const item = await Item.findById(loan.item);
    if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });
    
    logger.info(`Ítem encontrado: ${item.nombre}. Stock actual: ${item.cantidad_disponible}`);

    loan.estado = 'Devuelto';
    loan.fecha_retorno = new Date();
    await loan.save();
    
    logger.info('Préstamo marcado como devuelto');

    item.cantidad_disponible += loan.cantidad_prestamo;
    if (item.cantidad_disponible > item.cantidad_total_stock) {
        item.cantidad_disponible = item.cantidad_total_stock;
    }
    await item.save();
    
    logger.info(`Stock restaurado. Nuevo stock disponible: ${item.cantidad_disponible}`);

    try {
        const populated = await Loan.findById(loan._id).populate(['usuario', 'item', 'aula']);
        await sendDevolucion(populated.usuario, populated, populated.item);
        logger.info(`Email de devolución enviado a ${populated.usuario.email}`);
    } catch (emailError) {
        logger.error('Error enviando email de devolución:', emailError);
    }

    return loan;
};

const delayLoan = async (loanId, nuevaFecha) => {
    logger.info(`Aplazando préstamo: ${loanId}`);
    
    const loan = await Loan.findById(loanId).populate(['usuario', 'item']);
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    if(!['Aprobado', 'Aplazado'].includes(loan.estado)) {
        throw Object.assign(new Error('El préstamo no puede ser aplazado'), { status: 400 });
    }
    if (!nuevaFecha) throw Object.assign(new Error('La nueva fecha es obligatoria'), { status: 400 });

    loan.estado = 'Aplazado';
    loan.fecha_estimada = nuevaFecha;
    await loan.save();
    
    logger.info(`Préstamo aplazado. Nueva fecha: ${nuevaFecha}`);

    try {
        await sendAplazado(loan.usuario, loan, loan.item);
        logger.info(`Email de aplazamiento enviado a ${loan.usuario.email}`);
    } catch (emailError) {
        logger.error('Error enviando email de aplazamiento:', emailError);
    }

    return loan;
};

const deleteLoan = async (loanId) => {
    logger.info(`Eliminando préstamo: ${loanId}`);
    
    const loan = await Loan.findByIdAndDelete(loanId);
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    
    logger.info('Préstamo eliminado exitosamente (stock NO restaurado automáticamente)');
    
    return loan;
};

const listLoans = async ({ rol, _id}, filtros = {}) => {
    const query = {};
    if (rol !== 'Admin') {
        query.usuario = _id;
    }
    if (filtros.estado) {
        query.estado = filtros.estado;
    }
    return Loan.find(query)
    .populate('usuario item aula')
    .sort({ createdAt: -1 });
};

const getLoanById = async ({ rol, _id }, loanId) => {
    const loan = await Loan.findById(loanId).populate('usuario item aula');
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    if (rol !== 'Admin' && loan.usuario._id.toString() !== _id.toString()) {
        throw Object.assign(new Error('No autorizado'), { status: 403 });
    }
    return loan;
};

module.exports = {
    createLoan,
    approveLoan,
    rejectLoan,
    returnLoan,
    delayLoan,
    deleteLoan,
    listLoans,
    getLoanById
};