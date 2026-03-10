/**
 * Dashboard Routes
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const pronunciationService = require('../services/pronunciationService');

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for current user
 */
router.get('/stats', protect, async (req, res) => {
    try {
        // Get user's meetings
        const meetings = await Meeting.find({
            $or: [
                { host_id: req.user._id },
                { 'participants.email': req.user.email }
            ]
        }).sort({ created_at: -1 }).limit(10);

        // Get pronunciation feedback
        const feedbackList = await pronunciationService.getUserFeedback(req.user._id);

        // Calculate stats
        const totalMeetings = meetings.length;
        const totalWords = feedbackList.reduce((sum, f) => sum + f.total_words, 0);
        const totalErrors = feedbackList.reduce((sum, f) => sum + f.mispronounced_count, 0);
        const avgErrorRate = totalWords > 0 ? (totalErrors / totalWords) * 100 : 0;

        // Pronunciation trend
        const trend = feedbackList.slice(-10).map(f => ({
            date: f.processed_at.toISOString(),
            meeting_id: f.meeting_id,
            error_rate: f.error_rate,
            words: f.total_words,
            errors: f.mispronounced_count
        }));

        res.json({
            success: true,
            message: 'Dashboard stats retrieved',
            data: {
                total_meetings: totalMeetings,
                total_words_spoken: totalWords,
                total_mispronunciations: totalErrors,
                average_error_rate: avgErrorRate,
                recent_meetings: meetings.slice(0, 5).map(m => m.toJSON()),
                pronunciation_trend: trend
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
 * GET /api/dashboard/recent-activity
 * Get recent activity for current user
 */
router.get('/recent-activity', protect, async (req, res) => {
    try {
        // Get recent meetings
        const meetings = await Meeting.find({
            $or: [
                { host_id: req.user._id },
                { 'participants.email': req.user.email }
            ]
        }).sort({ created_at: -1 }).limit(5);

        // Get recent feedback
        const feedbackList = await pronunciationService.getUserFeedback(req.user._id);

        const activities = [];

        // Add meeting activities
        meetings.forEach(m => {
            activities.push({
                type: 'meeting',
                title: m.title,
                meeting_id: m.meeting_id,
                status: m.status,
                date: m.created_at.toISOString(),
                timestamp: m.created_at.getTime()
            });
        });

        // Add feedback activities
        feedbackList.slice(0, 5).forEach(f => {
            activities.push({
                type: 'pronunciation_feedback',
                meeting_id: f.meeting_id,
                error_count: f.mispronounced_count,
                error_rate: f.error_rate,
                date: f.processed_at.toISOString(),
                timestamp: f.processed_at.getTime()
            });
        });

        // Sort by timestamp
        activities.sort((a, b) => b.timestamp - a.timestamp);

        res.json({
            success: true,
            message: 'Recent activity retrieved',
            data: activities.slice(0, 10)
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/dashboard/pronunciation-overview
 * Get pronunciation overview
 */
router.get('/pronunciation-overview', protect, async (req, res) => {
    try {
        const summary = await pronunciationService.getUserSummary(req.user._id);

        res.json({
            success: true,
            message: 'Pronunciation overview retrieved',
            data: summary
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
