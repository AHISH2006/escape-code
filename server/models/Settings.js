const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    isExamStarted: { type: Boolean, default: false },
    examDuration: { type: Number, default: 60 }, // duration in minutes
    startTime: { type: Date },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
