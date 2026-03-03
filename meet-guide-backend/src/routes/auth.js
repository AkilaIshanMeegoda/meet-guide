/**
 * Authentication Routes
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { generateToken } = require('../config/jwt');
const { createUser, authenticateUser } = require('../services/userService');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

/**
 * POST /api/auth/signup
 * Register a new user
 */
router.post('/signup', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirm_password').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        // Validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg,
                errors: errors.array()
            });
        }

        const { email, username, password, full_name } = req.body;

        // Create user
        const user = await createUser({ email, username, password, full_name });

        // Generate token
        const token = generateToken({ sub: user._id.toString(), email: user.email, is_management: user.is_management || false });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: user.toJSON(),
                access_token: token,
                token_type: 'bearer'
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user and return token
 */
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        // Validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg
            });
        }

        const { email, password } = req.body;

        // Authenticate
        const user = await authenticateUser(email, password);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken({ sub: user._id.toString(), email: user.email, is_management: user.is_management || false });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: user.toJSON(),
                access_token: token,
                token_type: 'bearer'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', protect, async (req, res) => {
    res.json({
        success: true,
        message: 'User retrieved',
        data: req.user.toJSON()
    });
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', protect, (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = router;
