/**
 * Processing Routes - Execute process_meeting.py and get processing status
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const processMeetingService = require('../services/processMeetingService');
const pronunciationService = require('../services/pronunciationService');

/**
 * GET /api/processing/meetings
 * Get list of meetings that can be processed
 */
router.get('/meetings', protect, async (req, res) => {
    try {
        const meetings = await processMeetingService.getProcessableMeetings();
        res.json({
            success: true,
            message: `Found ${meetings.length} processable meetings`,
            data: meetings
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/processing/run/:meetingId
 * Start processing a meeting (run process_meeting.py)
 */
router.post('/run/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { useWhisper = false, async: runAsync = false } = req.body;

        console.log(`Processing request for meeting: ${meetingId}`);
        console.log(`Options: useWhisper=${useWhisper}, async=${runAsync}`);

        if (runAsync) {
            // Start processing in background and return immediately
            const result = processMeetingService.processMeetingAsync(meetingId, useWhisper, (err, processResult) => {
                if (err) {
                    console.error(`Async processing error for ${meetingId}:`, err);
                } else {
                    console.log(`Async processing complete for ${meetingId}:`, processResult.success);
                    
                    // Auto-import the data after processing
                    if (processResult.success) {
                        pronunciationService.importMeetingData(meetingId)
                            .then(importResult => {
                                console.log(`Auto-import result for ${meetingId}:`, importResult);
                            })
                            .catch(importErr => {
                                console.error(`Auto-import error for ${meetingId}:`, importErr);
                            });
                    }
                }
            });

            return res.json({
                success: true,
                message: 'Processing started in background. Check status endpoint for progress.',
                data: {
                    meetingId,
                    status: 'processing',
                    statusUrl: `/api/processing/status/${meetingId}`
                }
            });
        }

        // Synchronous processing - wait for completion
        const result = await processMeetingService.processMeeting(meetingId, useWhisper);

        if (result.success) {
            // Auto-import the processed data to database
            const importResult = await pronunciationService.importMeetingData(meetingId);
            
            return res.json({
                success: true,
                message: 'Meeting processed and data imported successfully',
                data: {
                    processing: result,
                    import: importResult,
                    feedbackUrl: `/api/meetings/${meetingId}/feedback`
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.error || 'Processing failed',
                data: result
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/processing/status/:meetingId
 * Get processing status for a meeting
 */
router.get('/status/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;
        const status = processMeetingService.getProcessingStatus(meetingId);

        res.json({
            success: true,
            message: 'Processing status retrieved',
            data: {
                meetingId,
                ...status
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/processing/import/:meetingId
 * Import existing pronunciation data from files
 */
router.post('/import/:meetingId', protect, async (req, res) => {
    try {
        const { meetingId } = req.params;
        
        const result = await pronunciationService.importMeetingData(meetingId);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Meeting data imported successfully',
                data: result
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.error || 'Import failed',
                data: result
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
