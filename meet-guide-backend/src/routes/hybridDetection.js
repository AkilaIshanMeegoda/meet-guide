/**
 * Hybrid Detection Routes - Execute hybrid detection processing
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const hybridDetectionService = require('../services/hybridDetectionService');
const HybridDetection = require('../models/HybridDetection');

/**
 * POST /api/hybrid-detection/process/:meetingId
 * Manually trigger hybrid detection for a meeting
 */
router.post('/process/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;

        console.log(`Manual hybrid detection request for: ${meetingId}`);

        // Process hybrid detection
        const result = await hybridDetectionService.processHybridDetection(meetingId);

        if (result.success) {
            return res.json({
                success: true,
                message: 'Hybrid detection processed successfully',
                data: result
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.error || 'Processing failed',
                data: result
            });
        }
    } catch (error) {
        console.error('Hybrid detection error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/status/:meetingId
 * Get processing status for a meeting
 */
router.get('/status/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const status = hybridDetectionService.getStatus(meetingId);
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/results/:meetingId
 * Get hybrid detection results for all participants in a meeting
 * Supports both MongoDB _id and custom meeting_id
 */
router.get('/results/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const Meeting = require('../models/Meeting');
        
        console.log(`[Hybrid Detection] Searching for meeting: ${meetingId}`);
        
        let searchMeetingId = meetingId;
        
        // Check if meetingId looks like a MongoDB ObjectId (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(meetingId)) {
            console.log('[Hybrid Detection] Detected MongoDB ObjectId, looking up meeting...');
            
            // Look up the meeting by _id to get its meeting_id field
            const meeting = await Meeting.findById(meetingId);
            
            if (meeting && meeting.meeting_id) {
                searchMeetingId = meeting.meeting_id;
                console.log(`[Hybrid Detection] Found meeting with meeting_id: ${searchMeetingId}`);
            } else {
                console.log('[Hybrid Detection] Meeting not found or has no meeting_id');
            }
        }
        
        // Search for hybrid detection results using the meeting_id
        const results = await HybridDetection.find({ meeting_id: searchMeetingId })
            .populate('user_id', 'email username full_name')
            .sort({ professional_score: -1 });
        
        console.log(`[Hybrid Detection] Found ${results.length} results for meeting_id: ${searchMeetingId}`);
        
        res.json({
            success: true,
            message: `Found ${results.length} hybrid detection results`,
            data: results
        });
    } catch (error) {
        console.error('[Hybrid Detection] Error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/user/:userId
 * Get all hybrid detection results for a specific user
 */
router.get('/user/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const results = await HybridDetection.find({ user_id: userId })
            .sort({ processed_at: -1 });
        
        res.json({
            success: true,
            message: `Found ${results.length} hybrid detection results`,
            data: results
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/jobs
 * Get all active processing jobs
 */
router.get('/jobs', protect, async (req, res) => {
    try {
        const jobs = hybridDetectionService.getAllJobs();
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/my-score/:meetingId
 * Get professional score for the authenticated user and specific meeting
 * Uses email from JWT token to identify the user
 */
router.get('/my-score/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const userEmail = req.user.email; // Get email from authenticated user
        
        console.log(`[Hybrid Detection] Fetching professional score for authenticated user: ${userEmail}, meeting: ${meetingId}`);
        
        const result = await HybridDetection.findOne({ 
            user_name: userEmail, 
            meeting_id: meetingId 
        }).populate('user_id', 'email username full_name');
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No professional score data found for this meeting'
            });
        }
        
        res.json({
            success: true,
            message: 'Professional score data retrieved successfully',
            data: result
        });
    } catch (error) {
        console.error('[Hybrid Detection] Error fetching professional score:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/user/:userName/meeting/:meetingId
 * Get professional score for a specific user and meeting by user_name
 */
router.get('/user/:userName/meeting/:meetingId', protect, async (req, res) => {
    try {
        const { userName, meetingId } = req.params;
        
        console.log(`[Hybrid Detection] Fetching professional score for user: ${userName}, meeting: ${meetingId}`);
        
        const result = await HybridDetection.findOne({ 
            user_name: userName, 
            meeting_id: meetingId 
        }).populate('user_id', 'email username full_name');
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No professional score data found for this user and meeting'
            });
        }
        
        res.json({
            success: true,
            message: 'Professional score data retrieved successfully',
            data: result
        });
    } catch (error) {
        console.error('[Hybrid Detection] Error fetching professional score:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * GET /api/hybrid-detection/userid/:userId/meeting/:meetingId
 * Get professional score for a specific user and meeting by user_id
 */
router.get('/userid/:userId/meeting/:meetingId', protect, async (req, res) => {
    try {
        const { userId, meetingId } = req.params;
        const Meeting = require('../models/Meeting');
        
        console.log(`[Hybrid Detection] Fetching professional score for user_id: ${userId}, meeting: ${meetingId}`);
        
        let searchMeetingId = meetingId;
        
        // Check if meetingId looks like a MongoDB ObjectId (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(meetingId)) {
            console.log('[Hybrid Detection] Detected MongoDB ObjectId, looking up meeting...');
            
            // Look up the meeting by _id to get its meeting_id field
            const meeting = await Meeting.findById(meetingId);
            
            if (meeting && meeting.meeting_id) {
                searchMeetingId = meeting.meeting_id;
                console.log(`[Hybrid Detection] Found meeting with meeting_id: ${searchMeetingId}`);
            }
        }
        
        const result = await HybridDetection.findOne({ 
            user_id: userId, 
            meeting_id: searchMeetingId 
        }).populate('user_id', 'email username full_name');
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No professional score data found for this user and meeting'
            });
        }
        
        res.json({
            success: true,
            message: 'Professional score data retrieved successfully',
            data: result
        });
    } catch (error) {
        console.error('[Hybrid Detection] Error fetching professional score:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;
