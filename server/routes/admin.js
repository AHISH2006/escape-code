const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const User = require('../models/User');    // Admin only
const Student = require('../models/Student'); // Students only
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// @route   GET api/admin/settings
// @desc    Get exam settings + computed phase status
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        let settings = await Settings.findOne().sort({ updatedAt: -1 });
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }

        const response = {
            isExamStarted: settings.isExamStarted,
            examDuration: settings.examDuration,
            prepDuration: settings.prepDuration,
            startTime: settings.startTime,
            isPrepPhase: false,
            prepTimeLeft: 0,
            examTimeLeft: 0,
        };

        if (settings.isExamStarted && settings.startTime) {
            const now = new Date();
            const start = new Date(settings.startTime);
            const prepDurationMs = (settings.prepDuration || 0) * 60000;
            const examDurationMs = 30 * 60000; // Fixed: 30 minutes

            const prepEnd = new Date(start.getTime() + prepDurationMs);
            const examEnd = new Date(prepEnd.getTime() + examDurationMs);

            if (now < prepEnd) {
                // We are still in prep phase
                response.isPrepPhase = true;
                response.prepTimeLeft = Math.max(0, Math.floor((prepEnd - now) / 1000));
            } else if (now < examEnd) {
                // We are in the active exam phase
                response.isPrepPhase = false;
                response.examTimeLeft = Math.max(0, Math.floor((examEnd - now) / 1000));
            } else {
                // Exam has naturally expired
                response.isExamStarted = false;
                response.examTimeLeft = 0;
            }
        }

        res.json(response);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/admin/settings
// @desc    Update exam settings (Start/Stop Exam)
router.post('/settings', [authMiddleware, adminMiddleware], async (req, res) => {
    const { isExamStarted, examDuration, prepDuration } = req.body;
    try {
        let settings = await Settings.findOne().sort({ updatedAt: -1 });
        if (!settings) settings = new Settings();

        settings.isExamStarted = isExamStarted;
        settings.examDuration = 30; // Fixed 30-minute exam duration
        settings.prepDuration = 0;  // No prep wait

        if (isExamStarted) {
            settings.startTime = new Date();
        } else {
            settings.startTime = null;
        }

        settings.updatedAt = new Date();
        await settings.save();

        // Ensure only one settings document exists
        await Settings.deleteMany({ _id: { $ne: settings._id } });

        res.json(settings);
    } catch (err) {
        res.status(500).send('Server error');
    }
});


// @route   GET /api/admin/students
// @desc    Get all students (from Student collection, sorted by score)
router.get('/students', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const students = await Student.find()
            .populate('submissions.questionId', 'title marks')
            .sort({ score: -1, duration: 1 });
        res.json(students);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/admin/students/:id
// @desc    Permanently delete a student record
router.delete('/students/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const deleted = await Student.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Student not found' });
        res.json({ message: 'Student removed from system.' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/stats
// @desc    Aggregate stats from Student collection
router.get('/stats', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const students = await Student.find();
        const totalStudents = students.length;
        const totalScore = students.reduce((acc, s) => acc + (s.score || 0), 0);
        const avgScore = totalStudents > 0 ? totalScore / totalStudents : 0;
        res.json({ totalStudents, avgScore });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   GET /api/admin/exam-report
// @desc    Detailed exam report: timing, attendance, answer stats
router.get('/exam-report', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const settings = await Settings.findOne().sort({ updatedAt: -1 });
        const students = await Student.find().populate('submissions.questionId', 'title marks');
        const questions = await (require('../models/Question')).find();

        const startTime = settings?.startTime || null;
        const endTime = startTime
            ? new Date(new Date(startTime).getTime() + 30 * 60000)
            : null;

        const totalRegistered = students.length;
        const attended = students.filter(s => s.isOnline || (s.submissions && s.submissions.length > 0)).length;
        const attempted = students.filter(s => s.submissions && s.submissions.length > 0).length;
        const completed = students.filter(s => s.isCompleted).length;
        const correctAtLeastOne = students.filter(s => s.submissions.some(sub => sub.isCorrect)).length;

        // Per-question stats
        const questionStats = questions.map(q => {
            const attempts = students.filter(s => s.submissions.some(sub => sub.questionId?.toString() === q._id.toString())).length;
            const correct = students.filter(s => s.submissions.some(sub => sub.questionId?.toString() === q._id.toString() && sub.isCorrect)).length;
            return { id: q._id, title: q.title, marks: q.marks, attempts, correct };
        });

        res.json({
            startTime,
            endTime,
            isExamStarted: settings?.isExamStarted || false,
            totalRegistered,
            attended,
            attempted,
            completed,
            correctAtLeastOne,
            questionStats
        });
    } catch (err) {
        console.error('exam-report error:', err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
