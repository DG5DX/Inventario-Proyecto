const formatDate = (date) => new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
}).format(date);

const aprobacionTemplate = ({ nombreUsuario, itemNombre, fechaEstimada, cantidad}) => ({
    subject: 'Préstamo aprobado',
    text: `Hola ${nombreUsuario}, tu préstamo del ítem "${itemNombre}" por ${cantidad} unidad(es) fue aprobado. Debes devolverlo antes del ${formatDate(fechaEstimada)}.`
});

const devolucionTemplate = ({ nombreUsuario, itemNombre, cantidad }) => ({
    subject: 'Préstamo devuelto',
    text: `Hola ${nombreUsuario}, registramos la devolución del ítem "${itemNombre}" (${cantidad}). ¡Gracias!`
});

const recordatorioTemplate = ({ nombreUsuario, itemNombre, fechaEstimada }) => ({
    subject: 'Recordatorio de devolución',
    text: `Hola ${nombreUsuario}, recuerda devolver el ítem "${itemNombre}" antes del ${formatDate(fechaEstimada)}.`
});

const aplazadoTemplate = ({ nombreUsuario, itemNombre, nuevaFecha }) => ({
    subject: 'Fecha de préstamo aplazada',
    text: `Hola ${nombreUsuario}, la fecha estimada de devolucion del ítem "${itemNombre}" fue actualizada al ${formatDate(nuevaFecha)}.`
});

const nuevaSolicitudAdminTemplate = ({ nombreUsuario, emailUsuario, itemNombre, cantidad, aulaNombre, fechaSolicitud }) => ({
    subject: '🔔 Nueva Solicitud de Préstamo - Requiere Aprobación',
    text: `Nueva solicitud de préstamo recibida:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DETALLES DE LA SOLICITUD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 Solicitante: ${nombreUsuario}
📧 Email: ${emailUsuario}
📦 Ítem: ${itemNombre}
🔢 Cantidad: ${cantidad} unidad(es)
📍 Ubicación: ${aulaNombre}
📅 Fecha: ${formatDate(fechaSolicitud)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ACCIÓN REQUERIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por favor, ingresa al sistema para revisar y aprobar o rechazar esta solicitud.

🔗 Panel de Administración > Solicitudes Pendientes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este es un mensaje automático del Sistema de Inventario.
No responder a este correo.`
});

module.exports = {
    aprobacionTemplate,
    devolucionTemplate,
    recordatorioTemplate,
    aplazadoTemplate,
    nuevaSolicitudAdminTemplate
};