const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true
    },
    aula: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
        required: true
    },
    cantidad_prestamo: {
        type: Number,
        required: true,
        min: 1
    },
    fecha_solicitud: {
        type: Date,
        default: Date.now
    },
    fecha_prestamo: {
        type: Date
    },
    fecha_estimada: {
        type: Date
    },
    fecha_retorno: {
        type: Date
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'Aprobado', 'Rechazado', 'Devuelto', 'Aplazado'],
        default: 'Pendiente'
    }
}, {
    timestamps: true
});

loanSchema.index({ usuario: 1, estado: 1 });
loanSchema.index({ fecha_estimada: 1 });

module.exports = mongoose.model('Loan', loanSchema);