const express = require('express');
const Question = require('../models/Question');
const Settings = require('../models/Settings');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// @route   GET api/questions
// @desc    Get all questions (Admin) or current round questions (Student)
router.get('/', authMiddleware, async (req, res) => {
    try {
        let questions;
        if (req.user.role === 'admin') {
            questions = await Question.find();
        } else {
            // Check if exam is started
            const settings = await Settings.findOne();
            if (!settings || !settings.isExamStarted) {
                return res.status(403).json({ message: 'Exam has not started yet.' });
            }

            // Record student start time if not already set
            const user = await User.findById(req.user.id);
            if (user && !user.startTime) {
                user.startTime = new Date();
                await user.save();
            }

            questions = await Question.find().select('-correctOutput'); // Hide answer
        }
        res.json(questions);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const newQuestion = new Question(req.body);
        const question = await newQuestion.save();
        res.json(question);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/questions/submit
// @desc    Submit all answers and finalize the exam for a student
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.isCompleted) {
            return res.status(400).json({ message: 'Exam already submitted.' });
        }

        user.endTime = new Date();
        user.isCompleted = true;

        // Calculate duration in seconds
        if (user.startTime) {
            const diff = user.endTime.getTime() - user.startTime.getTime();
            user.duration = Math.floor(diff / 1000);
        }

        // Logic for score calculation can be added here if needed
        // For now, we just mark as complete
        await user.save();

        res.json({ message: 'Exam submitted successfully', duration: user.duration });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/questions/submit-answer
// @desc    Submit an answer for a single question
router.post('/submit-answer', authMiddleware, async (req, res) => {
    const { questionId, code, output } = req.body;
    try {
        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Simple check: compare output (trimmed and case-insensitive)
        const isCorrect = output.trim().toLowerCase() === question.correctOutput.trim().toLowerCase();

        // Update or add submission
        const existingSubIndex = user.submissions.findIndex(s => s.questionId.toString() === questionId);
        if (existingSubIndex > -1) {
            user.submissions[existingSubIndex] = {
                questionId,
                code,
                output,
                isCorrect,
                submittedAt: new Date()
            };
        } else {
            user.submissions.push({
                questionId,
                code,
                output,
                isCorrect
            });
        }

        // Update score if correct and not already scored for this question
        // This is a simple logic, can be refined
        const previousCorrectCount = user.submissions.filter(s => s.isCorrect).length;
        // recalculate score based on all correct submissions
        let totalScore = 0;
        for (const sub of user.submissions) {
            if (sub.isCorrect) {
                const q = await Question.findById(sub.questionId);
                if (q) totalScore += q.marks;
            }
        }
        user.score = totalScore;

        await user.save();
        res.json({ isCorrect, message: isCorrect ? 'Correct solution detected!' : 'Output mismatch detected.', score: user.score });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/questions/:id
// @desc    Update a question
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!question) return res.status(404).json({ message: 'Question not found' });
        res.json(question);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/questions/:id
// @desc    Delete a question
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        res.json({ message: 'Question deleted successfully' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
