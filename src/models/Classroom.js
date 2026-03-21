const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
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
  activo: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

classroomSchema.index({ nombre: 1, zona: 1 }, { unique: true });

module.exports = mongoose.model('Classroom', classroomSchema);