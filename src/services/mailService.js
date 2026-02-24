const nodemailer = require('nodemailer');
const logger = require('../config/logger.js');

// Crear transporter fresco cada vez para evitar credenciales cacheadas
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
};

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

const sendEmail = async ({ to, subject, text, html }, retries = 2) => {
    try {
        logger.info(`📧 Enviando email a: ${to}`);
        logger.info(`📋 Asunto: ${subject}`);
        
        if (!to || !to.includes('@')) {
            throw new Error(`Email inválido: ${to}`);
        }

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            throw new Error('Configuración SMTP incompleta. Verifica SMTP_HOST, SMTP_USER y SMTP_PASS');
        }

        const transporter = createTransporter();
        const fromEmail = process.env.MAIL_FROM || `"Inventario" <${process.env.SMTP_USER}>`;

        const mailOptions = {
            from: fromEmail,
            to: to,
            subject: subject,
            text: text,
            html: html || `<pre>${text}</pre>`
        };

        const info = await transporter.sendMail(mailOptions);
        
        logger.info(`✅ Email enviado exitosamente a: ${to}`);
        logger.info(`📬 Message ID: ${info.messageId}`);
        
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        logger.error(`❌ Error enviando email a ${to}: ${error.message} (código: ${error.code || 'N/A'})`);
        logger.error('Stack:', error.stack);
        
        if (retries > 0 && (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET')) {
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
    
    const subject = '🔒 Recuperación de Contraseña - Sistema de Inventario';
    
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
            <h1>🔒 Recuperación de Contraseña</h1>
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