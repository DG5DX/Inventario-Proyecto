const { Resend } = require('resend');
const logger = require('../config/logger.js');

const resend = new Resend(process.env.RESEND_API_KEY);

const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
        return new Intl.DateTimeFormat('es-CO', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'America/Bogota'
        }).format(new Date(date));
    } catch (error) {
        logger.error('Error formateando fecha:', error);
        return String(date);
    }
};

const isProduction = process.env.NODE_ENV === 'production' && process.env.RESEND_VERIFIED_DOMAIN;
const VERIFIED_OWNER_EMAIL = process.env.RESEND_OWNER_EMAIL || 'dafecano@gmail.com'; // Tu email verificado


const getRecipient = (originalTo) => {
    if (isProduction) {
        return originalTo;
    }
    
    if (originalTo.toLowerCase() === VERIFIED_OWNER_EMAIL.toLowerCase()) {
        return originalTo;
    }
    
    return 'delivered@resend.dev';
};


const getSubject = (originalSubject, originalTo) => {
    if (isProduction) {
        return originalSubject;
    }
    
    return `[TEST → ${originalTo}] ${originalSubject}`;
};

const sendEmail = async ({ to, subject, text, html }, retries = 2) => {
    try {
        logger.info(`📧 Enviando email a: ${to}`);
        logger.info(`📋 Asunto: ${subject}`);
        
        if (!to || !to.includes('@')) {
            throw new Error(`Email inválido: ${to}`);
        }

        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY no configurada');
        }

        const recipientEmail = getRecipient(to);
        const emailSubject = getSubject(subject, to);
        
        if (!isProduction && recipientEmail !== to) {
            logger.warn(`⚠️ MODO DESARROLLO: Email para ${to} será enviado a ${recipientEmail}`);
            logger.warn(`💡 Para enviar a destinatarios reales, configura RESEND_VERIFIED_DOMAIN en las variables de entorno`);
        }

        const fromEmail = isProduction && process.env.RESEND_FROM_EMAIL 
            ? process.env.RESEND_FROM_EMAIL 
            : 'Inventario <onboarding@resend.dev>';

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [recipientEmail],
            subject: emailSubject,
            html: html || `<pre>${text}</pre>`
        });

        if (error) {
            logger.error('❌ Error de Resend API:', JSON.stringify(error, null, 2));
            throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
        }
        
        logger.info(`✅ Email enviado exitosamente a: ${recipientEmail}`);
        if (!isProduction && recipientEmail !== to) {
            logger.info(`📬 Email original destinado a: ${to}`);
        }
        logger.info(`📬 Message ID: ${data.id}`);
        
        return { success: true, messageId: data.id };
        
    } catch (error) {
        logger.error(`❌ Error enviando email a ${to}:`, error.message);
        logger.error('Stack:', error.stack);
        
        if (retries > 0 && (error.statusCode === 429 || error.code === 'ETIMEDOUT')) {
            logger.info(`🔄 Reintentando envío (${retries} intentos restantes)...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return sendEmail({ to, subject, text, html }, retries - 1);
        }
        
        return { 
            success: false, 
            error: error.message || String(error),
            details: error.stack 
        };
    }
};

const sendAprobacion = async (user, loan, item) => {
    logger.info(`📨 Preparando email de aprobación para: ${user.email}`);
    
    const subject = 'Préstamo Aprobado - Sistema de Inventario';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Préstamo Aprobado</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>Tu préstamo ha sido <strong>APROBADO</strong>.</p>
            
            <div class="info-box">
                <p><strong>📦 Ítem:</strong> ${item.nombre}</p>
                <p><strong>🔢 Cantidad:</strong> ${loan.cantidad_prestamo} unidad(es)</p>
                <p><strong>📅 Fecha de devolución:</strong> ${formatDate(loan.fecha_estimada)}</p>
            </div>
            
            <p>Por favor, devuelve el ítem antes de la fecha indicada.</p>
        </div>
        <div class="footer">
            <p>Sistema de Inventario</p>
            <p>Este es un mensaje automático, no responder.</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return sendEmail({ to: user.email, subject, html });
};

const sendDevolucion = async (user, loan, item) => {
    logger.info(`📨 Preparando email de devolución para: ${user.email}`);
    
    const subject = 'Devolución Registrada - Sistema de Inventario';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Devolución Registrada</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>Hemos registrado la devolución de tu préstamo.</p>
            
            <div class="info-box">
                <p><strong>📦 Ítem:</strong> ${item.nombre}</p>
                <p><strong>🔢 Cantidad:</strong> ${loan.cantidad_prestamo} unidad(es)</p>
                <p><strong>📅 Devuelto el:</strong> ${formatDate(loan.fecha_retorno)}</p>
            </div>
            
            <p>¡Gracias por devolver a tiempo!</p>
        </div>
        <div class="footer">
            <p>Sistema de Inventario</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return sendEmail({ to: user.email, subject, html });
};

const sendRecordatorio = async (user, loan, item) => {
    logger.info(`📨 Preparando recordatorio para: ${user.email}`);
    
    const subject = 'Recordatorio de Devolución - Sistema de Inventario';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Recordatorio de Devolución</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>Este es un recordatorio de que tu préstamo debe ser devuelto pronto.</p>
            
            <div class="info-box">
                <p><strong>📦 Ítem:</strong> ${item.nombre}</p>
                <p><strong>🔢 Cantidad:</strong> ${loan.cantidad_prestamo} unidad(es)</p>
                <p><strong>📅 Fecha límite:</strong> ${formatDate(loan.fecha_estimada)}</p>
            </div>
            
            <p>Por favor, devuelve el ítem antes de la fecha indicada.</p>
        </div>
        <div class="footer">
            <p>Sistema de Inventario</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return sendEmail({ to: user.email, subject, html });
};

const sendAplazado = async (user, loan, item) => {
    logger.info(`📨 Preparando email de aplazamiento para: ${user.email}`);
    
    const subject = 'Fecha de Préstamo Actualizada - Sistema de Inventario';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #9C27B0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #9C27B0; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Fecha Actualizada</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>La fecha de devolución de tu préstamo ha sido actualizada.</p>
            
            <div class="info-box">
                <p><strong>📦 Ítem:</strong> ${item.nombre}</p>
                <p><strong>🔢 Cantidad:</strong> ${loan.cantidad_prestamo} unidad(es)</p>
                <p><strong>📅 Nueva fecha:</strong> ${formatDate(loan.fecha_estimada)}</p>
            </div>
            
            <p>Por favor, devuelve el ítem antes de la nueva fecha indicada.</p>
        </div>
        <div class="footer">
            <p>Sistema de Inventario</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return sendEmail({ to: user.email, subject, html });
};

const notifyAdminsNewLoan = async (user, loan, item, aula) => {
    logger.info(`📨 Preparando notificación para administradores`);
    
    const User = require('../models/User.js');
    
    try {
        const admins = await User.find({ rol: 'Admin' }).lean();
        
        if (!admins || admins.length === 0) {
            logger.warn('⚠️ No hay administradores registrados');
            return { success: false, error: 'No admins found' };
        }

        logger.info(`📬 Notificando a ${admins.length} administrador(es)`);

        const subject = '🔔 Nueva Solicitud de Préstamo - Requiere Aprobación';
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #F44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-box { background: white; padding: 20px; margin: 15px 0; border-left: 4px solid #F44336; }
        .action-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 5px; border: 2px solid #ffc107; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Nueva Solicitud de Préstamo</h1>
        </div>
        <div class="content">
            <p><strong>Nueva solicitud de préstamo recibida:</strong></p>
            
            <div class="info-box">
                <p><strong>👤 Solicitante:</strong> ${user.nombre}</p>
                <p><strong>📧 Email:</strong> ${user.email}</p>
                <p><strong>📦 Ítem:</strong> ${item.nombre}</p>
                <p><strong>🔢 Cantidad:</strong> ${loan.cantidad_prestamo} unidad(es)</p>
                <p><strong>📍 Ubicación:</strong> ${aula.nombre}</p>
                <p><strong>📅 Fecha:</strong> ${formatDate(loan.fecha_solicitud || new Date())}</p>
            </div>
            
            <div class="action-box">
                <p><strong>⚡ ACCIÓN REQUERIDA</strong></p>
                <p>Por favor, ingresa al sistema para revisar y aprobar o rechazar esta solicitud.</p>
                <p><strong>Panel de Administración &gt; Solicitudes Pendientes</strong></p>
            </div>
        </div>
        <div class="footer">
            <p>Sistema de Inventario</p>
        </div>
    </div>
</body>
</html>
        `.trim();

        const validAdmins = admins.filter(admin => {
            if (!admin.email || !admin.email.includes('@')) {
                logger.warn(`❌ Admin ${admin._id} sin email válido`);
                return false;
            }
            
            if (admin.email.includes('demo.com') || admin.email.includes('test.com')) {
                logger.info(`ℹ️ Omitiendo admin con email de demo: ${admin.email}`);
                return false;
            }
            
            return true;
        });

        if (validAdmins.length === 0) {
            logger.warn('⚠️ No hay administradores con emails válidos');
            return { success: false, error: 'No valid admin emails' };
        }

        logger.info(`📤 Enviando a ${validAdmins.length} administrador(es) con emails válidos`);

        const results = await Promise.allSettled(
            validAdmins.map(admin => sendEmail({ to: admin.email, subject, html }))
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const failed = results.length - successful;

        logger.info(`✅ Notificaciones: ${successful} exitosas, ${failed} fallidas`);

        return { success: successful > 0, successful, failed };
        
    } catch (error) {
        logger.error('❌ Error notificando administradores:', error.message);
        return { success: false, error: error.message };
    }
};

const sendPasswordReset = async (user, resetLink) => {
    logger.info(`📨 Preparando email de recuperación para: ${user.email}`);
    
    const subject = '🔑 Recuperación de Contraseña - Sistema de Inventario';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #673AB7; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .info-box { background: white; padding: 20px; margin: 15px 0; border-left: 4px solid #673AB7; }
        .button { display: inline-block; padding: 12px 30px; background: #673AB7; color: white !important; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        .warning { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 5px; border: 2px solid #ffc107; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔑 Recuperación de Contraseña</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${user.nombre}</strong>,</p>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            
            <div class="info-box">
                <p>Haz click en el botón de abajo para crear una nueva contraseña:</p>
                <p style="text-align: center;">
                    <a href="${resetLink}" class="button">Restablecer Contraseña</a>
                </p>
                <p style="font-size: 12px; color: #666; margin-top: 15px;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                    <span style="word-break: break-all;">${resetLink}</span>
                </p>
            </div>
            
            <div class="warning">
                <p><strong>⚠️ Importante:</strong></p>
                <p>• Este enlace expirará en 1 hora</p>
                <p>• Si no solicitaste este cambio, ignora este email</p>
                <p>• Tu contraseña actual seguirá siendo válida hasta que la cambies</p>
            </div>
        </div>
        <div class="footer">
            <p>Sistema de Inventario</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    return sendEmail({ to: user.email, subject, html });
};

module.exports = {
    sendAprobacion,
    sendDevolucion,
    sendRecordatorio,
    sendAplazado,
    notifyAdminsNewLoan,
    sendPasswordReset
};