const nodemailer = require('nodemailer');
const logger = require('../config/logger.js');

const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'America/Bogota'
        }).format(new Date(date));
    } catch (e) {
        return String(date);
    }
};

const sanitizeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
};

const baseCSS = `
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .container{max-width:620px;margin:0 auto;padding:20px}
    .content{background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px}
    .info-box{background:white;padding:18px;margin:15px 0;border-radius:6px;border-left:4px solid #ccc}
    .obs-box{background:#fff8e1;padding:15px;margin:15px 0;border-radius:6px;border:1px solid #ffe082}
    .obs-box-admin{background:#e8f5e9;padding:15px;margin:15px 0;border-radius:6px;border:1px solid #a5d6a7}
    .obs-box-warn{background:#fff3e0;padding:15px;margin:15px 0;border-radius:6px;border:1px solid #ffcc80}
    .action-box{background:#e8f5e9;padding:15px;margin:15px 0;border-radius:6px;border:2px solid #4CAF50}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:12px}
    .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;margin-left:6px;vertical-align:middle}
    .badge-consumible{background:#ffe0b2;color:#e65100}
    .badge-controlado{background:#e3f2fd;color:#1565c0}
    .items-table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
    .items-table th{background:#f0f0f0;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #ddd}
    .items-table td{padding:8px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top}
    .items-table tr:last-child td{border-bottom:none}
    .item-name{font-weight:600;color:#1a1a1a}
    .item-loc{font-size:12px;color:#888;margin-top:2px}
    .chip{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600}
    .chip-blue{background:#e3f2fd;color:#1565c0}
    .chip-orange{background:#fff3e0;color:#e65100}
    .chip-red{background:#ffebee;color:#c62828}
`;

const buildEmail = (accentColor, title, bodyHtml) =>
`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${baseCSS}</style></head>
<body>
<div class="container">
  <div style="background:${accentColor};color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:22px;">${title}</h1>
  </div>
  <div class="content">${bodyHtml}</div>
  <div class="footer"><p>Sistema de Inventario</p><p>Mensaje automático, no responder.</p></div>
</div>
</body>
</html>`;


const buildItemsTable = (items, filter = 'all', showCantAprobada = false) => {
    let rows = items;
    if (filter === 'active')   rows = items.filter(li => !['Eliminado'].includes(li.estado_item));
    if (filter === 'approved') rows = items.filter(li => li.estado_item === 'Aprobado');

    if (!rows.length) return '<p style="color:#888;font-style:italic;">Sin ítems.</p>';

    const extraTh = showCantAprobada ? '<th>Aprobada</th>' : '';
    const filas = rows.map(li => {
        const nombre  = sanitizeHtml(li.item?.nombre || 'N/A');
        const aula    = sanitizeHtml(li.aula?.nombre || 'N/A');
        const tipo    = li.item?.tipo_categoria || '';
        const chip    = tipo === 'Consumible' ? 'chip-orange' : 'chip-blue';
        const obs     = li.observacion_item ? `<div style="color:#888;font-size:12px;margin-top:3px;">💬 ${sanitizeHtml(li.observacion_item)}</div>` : '';
        const extraTd = showCantAprobada
            ? `<td style="text-align:center;">${li.cantidad_aprobada ?? li.cantidad_prestamo}</td>`
            : '';
        return `<tr>
            <td><div class="item-name">${nombre}</div><div class="item-loc">📍 ${aula}</div>${obs}</td>
            <td style="text-align:center;white-space:nowrap;"><span class="chip chip-blue">${li.cantidad_prestamo} ud.</span></td>
            ${extraTd}
            <td><span class="chip ${chip}">${tipo}</span></td>
        </tr>`;
    }).join('');

    const extraTh2 = showCantAprobada ? '<th>Aprobada</th>' : '';
    return `<table class="items-table">
        <thead><tr><th>Ítem</th><th>Solicitada</th>${extraTh2}<th>Tipo</th></tr></thead>
        <tbody>${filas}</tbody>
    </table>`;
};

const createTransporter = () => {
    const port   = parseInt(process.env.SMTP_PORT || '587');
    const secure = port === 465;
    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port,
        secure,
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls:    { rejectUnauthorized: false, ciphers: 'SSLv3' },
        pool:   false,
        connectionTimeout: 30000,
        greetingTimeout:   20000,
        socketTimeout:     45000,
    });
};

const sendEmail = async ({ to, subject, html, text }, retries = 2) => {
    if (!to || !to.includes('@')) {
        logger.warn(`⚠️ Email inválido, omitiendo: ${to}`);
        return { success: false, error: `Email inválido: ${to}` };
    }
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('⚠️ Configuración SMTP incompleta.');
        return { success: false, error: 'Configuración SMTP incompleta.' };
    }
    logger.info(`📧 Enviando email a: ${to} | Asunto: ${subject}`);
    const transporter = createTransporter();
    try {
        const fromEmail = process.env.MAIL_FROM || `"Sistema de Inventario" <${process.env.SMTP_USER}>`;
        const info = await transporter.sendMail({
            from: fromEmail, to, subject,
            html: html || `<pre>${text}</pre>`,
            text: text || ''
        });
        logger.info(`✅ Email enviado a: ${to} | ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        logger.error(`❌ Error enviando email a ${to}: ${error.message}`);
        const retryable = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ESOCKET'].includes(error.code);
        if (retries > 0 && retryable) {
            const waitMs = (3 - retries + 1) * 5000;
            logger.info(`🔄 Reintentando en ${waitMs / 1000}s (${retries} intentos restantes)...`);
            await new Promise(r => setTimeout(r, waitMs));
            return sendEmail({ to, subject, html, text }, retries - 1);
        }
        return { success: false, error: error.message || String(error) };
    } finally {
        try { transporter.close(); } catch (_) {}
    }
};

/**
 * Envía a todos los SuperAdmins con email válido.
 * Usado para notificaciones globales sin contexto de ambiente
 * (ej: recuperación de correo, resúmenes de vencidos).
 */
const sendToAdmins = async (subject, html) => {
    const User = require('../models/User.js');
    try {
        const all = await User.find({ rol: 'SuperAdmin' }).lean();
        const admins = (all || []).filter(a => a.email && a.email.includes('@') && !a.email.includes('demo.com') && !a.email.includes('test.com'));
        if (admins.length === 0) {
            logger.warn('⚠️ No hay SuperAdmins con email válido');
            return { success: false, error: 'No valid SuperAdmin emails' };
        }
        const results = await Promise.allSettled(admins.map(a => sendEmail({ to: a.email, subject, html })));
        const ok = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        return { success: ok > 0, successful: ok, failed: results.length - ok };
    } catch (err) {
        logger.error('❌ Error en sendToAdmins:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Envía a:
 *   - Todos los SuperAdmins (siempre)
 *   - Admins normales que tengan asignado al menos uno de los aulaIds del préstamo
 *
 * @param {string[]} aulaIds  IDs de las aulas involucradas en el préstamo/ítem
 * @param {string}   subject  Asunto del correo
 * @param {string}   html     Cuerpo HTML del correo
 */
const sendToAdminsByScope = async (aulaIds, subject, html) => {
    const User = require('../models/User.js');
    try {
        const aulaIdsStr = (aulaIds || []).map(String);

        // SuperAdmins — siempre reciben todo
        const superAdmins = await User.find({ rol: 'SuperAdmin' }).lean();

        // Admins normales — solo los que tengan al menos una aula del préstamo asignada
        const adminsNormales = aulaIdsStr.length > 0
            ? await User.find({
                rol: 'Admin',
                ambientes_asignados: { $in: aulaIdsStr }
              }).lean()
            : [];

        const destinatarios = [...superAdmins, ...adminsNormales].filter(
            a => a.email && a.email.includes('@') && !a.email.includes('demo.com') && !a.email.includes('test.com')
        );

        // Eliminar duplicados (por si un usuario tiene ambos roles, aunque no debería)
        const unicos = [...new Map(destinatarios.map(a => [String(a._id), a])).values()];

        if (unicos.length === 0) {
            logger.warn('⚠️ No hay destinatarios válidos para este scope');
            return { success: false, error: 'No valid recipients' };
        }

        logger.info(`📨 Enviando a ${unicos.length} destinatario(s): ${unicos.map(a => a.email).join(', ')}`);
        const results = await Promise.allSettled(unicos.map(a => sendEmail({ to: a.email, subject, html })));
        const ok = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        return { success: ok > 0, successful: ok, failed: results.length - ok };
    } catch (err) {
        logger.error('❌ Error en sendToAdminsByScope:', err.message);
        return { success: false, error: err.message };
    }
};

//  EMAILS AL USUARIO

// Aprobación — muestra todos los ítems aprobados y los eliminados (si los hubo)
const sendAprobacion = async (user, loan) => {
    logger.info(`📨 Email aprobación → ${user.email}`);

    const aprobados = (loan.items || []).filter(li => li.estado_item === 'Aprobado');
    const eliminados = (loan.items || []).filter(li => li.estado_item === 'Eliminado');

    const tablaAprobados = buildItemsTable(aprobados, 'all', true);

    const eliminadosBlock = eliminados.length > 0
        ? `<div class="obs-box-warn">
            <p style="margin:0 0 6px;"><strong>⚠️ Los siguientes ítems fueron retirados del préstamo por el administrador:</strong></p>
            <ul style="margin:4px 0;padding-left:18px;">
                ${eliminados.map(li => `<li>${sanitizeHtml(li.item?.nombre || 'N/A')}</li>`).join('')}
            </ul>
           </div>`
        : '';

    const fechaSugeridaFila = loan.fecha_sugerida_usuario
        ? `<p><strong>📅 Fecha solicitada por ti:</strong> <span style="color:#888;">${formatDate(loan.fecha_sugerida_usuario)}</span></p>`
        : '';

    const destinoBlock = loan.destino_salida
        ? `<div class="obs-box" style="background:#e0f2f1;border-color:#26a69a;"><p style="margin:0 0 6px;"><strong>📍 Destino de salida:</strong></p><p style="margin:0;">${sanitizeHtml(loan.destino_salida)}</p></div>`
        : '';

    const obsBlock = loan.observacion_solicitud
        ? `<div class="obs-box"><p style="margin:0 0 6px;"><strong>💬 Tu observación al solicitar:</strong></p><p style="margin:0;">${sanitizeHtml(loan.observacion_solicitud)}</p></div>`
        : '';

    const obsAdminBlock = loan.observacion_aprobacion
        ? `<div class="obs-box-admin"><p style="margin:0 0 6px;"><strong>📝 Observación del administrador:</strong></p><p style="margin:0;">${sanitizeHtml(loan.observacion_aprobacion)}</p></div>`
        : '';

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>Tu solicitud de préstamo ha sido <strong style="color:#4CAF50;">APROBADA</strong>.</p>
    <div class="info-box" style="border-color:#4CAF50;">
        <p><strong>📋 Ítems aprobados (${aprobados.length}):</strong></p>
        ${tablaAprobados}
        ${fechaSugeridaFila}
        <p><strong>📅 Fecha de devolución asignada:</strong> <strong style="color:#e65100;">${formatDate(loan.fecha_estimada)}</strong></p>
    </div>
    ${eliminadosBlock}
    ${destinoBlock}
    ${obsBlock}
    ${obsAdminBlock}
    <p>Por favor devuelve los ítems antes de la fecha indicada.</p>`;

    return sendEmail({
        to: user.email,
        subject: '✅ Préstamo Aprobado - Sistema de Inventario',
        html: buildEmail('#4CAF50', '✅ Préstamo Aprobado', body)
    });
};

// Rechazo total
const sendRechazo = async (user, loan, observacion) => {
    logger.info(`📨 Email rechazo → ${user.email}`);

    const motivoBlock = observacion
        ? `<div class="obs-box"><p style="margin:0 0 6px;"><strong>💬 Motivo del rechazo:</strong></p><p style="margin:0;">${sanitizeHtml(observacion)}</p></div>`
        : `<p style="color:#888;font-style:italic;">No se indicó un motivo específico.</p>`;

    const obsUsuario = loan.observacion_solicitud
        ? `<div class="obs-box" style="background:#f3e5f5;border-color:#ce93d8;"><p style="margin:0 0 6px;"><strong>💬 Tu observación original:</strong></p><p style="margin:0;">${sanitizeHtml(loan.observacion_solicitud)}</p></div>`
        : '';

    const destinoUsuario = loan.destino_salida
        ? `<div class="obs-box" style="background:#e0f2f1;border-color:#26a69a;"><p style="margin:0 0 6px;"><strong>📍 Destino de salida solicitado:</strong></p><p style="margin:0;">${sanitizeHtml(loan.destino_salida)}</p></div>`
        : '';

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>Tu solicitud de préstamo ha sido <strong style="color:#F44336;">RECHAZADA</strong>.</p>
    <div class="info-box" style="border-color:#F44336;">
        <p><strong>📋 Ítems solicitados (${loan.items?.length || 0}):</strong></p>
        ${buildItemsTable(loan.items || [], 'all')}
        <p><strong>📅 Fecha de solicitud:</strong> ${formatDate(loan.fecha_solicitud)}</p>
    </div>
    ${destinoUsuario}
    ${obsUsuario}
    ${motivoBlock}
    <p>Si tienes dudas, comunícate con el administrador.</p>`;

    return sendEmail({
        to: user.email,
        subject: '❌ Solicitud de Préstamo Rechazada - Sistema de Inventario',
        html: buildEmail('#F44336', '❌ Solicitud Rechazada', body)
    });
};

// Devolución total confirmada
const sendDevolucion = async (user, loan, { obsAdmin } = {}) => {
    logger.info(`📨 Email devolución confirmada → ${user.email}`);

    const obsAdminBlock = obsAdmin
        ? `<div class="obs-box-admin"><p style="margin:0 0 6px;"><strong>💬 Nota del administrador:</strong></p><p style="margin:0;">${sanitizeHtml(obsAdmin)}</p></div>`
        : '';

    // Construir tabla de estado por ítem con detalle de devoluciones
    const allItems = (loan.items || []).filter(li => !['Eliminado'].includes(li.estado_item));

    const buildReturnStatusTable = (items) => {
        if (!items.length) return '<p style="color:#888;font-style:italic;">Sin ítems.</p>';

        const filas = items.map(li => {
            const nombre = sanitizeHtml(li.item?.nombre || 'N/A');
            const aula   = sanitizeHtml(li.aula?.nombre || 'N/A');
            const tipo   = li.item?.tipo_categoria || '';
            const chip   = tipo === 'Consumible' ? 'chip-orange' : 'chip-blue';
            const esConsumible = tipo === 'Consumible';
            const confirmadas  = li.cantidad_confirmada || 0;
            const total        = li.cantidad_prestamo   || 0;
            const devueltoCompleto = li.estado_item === 'Devuelto' || li.estado_item === 'Usado' || confirmadas >= total;

            let estadoCell = '';
            if (esConsumible) {
                estadoCell = `<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">✅ Usado/Entregado</span>`;
            } else if (devueltoCompleto) {
                estadoCell = `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">✅ ${confirmadas}/${total} ud.</span>`;
            } else {
                const pendiente = total - confirmadas;
                estadoCell = `<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">⚠️ ${confirmadas}/${total} ud. · ${pendiente} pendiente(s)</span>`;
            }

            return `<tr>
                <td><div class="item-name">${nombre}</div><div class="item-loc">📍 ${aula}</div></td>
                <td style="text-align:center;white-space:nowrap;"><span class="chip ${chip}">${tipo}</span></td>
                <td style="text-align:center;">${estadoCell}</td>
            </tr>`;
        }).join('');

        return `<table class="items-table">
            <thead><tr><th>Ítem</th><th>Tipo</th><th>Estado devolución</th></tr></thead>
            <tbody>${filas}</tbody>
        </table>`;
    };

    const soloConsumibles = allItems.length > 0 && allItems.every(li => li.item?.tipo_categoria === 'Consumible');

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>${soloConsumibles
        ? 'El administrador ha <strong style="color:#e65100;">confirmado el uso</strong> de los consumibles de tu préstamo.'
        : 'El administrador ha <strong style="color:#2196F3;">confirmado la devolución</strong> de tu préstamo.'
    }</p>
    <div class="info-box" style="border-color:${soloConsumibles ? '#e65100' : '#2196F3'};">
        <p><strong>📋 Estado por ítem:</strong></p>
        ${buildReturnStatusTable(allItems)}
        <p><strong>📅 Cerrado el:</strong> ${formatDate(loan.fecha_retorno || new Date())}</p>
    </div>
    ${obsAdminBlock}
    <p>${soloConsumibles ? '¡Gracias por reportar el uso!' : '¡Gracias por devolver!'}</p>`;

    return sendEmail({
        to: user.email,
        subject: soloConsumibles
            ? '✅ Uso de Consumibles Confirmado - Sistema de Inventario'
            : '📦 Devolución Confirmada - Sistema de Inventario',
        html: buildEmail(soloConsumibles ? '#e65100' : '#2196F3',
            soloConsumibles ? '✅ Uso Confirmado' : '📦 Devolución Confirmada', body)
    });
};

// Confirmación parcial (un ítem específico)
const sendConfirmacionParcialUsuario = async (user, loan, loanItem, { cantidadConfirmada, pendiente, obsAdmin }) => {
    logger.info(`📨 Email confirmación parcial → ${user.email}`);

    const nombreItem = sanitizeHtml(loanItem.item?.nombre || loanItem.nombre || 'N/A');

    const obsAdminBlock = obsAdmin
        ? `<div class="obs-box-admin"><p style="margin:0 0 6px;"><strong>💬 Nota del administrador:</strong></p><p style="margin:0;">${sanitizeHtml(obsAdmin)}</p></div>`
        : '';

    // Tabla de estado de todos los ítems del préstamo
    const buildFullStatusTable = (items) => {
        const rows = (items || []).filter(li => !['Eliminado'].includes(li.estado_item));
        if (!rows.length) return '';
        const filas = rows.map(li => {
            const nombre = sanitizeHtml(li.item?.nombre || 'N/A');
            const aula   = sanitizeHtml(li.aula?.nombre || 'N/A');
            const esConsumible  = li.item?.tipo_categoria === 'Consumible';
            const confirmadas   = li.cantidad_confirmada || 0;
            const total         = li.cantidad_prestamo   || 0;
            const devueltoTotal = li.estado_item === 'Devuelto' || li.estado_item === 'Usado' || confirmadas >= total;
            let estadoCell = '';
            if (esConsumible) {
                estadoCell = (li.estado_item === 'Devuelto' || li.estado_item === 'Usado')
                    ? `<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">✅ Usado/Entregado</span>`
                    : `<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">⏳ Pendiente confirmación</span>`;
            } else if (devueltoTotal) {
                estadoCell = `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">✅ ${confirmadas}/${total} ud.</span>`;
            } else {
                const pend = total - confirmadas;
                estadoCell = `<span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;">⏳ ${confirmadas}/${total} ud. · faltan ${pend}</span>`;
            }
            return `<tr>
                <td><div style="font-weight:600;color:#1a1a1a;">${nombre}</div><div style="font-size:12px;color:#888;">📍 ${aula}</div></td>
                <td style="text-align:center;">${estadoCell}</td>
            </tr>`;
        }).join('');
        return `<div style="margin:15px 0;">
            <p><strong>📊 Estado actual de tu préstamo:</strong></p>
            <table class="items-table">
                <thead><tr><th>Ítem</th><th>Estado</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
    };

    const esConsumibleItem = loanItem.item?.tipo_categoria === 'Consumible';

    if (cantidadConfirmada === 0) {
        const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>El administrador revisó tu notificación pero <strong style="color:#F44336;">no registró ninguna unidad recibida</strong> para <strong>${nombreItem}</strong>.</p>
    <div class="info-box" style="border-color:#F44336;">
        <p><strong>📦 Ítem:</strong> ${nombreItem}</p>
        <p><strong>⏳ Pendientes ${esConsumibleItem ? 'por entregar' : 'por devolver'}:</strong> <strong style="color:#e65100;">${pendiente} unidad(es)</strong></p>
    </div>
    ${buildFullStatusTable(loan.items)}
    ${obsAdminBlock}
    <div class="obs-box-warn"><p style="margin:0;"><strong>⚠️ Por favor, vuelve a notificar ${esConsumibleItem ? 'la entrega' : 'la devolución'} una vez hayas ${esConsumibleItem ? 'entregado el ítem' : 'entregado el ítem'}.</strong></p></div>`;

        return sendEmail({
            to: user.email,
            subject: `⚠️ ${esConsumibleItem ? 'Entrega' : 'Devolución'} no registrada - ${nombreItem}`,
            html: buildEmail('#F44336', `⚠️ ${esConsumibleItem ? 'Entrega' : 'Devolución'} No Registrada`, body)
        });
    }

    const pendienteBlock = pendiente > 0
        ? `<div class="obs-box-warn"><p style="margin:0;"><strong>⚠️ Todavía quedan <span style="color:#e65100;">${pendiente} unidad(es)</span> pendientes de ${esConsumibleItem ? 'entregar' : 'devolver'} para este ítem.</strong></p></div>`
        : `<div style="background:#e8f5e9;padding:12px;border-radius:6px;border:1px solid #a5d6a7;margin:12px 0;"><p style="margin:0;color:#2e7d32;font-weight:600;">✅ Todas las unidades de este ítem han sido confirmadas.</p></div>`;

    const accionTexto = esConsumibleItem ? 'recepción/uso' : 'recepción';

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>El administrador registró la ${accionTexto} de <strong>${cantidadConfirmada} unidad(es)</strong> de <strong>${nombreItem}</strong>.</p>
    <div class="info-box" style="border-color:#FF9800;">
        <p><strong>📦 Ítem:</strong> ${nombreItem}</p>
        <p><strong>✅ Unidades confirmadas ahora:</strong> <strong>${cantidadConfirmada}</strong> ud.</p>
        <p><strong>📊 Total confirmado:</strong> ${loanItem.cantidad_confirmada} / ${loanItem.cantidad_prestamo} ud.</p>
    </div>
    ${obsAdminBlock}
    ${pendienteBlock}
    ${buildFullStatusTable(loan.items)}`;

    return sendEmail({
        to: user.email,
        subject: esConsumibleItem
            ? `⏳ Entrega Parcial Confirmada (${loanItem.cantidad_confirmada}/${loanItem.cantidad_prestamo} ud.) - ${nombreItem}`
            : `⏳ Devolución Parcial Confirmada (${loanItem.cantidad_confirmada}/${loanItem.cantidad_prestamo} ud.) - ${nombreItem}`,
        html: buildEmail('#FF9800',
            esConsumibleItem ? '⏳ Confirmación Parcial de Entrega' : '⏳ Confirmación Parcial de Devolución', body)
    });
};

const sendRecordatorio = async (user, loan) => {
    logger.info(`📨 Email recordatorio → ${user.email}`);

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>Tienes un préstamo próximo a vencer.</p>
    <div class="info-box" style="border-color:#FF9800;">
        <p><strong>📋 Ítems en préstamo:</strong></p>
        ${buildItemsTable((loan.items || []).filter(li => li.estado_item === 'Aprobado'), 'all')}
        <p><strong>📅 Fecha límite:</strong> <strong style="color:#e65100;">${formatDate(loan.fecha_estimada)}</strong></p>
    </div>
    <p>⚠️ Por favor devuelve los ítems a tiempo.</p>`;

    return sendEmail({
        to: user.email,
        subject: '⏰ Recordatorio de Devolución - Sistema de Inventario',
        html: buildEmail('#FF9800', '⏰ Recordatorio de Devolución', body)
    });
};

const sendAplazado = async (user, loan) => {
    logger.info(`📨 Email aplazamiento → ${user.email}`);

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>El administrador ha actualizado la fecha de devolución de tu préstamo.</p>
    <div class="info-box" style="border-color:#9C27B0;">
        <p><strong>📋 Ítems del préstamo:</strong></p>
        ${buildItemsTable((loan.items || []).filter(li => li.estado_item === 'Aprobado'), 'all')}
        <p><strong>📅 Nueva fecha de devolución:</strong> <strong style="color:#6a1b9a;">${formatDate(loan.fecha_estimada)}</strong></p>
    </div>
    <p>Por favor devuelve los ítems antes de la nueva fecha indicada.</p>`;

    return sendEmail({
        to: user.email,
        subject: '📅 Fecha de Devolución Actualizada - Sistema de Inventario',
        html: buildEmail('#9C27B0', '📅 Fecha Actualizada', body)
    });
};


const sendVencimiento = async (user, loans) => {
    // Compatibilidad: si se pasa un préstamo individual lo envolvemos en array
    const loanList = Array.isArray(loans) ? loans : [loans];
    logger.info(`📨 Email préstamos VENCIDOS (${loanList.length}) → ${user.email}`);

    const now = new Date();

    const bloquesPrestamos = loanList.map((loan, idx) => {
        const diasVencido = Math.floor((now - new Date(loan.fecha_estimada)) / (1000 * 60 * 60 * 24));
        const diasTexto   = diasVencido === 0 ? 'hoy' : `hace ${diasVencido} día(s)`;
        const itemsAprobados = (loan.items || []).filter(li => li.estado_item === 'Aprobado');

        return `
        <div class="info-box" style="border-color:#c62828;margin-bottom:18px;">
            ${loanList.length > 1 ? `<p style="margin:0 0 8px;font-size:13px;color:#888;">Préstamo ${idx + 1} de ${loanList.length}</p>` : ''}
            <p><strong>📋 Ítems pendientes de devolución:</strong></p>
            ${buildItemsTable(itemsAprobados, 'all')}
            <p><strong>📅 Fecha límite era:</strong> <strong style="color:#c62828;">${formatDate(loan.fecha_estimada)}</strong></p>
            <p><strong>⏳ Venció:</strong> ${diasTexto}</p>
        </div>`;
    }).join('');

    const titulo = loanList.length > 1
        ? `Tienes <strong style="color:#c62828;">${loanList.length} préstamos VENCIDOS</strong> pendientes de devolución.`
        : `Tu préstamo ha <strong style="color:#c62828;">VENCIDO</strong> y aún no ha sido devuelto.`;

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>${titulo}</p>
    ${bloquesPrestamos}
    <div style="background:#ffebee;padding:15px;border-radius:6px;border:2px solid #ef9a9a;">
        <p style="margin:0;"><strong>⚠️ Por favor devuelve los ítems a la brevedad posible.</strong></p>
    </div>`;

    const subject = loanList.length > 1
        ? `🚨 Tienes ${loanList.length} préstamos VENCIDOS - Acción Requerida`
        : '🚨 Préstamo VENCIDO - Acción Requerida';

    return sendEmail({
        to: user.email,
        subject,
        html: buildEmail('#c62828', '🚨 Préstamo(s) Vencido(s)', body)
    });
};

const sendPasswordReset = async (user, resetLink) => {
    logger.info(`📨 Email recuperación contraseña → ${user.email}`);

    const body = `
    <p>Hola <strong>${sanitizeHtml(user.nombre)}</strong>,</p>
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <div class="info-box" style="border-color:#673AB7;">
        <p>Haz clic en el botón para crear una nueva contraseña:</p>
        <p style="text-align:center;margin:20px 0;">
            <a href="${resetLink}" style="display:inline-block;padding:12px 30px;background:#673AB7;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">
                Restablecer Contraseña
            </a>
        </p>
        <p style="font-size:12px;color:#666;">Si el botón no funciona, copia este enlace:<br>
            <span style="word-break:break-all;">${resetLink}</span>
        </p>
    </div>
    <div style="background:#fff3cd;padding:15px;border-radius:6px;border:2px solid #ffc107;">
        <p><strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora.</p>
    </div>`;

    return sendEmail({
        to: user.email,
        subject: '🔒 Recuperación de Contraseña - Sistema de Inventario',
        html: buildEmail('#673AB7', '🔒 Recuperación de Contraseña', body)
    });
};

//  NOTIFICACIONES A ADMINISTRADORES

// Nueva solicitud (loan ya populado)
const notifyAdminsNewLoan = async (user, loan) => {
    logger.info(`📨 Notificando admins: nueva solicitud`);

    const fechaSugeridaFila = loan.fecha_sugerida_usuario
        ? `<p><strong>📅 Fecha sugerida por usuario:</strong> ${formatDate(loan.fecha_sugerida_usuario)}</p>`
        : '';

    const obsBlock = loan.observacion_solicitud
        ? `<div class="obs-box"><p style="margin:0 0 6px;"><strong>💬 Observación del usuario:</strong></p><p style="margin:0;">${sanitizeHtml(loan.observacion_solicitud)}</p></div>`
        : '';

    const destinoAdminBlock = loan.destino_salida
        ? `<div class="obs-box" style="background:#e0f2f1;border-color:#26a69a;"><p style="margin:0 0 6px;"><strong>📍 Destino de salida:</strong></p><p style="margin:0;">${sanitizeHtml(loan.destino_salida)}</p></div>`
        : '';

    const body = `
    <p><strong>Nueva solicitud de préstamo recibida:</strong></p>
    <div class="info-box" style="border-color:#F44336;">
        <p><strong>👤 Solicitante:</strong> ${sanitizeHtml(user.nombre)}</p>
        <p><strong>📧 Email:</strong> ${user.email}</p>
        <p><strong>📋 Ítems solicitados (${loan.items?.length || 0}):</strong></p>
        ${buildItemsTable(loan.items || [], 'all')}
        <p><strong>📅 Fecha solicitud:</strong> ${formatDate(loan.fecha_solicitud || new Date())}</p>
        ${fechaSugeridaFila}
    </div>
    ${destinoAdminBlock}
    ${obsBlock}
    <div class="action-box">
        <p><strong>⚡ ACCIÓN REQUERIDA</strong></p>
        <p>Ingresa al sistema para aprobar o rechazar esta solicitud.</p>
        <p><strong>Panel de Administración › Solicitudes Pendientes</strong></p>
    </div>`;

    // Extraer aulas involucradas para notificar solo a admins de esos ambientes
    const aulaIdsNuevaSol = (loan.items || [])
        .map(li => String(li.aula?._id || li.aula))
        .filter(Boolean);

    return sendToAdminsByScope(
        aulaIdsNuevaSol,
        `🔔 Nueva Solicitud de Préstamo (${loan.items?.length || 1} ítem(s)) - ${sanitizeHtml(user.nombre)}`,
        buildEmail('#F44336', '🔔 Nueva Solicitud de Préstamo', body)
    );
};

// Aviso de devolución de un ítem específico
const notifyAdminsReturnRequest = async (user, loan, loanItem, { cantidadDevuelta, observacion, devueltaTotal, pendienteDespues, devolucionCompleta }) => {
    logger.info(`📨 Notificando admins: aviso de devolución`);

    const item = loanItem.item || loanItem;
    const esConsumible = item?.tipo_categoria === 'Consumible';
    const nombreItem = sanitizeHtml(item?.nombre || 'N/A');
    const badgeClass = esConsumible ? 'badge-consumible' : 'badge-controlado';

    let detalle = '';
    if (esConsumible) {
        detalle = `<p><strong>🔄 Consumida:</strong> ${loanItem.cantidad_prestamo - cantidadDevuelta} ud.</p>
                   <p><strong>↩️ A devolver:</strong> ${cantidadDevuelta} ud.</p>`;
    } else {
        detalle = `<p><strong>↩️ Devueltas ahora:</strong> ${cantidadDevuelta} ud.</p>
                   <p><strong>📦 Total devuelto:</strong> ${devueltaTotal} / ${loanItem.cantidad_prestamo} ud.</p>`;
        if (!devolucionCompleta)
            detalle += `<p><strong>⏳ Pendientes:</strong> <span style="color:#c2410c;font-weight:bold;">${pendienteDespues} ud.</span></p>`;
    }

    const obsBlock = observacion
        ? `<div class="obs-box"><p style="margin:0 0 6px;"><strong>💬 Observación del usuario:</strong></p><p style="margin:0;">${sanitizeHtml(observacion)}</p></div>`
        : '';

    // Historial de devoluciones parciales
    let historialBlock = '';
    if (!esConsumible && loanItem.devoluciones_parciales?.length > 1) {
        const filas = loanItem.devoluciones_parciales.map((d, i) =>
            `<tr>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${i + 1}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${d.cantidad} ud.</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${formatDate(d.fecha)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${d.observacion ? sanitizeHtml(d.observacion) : '—'}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:${d.confirmado ? '#15803d' : '#c2410c'};">${d.confirmado ? '✅ Confirmado' : '⏳ Pendiente'}</td>
            </tr>`
        ).join('');
        historialBlock = `<div style="margin:15px 0;">
            <p><strong>📋 Historial de devoluciones:</strong></p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8f8f8;">
                    <th style="padding:6px 8px;text-align:left;">#</th>
                    <th>Cant.</th><th>Fecha</th><th>Obs. usuario</th><th>Estado</th>
                </tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
    }

    const estadoDevolucion = esConsumible ? ''
        : devolucionCompleta
            ? `<div style="background:#dcfce7;padding:12px;border-radius:6px;border:2px solid #86efac;margin:12px 0;">
                <p style="margin:0;color:#15803d;font-weight:bold;">✅ DEVOLUCIÓN COMPLETA — Ya puedes confirmarla</p></div>`
            : `<div style="background:#fff7ed;padding:12px;border-radius:6px;border:2px solid #fed7aa;margin:12px 0;">
                <p style="margin:0;color:#c2410c;font-weight:bold;">⏳ DEVOLUCIÓN PARCIAL — Espera el resto</p></div>`;

    const actionText = esConsumible || devolucionCompleta
        ? 'Verifica la devolución física y confírmala en el sistema.'
        : 'NO confirmes aún. El usuario aún tiene unidades pendientes.';

    // Contexto del préstamo completo
    const otrosItems = (loan.items || []).filter(li => String(li._id) !== String(loanItem._id) && li.estado_item === 'Aprobado');
    const otrosBlock = otrosItems.length > 0
        ? `<div style="margin-top:12px;"><p><strong>📦 Otros ítems activos en el mismo préstamo:</strong></p>${buildItemsTable(otrosItems, 'all')}</div>`
        : '';

    const body = `
    <p>El usuario <strong>${sanitizeHtml(user.nombre)}</strong> notificó una devolución.</p>
    <div class="info-box" style="border-color:#FF9800;">
        <p><strong>👤 Usuario:</strong> ${sanitizeHtml(user.nombre)} (${user.email})</p>
        <p><strong>📦 Ítem:</strong> ${nombreItem} <span class="badge ${badgeClass}">${item?.tipo_categoria || ''}</span></p>
        <p><strong>📍 Ubicación:</strong> ${sanitizeHtml(loanItem.aula?.nombre || 'N/A')}</p>
        ${detalle}
    </div>
    ${estadoDevolucion}
    ${historialBlock}
    ${obsBlock}
    ${otrosBlock}
    <div class="action-box">
        <p><strong>${esConsumible || devolucionCompleta ? '✅' : '⚠️'} ACCIÓN REQUERIDA</strong></p>
        <p>${actionText}</p>
        <p><strong>Panel de Administración › Gestión de Préstamos</strong></p>
    </div>`;

    const asunto = esConsumible
        ? `📦 Aviso Devolución - ${nombreItem} (${sanitizeHtml(user.nombre)})`
        : devolucionCompleta
            ? `✅ Devolución Completa - ${nombreItem}`
            : `⏳ Devolución Parcial (${devueltaTotal}/${loanItem.cantidad_prestamo} ud.) - ${nombreItem}`;

    // Notificar al admin del ambiente del ítem devuelto
    const aulaIdDevolucion = [String(loanItem.aula?._id || loanItem.aula)].filter(Boolean);
    return sendToAdminsByScope(aulaIdDevolucion, asunto, buildEmail('#FF9800', '📦 Aviso de Devolución', body));
};


const notifyAdminsOverdueLoans = async (overdueLoans) => {
    if (!overdueLoans || overdueLoans.length === 0) return;
    logger.info(`📨 Notificando admins: resumen de ${overdueLoans.length} préstamo(s) vencido(s)`);

    const now = new Date();

    // Agrupar préstamos por usuario
    const porUsuario = new Map();
    for (const loan of overdueLoans) {
        if (!loan.usuario) continue;
        const uid = String(loan.usuario._id);
        if (!porUsuario.has(uid)) porUsuario.set(uid, { usuario: loan.usuario, loans: [] });
        porUsuario.get(uid).loans.push(loan);
    }

    const bloques = [...porUsuario.values()].map(({ usuario, loans }) => {
        const loanRows = loans.map((loan, idx) => {
            const diasVencido = Math.floor((now - new Date(loan.fecha_estimada)) / (1000 * 60 * 60 * 24));
            const diasTexto   = diasVencido === 0 ? 'hoy' : `hace ${diasVencido} día(s)`;
            const itemsAprobados = (loan.items || []).filter(li => li.estado_item === 'Aprobado');

            return `
            <div style="margin-bottom:10px;padding-left:12px;border-left:3px solid #ef9a9a;">
                ${loans.length > 1 ? `<p style="margin:0 0 4px;font-size:12px;color:#888;">Préstamo ${idx + 1}</p>` : ''}
                ${buildItemsTable(itemsAprobados, 'all')}
                <p style="margin:4px 0;font-size:13px;"><strong>📅 Fecha límite era:</strong> <strong style="color:#c62828;">${formatDate(loan.fecha_estimada)}</strong> — venció ${diasTexto}</p>
            </div>`;
        }).join('');

        return `
        <div class="info-box" style="border-color:#c62828;margin-bottom:20px;">
            <p style="margin:0 0 6px;"><strong>👤 Usuario:</strong> ${sanitizeHtml(usuario.nombre)}</p>
            <p style="margin:0 0 10px;"><strong>📧 Email:</strong> ${sanitizeHtml(usuario.email)}</p>
            ${loanRows}
        </div>`;
    }).join('');

    const totalPrestamos = overdueLoans.filter(l => l.usuario).length;
    const totalUsuarios  = porUsuario.size;

    const resumenChips = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;">
        <span style="background:#ffebee;color:#c62828;padding:4px 14px;border-radius:12px;font-weight:700;font-size:13px;">
            🚨 ${totalPrestamos} préstamo(s) vencido(s)
        </span>
        <span style="background:#fce4ec;color:#880e4f;padding:4px 14px;border-radius:12px;font-weight:700;font-size:13px;">
            👥 ${totalUsuarios} usuario(s) afectado(s)
        </span>
    </div>`;

    const body = `
    <p>Resumen diario de préstamos <strong style="color:#c62828;">VENCIDOS</strong>:</p>
    ${resumenChips}
    ${bloques}
    <div class="action-box" style="background:#ffebee;border:2px solid #ef9a9a;">
        <p><strong>🚨 ATENCIÓN REQUERIDA</strong></p>
        <p>Contacta a los usuarios y gestiona las devoluciones pendientes.</p>
        <p><strong>Panel de Administración › Gestión de Préstamos › Vencidos</strong></p>
    </div>`;

    // Recopilar todas las aulas de todos los préstamos vencidos
    const aulaIdsVencidos = [...new Set(
        overdueLoans.flatMap(l =>
            (l.items || [])
                .filter(li => li.estado_item === 'Aprobado')
                .map(li => String(li.aula?._id || li.aula))
        ).filter(Boolean)
    )];

    return sendToAdminsByScope(
        aulaIdsVencidos,
        `🚨 ${totalPrestamos} Préstamo(s) Vencido(s) — ${totalUsuarios} usuario(s)`,
        buildEmail('#c62828', '🚨 Resumen de Préstamos Vencidos', body)
    );
};

/**
 * Notifica a los administradores que un usuario no recuerda su correo.
 * El admin podrá contactar al usuario por otro canal (en persona, WhatsApp, etc.)
 */
const notifyAdminsEmailHint = async (nombreBuscado, coincidencias) => {
    logger.info(`📨 Notificando admins: solicitud de recuperación de correo para "${nombreBuscado}"`);

    const filas = coincidencias.map(u =>
        `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;">${sanitizeHtml(u.nombre)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#1565c0;">${sanitizeHtml(u.email)}</td>
        </tr>`
    ).join('');

    const tablaCoincidencias = coincidencias.length > 0
        ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:10px 0;">
            <thead><tr style="background:#f0f4ff;">
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Nombre registrado</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;">Correo electrónico</th>
            </tr></thead>
            <tbody>${filas}</tbody>
           </table>`
        : `<p style="color:#888;font-style:italic;">No se encontraron coincidencias exactas para ese nombre.</p>`;

    const body = `
    <p>Un usuario solicitó ayuda para recordar su correo de acceso al sistema.</p>
    <div class="info-box" style="border-color:#1976D2;">
        <p><strong>🔍 Nombre buscado:</strong> <span style="font-size:16px;font-weight:700;">${sanitizeHtml(nombreBuscado)}</span></p>
        <p><strong>🕐 Fecha:</strong> ${formatDate(new Date())}</p>
    </div>
    <p><strong>Posibles coincidencias en el sistema:</strong></p>
    ${tablaCoincidencias}
    <div class="action-box" style="background:#e3f2fd;border:2px solid #90caf9;">
        <p><strong>📋 ACCIÓN REQUERIDA</strong></p>
        <p>Contacta al usuario en persona o por otro canal y confírmale cuál es el correo con el que se registró para que pueda recuperar su contraseña.</p>
        <p style="color:#888;font-size:12px;">Por seguridad, no respondas este correo ni compartas esta información por canales no seguros.</p>
    </div>`;

    return sendToAdmins(
        `🔑 Solicitud de recuperación de correo — "${sanitizeHtml(nombreBuscado)}"`,
        buildEmail('#1976D2', '🔑 Recuperación de Acceso', body)
    );
};

/**
 * Envía al usuario un correo recordándole cuál es su correo de acceso.
 * Se dispara cuando el usuario busca su nombre y el sistema encuentra coincidencia.
 */
const sendEmailHintToUser = async (user) => {
    logger.info(`📨 Enviando recordatorio de correo a: ${user.email}`);

    const body = `
    <p>Hola, <strong>${sanitizeHtml(user.nombre)}</strong>.</p>
    <p>Recibimos una solicitud para recordarte el correo con el que accedes al <strong>Sistema de Inventario</strong>.</p>

    <div class="info-box" style="border-color:#39A900; text-align:center; padding:24px;">
        <p style="margin:0 0 8px; color:#555; font-size:14px;">Tu correo registrado es:</p>
        <p style="margin:0; font-size:22px; font-weight:800; color:#1a1a1a; letter-spacing:1px;">
            ${sanitizeHtml(user.email)}
        </p>
    </div>

    <div class="action-box">
        <p><strong>¿Qué puedes hacer ahora?</strong></p>
        <p>Con este correo ya puedes iniciar sesión. Si además olvidaste tu contraseña,
        usa la opción <strong>"¿Olvidaste tu contraseña?"</strong> en la pantalla de acceso
        e ingresa este correo para recibir un enlace de recuperación.</p>
    </div>

    <div class="obs-box-warn">
        <p style="margin:0; font-size:13px;">
            ⚠️ Si no realizaste esta solicitud, ignora este mensaje.
            Nadie más ha podido ver tu correo.
        </p>
    </div>`;

    return sendEmail({
        to:      user.email,
        subject: '🔑 Tu correo de acceso — Sistema de Inventario',
        html:    buildEmail('#39A900', '🔑 Recordatorio de Correo', body)
    });
};

module.exports = {
    sendAprobacion,
    sendRechazo,
    sendDevolucion,
    sendConfirmacionParcialUsuario,
    sendRecordatorio,
    sendAplazado,
    sendVencimiento,
    sendPasswordReset,
    notifyAdminsNewLoan,
    notifyAdminsReturnRequest,
    notifyAdminsOverdueLoans,
    notifyAdminsEmailHint,
    sendEmailHintToUser,
    sendToAdmins,
    sendToAdminsByScope,
};