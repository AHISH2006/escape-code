const mongoose = require('mongoose');

/**
 * User collection — Admin accounts ONLY.
 * There is only one admin for this event.
 * Students are stored in the separate Student collection.
 */
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    role: { type: String, default: 'admin' },
    isOnline: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
