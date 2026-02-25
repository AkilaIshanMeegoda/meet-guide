/**
 * Pronunciation Service - Handles pronunciation data from mispronunciation-detection-system
 */
const fs = require('fs').promises;
const path = require('path');
const PronunciationFeedback = require('../models/PronunciationFeedback');
const User = require('../models/User');
const Meeting = require('../models/Meeting');

// Path to mispronunciation detection system
const MISPRONUNCIATION_PATH = path.resolve(__dirname, '../../../meet-guide-components/mispronunciation-detection-system');

/**
 * Get user's pronunciation feedback
 */
async function getUserFeedback(userId, meetingId = null) {
    const query = { user_id: userId };
    if (meetingId) {
        query.meeting_id = meetingId;
    }
    return PronunciationFeedback.find(query).sort({ processed_at: -1 });
}

/**
 * Get user's pronunciation summary
 */
async function getUserSummary(userId) {
    const feedbackList = await getUserFeedback(userId);
    const user = await User.findById(userId);
    
    const totalWords = feedbackList.reduce((sum, f) => sum + (f.total_words || 0), 0);
    const totalErrors = feedbackList.reduce((sum, f) => sum + (f.mispronounced_count || 0), 0);
    const avgAccuracy = feedbackList.length > 0 
        ? feedbackList.reduce((sum, f) => sum + (f.accuracy || 0), 0) / feedbackList.length 
        : 100;

    // Calculate common errors
    const errorCounts = {};
    feedbackList.forEach(feedback => {
        if (feedback.errors) {
            feedback.errors.forEach(err => {
                const word = (err.word || err.spoken || '').toLowerCase();
                if (word) {
                    errorCounts[word] = (errorCounts[word] || 0) + 1;
                }
            });
        }
    });

    const commonErrors = Object.entries(errorCounts)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        user_id: userId,
        user_name: user ? user.username : 'Unknown',
        total_meetings: feedbackList.length,
        total_words: totalWords,
        total_errors: totalErrors,
        average_accuracy: avgAccuracy,
        common_errors: commonErrors,
        recent_feedback: feedbackList.slice(0, 5).map(f => ({
            meeting_id: f.meeting_id,
            total_words: f.total_words,
            errors: f.mispronounced_count,
            accuracy: f.accuracy,
            date: f.processed_at
        }))
    };
}

/**
 * Get meeting pronunciation feedback
 */
async function getMeetingFeedback(meetingId) {
    return PronunciationFeedback.find({ meeting_id: meetingId });
}

/**
 * Load pronunciation summary from files
 */
async function loadPronunciationSummary(recordingFolder) {
    try {
        const summaryPath = path.join(MISPRONUNCIATION_PATH, recordingFolder, 'participant_transcripts', 'mispronunciation_summary.json');
        const data = await fs.readFile(summaryPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

/**
 * Load timeline data
 */
async function loadTimelineData(recordingFolder) {
    try {
        const timelinePath = path.join(MISPRONUNCIATION_PATH, recordingFolder, 'timeline.json');
        const data = await fs.readFile(timelinePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

/**
 * Get participant mispronunciation detail
 */
async function getParticipantMispronunciation(recordingFolder, participantName) {
    const variations = [
        participantName,
        participantName.charAt(0).toUpperCase() + participantName.slice(1).toLowerCase(),
        participantName.toLowerCase(),
        participantName.toUpperCase()
    ];

    for (const name of variations) {
        try {
            const detailPath = path.join(MISPRONUNCIATION_PATH, recordingFolder, 'participant_transcripts', `${name}_mispronunciation.json`);
            const data = await fs.readFile(detailPath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            // Try next variation
        }
    }
    return null;
}

/**
 * Get participant transcript
 */
async function getParticipantTranscript(recordingFolder, participantName) {
    const variations = [
        participantName,
        participantName.charAt(0).toUpperCase() + participantName.slice(1).toLowerCase(),
        participantName.toLowerCase(),
        participantName.toUpperCase()
    ];

    for (const name of variations) {
        try {
            const transcriptPath = path.join(MISPRONUNCIATION_PATH, recordingFolder, 'participant_transcripts', `${name}.txt`);
            return await fs.readFile(transcriptPath, 'utf8');
        } catch (e) {
            // Try next variation
        }
    }
    return null;
}

/**
 * Get available meetings with pronunciation data
 */
async function getAvailableMeetings() {
    const meetings = [];
    
    try {
        const folders = await fs.readdir(MISPRONUNCIATION_PATH);
        
        for (const folder of folders) {
            if (folder.startsWith('.') || ['web', '__pycache__', 'configs', 'finetuned_whisper_nptel'].includes(folder)) {
                continue;
            }
            
            const folderPath = path.join(MISPRONUNCIATION_PATH, folder);
            
            try {
                const stat = await fs.stat(folderPath);
                if (!stat.isDirectory()) continue;
                
                const summaryPath = path.join(folderPath, 'participant_transcripts', 'mispronunciation_summary.json');
                
                try {
                    await fs.access(summaryPath);
                    
                    const summaryData = await loadPronunciationSummary(folder);
                    const timeline = await loadTimelineData(folder);
                    
                    meetings.push({
                        folder: folder,
                        name: folder.replace(/_/g, ' ').replace(/projectmeeting/i, 'Project Meeting '),
                        has_data: true,
                        participant_count: summaryData ? summaryData.total_participants : 0,
                        total_words: summaryData?.overall_stats?.total_words || 0,
                        total_errors: summaryData?.overall_stats?.total_errors || 0,
                        average_accuracy: summaryData?.overall_stats?.average_accuracy || 0,
                        meeting_date: timeline?.meeting_start_iso || null,
                        duration_sec: timeline?.total_duration_sec || null
                    });
                } catch (e) {
                    // No summary file
                }
            } catch (e) {
                // Not a valid folder
            }
        }
    } catch (error) {
        console.error('Error getting available meetings:', error.message);
    }
    
    return meetings;
}

/**
 * Import meeting data from projectmeeting folder
 */
async function importMeetingData(recordingFolder) {
    try {
        console.log(`Importing meeting data from: ${recordingFolder}`);
        
        const summaryData = await loadPronunciationSummary(recordingFolder);
        if (!summaryData) {
            return { success: false, message: 'No pronunciation data found' };
        }

        const timeline = await loadTimelineData(recordingFolder);
        const participants = summaryData.participants || {};
        let importedCount = 0;
        const importedUsers = [];
        const bcrypt = require('bcryptjs');

        // Create or update meeting record
        let meeting = await Meeting.findOne({ meeting_id: recordingFolder });
        const firstUser = await User.findOne({});
        
        if (!meeting) {
            // Build proper participants array with subdocuments
            const participantDocs = [];
            for (const pName of Object.keys(participants)) {
                const pLower = pName.toLowerCase();
                const pEmail = pLower.includes('@') ? pLower : `${pLower}@gmail.com`;
                const pUser = pLower.replace(/@.*$/, '');
                participantDocs.push({
                    username: pUser,
                    email: pEmail,
                    full_name: pName,
                    joined_at: new Date()
                });
            }

            meeting = new Meeting({
                meeting_id: recordingFolder,
                title: recordingFolder.replace(/_/g, ' ').replace(/projectmeeting/i, 'Project Meeting '),
                description: `Imported meeting with ${summaryData.total_participants} participants`,
                host_id: firstUser ? firstUser._id : null,
                host_name: firstUser ? firstUser.username : 'Unknown',
                host_email: firstUser ? firstUser.email : '',
                participants: participantDocs,
                status: 'ended',
                recording_folder: recordingFolder,
                actual_start: timeline?.meeting_start_iso ? new Date(timeline.meeting_start_iso) : new Date(),
                actual_end: timeline?.meeting_start_iso && timeline?.total_duration_sec 
                    ? new Date(new Date(timeline.meeting_start_iso).getTime() + parseFloat(timeline.total_duration_sec) * 1000)
                    : new Date()
            });
            await meeting.save();
            console.log(`Created meeting record for ${recordingFolder}`);
        }

        // Import pronunciation data for each participant
        for (const [participantName, pData] of Object.entries(participants)) {
            if (pData.status !== 'success') continue;

            // Determine if participantName is an email or plain name
            const isEmail = participantName.includes('@');
            const emailAddr = isEmail ? participantName.toLowerCase() : `${participantName.toLowerCase()}@gmail.com`;
            const userName = isEmail ? participantName.split('@')[0].toLowerCase() : participantName.toLowerCase();

            // Find user by email or username (case insensitive)
            let user = await User.findOne({
                $or: [
                    { email: { $regex: new RegExp(`^${emailAddr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                    { username: { $regex: new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
                ]
            });
            
            if (!user) {
                // Create user if not exists
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('password123', salt);
                
                user = new User({
                    email: emailAddr,
                    username: userName,
                    full_name: participantName,
                    hashed_password: hashedPassword
                });
                await user.save();
                console.log(`Created user: ${emailAddr}`);
            }

            // Load detailed mispronunciation data
            const detailData = await getParticipantMispronunciation(recordingFolder, participantName);
            const transcript = await getParticipantTranscript(recordingFolder, participantName);

            const errors = [];
            if (detailData && detailData.errors) {
                for (const err of detailData.errors) {
                    errors.push({
                        word: err.word || '',
                        spoken: err.word || '',
                        expected: err.expected || err.word || '',
                        expected_phonemes: (err.expected_phonemes || []).join(' '),
                        actual_phonemes: '',
                        error_type: err.error_type || 'pronunciation',
                        severity: err.severity || 'medium',
                        confidence: err.confidence || 0,
                        start_time: err.start_time || 0,
                        end_time: err.end_time || 0,
                        context: err.context || '',
                        suggestion: err.suggestion || ''
                    });
                }
            }

            // Upsert pronunciation feedback
            // Always store user_name as the user's email for consistent lookups
            await PronunciationFeedback.findOneAndUpdate(
                { meeting_id: recordingFolder, user_id: user._id },
                {
                    meeting_id: recordingFolder,
                    user_id: user._id,
                    user_name: user.email,
                    total_words: pData.total_words || 0,
                    mispronounced_count: pData.errors_detected || 0,
                    accuracy: (pData.accuracy || 1) * 100,
                    error_rate: pData.errors_detected && pData.total_words 
                        ? (pData.errors_detected / pData.total_words) * 100 
                        : 0,
                    mispronunciations: errors,
                    transcript: transcript || '',
                    processed_at: new Date()
                },
                { upsert: true, new: true }
            );

            importedCount++;
            importedUsers.push(participantName);
        }

        return { 
            success: true, 
            message: `Imported ${importedCount} participants`, 
            imported_users: importedUsers,
            meeting_id: recordingFolder
        };
    } catch (error) {
        console.error('Error importing meeting data:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get complete meeting feedback with all participants
 * If userId is provided, only return feedback for that user
 */
async function getCompleteMeetingFeedback(meetingId, userId = null) {
    const feedbackQuery = { meeting_id: meetingId };
    if (userId) {
        feedbackQuery.user_id = userId;
    }
    const feedbackList = await PronunciationFeedback.find(feedbackQuery);
    const meeting = await Meeting.findOne({ meeting_id: meetingId });
    const summaryData = await loadPronunciationSummary(meetingId);
    const timeline = await loadTimelineData(meetingId);

    // Compute overall stats scoped to the filtered participants
    let overallStats = null;
    if (feedbackList.length > 0) {
        const totalWords = feedbackList.reduce((sum, f) => sum + (f.total_words || 0), 0);
        const totalErrors = feedbackList.reduce((sum, f) => sum + (f.mispronounced_count || 0), 0);
        const avgAccuracy = feedbackList.reduce((sum, f) => sum + (f.accuracy || 0), 0) / feedbackList.length;
        overallStats = {
            total_words: totalWords,
            total_errors: totalErrors,
            average_accuracy: avgAccuracy / 100
        };
    } else if (!userId) {
        overallStats = summaryData?.overall_stats || null;
    }

    return {
        meeting: meeting ? {
            id: meeting._id,
            meeting_id: meeting.meeting_id,
            title: meeting.title,
            status: meeting.status,
            start_time: meeting.actual_start,
            end_time: meeting.actual_end,
            host_name: meeting.host_name
        } : null,
        timeline: timeline ? {
            start_time: timeline.meeting_start_iso,
            duration_sec: timeline.total_duration_sec,
            event_count: timeline.event_count
        } : null,
        overall_stats: overallStats,
        participants: feedbackList.map(f => ({
            user_id: f.user_id,
            user_name: f.user_name,
            total_words: f.total_words,
            errors: f.mispronounced_count,
            accuracy: f.accuracy,
            error_rate: f.error_rate,
            mispronunciations: f.errors || [],
            transcript: f.transcript
        }))
    };
}

module.exports = {
    getUserFeedback,
    getUserSummary,
    getMeetingFeedback,
    loadPronunciationSummary,
    loadTimelineData,
    getParticipantMispronunciation,
    getParticipantTranscript,
    getAvailableMeetings,
    importMeetingData,
    getCompleteMeetingFeedback,
    MISPRONUNCIATION_PATH
};
