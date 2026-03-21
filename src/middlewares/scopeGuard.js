/**
 * scopeGuard.js
 * 
 * Middleware que valida que un Admin solo pueda actuar sobre
 * ítems y préstamos correspondientes a sus ambientes asignados.
 * SuperAdmin siempre pasa sin restricción.
 * 
 * Uso en rutas de ítems:
 *   router.post('/', authJWT, roleGuard(['Admin']), scopeGuard.item, createItem)
 * 
 * Uso en rutas de préstamos:
 *   router.post('/:id/aprobar', authJWT, roleGuard(['Admin']), scopeGuard.loan, approveLoan)
 */

const Item      = require('../models/Item.js');
const Loan      = require('../models/Loan.js');
const Classroom = require('../models/Classroom.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Devuelve true si el usuario tiene un ambiente asignado con ese ID.
 */
const hasAmbiente = (user, aulaId) => {
    if (user.rol === 'SuperAdmin') return true;
    if (!user.ambientes_asignados || user.ambientes_asignados.length === 0) return false;
    return user.ambientes_asignados.some(id => String(id) === String(aulaId));
};

// ── Middlewares ────────────────────────────────────────────────────────────────

/**
 * Para rutas de creación/edición de ítems.
 * Verifica que el aula del body esté entre los ambientes asignados del admin.
 */
const itemScope = async (req, res, next) => {
    try {
        if (req.user.rol === 'SuperAdmin') return next();

        // Obtener aulaId desde body (crear/editar) o desde el ítem existente (editar por ID)
        let aulaId = req.body.aula;

        if (!aulaId && req.params.id) {
            // Edición: buscar el ítem para obtener su aula actual
            const item = await Item.findById(req.params.id).lean();
            if (!item) return res.status(404).json({ message: 'Ítem no encontrado' });
            aulaId = item.aula;
        }

        if (!aulaId) {
            return res.status(400).json({ message: 'Se requiere el ambiente (aula) del ítem' });
        }

        if (!hasAmbiente(req.user, aulaId)) {
            return res.status(403).json({
                message: 'No tienes permiso para gestionar ítems de este ambiente'
            });
        }

        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Para rutas de aprobación/rechazo/gestión de préstamos.
 * Verifica que al menos uno de los ítems del préstamo pertenezca
 * a un ambiente del admin. Si el préstamo tiene ítems de distintos
 * ambientes, el admin solo puede gestionarlo si TODOS los ítems
 * activos están en sus ambientes asignados.
 */
const loanScope = async (req, res, next) => {
    try {
        if (req.user.rol === 'SuperAdmin') return next();

        const loan = await Loan.findById(req.params.id).populate('items.item').lean();
        if (!loan) return res.status(404).json({ message: 'Préstamo no encontrado' });

        const ambientesAdmin = (req.user.ambientes_asignados || []).map(String);
        if (ambientesAdmin.length === 0) {
            return res.status(403).json({
                message: 'No tienes ambientes asignados para gestionar préstamos'
            });
        }

        // Ítems activos (no eliminados ni rechazados)
        const itemsActivos = (loan.items || []).filter(
            li => !['Eliminado', 'Rechazado'].includes(li.estado_item)
        );

        // El préstamo es del ámbito del admin si TODOS los ítems activos
        // pertenecen a alguno de sus ambientes asignados.
        const todosDeSuScope = itemsActivos.every(li =>
            ambientesAdmin.includes(String(li.aula))
        );

        if (!todosDeSuScope) {
            return res.status(403).json({
                message: 'Este préstamo contiene ítems de ambientes que no están bajo tu gestión'
            });
        }

        // Guardar el préstamo en req para que el controlador no lo vuelva a buscar (optimización)
        req.scopedLoan = loan;
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Para listar: inyecta en req.adminScope los ambientes del admin
 * para que los controladores filtren correctamente.
 * - SuperAdmin: sin restricción (req.adminScope queda undefined)
 * - Admin:      filtra por sus ambientes asignados
 * - Comun:      sin restricción (ve todos los ítems como antes)
 */
const injectScope = (req, res, next) => {
    if (req.user.rol === 'Admin') {
        req.adminScope = (req.user.ambientes_asignados || []).map(String);
    }
    // SuperAdmin y Comun no reciben adminScope → el controlador no aplica filtro
    next();
};

module.exports = { itemScope, loanScope, injectScope };