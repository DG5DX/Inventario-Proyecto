const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 150
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

zoneSchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model('Zone', zoneSchema);