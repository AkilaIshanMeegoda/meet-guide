const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Paths to actual data
const MISPRONUNCIATION_DIR = path.join(__dirname, '..', 'meet-guide-components', 'mispronunciation-detection-system');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide?retryWrites=true&w=majority';

// User email-to-name mapping
const USER_MAP = {
    'chalana@gmail.com': { username: 'chalana', full_name: 'Chalana Madusanka' },
    'savishka@gmail.com': { username: 'savishka', full_name: 'Savishka Perera' },
    'dinithi@gmail.com': { username: 'dinithi', full_name: 'Dinithi Fernando' },
    'akila@gmail.com': { username: 'akila', full_name: 'Akila Bandara' }
};

function readJsonFile(filePath) {
    try {
        let raw = fs.readFileSync(filePath, 'utf8');
        // Strip UTF-8 BOM if present
        if (raw.charCodeAt(0) === 0xFEFF) {
            raw = raw.slice(1);
        }
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`  ⚠ Could not read ${filePath}: ${err.message}`);
        return null;
    }
}

function readTextFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch (err) {
        return '';
    }
}

/**
 * Discover meeting folders by scanning the mispronunciation directory
 * for folders that have a timeline.json and participant_transcripts/
 */
function discoverMeetingFolders() {
    const entries = fs.readdirSync(MISPRONUNCIATION_DIR, { withFileTypes: true });
    const meetingFolders = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const folderPath = path.join(MISPRONUNCIATION_DIR, entry.name);
        const hasTimeline = fs.existsSync(path.join(folderPath, 'timeline.json'));
        const hasTranscripts = fs.existsSync(path.join(folderPath, 'participant_transcripts'));
        const hasSummary = fs.existsSync(path.join(folderPath, 'participant_transcripts', 'mispronunciation_summary.json'));

        if (hasTimeline && hasTranscripts && hasSummary) {
            meetingFolders.push(entry.name);
        }
    }

    return meetingFolders.sort();
}

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, { dbName: 'meetguide' });
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // ============ DISCOVER MEETING FOLDERS ============
        console.log(`\nScanning: ${MISPRONUNCIATION_DIR}`);
        const meetingIds = discoverMeetingFolders();
        console.log(`Found ${meetingIds.length} meeting folders: ${meetingIds.join(', ')}`);

        if (meetingIds.length === 0) {
            console.error('No meeting folders found! Aborting.');
            process.exit(1);
        }

        // ============ DISCOVER USERS FROM DATA ============
        // Scan all mispronunciation_summary.json to find all participant emails
        const allEmails = new Set();
        for (const meetingId of meetingIds) {
            const summaryPath = path.join(MISPRONUNCIATION_DIR, meetingId, 'participant_transcripts', 'mispronunciation_summary.json');
            const summary = readJsonFile(summaryPath);
            if (summary && summary.participants) {
                Object.keys(summary.participants).forEach(email => allEmails.add(email));
            }
        }
        console.log(`Found ${allEmails.size} unique participants: ${[...allEmails].join(', ')}`);

        // ============ WIPE ALL COLLECTIONS ============
        console.log('\n=== WIPING DATABASE ===');
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
            await db.dropCollection(col.name);
            console.log(`  Dropped: ${col.name}`);
        }
        console.log('Database wiped clean!');

        // ============ CREATE USERS ============
        console.log('\n=== CREATING USERS ===');
        const hashedPassword = await bcrypt.hash('password123', 10);
        const usersData = [...allEmails].map(email => {
            const info = USER_MAP[email] || {
                username: email.split('@')[0],
                full_name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
            };
            return {
                email,
                username: info.username,
                full_name: info.full_name,
                hashed_password: hashedPassword,
                is_active: true,
                is_management: email === 'savishka@gmail.com',
                created_at: new Date('2025-12-20')
            };
        });

        const usersCollection = db.collection('users');
        const insertedUsers = await usersCollection.insertMany(usersData);
        const userIds = Object.values(insertedUsers.insertedIds);

        // Build email -> ObjectId map
        const emailToId = {};
        const emailList = [...allEmails];
        emailList.forEach((email, idx) => {
            emailToId[email] = userIds[idx];
            console.log(`  ${email} -> ${userIds[idx]}`);
        });

        // ============ CREATE MEETINGS FROM REAL DATA ============
        console.log('\n=== CREATING MEETINGS (from recording files) ===');
        const meetingsCollection = db.collection('meetings');

        for (const meetingId of meetingIds) {
            const meetingDir = path.join(MISPRONUNCIATION_DIR, meetingId);

            // Read timeline.json for real timestamps
            const timeline = readJsonFile(path.join(meetingDir, 'timeline.json'));
            if (!timeline) {
                console.error(`  ✗ Skipping ${meetingId}: no timeline.json`);
                continue;
            }

            // Extract meeting start/end from timeline events
            const meetingStartEvent = timeline.events.find(e => e.event_type === 'meeting_start');
            const meetingEndEvent = timeline.events.find(e => e.event_type === 'meeting_end');
            const actualStart = new Date(meetingStartEvent?.iso_time || timeline.meeting_start_iso);
            const actualEnd = meetingEndEvent
                ? new Date(meetingEndEvent.iso_time)
                : new Date(actualStart.getTime() + timeline.total_duration_ms);

            // Build participants from user_join events in timeline
            const userJoinEvents = timeline.events.filter(e => e.event_type === 'user_join');
            const participants = userJoinEvents.map(evt => {
                const displayName = evt.user_name.toLowerCase();
                const email = `${displayName}@gmail.com`;
                const userInfo = USER_MAP[email];
                return {
                    username: userInfo ? userInfo.username : displayName,
                    email: email,
                    full_name: userInfo ? userInfo.full_name : evt.user_name,
                    joined_at: new Date(evt.iso_time)
                };
            });

            // First user who joined is the host
            const hostEmail = participants[0]?.email || 'akila@gmail.com';
            const hostInfo = USER_MAP[hostEmail] || { username: hostEmail.split('@')[0], full_name: hostEmail.split('@')[0] };

            const meetingDoc = {
                meeting_id: meetingId,
                title: meetingId,  // Use folder name as title
                description: `Meeting: ${meetingId}`,
                host_id: emailToId[hostEmail],
                host_name: hostInfo.full_name,
                host_email: hostEmail,
                participants: participants,
                status: 'ended',
                recording_folder: meetingId,
                actual_start: actualStart,
                actual_end: actualEnd,
                created_at: new Date(actualStart.getTime() - 5 * 60 * 1000)
            };

            await meetingsCollection.insertOne(meetingDoc);
            console.log(`  ✓ ${meetingId}`);
            console.log(`    Start: ${actualStart.toISOString()} | End: ${actualEnd.toISOString()} | Duration: ${timeline.total_duration_sec}s`);
            console.log(`    Host: ${hostEmail} | Participants: ${participants.map(p => p.email).join(', ')}`);
        }

        // ============ CREATE PRONUNCIATION FEEDBACK FROM REAL DATA ============
        console.log('\n=== CREATING PRONUNCIATION FEEDBACK (from recording files) ===');
        const feedbackCollection = db.collection('pronunciationfeedbacks');
        let totalFeedback = 0;

        for (const meetingId of meetingIds) {
            const meetingDir = path.join(MISPRONUNCIATION_DIR, meetingId);
            const transcriptsDir = path.join(meetingDir, 'participant_transcripts');

            // Read the summary files
            const summary = readJsonFile(path.join(transcriptsDir, 'mispronunciation_summary.json'));
            const confidenceSummary = readJsonFile(path.join(transcriptsDir, 'confidence_pronunciation_summary.json'));

            if (!summary) {
                console.error(`  ✗ Skipping ${meetingId}: no mispronunciation_summary.json`);
                continue;
            }

            console.log(`\n  Meeting: ${meetingId}`);

            for (const [email, participantData] of Object.entries(summary.participants)) {
                const userId = emailToId[email];
                if (!userId) {
                    console.warn(`    ⚠ Unknown user ${email}, skipping`);
                    continue;
                }

                // Read per-user transcript
                const transcript = readTextFile(path.join(transcriptsDir, `${email}.txt`));

                // Read per-user mispronunciation errors from confidence_pronunciation_summary
                let mispronunciations = [];
                if (confidenceSummary && confidenceSummary.all_errors && confidenceSummary.all_errors[email]) {
                    mispronunciations = confidenceSummary.all_errors[email].map(err => ({
                        word: err.word || '',
                        spoken: err.word || '',
                        expected: err.word || '',
                        expected_phonemes: err.expected_phonemes || '',
                        actual_phonemes: '',
                        error_type: err.error_type || 'unknown',
                        severity: err.severity || 'medium',
                        confidence: err.confidence || 0,
                        start_time: err.start_time || 0,
                        end_time: err.end_time || 0,
                        context: err.context || '',
                        suggestion: err.details || ''
                    }));
                }

                const accuracy = participantData.accuracy * 100;
                const feedbackDoc = {
                    meeting_id: meetingId,
                    user_id: userId,
                    user_name: email,
                    total_words: participantData.total_words || 0,
                    mispronounced_count: participantData.errors_detected || 0,
                    accuracy: parseFloat(accuracy.toFixed(2)),
                    error_rate: parseFloat((100 - accuracy).toFixed(2)),
                    mispronunciations: mispronunciations,
                    transcript: transcript,
                    processed_at: new Date()
                };

                await feedbackCollection.insertOne(feedbackDoc);
                totalFeedback++;
                console.log(`    ${email}: ${feedbackDoc.total_words} words, ${feedbackDoc.mispronounced_count} errors, ${feedbackDoc.accuracy}% accuracy, ${mispronunciations.length} error details`);
            }
        }

        // ============ VERIFICATION ============
        console.log('\n=== VERIFICATION ===');
        const finalUsers = await usersCollection.find({}).toArray();
        const finalMeetings = await meetingsCollection.find({}).toArray();
        const finalFeedback = await feedbackCollection.find({}).toArray();

        console.log(`Users: ${finalUsers.length}`);
        finalUsers.forEach(u => console.log(`  - ${u.email} (${u.full_name})`));

        console.log(`Meetings: ${finalMeetings.length}`);
        finalMeetings.forEach(m => console.log(`  - ${m.meeting_id}: ${m.title} (${m.participants.length} participants)`));

        console.log(`Pronunciation Feedback: ${finalFeedback.length}`);

        console.log('\n=== PER-USER MEETING PARTICIPATION ===');
        for (const user of finalUsers) {
            const userFeedback = finalFeedback.filter(f => f.user_name === user.email);
            const meetingIds = [...new Set(userFeedback.map(f => f.meeting_id))];
            console.log(`  ${user.email}: ${meetingIds.length} meetings -> [${meetingIds.join(', ')}]`);
        }

        console.log('\n✅ Database seeded successfully from real recording data!');
        console.log('📝 All users password: password123');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

seedDatabase();
