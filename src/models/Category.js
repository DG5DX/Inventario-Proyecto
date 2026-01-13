const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
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

categorySchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);