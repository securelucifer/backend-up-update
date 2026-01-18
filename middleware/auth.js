import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Admin token required.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id).select('-password');

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin token'
            });
        }

        if (!admin.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Admin account is deactivated'
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Server error in auth middleware',
            error: error.message
        });
    }
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

export { adminAuth, generateToken };
