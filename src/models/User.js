const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 350
  },
  passwordHash: {
    type: String,
    required: true
  },
  rol: {
    type: String,
    enum: ['Admin', 'Comun'],
    default: 'Comun'
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);