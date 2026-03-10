#!/usr/bin/env node

/**
 * Upload Old Meeting Transcripts to MongoDB
 * 
 * This script scans the mispronunciation-detection-system folder for meeting
 * directories that have global_transcript files and uploads them to MongoDB
 * as part of each meeting document.
 * 
 * Usage:
 *   node src/scripts/upload-old-transcripts.js
 *   node src/scripts/upload-old-transcripts.js --dry-run    (preview without uploading)
 *   node src/scripts/upload-old-transcripts.js --meeting projectmeeting2  (specific meeting only)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fs = require('fs').promises;
const fsSync = require('fs');

// Import the Meeting model
const Meeting = require('../models/Meeting');

// Configuration
const MISPRONUNCIATION_DIR = path.resolve(__dirname, '../../../meet-guide-components/mispronunciation-detection-system');

// Parse command line args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_MEETING = args.includes('--meeting') ? args[args.indexOf('--meeting') + 1] : null;

function log(msg, level = 'INFO') {
    const prefix = level === 'ERROR' ? '❌' : level === 'SUCCESS' ? '✅' : level === 'SKIP' ? '⏭️' : '📋';
    console.log(`${prefix} ${msg}`);
}

async function findTranscriptFiles(meetingFolder) {
    const transcriptDir = path.join(MISPRONUNCIATION_DIR, meetingFolder, 'global_transcript');
    
    if (!fsSync.existsSync(transcriptDir)) {
        return null;
    }

    const files = await fs.readdir(transcriptDir);
    const jsonFile = files.find(f => f.endsWith('_speaker_attributed.json'));
    const txtFile = files.find(f => f.endsWith('_speaker_attributed.txt'));

    if (!jsonFile) {
        return null;
    }

    return {
        jsonPath: path.join(transcriptDir, jsonFile),
        txtPath: txtFile ? path.join(transcriptDir, txtFile) : null
    };
}

async function uploadTranscript(meetingId, recordingFolder) {
    try {
        // Find transcript files
        const files = await findTranscriptFiles(recordingFolder);
        
        if (!files) {
            log(`No speaker_attributed.json found for ${recordingFolder}`, 'SKIP');
            return false;
        }

        // Read JSON data
        const jsonContent = await fs.readFile(files.jsonPath, 'utf-8');
        const jsonData = JSON.parse(jsonContent);

        // Read TXT data
        let txtData = '';
        if (files.txtPath && fsSync.existsSync(files.txtPath)) {
            txtData = await fs.readFile(files.txtPath, 'utf-8');
        }

        // Skip empty transcripts
        if (!jsonData.utterances || jsonData.utterances.length === 0) {
            log(`Transcript is empty for ${recordingFolder} (0 utterances)`, 'SKIP');
            return false;
        }

        if (DRY_RUN) {
            log(`[DRY RUN] Would upload transcript for ${meetingId}: ${jsonData.utterances.length} utterances, ${Object.keys(jsonData.speaker_mapping || {}).length} speakers`);
            return true;
        }

        // Build transcript object
        const transcript = {
            speaker_mapping: jsonData.speaker_mapping || {},
            utterances: jsonData.utterances || [],
            formatted_transcript: jsonData.formatted_transcript || '',
            plain_text: txtData || jsonData.formatted_transcript || '',
            uploaded_at: new Date()
        };

        // Update meeting in MongoDB
        const result = await Meeting.findOneAndUpdate(
            { meeting_id: meetingId },
            { 
                $set: { 
                    transcript: transcript,
                    updated_at: new Date()
                }
            },
            { new: true }
        );

        if (!result) {
            log(`Meeting not found in DB: ${meetingId}`, 'ERROR');
            return false;
        }

        log(`Uploaded transcript for ${meetingId}: ${jsonData.utterances.length} utterances, speakers: ${Object.values(jsonData.speaker_mapping || {}).join(', ')}`, 'SUCCESS');
        return true;
    } catch (error) {
        log(`Error uploading transcript for ${meetingId}: ${error.message}`, 'ERROR');
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Upload Old Meeting Transcripts to MongoDB');
    console.log('='.repeat(60));
    
    if (DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide?retryWrites=true&w=majority';
    await mongoose.connect(mongoURI, {
        dbName: process.env.MONGODB_DB_NAME || 'meetguide'
    });
    log('Connected to MongoDB');

    // Get all meetings from DB
    const meetings = await Meeting.find({}, 'meeting_id recording_folder title status transcript').lean();
    log(`Found ${meetings.length} meetings in database\n`);

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    let alreadyHas = 0;

    for (const meeting of meetings) {
        const recordingFolder = meeting.recording_folder || meeting.meeting_id;
        
        // Filter by specific meeting if provided
        if (SPECIFIC_MEETING && meeting.meeting_id !== SPECIFIC_MEETING && recordingFolder !== SPECIFIC_MEETING) {
            continue;
        }

        // Skip if already has transcript (unless specific meeting requested)
        if (meeting.transcript && meeting.transcript.utterances && meeting.transcript.utterances.length > 0 && !SPECIFIC_MEETING) {
            log(`Already has transcript: ${meeting.meeting_id} (${meeting.transcript.utterances.length} utterances)`, 'SKIP');
            alreadyHas++;
            continue;
        }

        console.log(`\n--- Processing: ${meeting.meeting_id} (${meeting.title}) ---`);
        
        const success = await uploadTranscript(meeting.meeting_id, recordingFolder);
        if (success) {
            uploaded++;
        } else {
            // Check if it was just empty/skipped vs actual failure
            const files = await findTranscriptFiles(recordingFolder);
            if (!files) {
                skipped++;
            } else {
                failed++;
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Uploaded:     ${uploaded}`);
    console.log(`  Already had:  ${alreadyHas}`);
    console.log(`  Skipped:      ${skipped} (no transcript files)`);
    console.log(`  Failed:       ${failed}`);
    console.log('='.repeat(60));

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
