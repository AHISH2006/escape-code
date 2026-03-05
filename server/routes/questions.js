const express = require('express');
const Question = require('../models/Question');
const Settings = require('../models/Settings');
const Student = require('../models/Student');   // Students collection
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// @route   GET /api/questions
// @desc    Admin → all questions with answers | Student → questions without answers
router.get('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            return res.json(await Question.find());
        }

        const settings = await Settings.findOne().sort({ updatedAt: -1 });
        if (!settings || !settings.isExamStarted) {
            return res.status(403).json({ message: 'Exam has not started yet.' });
        }

        // Record start time on first question fetch
        const student = await Student.findById(req.user.id);
        if (student && !student.startTime) {
            student.startTime = new Date();
            await student.save();
        }

        // Hidden correctOutput for students
        return res.json(await Question.find().select('-correctOutput'));
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST /api/questions
// @desc    Admin: add a new question
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const q = await new Question(req.body).save();
        res.json(q);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST /api/questions/submit
// @desc    Student finalizes the exam
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const student = await Student.findById(req.user.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        if (student.isCompleted) return res.status(400).json({ message: 'Exam already submitted.' });

        student.endTime = new Date();
        student.isCompleted = true;

        if (student.startTime) {
            student.duration = Math.floor((student.endTime - student.startTime) / 1000);
        }

        await student.save();
        res.json({ message: 'Exam submitted successfully', duration: student.duration });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST /api/questions/submit-answer
// @desc    Student submits a single answer
router.post('/submit-answer', authMiddleware, async (req, res) => {
    const { questionId, code, output } = req.body;
    try {
        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const student = await Student.findById(req.user.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const isCorrect = output.trim().toLowerCase() === question.correctOutput.trim().toLowerCase();

        // Upsert submission
        const idx = student.submissions.findIndex(s => s.questionId.toString() === questionId);
        const subData = { questionId, code, output, isCorrect, submittedAt: new Date() };
        if (idx > -1) student.submissions[idx] = subData;
        else student.submissions.push(subData);

        // Recalculate total score from all correct submissions
        let totalScore = 0, correctCount = 0;
        for (const sub of student.submissions) {
            if (sub.isCorrect) {
                correctCount++;
                const q = await Question.findById(sub.questionId);
                if (q) totalScore += q.marks;
            }
        }
        student.score = totalScore;

        // Auto-complete if all questions answered correctly
        const totalQuestions = await Question.countDocuments();
        if (correctCount >= totalQuestions && !student.isCompleted) {
            student.isCompleted = true;
            student.endTime = new Date();
            const settings = await Settings.findOne().sort({ updatedAt: -1 });
            const base = settings?.startTime || student.startTime;
            student.duration = Math.floor((student.endTime - new Date(base)) / 1000);
        }

        await student.save();
        res.json({ isCorrect, score: student.score, isCompleted: student.isCompleted, duration: student.duration });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/questions/:id  — Admin: update question
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const q = await Question.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        if (!q) return res.status(404).json({ message: 'Question not found' });
        res.json(q);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/questions/:id  — Admin: delete question
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const q = await Question.findByIdAndDelete(req.params.id);
        if (!q) return res.status(404).json({ message: 'Question not found' });
        res.json({ message: 'Question deleted' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
