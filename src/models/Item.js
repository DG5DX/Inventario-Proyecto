const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: 500
  },
  zona: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: true
  },
  aula: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  cantidad_total_stock: {
    type: Number,
    required: true,
    min: 0
  },
  cantidad_disponible: {
    type: Number,
    required: true,
    min: 0
  },
  imagen: {
    type: String,
    trim: true
  },
  numero_placa: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 50
    // unique e índice se declaran abajo con sparse: true
  },
  tipo_categoria: {
    type: String,
    enum: ['Consumible', 'De Uso Controlado', 'Equipo O Maquinaria'],
    required: true
  },
  estado: {
    type: String,
    enum: ['Disponible', 'Agotado'],
    required: true,
    default: 'Disponible'
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  codigo_unspsc: {
    type: String,
    trim: true,
    maxlength: 8,
    match: [/^\d{8}$/, 'El código UNSPSC debe tener exactamente 8 dígitos numéricos']
  },
  unidad_medida: {
    type: String,
    trim: true,
    maxlength: 50
  },
  presentacion: {
    type: String,
    trim: true,
    maxlength: 300
  },
  cuentadante: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuentadante',
    required: true
  }
}, {
  timestamps: true
});

const syncEstado = (doc) => {
  if (!doc) return;
  doc.estado = doc.cantidad_disponible > 0 ? 'Disponible' : 'Agotado';
};

itemSchema.pre('save', function (next) {
  syncEstado(this);
  next();
});

itemSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (!update) return next();
  if (update.$set) {
    if (typeof update.$set.cantidad_disponible === 'number') {
      update.$set.estado = update.$set.cantidad_disponible > 0 ? 'Disponible' : 'Agotado';
    }
  }
  if (typeof update.cantidad_disponible === 'number') {
    update.estado = update.cantidad_disponible > 0 ? 'Disponible' : 'Agotado';
  }
  next();
});

// Índice compuesto de ubicación — un ítem no puede repetir nombre en el mismo ambiente y sede
itemSchema.index({ aula: 1, zona: 1, nombre: 1 }, { unique: true });

// Unicidad de placa SENA — sparse: true para que null no cuente como duplicado
// (los materiales no tienen placa, solo los equipos)
itemSchema.index({ numero_placa: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Item', itemSchema);