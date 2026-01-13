const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 60 * 60 * 1000) 
    },
    used: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

passwordResetSchema.index({ token: 1 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);