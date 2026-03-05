const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// @route   GET api/admin/settings
// @desc    Get exam settings
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        res.json(settings);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/admin/settings
// @desc    Update exam settings (Start/Stop Exam)
router.post('/settings', [authMiddleware, adminMiddleware], async (req, res) => {
    const { isExamStarted, examDuration } = req.body;
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        settings.isExamStarted = isExamStarted;
        if (examDuration) settings.examDuration = examDuration;
        if (isExamStarted) {
            settings.startTime = new Date();
        } else {
            settings.startTime = null;
        }
        settings.updatedAt = new Date();
        await settings.save();
        res.json(settings);
    } catch (err) {
        res.status(500).send('Server error');
    }
});


// @route   GET api/admin/students
// @desc    Get all students with timing/score details
router.get('/students', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .populate('submissions.questionId', 'title marks')
            .sort({ score: -1, duration: 1 });
        res.json(students);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
