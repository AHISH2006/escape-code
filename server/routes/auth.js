const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');       // Admin only
const Student = require('../models/Student'); // Students only
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── Admin credentials (static) ───────────────────────────────────────────────
const ADMIN_EMAIL = 'AHISH@123';
const ADMIN_PASSWORD = 'AHISH@123';

// @route   POST /api/auth/login
// @desc    Login for both admin and students
router.post('/login', async (req, res) => {
    const { type, name, collegeName, participationType, teamMembers, email, password } = req.body;

    try {
        // ── ADMIN LOGIN ──────────────────────────────────────────────────────
        if (type === 'admin') {
            if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
                return res.status(400).json({ message: 'Invalid Admin credentials' });
            }

            // Upsert the single admin document
            let admin = await User.findOne({ role: 'admin' });
            if (!admin) {
                admin = new User({ name: 'Central Admin', email: ADMIN_EMAIL, role: 'admin' });
            }
            admin.isOnline = true;
            await admin.save();

            const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
            return res.json({ token, user: { id: admin.id, name: admin.name, role: 'admin' } });
        }

        // ── STUDENT LOGIN / REGISTER ──────────────────────────────────────────
        // Find existing student by name + college (unique identity)
        let student = await Student.findOne({ name, collegeName });

        if (!student) {
            // First time: create the student record
            student = new Student({
                name,
                collegeName,
                participationType: participationType || 'single',
                teamMembers: teamMembers || [],
                isOnline: true
            });
        } else {
            // Returning student: just mark online
            student.isOnline = true;
        }
        await student.save();

        const token = jwt.sign({ id: student.id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({
            token,
            user: {
                id: student.id,
                name: student.name,
                collegeName: student.collegeName,
                role: 'student',
                participationType: student.participationType,
                teamMembers: student.teamMembers
            }
        });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).send('Server error');
    }
});


// @route   GET /api/auth/me
// @desc    Get current user/student profile
router.get('/me', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            const admin = await User.findById(req.user.id);
            if (!admin) return res.status(404).json({ message: 'Admin not found' });
            return res.json(admin);
        }

        // Student
        const student = await Student.findById(req.user.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        return res.json(student);

    } catch (err) {
        res.status(500).send('Server error');
    }
});


// @route   POST /api/auth/logout
// @desc    Mark user offline
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            const admin = await User.findById(req.user.id);
            if (admin) { admin.isOnline = false; await admin.save(); }
        } else {
            const student = await Student.findById(req.user.id);
            if (student) { student.isOnline = false; await student.save(); }
        }
        res.json({ message: 'Logged out' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
