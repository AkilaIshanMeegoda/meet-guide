/**
 * User Routes
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', protect, async (req, res) => {
    res.json({
        success: true,
        message: 'User profile retrieved',
        data: req.user.toJSON()
    });
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', protect, async (req, res) => {
    try {
        const { full_name, profile_image } = req.body;

        const updates = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (profile_image !== undefined) updates.profile_image = profile_image;
        updates.updated_at = new Date();

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true }
        );

        res.json({
            success: true,
            message: 'Profile updated',
            data: user.toJSON()
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/users/:id
 * Get user by ID (admin only or self)
 */
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User retrieved',
            data: user.toJSON()
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
