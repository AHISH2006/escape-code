const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// @route   POST api/auth/login
// @desc    Authenticate user
router.post('/login', async (req, res) => {
    const { type, name, collegeName, email, password, participationType, teamMembers } = req.body;

    try {
        if (type === 'admin') {
            const ADMIN_EMAIL = "AHISH@123";
            const ADMIN_PASSWORD = "AHISH@123";

            if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                let user = await User.findOne({ email: ADMIN_EMAIL, role: 'admin' });
                if (!user) {
                    user = new User({ name: 'Central Admin', email: ADMIN_EMAIL, role: 'admin', isOnline: true });
                    await user.save();
                } else {
                    user.isOnline = true;
                    await user.save();
                }
                const payload = { userId: user.id, role: user.role };
                const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
                return res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
            }
            return res.status(400).json({ message: 'Invalid Admin credentials' });
        } else {
            // Student: Check if user exists
            let user = await User.findOne({ name, collegeName, role: 'student' });

            // If user doesn't exist, create it (First-time login)
            if (!user) {
                user = new User({
                    name,
                    collegeName,
                    role: 'student',
                    participationType: participationType || 'single',
                    teamMembers: teamMembers || [],
                    isOnline: true
                });
            } else {
                user.isOnline = true;
            }
            await user.save();

            const payload = { userId: user.id, role: user.role };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

            res.json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    collegeName: user.collegeName,
                    participationType: user.participationType,
                    teamMembers: user.teamMembers
                }
            });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/me
// @desc    Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/logout
// @desc    Logout user
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user) {
            user.isOnline = false;
            await user.save();
        }
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
