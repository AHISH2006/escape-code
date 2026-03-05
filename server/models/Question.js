const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    round: { type: Number, required: true },
    title: { type: String, required: true },
    problem: { type: String, required: true },
    buggyCode: { type: String, required: true },
    sampleInput: { type: String, default: "" },
    correctOutput: { type: String, required: true },
    marks: { type: Number, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    note: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', questionSchema);
