const mongoose = require('mongoose');

/**
 * Student collection — completely separate from the User (admin) collection.
 * Stores every student who logs in, their submissions, score, and timing.
 */
const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    collegeName: { type: String, required: true },
    participationType: { type: String, enum: ['single', 'team'], default: 'single' },
    teamMembers: [String],

    // Exam tracking
    score: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number },        // seconds taken
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

module.exports = mongoose.model('Student', studentSchema);
