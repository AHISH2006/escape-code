const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    collegeName: { type: String }, // For students
    email: { type: String, unique: true, sparse: true }, // For admin
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    participationType: { type: String, enum: ['single', 'team'], default: 'single' },
    teamMembers: [String], // Array of names if participationType is 'team'
    teamId: { type: String },
    score: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number }, // seconds
    isCompleted: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    submissions: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        code: { type: String },
        output: { type: String },
        isCorrect: { type: Boolean },
        submittedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
