const Loan   = require('../models/Loan.js');
const Item   = require('../models/Item.js');
const User   = require('../models/User.js');
const logger = require('../config/logger.js');
const {
    sendAprobacion, sendDevolucion, sendConfirmacionParcialUsuario,
    sendAplazado, sendRechazo, notifyAdminsNewLoan, notifyAdminsReturnRequest
} = require('./mailService.js');

const populateLoan = (query) =>
    query
        .populate('usuario')
        .populate({ path: 'items.item', populate: { path: 'cuentadante' } })
        .populate('items.aula')
        .populate('cuentadante_principal');

// ─── CREATE ───────────────────────────────────────────────────────────────────
const createLoan = async (userId, body) => {
    logger.info(`Creando prestamo para usuario: ${userId}`);
    const { items, fecha_sugerida_usuario, observacion_solicitud, destino_salida } = body;
    if (!Array.isArray(items) || items.length === 0)
        throw Object.assign(new Error('Debes incluir al menos un item'), { status: 400 });
    for (const li of items) {
        if (!li.item || !li.aula || !li.cantidad_prestamo)
            throw Object.assign(new Error('Cada item debe tener item, aula y cantidad_prestamo'), { status: 400 });
        if (!Number.isInteger(Number(li.cantidad_prestamo)) || li.cantidad_prestamo < 1)
            throw Object.assign(new Error('La cantidad debe ser un entero >= 1'), { status: 400 });
    }
    const loanData = {
        usuario: userId,
        items: items.map(li => ({
            item: li.item, aula: li.aula,
            cantidad_prestamo: Number(li.cantidad_prestamo),
            observacion_item: li.observacion_item || undefined,
            estado_item: 'Pendiente',
        })),
    };
    if (fecha_sugerida_usuario) loanData.fecha_sugerida_usuario = fecha_sugerida_usuario;
    if (observacion_solicitud)  loanData.observacion_solicitud  = observacion_solicitud;
    if (destino_salida)         loanData.destino_salida         = destino_salida.trim();
    const loan = await Loan.create(loanData);
    setImmediate(async () => {
        try {
            const [user, populated] = await Promise.all([
                User.findById(userId).lean(),
                populateLoan(Loan.findById(loan._id))
            ]);
            if (user && populated) await notifyAdminsNewLoan(user, populated);
        } catch (e) { logger.error('Error notificar admins:', e.message); }
    });
    return loan;
};

// ─── APPROVE ──────────────────────────────────────────────────────────────────
const approveLoan = async (loanId, fechaEstimada, { approvals = [], itemsToRemove = [], observacion_aprobacion, cuentadante_principal } = {}) => {
    logger.info(`Aprobando prestamo: ${loanId}`);
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    if (loan.estado !== 'Pendiente') throw Object.assign(new Error('El prestamo no esta pendiente'), { status: 400 });

    const removeSet = new Set(itemsToRemove.map(String));
    for (const li of loan.items) {
        if (removeSet.has(String(li._id))) li.estado_item = 'Eliminado';
    }

    const approvalMap = {};
    for (const a of approvals) approvalMap[String(a.loanItemId)] = Number(a.cantidad_aprobada);

    const pending = loan.items.filter(li => li.estado_item === 'Pendiente');
    if (pending.length === 0)
        throw Object.assign(new Error('Todos los items fueron eliminados'), { status: 400 });

    for (const li of pending) {
        const itemDoc = await Item.findById(li.item._id || li.item);
        if (!itemDoc) throw Object.assign(new Error(`Item no encontrado: ${li.item}`), { status: 404 });

        const cantSolicitada = li.cantidad_prestamo;
        const cantPropuesta  = approvalMap[String(li._id)] !== undefined
            ? approvalMap[String(li._id)] : cantSolicitada;
        const cantFinal = Math.min(Math.max(0, Math.floor(cantPropuesta)), cantSolicitada);

        if (cantFinal < 1) { li.estado_item = 'Eliminado'; continue; }

        if (cantFinal > itemDoc.cantidad_disponible)
            throw Object.assign(
                new Error(`Stock insuficiente para "${itemDoc.nombre}". Disponible: ${itemDoc.cantidad_disponible}`),
                { status: 400 }
            );

        itemDoc.cantidad_disponible -= cantFinal;
        await itemDoc.save();

        li.cantidad_aprobada = cantFinal;
        li.cantidad_prestamo = cantFinal;
        li.estado_item = 'Aprobado';
    }

    const aprobados = loan.items.filter(li => li.estado_item === 'Aprobado');
    if (aprobados.length === 0)
        throw Object.assign(new Error('No quedo ningun item aprobado en el prestamo'), { status: 400 });

    const tieneNoConsumible = aprobados.some(li => {
        const tipo = li.item?.tipo_categoria;
        return tipo !== 'Consumible';
    });
    if (tieneNoConsumible && !fechaEstimada)
        throw Object.assign(new Error('La fecha estimada es obligatoria para préstamos con ítems no consumibles'), { status: 400 });

    loan.estado         = 'Aprobado';
    loan.fecha_prestamo = new Date();
    if (fechaEstimada) loan.fecha_estimada = fechaEstimada;
    if (observacion_aprobacion) loan.observacion_aprobacion = String(observacion_aprobacion).trim();
    if (cuentadante_principal) loan.cuentadante_principal = cuentadante_principal;
    await loan.save();

    setImmediate(async () => {
        try {
            const p = await populateLoan(Loan.findById(loan._id));
            if (p?.usuario?.email?.includes('@')) await sendAprobacion(p.usuario, p);
        } catch (e) { logger.error('Error email aprobacion:', e.message); }
    });
    return loan;
};

// ─── REJECT ───────────────────────────────────────────────────────────────────
const rejectLoan = async (loanId, observacion_rechazo) => {
    logger.info(`Rechazando prestamo: ${loanId}`);
    const loan = await Loan.findById(loanId);
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    if (loan.estado !== 'Pendiente') throw Object.assign(new Error('El prestamo no esta pendiente'), { status: 400 });
    loan.estado = 'Rechazado';
    if (observacion_rechazo) loan.observacion_rechazo = observacion_rechazo;
    await loan.save();
    setImmediate(async () => {
        try {
            const p = await populateLoan(Loan.findById(loan._id));
            if (p?.usuario?.email?.includes('@')) await sendRechazo(p.usuario, p, observacion_rechazo);
        } catch (e) { logger.error('Error email rechazo:', e.message); }
    });
    return loan;
};

// ─── DELAY ────────────────────────────────────────────────────────────────────
const delayLoan = async (loanId, nuevaFecha) => {
    logger.info(`Aplazando prestamo: ${loanId}`);
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    if (!['Aprobado', 'Aplazado'].includes(loan.estado))
        throw Object.assign(new Error('El prestamo no puede ser aplazado'), { status: 400 });
    loan.estado = 'Aplazado';
    loan.fecha_estimada = nuevaFecha;
    await loan.save();
    setImmediate(async () => {
        try {
            if (loan.usuario?.email?.includes('@')) await sendAplazado(loan.usuario, loan);
        } catch (e) { logger.error('Error email aplazamiento:', e.message); }
    });
    return loan;
};

// ─── NOTIFY RETURN ────────────────────────────────────────────────────────────
const notifyReturnRequest = async (loanId, userId, { loanItemId, cantidadDevuelta, observacion }) => {
    logger.info(`Notif. devolucion: usuario=${userId} prestamo=${loanId} item=${loanItemId}`);
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    if (loan.usuario._id.toString() !== userId.toString())
        throw Object.assign(new Error('No autorizado'), { status: 403 });
    if (!['Aprobado', 'Aplazado'].includes(loan.estado))
        throw Object.assign(new Error('El prestamo no esta activo'), { status: 400 });

    const li = loan.items.id(loanItemId);
    if (!li) throw Object.assign(new Error('Item no encontrado en el prestamo'), { status: 404 });
    if (li.estado_item !== 'Aprobado')
        throw Object.assign(new Error('Este item no esta activo'), { status: 400 });

    const cantDev = Number(cantidadDevuelta);
    if (isNaN(cantDev) || cantDev < 0 || cantDev > li.cantidad_prestamo)
        throw Object.assign(new Error('Cantidad devuelta invalida'), { status: 400 });

    const esConsumible = li.item?.tipo_categoria === 'Consumible';

    if (esConsumible) {
        if (li.notificacion_devolucion_enviada)
            throw Object.assign(new Error('Ya notificaste la devolucion. Espera la confirmacion.'), { status: 409 });
        if (cantDev === 0) {
            li.estado_item = 'Usado';
            li.cantidad_devuelta = 0;
            li.cantidad_confirmada = 0;
            li.notificacion_devolucion_enviada = true;
            _checkAndCloseLoan(loan);
            await loan.save();
            return { notified: false, closed: true, message: 'Consumible utilizado totalmente.' };
        }
        li.devoluciones_parciales.push({ cantidad: cantDev, observacion: observacion || undefined });
        li.cantidad_devuelta = (li.cantidad_confirmada || 0) + cantDev;
        li.notificacion_devolucion_enviada = true;
        await loan.save();
        const user = await User.findById(userId).lean();
        const esFinal = cantDev >= li.cantidad_prestamo;
        await notifyAdminsReturnRequest(user, loan, li, {
            cantidadDevuelta: cantDev, observacion,
            devueltaTotal: cantDev, pendienteDespues: li.cantidad_prestamo - cantDev,
            devolucionCompleta: esFinal
        });
        return { notified: true, closed: false, message: esFinal ? 'Devolucion completa notificada.' : 'Devolucion parcial notificada.' };
    }

    if (!Number.isInteger(cantDev) || cantDev < 1)
        throw Object.assign(new Error('Debes notificar al menos 1 unidad entera.'), { status: 400 });
    const devuelta   = li.cantidad_devuelta   || 0;
    const confirmada = li.cantidad_confirmada  || 0;
    if (devuelta > confirmada)
        throw Object.assign(new Error('Ya tienes una notificacion pendiente de confirmacion.'), { status: 409 });
    const pendienteActual = li.cantidad_prestamo - confirmada;
    if (cantDev > pendienteActual)
        throw Object.assign(new Error(`Solo quedan ${pendienteActual} unidad(es) por devolver.`), { status: 400 });

    li.devoluciones_parciales.push({ cantidad: cantDev, observacion: observacion || undefined });
    li.cantidad_devuelta = confirmada + cantDev;
    await loan.save();

    const user    = await User.findById(userId).lean();
    const acumDev = confirmada + cantDev;
    const esFinal = acumDev >= li.cantidad_prestamo;
    await notifyAdminsReturnRequest(user, loan, li, {
        cantidadDevuelta: cantDev, observacion,
        devueltaTotal: acumDev, pendienteDespues: li.cantidad_prestamo - acumDev,
        devolucionCompleta: esFinal
    });
    return { notified: true, closed: false,
        message: esFinal ? 'Devolucion completa notificada.' : 'Devolucion parcial notificada.' };
};

// ─── CONFIRM PARTIAL RETURN ───────────────────────────────────────────────────
const confirmPartialReturn = async (loanId, loanItemId, cantAdmin, observacion_recepcion) => {
    logger.info(`Confirmando devolucion: prestamo=${loanId} item=${loanItemId} cant=${cantAdmin}`);
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    const li = loan.items.id(loanItemId);
    if (!li) throw Object.assign(new Error('Item no encontrado en el prestamo'), { status: 404 });

    const yaConfirmado   = li.cantidad_confirmada || 0;
    const maxConfirmable = li.cantidad_prestamo - yaConfirmado;
    if (cantAdmin > maxConfirmable)
        throw Object.assign(new Error(`Solo se pueden confirmar ${maxConfirmable} unidad(es) mas.`), { status: 400 });

    const ahora = new Date();

    if (cantAdmin === 0) {
        for (const d of li.devoluciones_parciales) {
            if (!d.confirmado && !d.no_recibida) {
                d.no_recibida = true;
                d.fecha_confirmacion = ahora;
                if (observacion_recepcion) d.observacion_recepcion = observacion_recepcion;
            }
        }
        li.cantidad_devuelta = yaConfirmado;
        li.notificacion_devolucion_enviada = false;
        await loan.save();

        const _loanId = loan._id, _liSnap = li.toObject(), _obsAdmin = observacion_recepcion || null;
        const pendiente = li.cantidad_prestamo - yaConfirmado;
        setImmediate(async () => {
            try {
                const p = await populateLoan(Loan.findById(_loanId));
                if (!p?.usuario?.email?.includes('@')) return;
                await sendConfirmacionParcialUsuario(p.usuario, p, _liSnap, {
                    cantidadConfirmada: 0, pendiente: pendiente, obsAdmin: _obsAdmin
                });
            } catch (e) { logger.error('Error email no-recibida:', e.message); }
        });
        return { loan, cantidadConfirmada: 0, totalConfirmado: yaConfirmado, cerrado: false };
    }

    let restoPorMarcar = cantAdmin;
    for (const d of li.devoluciones_parciales) {
        if (d.confirmado || d.no_recibida || restoPorMarcar <= 0) continue;
        if (d.cantidad <= restoPorMarcar) {
            d.confirmado = true; d.fecha_confirmacion = ahora;
            if (observacion_recepcion) d.observacion_recepcion = observacion_recepcion;
            restoPorMarcar -= d.cantidad;
        } else {
            li.devoluciones_parciales.push({
                cantidad: restoPorMarcar,
                observacion: 'Confirmado parcialmente por admin',
                observacion_recepcion: observacion_recepcion || undefined,
                fecha: d.fecha, confirmado: true, fecha_confirmacion: ahora
            });
            d.cantidad -= restoPorMarcar;
            restoPorMarcar = 0;
        }
    }
    if (restoPorMarcar > 0) {
        li.devoluciones_parciales.push({
            cantidad: restoPorMarcar,
            observacion: 'Confirmacion directa por admin',
            observacion_recepcion: observacion_recepcion || undefined,
            confirmado: true, fecha_confirmacion: ahora
        });
    }

    const nuevoConfirmado = yaConfirmado + cantAdmin;
    li.cantidad_confirmada = nuevoConfirmado;

    const esConsumible    = li.item?.tipo_categoria === 'Consumible';
    const devolucionTotal = nuevoConfirmado >= li.cantidad_prestamo;

    if (devolucionTotal) {
        li.estado_item = esConsumible ? 'Usado' : 'Devuelto';
        li.notificacion_devolucion_enviada = true;
    } else if (esConsumible) {
        li.estado_item = 'Usado';
        li.cantidad_confirmada = li.cantidad_prestamo;
        li.notificacion_devolucion_enviada = true;
    } else {
        li.notificacion_devolucion_enviada = false;
    }

    const itemDoc = await Item.findById(li.item._id || li.item);
    if (itemDoc) {
        const nuevoDisponible = itemDoc.cantidad_disponible + cantAdmin;
        if (nuevoDisponible > itemDoc.cantidad_total_stock)
            itemDoc.cantidad_total_stock = nuevoDisponible;
        itemDoc.cantidad_disponible = nuevoDisponible;
        await itemDoc.save();
    }

    const cerrado = esConsumible ? true : devolucionTotal;
    _checkAndCloseLoan(loan);
    await loan.save();

    const _loanId = loan._id, _liSnap = li.toObject(),
          _cantAdmin = cantAdmin, _obsAdmin = observacion_recepcion || null;

    setImmediate(async () => {
        try {
            const p = await populateLoan(Loan.findById(_loanId));
            if (!p?.usuario?.email?.includes('@')) return;
            if (cerrado) {
                await sendDevolucion(p.usuario, p, { obsAdmin: _obsAdmin });
            } else {
                await sendConfirmacionParcialUsuario(p.usuario, p, _liSnap, {
                    cantidadConfirmada: _cantAdmin,
                    pendiente: _liSnap.cantidad_prestamo - nuevoConfirmado,
                    obsAdmin: _obsAdmin
                });
            }
        } catch (e) { logger.error('Error email confirmacion devolucion:', e.message); }
    });
    return { loan, cantidadConfirmada: cantAdmin, totalConfirmado: nuevoConfirmado, cerrado };
};

// ─── RETURN LOAN ──────────────────────────────────────────────────────────────
const returnLoan = async (loanId) => {
    logger.info(`Cerrando prestamo: ${loanId}`);
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    if (!['Aprobado', 'Aplazado'].includes(loan.estado))
        throw Object.assign(new Error('El prestamo no se puede cerrar en su estado actual'), { status: 400 });

    for (const li of loan.items.filter(l => l.estado_item === 'Aprobado')) {
        const item = li.item;
        if (!item) continue;
        if (item.tipo_categoria !== 'Consumible') {
            const pendiente = li.cantidad_prestamo - (li.cantidad_confirmada || 0);
            if (pendiente > 0)
                throw Object.assign(
                    new Error(`Faltan ${pendiente} unidad(es) por confirmar del item "${item.nombre}".`),
                    { status: 400 }
                );
        }
        li.estado_item = item.tipo_categoria === 'Consumible' ? 'Usado' : 'Devuelto';
    }

    loan.estado = 'Devuelto';
    loan.fecha_retorno = new Date();
    await loan.save();

    setImmediate(async () => {
        try {
            const p = await populateLoan(Loan.findById(loan._id));
            if (p?.usuario?.email?.includes('@')) await sendDevolucion(p.usuario, p);
        } catch (e) { logger.error('Error email devolucion:', e.message); }
    });
    return loan;
};

// ─── FORCE CLOSE ──────────────────────────────────────────────────────────────
const forceCloseLoan = async (loanId, observacion_cierre) => {
    logger.info(`Cierre forzado: prestamo=${loanId}`);
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Préstamo no encontrado'), { status: 404 });
    if (!['Aprobado', 'Aplazado'].includes(loan.estado))
        throw Object.assign(new Error('Solo se pueden cerrar forzadamente préstamos activos'), { status: 400 });

    for (const li of loan.items.filter(l => l.estado_item === 'Aprobado')) {
        const itemDoc = await Item.findById(li.item._id || li.item);
        if (itemDoc) {
            const pendienteStock = (li.cantidad_prestamo || 0) - (li.cantidad_confirmada || 0);
            if (pendienteStock > 0) {
                const nuevoDisponible = itemDoc.cantidad_disponible + pendienteStock;
                if (nuevoDisponible > itemDoc.cantidad_total_stock)
                    itemDoc.cantidad_total_stock = nuevoDisponible;
                itemDoc.cantidad_disponible = nuevoDisponible;
                await itemDoc.save();
            }
        }
        li.estado_item = li.item?.tipo_categoria === 'Consumible' ? 'Usado' : 'Devuelto';
        if (observacion_cierre) {
            li.devoluciones_parciales.push({
                cantidad: 0,
                observacion: `[Cierre forzado por admin] ${observacion_cierre}`,
                confirmado: true, fecha_confirmacion: new Date()
            });
        }
    }

    loan.estado = 'Cerrado';
    loan.fecha_retorno = new Date();
    if (observacion_cierre) loan.observacion_aprobacion = `[Cierre forzado] ${observacion_cierre}`;
    await loan.save();
    return loan;
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
const deleteLoan = async (loanId) => {
    logger.info(`Eliminando prestamo: ${loanId}`);
    const loan = await Loan.findById(loanId);
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });
    if (['Aprobado', 'Aplazado'].includes(loan.estado))
        throw Object.assign(
            new Error('No se puede eliminar un préstamo activo. Ciérralo primero.'),
            { status: 409 }
        );
    await Loan.findByIdAndDelete(loanId);
    return loan;
};

// ─── LIST ─────────────────────────────────────────────────────────────────────
const listLoans = async ({ rol, _id, ambientes_asignados }, filtros = {}) => {
    const isStaff = rol === 'Admin' || rol === 'SuperAdmin';
    const query = {};

    // Usuario común: solo sus propios préstamos
    if (!isStaff || filtros.propios === 'true' || filtros.propios === true) {
        query.usuario = _id;
    }

    // Admin normal: filtrar por sus ambientes asignados
    if (rol === 'Admin' && !filtros.propios) {
        const aulaIds = (ambientes_asignados || []).map(String);
        if (aulaIds.length === 0) return [];
        // Préstamos que tengan al menos un ítem en sus ambientes
        query['items.aula'] = { $in: aulaIds };
    }

    if (filtros.estado) query.estado = filtros.estado;

    return populateLoan(Loan.find(query)).sort({ createdAt: -1 });
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
const getLoanById = async ({ rol, _id, ambientes_asignados }, loanId) => {
    const isStaff = rol === 'Admin' || rol === 'SuperAdmin';
    const loan = await populateLoan(Loan.findById(loanId));
    if (!loan) throw Object.assign(new Error('Prestamo no encontrado'), { status: 404 });

    if (!isStaff && loan.usuario._id.toString() !== _id.toString())
        throw Object.assign(new Error('No autorizado'), { status: 403 });

    // Admin: verificar que el préstamo tenga ítems en sus ambientes
    if (rol === 'Admin') {
        const aulaIds = (ambientes_asignados || []).map(String);
        const esDeScope = (loan.items || []).some(li => aulaIds.includes(String(li.aula?._id || li.aula)));
        if (!esDeScope) throw Object.assign(new Error('No autorizado'), { status: 403 });
    }

    return loan;
};

// ─── Helper cierre automático ─────────────────────────────────────────────────
const _checkAndCloseLoan = (loan) => {
    const activos = loan.items.filter(li => li.estado_item === 'Aprobado');
    if (activos.length === 0 && ['Aprobado', 'Aplazado'].includes(loan.estado)) {
        loan.estado = 'Devuelto';
        loan.fecha_retorno = new Date();
        logger.info(`Prestamo ${loan._id} cerrado automaticamente`);
    }
};

module.exports = {
    createLoan, approveLoan, rejectLoan, returnLoan,
    confirmPartialReturn, delayLoan, deleteLoan, forceCloseLoan,
    listLoans, getLoanById, notifyReturnRequest
};