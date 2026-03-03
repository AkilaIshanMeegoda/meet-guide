#!/usr/bin/env node

'use strict';

/**
 * Merge Meeting Audio - Post-processing script for MiroTalk SFU
 * 
 * Reads timeline.json and merges individual audio recordings with proper timing.
 * Generates:
 *   - transcript.txt (voice activity log)
 *   - statistics.json (meeting statistics)
 *   - merged_meeting.wav (synchronized merged audio)
 * 
 * Usage:
 *   node merge-meeting-audio.js <meeting-directory>
 *   node merge-meeting-audio.js /var/recordings/meetings/abc123
 * 
 * @author MiroTalk SFU Timeline Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);
const readdir = promisify(fs.readdir);

// Configuration
const SAMPLE_RATE = 48000; // 48kHz for high quality
const CHANNELS = 1; // Mono
const SILENCE_THRESHOLD = 0.001; // Threshold for detecting silence

/**
 * Logger utility
 */
class Logger {
    static info(message, data = {}) {
        console.log(`[INFO] ${message}`, Object.keys(data).length ? JSON.stringify(data, null, 2) : '');
    }

    static warn(message, data = {}) {
        console.warn(`[WARN] ${message}`, Object.keys(data).length ? JSON.stringify(data, null, 2) : '');
    }

    static error(message, data = {}) {
        console.error(`[ERROR] ${message}`, Object.keys(data).length ? JSON.stringify(data, null, 2) : '');
    }

    static debug(message, data = {}) {
        if (process.env.DEBUG) {
            console.log(`[DEBUG] ${message}`, Object.keys(data).length ? JSON.stringify(data, null, 2) : '');
        }
    }
}

/**
 * Check if FFmpeg is available
 */
function checkFFmpeg() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
    } catch (error) {
        Logger.error('FFmpeg not found. Please install FFmpeg to continue.');
        return false;
    }
}

/**
 * Convert WebM to WAV using FFmpeg
 * @param {string} inputFile - Path to WebM file
 * @param {string} outputFile - Path to output WAV file
 * @returns {Promise<boolean>} Success status
 */
async function convertWebMToWav(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        Logger.info(`Converting ${path.basename(inputFile)} to WAV...`);

        const ffmpeg = spawn('ffmpeg', [
            '-i', inputFile,
            '-acodec', 'pcm_s16le',
            '-ar', SAMPLE_RATE.toString(),
            '-ac', CHANNELS.toString(),
            '-y', // Overwrite output file
            outputFile
        ]);

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                Logger.info(`Converted: ${path.basename(outputFile)}`);
                resolve(true);
            } else {
                Logger.error(`FFmpeg conversion failed with code ${code}`, { error: errorOutput });
                reject(new Error(`FFmpeg failed with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            Logger.error('FFmpeg process error', { error: err.message });
            reject(err);
        });
    });
}

/**
 * Read and parse timeline.json
 * @param {string} timelineFile - Path to timeline.json
 * @returns {Promise<object>} Timeline data
 */
async function readTimeline(timelineFile) {
    try {
        const content = await readFile(timelineFile, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to read timeline: ${error.message}`);
    }
}

/**
 * Find audio files in the meeting directory
 * @param {string} meetingDir - Meeting directory path
 * @returns {Promise<Array>} Array of audio file paths
 */
async function findAudioFiles(meetingDir) {
    try {
        const files = await readdir(meetingDir);
        return files
            .filter(file => file.endsWith('.webm') || file.endsWith('.wav'))
            .map(file => path.join(meetingDir, file));
    } catch (error) {
        throw new Error(`Failed to read directory: ${error.message}`);
    }
}

/**
 * Build recording map from timeline events
 * @param {object} timeline - Timeline data
 * @param {Array} audioFiles - Available audio files
 * @returns {Array} Recording segments with timing info
 */
function buildRecordingMap(timeline, audioFiles) {
    const recordings = [];
    const recordingStarts = {};

    for (const event of timeline.events) {
        if (event.event_type === 'recording_start') {
            recordingStarts[event.producer_id] = {
                user_id: event.user_id,
                user_name: event.user_name,
                start_time_ms: event.timestamp_rel_ms,
                producer_id: event.producer_id,
            };
        } else if (event.event_type === 'recording_stop') {
            const startInfo = recordingStarts[event.producer_id];
            if (startInfo) {
                // Try to find matching audio file
                const audioFile = audioFiles.find(file => 
                    file.includes(startInfo.user_id) || 
                    file.includes(startInfo.producer_id) ||
                    file.includes(startInfo.user_name.replace(/[^a-zA-Z0-9]/g, '_'))
                );

                recordings.push({
                    user_id: startInfo.user_id,
                    user_name: startInfo.user_name,
                    producer_id: startInfo.producer_id,
                    start_time_ms: startInfo.start_time_ms,
                    end_time_ms: event.timestamp_rel_ms,
                    duration_ms: event.timestamp_rel_ms - startInfo.start_time_ms,
                    audio_file: audioFile || null,
                });

                delete recordingStarts[event.producer_id];
            }
        }
    }

    // Handle recordings that never stopped (still active at meeting end)
    for (const [producer_id, startInfo] of Object.entries(recordingStarts)) {
        const audioFile = audioFiles.find(file => 
            file.includes(startInfo.user_id) || 
            file.includes(startInfo.producer_id) ||
            file.includes(startInfo.user_name.replace(/[^a-zA-Z0-9]/g, '_'))
        );

        recordings.push({
            user_id: startInfo.user_id,
            user_name: startInfo.user_name,
            producer_id: producer_id,
            start_time_ms: startInfo.start_time_ms,
            end_time_ms: timeline.total_duration_ms,
            duration_ms: timeline.total_duration_ms - startInfo.start_time_ms,
            audio_file: audioFile || null,
            still_recording: true,
        });
    }

    return recordings.sort((a, b) => a.start_time_ms - b.start_time_ms);
}

/**
 * Generate voice activity transcript
 * @param {object} timeline - Timeline data
 * @param {Array} recordings - Recording segments
 * @returns {string} Transcript text
 */
function generateTranscript(timeline, recordings) {
    let transcript = '';
    transcript += '='.repeat(80) + '\n';
    transcript += 'VOICE ACTIVITY TRANSCRIPT\n';
    transcript += '='.repeat(80) + '\n\n';
    transcript += `Meeting ID: ${timeline.room_id}\n`;
    transcript += `Meeting Start: ${timeline.meeting_start_iso}\n`;
    transcript += `Duration: ${(timeline.total_duration_ms / 1000).toFixed(2)} seconds\n\n`;
    transcript += '='.repeat(80) + '\n\n';

    // User join/leave events
    transcript += 'PARTICIPANT ACTIVITY:\n';
    transcript += '-'.repeat(80) + '\n';
    
    const userJoins = timeline.events.filter(e => e.event_type === 'user_join');
    const userLeaves = timeline.events.filter(e => e.event_type === 'user_leave');
    
    userJoins.forEach(event => {
        const timeStr = formatTimestamp(event.timestamp_rel_ms);
        transcript += `[${timeStr}] ${event.user_name} joined the meeting\n`;
    });
    
    userLeaves.forEach(event => {
        const timeStr = formatTimestamp(event.timestamp_rel_ms);
        transcript += `[${timeStr}] ${event.user_name} left the meeting (${event.reason})\n`;
    });
    
    transcript += '\n' + '='.repeat(80) + '\n\n';

    // Voice activity
    transcript += 'VOICE ACTIVITY:\n';
    transcript += '-'.repeat(80) + '\n';
    
    recordings.forEach((rec, index) => {
        const startStr = formatTimestamp(rec.start_time_ms);
        const endStr = formatTimestamp(rec.end_time_ms);
        const durationStr = (rec.duration_ms / 1000).toFixed(2);
        const audioStatus = rec.audio_file ? '✓ AUDIO AVAILABLE' : '✗ AUDIO MISSING';
        
        transcript += `\n[${index + 1}] ${rec.user_name}\n`;
        transcript += `    Start: ${startStr}\n`;
        transcript += `    End: ${endStr}\n`;
        transcript += `    Duration: ${durationStr}s\n`;
        transcript += `    Audio: ${audioStatus}\n`;
        if (rec.still_recording) {
            transcript += `    Note: Recording was still active at meeting end\n`;
        }
    });

    transcript += '\n' + '='.repeat(80) + '\n';
    transcript += 'END OF TRANSCRIPT\n';
    transcript += '='.repeat(80) + '\n';

    return transcript;
}

/**
 * Format timestamp from milliseconds to HH:MM:SS.mmm
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num, size) => String(num).padStart(size, '0');

    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
}

/**
 * Generate statistics
 * @param {object} timeline - Timeline data
 * @param {Array} recordings - Recording segments
 * @returns {object} Statistics object
 */
function generateStatistics(timeline, recordings) {
    const userJoins = timeline.events.filter(e => e.event_type === 'user_join');
    const userLeaves = timeline.events.filter(e => e.event_type === 'user_leave');
    
    const uniqueUsers = new Set(userJoins.map(e => e.user_id));
    const totalSpeakingTime = recordings.reduce((sum, rec) => sum + rec.duration_ms, 0);
    
    const speakerStats = {};
    recordings.forEach(rec => {
        if (!speakerStats[rec.user_name]) {
            speakerStats[rec.user_name] = {
                total_speaking_time_ms: 0,
                segments: 0,
            };
        }
        speakerStats[rec.user_name].total_speaking_time_ms += rec.duration_ms;
        speakerStats[rec.user_name].segments++;
    });

    // Convert to percentages and seconds
    Object.keys(speakerStats).forEach(user => {
        const stats = speakerStats[user];
        stats.total_speaking_time_sec = (stats.total_speaking_time_ms / 1000).toFixed(2);
        stats.percentage = totalSpeakingTime > 0 
            ? ((stats.total_speaking_time_ms / totalSpeakingTime) * 100).toFixed(2)
            : '0.00';
    });

    return {
        meeting_id: timeline.room_id,
        meeting_start: timeline.meeting_start_iso,
        meeting_duration_ms: timeline.total_duration_ms,
        meeting_duration_sec: (timeline.total_duration_ms / 1000).toFixed(2),
        total_participants: uniqueUsers.size,
        total_events: timeline.events.length,
        total_recordings: recordings.length,
        total_speaking_time_ms: totalSpeakingTime,
        total_speaking_time_sec: (totalSpeakingTime / 1000).toFixed(2),
        speaker_statistics: speakerStats,
        recordings_with_audio: recordings.filter(r => r.audio_file).length,
        recordings_missing_audio: recordings.filter(r => !r.audio_file).length,
    };
}

/**
 * Merge audio files with proper timing using FFmpeg
 * @param {Array} recordings - Recording segments with timing
 * @param {string} outputFile - Output merged WAV file
 * @param {number} totalDurationMs - Total meeting duration
 * @returns {Promise<boolean>} Success status
 */
async function mergeAudioFiles(recordings, outputFile, totalDurationMs) {
    Logger.info('Preparing to merge audio files...');

    // Convert all WebM files to WAV first
    const wavFiles = [];
    const tempDir = path.dirname(outputFile);

    for (const rec of recordings) {
        if (!rec.audio_file) {
            Logger.warn(`No audio file found for ${rec.user_name}, skipping...`);
            continue;
        }

        const ext = path.extname(rec.audio_file);
        let wavFile = rec.audio_file;

        if (ext === '.webm') {
            wavFile = path.join(tempDir, `temp_${rec.user_id}_${Date.now()}.wav`);
            try {
                await convertWebMToWav(rec.audio_file, wavFile);
                rec.wav_file = wavFile;
                rec.is_temp = true;
            } catch (error) {
                Logger.error(`Failed to convert ${rec.audio_file}`, { error: error.message });
                continue;
            }
        } else {
            rec.wav_file = wavFile;
            rec.is_temp = false;
        }

        wavFiles.push(rec);
    }

    if (wavFiles.length === 0) {
        throw new Error('No audio files available for merging');
    }

    Logger.info(`Merging ${wavFiles.length} audio tracks...`);

    // Create FFmpeg filter complex for mixing with delays
    const filterParts = [];
    const inputFiles = [];

    for (let i = 0; i < wavFiles.length; i++) {
        const rec = wavFiles[i];
        inputFiles.push('-i', rec.wav_file);

        const delayMs = rec.start_time_ms;
        filterParts.push(`[${i}:a]adelay=${delayMs}|${delayMs}[a${i}]`);
    }

    // Mix all delayed audio streams
    const mixInputs = wavFiles.map((_, i) => `[a${i}]`).join('');
    const mixFilter = `${mixInputs}amix=inputs=${wavFiles.length}:duration=longest:dropout_transition=2[out]`;

    const filterComplex = [...filterParts, mixFilter].join(';');

    return new Promise((resolve, reject) => {
        const args = [
            ...inputFiles,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-acodec', 'pcm_s16le',
            '-ar', SAMPLE_RATE.toString(),
            '-ac', CHANNELS.toString(),
            '-y',
            outputFile
        ];

        Logger.debug('FFmpeg merge command', { args: args.join(' ') });

        const ffmpeg = spawn('ffmpeg', args);

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            // Clean up temporary WAV files
            wavFiles.forEach(rec => {
                if (rec.is_temp) {
                    try {
                        fs.unlinkSync(rec.wav_file);
                        Logger.debug(`Cleaned up temp file: ${rec.wav_file}`);
                    } catch (err) {
                        Logger.warn(`Failed to clean up temp file: ${rec.wav_file}`);
                    }
                }
            });

            if (code === 0) {
                Logger.info(`Merged audio saved to: ${outputFile}`);
                resolve(true);
            } else {
                Logger.error(`FFmpeg merge failed with code ${code}`, { error: errorOutput });
                reject(new Error(`FFmpeg failed with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            Logger.error('FFmpeg process error', { error: err.message });
            reject(err);
        });
    });
}

/**
 * Main processing function
 * @param {string} meetingDir - Path to meeting directory
 */
async function processMeeting(meetingDir) {
    try {
        Logger.info('Starting meeting audio processing...', { meeting_dir: meetingDir });

        // Validate directory
        try {
            await access(meetingDir, fs.constants.R_OK);
        } catch (error) {
            throw new Error(`Cannot access meeting directory: ${meetingDir}`);
        }

        // Check FFmpeg
        if (!checkFFmpeg()) {
            throw new Error('FFmpeg is required but not installed');
        }

        // Read timeline
        const timelineFile = path.join(meetingDir, 'timeline.json');
        Logger.info('Reading timeline...', { file: timelineFile });
        const timeline = await readTimeline(timelineFile);

        // Find audio files
        Logger.info('Finding audio files...');
        const audioFiles = await findAudioFiles(meetingDir);
        Logger.info(`Found ${audioFiles.length} audio files`);

        // Build recording map
        Logger.info('Building recording map from timeline...');
        const recordings = buildRecordingMap(timeline, audioFiles);
        Logger.info(`Identified ${recordings.length} recording segments`);

        // Generate transcript
        Logger.info('Generating transcript...');
        const transcript = generateTranscript(timeline, recordings);
        const transcriptFile = path.join(meetingDir, 'transcript.txt');
        await writeFile(transcriptFile, transcript, 'utf8');
        Logger.info(`Transcript saved: ${transcriptFile}`);

        // Generate statistics
        Logger.info('Generating statistics...');
        const statistics = generateStatistics(timeline, recordings);
        const statisticsFile = path.join(meetingDir, 'statistics.json');
        await writeFile(statisticsFile, JSON.stringify(statistics, null, 2), 'utf8');
        Logger.info(`Statistics saved: ${statisticsFile}`);

        // Merge audio files
        if (recordings.some(r => r.audio_file)) {
            Logger.info('Merging audio files...');
            const mergedFile = path.join(meetingDir, 'merged_meeting.wav');
            await mergeAudioFiles(recordings, mergedFile, timeline.total_duration_ms);
            Logger.info(`Merged audio saved: ${mergedFile}`);
        } else {
            Logger.warn('No audio files available for merging');
        }

        Logger.info('Processing complete!', {
            transcript: path.join(meetingDir, 'transcript.txt'),
            statistics: path.join(meetingDir, 'statistics.json'),
            merged_audio: path.join(meetingDir, 'merged_meeting.wav'),
        });

    } catch (error) {
        Logger.error('Processing failed', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: node merge-meeting-audio.js <meeting-directory>');
        console.error('Example: node merge-meeting-audio.js /var/recordings/meetings/abc123');
        process.exit(1);
    }

    const meetingDir = args[0];
    processMeeting(meetingDir).catch(error => {
        Logger.error('Unhandled error', { error: error.message });
        process.exit(1);
    });
}

module.exports = { processMeeting, generateTranscript, generateStatistics };
