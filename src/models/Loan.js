const mongoose = require('mongoose');

// ── Sub-esquema de cada línea del préstamo ────────────────────────────────────
const loanItemSchema = new mongoose.Schema({
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    aula: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    cantidad_prestamo:  { type: Number, required: true, min: 1 },
    cantidad_aprobada:  { type: Number, min: 0 },

    // Estados semánticos:
    // 'Pendiente'  → esperando aprobación
    // 'Aprobado'   → activo, en manos del usuario
    // 'Devuelto'   → completamente devuelto y confirmado (stock restaurado)
    // 'Rechazado'  → rechazado/eliminado al momento de aprobar
    // 'Eliminado'  → quitado por el admin antes de aprobar
    estado_item: {
        type: String,
        enum: ['Pendiente', 'Aprobado', 'Devuelto', 'Usado', 'Rechazado', 'Eliminado'],
        default: 'Pendiente'
    },

    observacion_item: { type: String, trim: true, maxlength: 300 },

    // Seguimiento de devoluciones
    cantidad_devuelta:   { type: Number, default: 0, min: 0 },
    cantidad_confirmada: { type: Number, default: 0, min: 0 },
    notificacion_devolucion_enviada: { type: Boolean, default: false },

    devoluciones_parciales: [{
        cantidad:              { type: Number, required: true, min: 0 },
        observacion:           { type: String, trim: true, maxlength: 500 },
        observacion_recepcion: { type: String, trim: true, maxlength: 500 },
        fecha:                 { type: Date, default: Date.now },
        confirmado:            { type: Boolean, default: false },
        fecha_confirmacion:    { type: Date },
        no_recibida:           { type: Boolean, default: false }
    }]
}, { _id: true });

// ── Esquema principal ─────────────────────────────────────────────────────────
const loanSchema = new mongoose.Schema({
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    items: {
        type: [loanItemSchema],
        validate: {
            validator: v => Array.isArray(v) && v.length >= 1,
            message: 'Un préstamo debe tener al menos un ítem'
        }
    },

    fecha_solicitud:        { type: Date, default: Date.now },
    fecha_sugerida_usuario: { type: Date },
    fecha_prestamo:         { type: Date },
    fecha_estimada:         { type: Date },
    fecha_retorno:          { type: Date },

    estado: {
        type: String,
        enum: ['Pendiente', 'Aprobado', 'Rechazado', 'Devuelto', 'Aplazado', 'Cerrado'],
        default: 'Pendiente'
    },

    observacion_solicitud:  { type: String, trim: true, maxlength: 500 },
    destino_salida:         { type: String, trim: true, maxlength: 120 },
    observacion_rechazo:    { type: String, trim: true, maxlength: 500 },
    observacion_aprobacion: { type: String, trim: true, maxlength: 500 },
    // Cuentadante seleccionado por el admin al aprobar (cuando hay múltiples en el préstamo)
    cuentadante_principal:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cuentadante' },
}, { timestamps: true });

loanSchema.index({ usuario: 1, estado: 1 });
loanSchema.index({ fecha_estimada: 1 });

module.exports = mongoose.model('Loan', loanSchema);