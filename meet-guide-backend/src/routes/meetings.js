/**
 * Meeting Routes - Create, join, manage meetings with MiroTalk integration
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const pronunciationService = require('../services/pronunciationService');
const processMeetingService = require('../services/processMeetingService');
const hybridDetectionService = require('../services/hybridDetectionService');
const summarizationService = require('../services/summarizationService');

// Generate unique meeting ID
function generateMeetingId() {
    const timestamp = Date.now().toString(36);
    const random = uuidv4().substring(0, 6);
    return `meet_${timestamp}_${random}`;
}

// Generate MiroTalk join URL with user info
function generateMiroTalkUrl(meetingId, userName, userEmail, isHost = false) {
    const mirotalkBase = process.env.MIROTALK_URL || 'https://localhost:3010';
    // Use email as the display name for accurate speaker identification
    const displayName = encodeURIComponent(userEmail || userName || 'Guest');
    // Build URL with all necessary parameters
    const params = new URLSearchParams({
        room: meetingId,
        name: displayName,
        audio: '1',
        video: '1',
        notify: '0'
    });
    return `${mirotalkBase}/join?${params.toString()}`;
}

/**
 * POST /api/meetings
 * Create a new meeting
 */
router.post('/', protect, [
    body('title').notEmpty().withMessage('Title is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const { title, description, scheduled_start, scheduled_end, invited_emails } = req.body;
        const meetingId = generateMeetingId();

        // Build participants list: host + invited emails
        const participants = [{
            username: req.user.username,
            email: req.user.email,
            full_name: req.user.full_name || req.user.username
        }];

        // Add invited participants by email
        if (invited_emails && Array.isArray(invited_emails)) {
            for (const email of invited_emails) {
                const trimmedEmail = email.trim().toLowerCase();
                // Skip if it's the host's own email or duplicate
                if (trimmedEmail && trimmedEmail !== req.user.email.toLowerCase() &&
                    !participants.find(p => p.email.toLowerCase() === trimmedEmail)) {
                    // Look up user by email to get their username/full_name
                    const User = require('../models/User');
                    const invitedUser = await User.findOne({ email: trimmedEmail });
                    participants.push({
                        username: invitedUser ? invitedUser.username : trimmedEmail.split('@')[0],
                        email: trimmedEmail,
                        full_name: invitedUser ? (invitedUser.full_name || invitedUser.username) : trimmedEmail.split('@')[0]
                    });
                }
            }
        }

        const meeting = new Meeting({
            meeting_id: meetingId,
            title,
            description: description || '',
            host_id: req.user._id,
            host_name: req.user.full_name || req.user.username,
            host_email: req.user.email,
            participants,
            status: 'scheduled',
            recording_folder: meetingId,
            scheduled_start: scheduled_start ? new Date(scheduled_start) : null,
            scheduled_end: scheduled_end ? new Date(scheduled_end) : null
        });

        await meeting.save();

        // Generate join URL with user's email as display name
        const joinUrl = generateMiroTalkUrl(meetingId, req.user.full_name, req.user.email, true);

        res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            data: {
                ...meeting.toJSON(),
                join_url: joinUrl,
                mirotalk_url: joinUrl
            }
        });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/meetings
 * Get all meetings for current user
 */
router.get('/', protect, async (req, res) => {
    try {
        const { status } = req.query;
        const query = {
            $or: [
                { host_id: req.user._id },
                { 'participants.email': req.user.email }
            ]
        };

        if (status) {
            query.status = status;
        }

        const meetings = await Meeting.find(query).sort({ created_at: -1 });

        res.json({
            success: true,
            message: `Found ${meetings.length} meetings`,
            data: meetings.map(m => ({
                ...m.toJSON(),
                join_url: generateMiroTalkUrl(m.meeting_id, req.user.full_name, req.user.email),
                mirotalk_url: generateMiroTalkUrl(m.meeting_id, req.user.full_name, req.user.email)
            }))
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/meetings/ended
 * Get ended meetings for current user (where they are host or participant)
 */
router.get('/ended', protect, async (req, res) => {
    try {
        console.log('Getting ended meetings for user:', req.user.email);
        
        const PronunciationFeedback = require('../models/PronunciationFeedback');

        // Get ended meetings from database where user is host or participant
        const dbMeetings = await Meeting.find({
            status: 'ended',
            $or: [
                { host_id: req.user._id },
                { host_email: req.user.email },
                { 'participants.email': req.user.email }
            ]
        }).sort({ actual_end: -1 });
        
        console.log('DB meetings count:', dbMeetings.length);
        
        // Get available pronunciation data folders
        const availableMeetings = await pronunciationService.getAvailableMeetings();
        
        const meetings = [];
        
        // Add ALL ended DB meetings for this user (don't require PronunciationFeedback)
        for (const m of dbMeetings) {
            // Check if pronunciation data exists (by user email or user_id)
            const userFeedback = await PronunciationFeedback.findOne({
                meeting_id: m.meeting_id,
                $or: [
                    { user_name: req.user.email },
                    { user_name: { $regex: new RegExp(`^${req.user.username}$`, 'i') } },
                    { user_id: req.user._id }
                ]
            });
            
            const hasData = availableMeetings.some(am => am.folder === m.meeting_id);
            meetings.push({
                ...m.toJSON(),
                has_pronunciation_data: hasData || !!userFeedback
            });
        }
        
        // Also include pronunciation-data-only meetings (from file system) not already in DB
        for (const am of availableMeetings) {
            const exists = meetings.some(m => m.meeting_id === am.folder);
            if (!exists) {
                // Check if user has pronunciation feedback for this meeting
                const userFeedback = await PronunciationFeedback.findOne({
                    meeting_id: am.folder,
                    $or: [
                        { user_name: req.user.email },
                        { user_name: { $regex: new RegExp(`^${req.user.username}$`, 'i') } },
                        { user_id: req.user._id }
                    ]
                });
                
                if (userFeedback) {
                    meetings.push({
                        meeting_id: am.folder,
                        title: am.name,
                        status: 'ended',
                        has_pronunciation_data: true,
                        participant_count: am.participant_count,
                        meeting_date: am.meeting_date,
                        duration_sec: am.duration_sec,
                        average_accuracy: am.average_accuracy
                    });
                }
            }
        }

        console.log('Final meetings count for user:', meetings.length);
        
        res.json({
            success: true,
            message: `Found ${meetings.length} ended meetings`,
            data: meetings
        });
    } catch (error) {
        console.error('Error in /meetings/ended:', error);
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/meetings/:meetingId
 * Get meeting by ID
 */
router.get('/:meetingId', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meeting_id: req.params.meetingId });

        if (!meeting) {
            // Check if it's an available pronunciation meeting
            const availableMeetings = await pronunciationService.getAvailableMeetings();
            const available = availableMeetings.find(m => m.folder === req.params.meetingId);
            
            if (available) {
                const joinUrl = generateMiroTalkUrl(available.folder, req.user.full_name, req.user.email);
                return res.json({
                    success: true,
                    message: 'Meeting found (from files)',
                    data: {
                        meeting_id: available.folder,
                        title: available.name,
                        status: 'ended',
                        has_pronunciation_data: true,
                        participant_count: available.participant_count,
                        meeting_date: available.meeting_date,
                        join_url: joinUrl
                    }
                });
            }
            
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        const joinUrl = generateMiroTalkUrl(meeting.meeting_id, req.user.full_name, req.user.email);

        res.json({
            success: true,
            message: 'Meeting retrieved',
            data: {
                ...meeting.toJSON(),
                join_url: joinUrl,
                mirotalk_url: joinUrl
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/meetings/:meetingId/start
 * Start a meeting
 */
router.post('/:meetingId/start', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOneAndUpdate(
            { meeting_id: req.params.meetingId },
            { status: 'active', actual_start: new Date() },
            { new: true }
        );

        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        const mirotalkUrl = process.env.MIROTALK_URL || 'https://localhost:3010';

        res.json({
            success: true,
            message: 'Meeting started',
            data: {
                ...meeting.toJSON(),
                join_url: `${mirotalkUrl}/join/${meeting.meeting_id}`
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/meetings/:meetingId/end
 * End a meeting and automatically start full processing pipeline:
 * pronunciation → transcript import → hybrid detection → summarization
 */
router.post('/:meetingId/end', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOneAndUpdate(
            { meeting_id: req.params.meetingId },
            { status: 'ended', actual_end: new Date() },
            { new: true }
        );

        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        const meetingId = req.params.meetingId;

        // Copy recording files from MiroTalk recordings to mispronunciation system dir
        // so processMeetingService can find them
        const path = require('path');
        const fs = require('fs').promises;
        const fsSync = require('fs');
        const mirotalkRecordingsPath = process.env.MIROTALK_RECORDINGS_PATH || 
            path.resolve(__dirname, '../../../mirotalk/app/src/recordings');
        const mispronunciationPath = path.resolve(__dirname, '../../../meet-guide-components/mispronunciation-detection-system');
        const sourcePath = path.join(mirotalkRecordingsPath, meetingId);
        const destPath = path.join(mispronunciationPath, meetingId);

        if (fsSync.existsSync(sourcePath) && !fsSync.existsSync(destPath)) {
            try {
                await fs.mkdir(destPath, { recursive: true });
                const files = await fs.readdir(sourcePath);
                for (const file of files) {
                    const srcFile = path.join(sourcePath, file);
                    const stat = await fs.stat(srcFile);
                    if (stat.isFile()) {
                        await fs.copyFile(srcFile, path.join(destPath, file));
                    }
                }
                console.log(`Copied ${files.length} recording files for ${meetingId}`);
            } catch (copyErr) {
                console.error(`Failed to copy recording files for ${meetingId}:`, copyErr.message);
            }
        }

        // Start full processing pipeline in background
        const processingStarted = processMeetingService.processMeetingAsync(
            meetingId,
            false, // Use Deepgram by default
            async (err, result) => {
                if (err) {
                    console.error(`[Pipeline] Pronunciation processing error for ${meetingId}:`, err);
                    return;
                }
                
                if (!result.success) {
                    console.error(`[Pipeline] Pronunciation processing failed for ${meetingId}`);
                    return;
                }
                
                console.log(`[Pipeline] Pronunciation processing complete for ${meetingId}`);
                
                // Step 1: Auto-import pronunciation data
                try {
                    await pronunciationService.importMeetingData(meetingId);
                    console.log(`[Pipeline] Pronunciation data imported for ${meetingId}`);
                } catch (importErr) {
                    console.error(`[Pipeline] Pronunciation import error for ${meetingId}:`, importErr.message);
                }
                
                // Step 2: Auto-run hybrid detection (Gen-Z slang analysis)
                try {
                    console.log(`[Pipeline] Starting hybrid detection for ${meetingId}...`);
                    const hybridResult = await hybridDetectionService.processHybridDetection(meetingId);
                    if (hybridResult.success) {
                        console.log(`[Pipeline] ✅ Hybrid detection complete for ${meetingId}`);
                    } else {
                        console.error(`[Pipeline] ⚠️ Hybrid detection failed for ${meetingId}:`, hybridResult.error);
                    }
                } catch (hybridErr) {
                    console.error(`[Pipeline] Hybrid detection error for ${meetingId}:`, hybridErr.message);
                }
                
                // Step 3: Auto-run meeting summarization
                try {
                    console.log(`[Pipeline] Starting summarization for ${meetingId}...`);
                    const sumResult = await summarizationService.processMeetingSummarization(meetingId);
                    if (sumResult.success) {
                        console.log(`[Pipeline] ✅ Summarization complete for ${meetingId}`);
                    } else {
                        console.error(`[Pipeline] ⚠️ Summarization failed for ${meetingId}:`, sumResult.error);
                    }
                } catch (sumErr) {
                    console.error(`[Pipeline] Summarization error for ${meetingId}:`, sumErr.message);
                }
                
                console.log(`[Pipeline] ✅ Full processing pipeline complete for ${meetingId}`);
            }
        );

        res.json({
            success: true,
            message: 'Meeting ended. Full processing pipeline started automatically (pronunciation → hybrid detection → summarization).',
            data: {
                ...meeting.toJSON(),
                processing: processingStarted,
                processingStatusUrl: `/api/processing/status/${meetingId}`
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/meetings/:meetingId/join
 * Join a meeting
 */
router.post('/:meetingId/join', protect, async (req, res) => {
    try {
        // Add participant with full details
        const participantData = {
            username: req.user.username,
            email: req.user.email,
            full_name: req.user.full_name || req.user.username,
            joined_at: new Date()
        };

        // Use $addToSet with match on email to prevent duplicates
        let meeting = await Meeting.findOne({ meeting_id: req.params.meetingId });
        
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        // Check if participant already exists
        const existingParticipant = meeting.participants.find(p => p.email === req.user.email);
        if (!existingParticipant) {
            meeting.participants.push(participantData);
            await meeting.save();
        }

        // Generate join URL with user's email
        const joinUrl = generateMiroTalkUrl(meeting.meeting_id, req.user.full_name, req.user.email);

        res.json({
            success: true,
            message: 'Joined meeting',
            data: {
                ...meeting.toJSON(),
                join_url: joinUrl,
                mirotalk_url: joinUrl
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/meetings/:meetingId/transcript
 * Save transcript data for a meeting (internal - no auth for automation)
 */
router.post('/:meetingId/transcript/internal', async (req, res) => {
    try {
        const { speaker_attributed_json, speaker_attributed_txt } = req.body;

        if (!speaker_attributed_json) {
            return res.status(400).json({ success: false, message: 'speaker_attributed_json is required' });
        }

        const meeting = await Meeting.findOne({ meeting_id: req.params.meetingId });
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        // Build transcript object from the speaker_attributed.json data
        const transcript = {
            speaker_mapping: speaker_attributed_json.speaker_mapping || {},
            utterances: speaker_attributed_json.utterances || [],
            formatted_transcript: speaker_attributed_json.formatted_transcript || '',
            plain_text: speaker_attributed_txt || speaker_attributed_json.formatted_transcript || '',
            uploaded_at: new Date()
        };

        meeting.transcript = transcript;
        meeting.updated_at = new Date();
        await meeting.save();

        console.log(`Transcript saved for meeting: ${req.params.meetingId}`);

        res.json({
            success: true,
            message: 'Transcript saved successfully',
            data: {
                meeting_id: req.params.meetingId,
                utterance_count: transcript.utterances.length,
                speakers: Object.values(transcript.speaker_mapping || {})
            }
        });
    } catch (error) {
        console.error(`Error saving transcript for ${req.params.meetingId}:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/meetings/:meetingId/transcript
 * Save transcript data for a meeting (authenticated)
 */
router.post('/:meetingId/transcript', protect, async (req, res) => {
    try {
        const { speaker_attributed_json, speaker_attributed_txt } = req.body;

        if (!speaker_attributed_json) {
            return res.status(400).json({ success: false, message: 'speaker_attributed_json is required' });
        }

        const meeting = await Meeting.findOne({ meeting_id: req.params.meetingId });
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        const transcript = {
            speaker_mapping: speaker_attributed_json.speaker_mapping || {},
            utterances: speaker_attributed_json.utterances || [],
            formatted_transcript: speaker_attributed_json.formatted_transcript || '',
            plain_text: speaker_attributed_txt || speaker_attributed_json.formatted_transcript || '',
            uploaded_at: new Date()
        };

        meeting.transcript = transcript;
        meeting.updated_at = new Date();
        await meeting.save();

        res.json({
            success: true,
            message: 'Transcript saved successfully',
            data: {
                meeting_id: req.params.meetingId,
                utterance_count: transcript.utterances.length,
                speakers: Object.values(transcript.speaker_mapping || {})
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/meetings/:meetingId/transcript
 * Get transcript for a meeting
 */
router.get('/:meetingId/transcript', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meeting_id: req.params.meetingId });
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        if (!meeting.transcript) {
            return res.status(404).json({ success: false, message: 'No transcript available for this meeting' });
        }

        res.json({
            success: true,
            message: 'Transcript retrieved',
            data: meeting.transcript
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/meetings/:meetingId/feedback
 * Get pronunciation feedback for a meeting
 */
router.get('/:meetingId/feedback', protect, async (req, res) => {
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
                    message: 'Meeting feedback retrieved (auto-imported)',
                    data: updatedFeedback
                });
            }
            return res.status(404).json({ success: false, message: 'No feedback data available' });
        }

        res.json({
            success: true,
            message: 'Meeting feedback retrieved',
            data: feedback
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
