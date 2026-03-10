/**
 * Pronunciation Routes - Get pronunciation feedback and import data
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const pronunciationService = require('../services/pronunciationService');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/pronunciation/my-feedback
 * Get current user's pronunciation feedback
 */
router.get('/my-feedback', protect, async (req, res) => {
    try {
        const { meeting_id } = req.query;
        const feedbackList = await pronunciationService.getUserFeedback(req.user._id, meeting_id);

        res.json({
            success: true,
            message: `Found ${feedbackList.length} feedback records`,
            data: feedbackList.map(f => f.toJSON())
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pronunciation/my-summary
 * Get current user's pronunciation summary
 */
router.get('/my-summary', protect, async (req, res) => {
    try {
        const summary = await pronunciationService.getUserSummary(req.user._id);

        res.json({
            success: true,
            message: 'Summary retrieved',
            data: summary
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pronunciation/meeting/:meetingId
 * Get all pronunciation feedback for a meeting
 */
router.get('/meeting/:meetingId', protect, async (req, res) => {
    try {
        // Only return the current user's pronunciation feedback for this meeting
        const userId = req.user._id;
        const feedback = await pronunciationService.getCompleteMeetingFeedback(req.params.meetingId, userId);

        if (!feedback.meeting && feedback.participants.length === 0) {
            // Try to import the data first
            const importResult = await pronunciationService.importMeetingData(req.params.meetingId);
            if (importResult.success) {
                const updatedFeedback = await pronunciationService.getCompleteMeetingFeedback(req.params.meetingId, userId);
                return res.json({
                    success: true,
                    message: 'Pronunciation feedback retrieved (auto-imported)',
                    data: updatedFeedback
                });
            }
            return res.status(404).json({ success: false, message: 'No pronunciation data found' });
        }

        res.json({
            success: true,
            message: 'Pronunciation feedback retrieved',
            data: feedback
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pronunciation/meeting/:meetingId/participant/:participantName
 * Get pronunciation data for specific participant
 */
router.get('/meeting/:meetingId/participant/:participantName', protect, async (req, res) => {
    try {
        const detail = await pronunciationService.getParticipantMispronunciation(
            req.params.meetingId,
            req.params.participantName
        );

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: `Pronunciation data not found for: ${req.params.participantName}`
            });
        }

        const transcript = await pronunciationService.getParticipantTranscript(
            req.params.meetingId,
            req.params.participantName
        );

        res.json({
            success: true,
            message: 'Participant data retrieved',
            data: {
                participant_name: req.params.participantName,
                pronunciation: detail,
                transcript
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/pronunciation/import/:recordingFolder
 * Import pronunciation data from existing processed meeting
 */
router.post('/import/:recordingFolder', protect, async (req, res) => {
    try {
        const result = await pronunciationService.importMeetingData(req.params.recordingFolder);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: result.message,
            data: {
                recording_folder: req.params.recordingFolder,
                imported_users: result.imported_users
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pronunciation/available-meetings
 * Get list of meeting folders with pronunciation data
 */
router.get('/available-meetings', protect, async (req, res) => {
    try {
        const meetings = await pronunciationService.getAvailableMeetings();

        res.json({
            success: true,
            message: `Found ${meetings.length} meetings with pronunciation data`,
            data: meetings
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/pronunciation/import-all
 * Import all available pronunciation data
 */
router.post('/import-all', protect, async (req, res) => {
    try {
        const meetings = await pronunciationService.getAvailableMeetings();
        const results = [];

        for (const meeting of meetings) {
            const result = await pronunciationService.importMeetingData(meeting.folder);
            results.push({
                folder: meeting.folder,
                ...result
            });
        }

        res.json({
            success: true,
            message: `Imported data from ${results.filter(r => r.success).length}/${meetings.length} meetings`,
            data: results
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/pronunciation/internal-import/:recordingFolder
 * Internal endpoint for auto-import from meeting-processor service (no auth required)
 * Only accepts requests from localhost
 */
router.post('/internal-import/:recordingFolder', async (req, res) => {
    try {
        // Only allow from localhost
        const ip = req.ip || req.connection.remoteAddress;
        const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
        if (!isLocal) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const result = await pronunciationService.importMeetingData(req.params.recordingFolder);

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.message });
        }

        res.json({
            success: true,
            message: result.message,
            data: {
                recording_folder: req.params.recordingFolder,
                imported_users: result.imported_users
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pronunciation/audio-clip/:meetingId/:participantEmail
 * Extract and stream an audio segment of a mispronounced word from the participant's WAV file.
 * Query params: start (seconds), end (seconds), padding (optional, default 0.3s)
 */
router.get('/audio-clip/:meetingId/:participantEmail', protect, async (req, res) => {
    try {
        const { meetingId, participantEmail } = req.params;
        const start = parseFloat(req.query.start);
        const end = parseFloat(req.query.end);
        const padding = parseFloat(req.query.padding) || 0.3;

        if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
            return res.status(400).json({ success: false, message: 'Invalid start/end time parameters' });
        }

        // Find the participant's converted WAV file in the meeting folder
        const meetingDir = path.join(pronunciationService.MISPRONUNCIATION_PATH, meetingId);
        if (!fs.existsSync(meetingDir)) {
            return res.status(404).json({ success: false, message: 'Meeting folder not found' });
        }

        const files = fs.readdirSync(meetingDir);
        // Sanitize email for matching: replace @ and . for filename comparison
        const emailLower = participantEmail.toLowerCase();
        const emailSanitized = emailLower.replace(/@/g, '_').replace(/\./g, '_');

        // Look for per-participant converted WAV file first
        let wavFile = files.find(f => {
            const fLower = f.toLowerCase();
            return fLower.endsWith('_converted.wav') &&
                   (fLower.includes(emailLower) || fLower.includes(emailSanitized));
        });

        // Fallback: if single participant, try merged audio
        if (!wavFile) {
            wavFile = files.find(f => f.endsWith('_merged_audio.wav'));
        }

        if (!wavFile) {
            return res.status(404).json({ success: false, message: 'Audio file not found for this participant' });
        }

        const wavPath = path.join(meetingDir, wavFile);

        // Add padding around the word for better context
        const clipStart = Math.max(0, start - padding);
        const clipDuration = (end - start) + (padding * 2);

        // Use FFmpeg to extract the audio segment and output as WAV
        try {
            const audioBuffer = execSync(
                `ffmpeg -y -i "${wavPath}" -ss ${clipStart.toFixed(3)} -t ${clipDuration.toFixed(3)} -acodec pcm_s16le -ar 16000 -ac 1 -f wav pipe:1`,
                { maxBuffer: 5 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
            );

            res.set({
                'Content-Type': 'audio/wav',
                'Content-Length': audioBuffer.length,
                'Cache-Control': 'public, max-age=86400',
            });
            res.send(audioBuffer);
        } catch (ffmpegErr) {
            console.error('FFmpeg error extracting audio clip:', ffmpegErr.message);
            return res.status(500).json({ success: false, message: 'Failed to extract audio clip' });
        }
    } catch (error) {
        console.error('Error in audio-clip endpoint:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
