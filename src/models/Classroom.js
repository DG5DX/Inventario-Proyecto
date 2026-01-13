const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
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

classroomSchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model('Classroom', classroomSchema);