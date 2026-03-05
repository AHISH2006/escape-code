const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    isExamStarted: { type: Boolean, default: false },
    examDuration: { type: Number, default: 30 },  // minutes — fixed at 30
    prepDuration: { type: Number, default: 0 },   // 0 = questions visible immediately
    startTime: { type: Date },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
