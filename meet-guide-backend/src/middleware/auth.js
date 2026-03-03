/**
 * Authentication Middleware
 */
const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

/**
 * Protect routes - require valid JWT
 */
async function protect(req, res, next) {
    try {
        let token;

        // Check for Bearer token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. No token provided.'
            });
        }

        // Verify token
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. Invalid token.'
            });
        }

        // Get user from token
        const user = await User.findById(decoded.sub);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'User account is deactivated.'
            });
        }

        // Attach user to request
        req.user = user;
        req.user_id = user._id.toString();
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Not authorized.'
        });
    }
}

/**
 * Require management role - must be used after protect middleware
 */
function requireManagement(req, res, next) {
    if (!req.user || !req.user.is_management) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Management privileges required.'
        });
    }
    next();
}

module.exports = { protect, requireManagement };
