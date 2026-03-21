const mongoose = require('mongoose');

const cuentadanteSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    numero_identificacion: {
        type: String,
        required: true,
        trim: true,
        minlength: 8,
        maxlength: 20
    },
    activo: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Cuentadante', cuentadanteSchema);