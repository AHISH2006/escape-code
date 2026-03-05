const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

// @route   GET api/users/count
// @desc    Get total number of students
router.get('/count', authMiddleware, async (req, res) => {
    try {
        const count = await User.countDocuments({ role: 'student' });
        res.json({ count });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/users/add-student
// @desc    Admin adds a student
router.post('/add-student', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized' });

    const { name, collegeName, teamId } = req.body;
    try {
        let user = await User.findOne({ name, collegeName });
        if (user) return res.status(400).json({ message: 'Student already exists' });

        user = new User({ name, collegeName, teamId, role: 'student' });
        await user.save();
        res.json({ message: 'Student added successfully', user });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   GET api/users/leaderboard
// @desc    Get top scores
router.get('/leaderboard', async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).sort({ score: -1 }).limit(50);
        res.json(users);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
