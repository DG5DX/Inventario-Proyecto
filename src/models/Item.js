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
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
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
  tipo_categoria: {
    type: String,
    enum: ['Consumible', 'Devolutivo', 'Trasladado', 'Placa SENA', 'Herramienta de equipo', 'Insumo', 'De Uso Controlado'],
    required: true
  },
  estado: {
    type: String,
    enum: ['Disponible', 'Agotado'],
    required: true,
    default: 'Disponible'
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

itemSchema.index({ aula: 1, categoria: 1, nombre: 1 });

module.exports = mongoose.model('Item', itemSchema);