const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        if (!req.user.id && req.user.userId) {
            req.user.id = req.user.userId;
        }

        next();
    } catch (err) {
        console.error("Auth Guard - Token verification failed:", err.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Permission denied: Admin only' });
    }
};

module.exports = { authMiddleware, adminMiddleware };
