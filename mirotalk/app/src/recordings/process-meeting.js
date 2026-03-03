#!/usr/bin/env node

/**
 * MiroTalk Meeting Recording Processor
 * 
 * This script processes meeting recordings by:
 * 1. Generating a voice activity transcript from timeline.json
 * 2. Merging individual audio files with precise timing synchronization
 * 3. Creating detailed statistics in JSON format
 * 
 * Usage:
 *   node process-meeting.js <meeting_id>
 *   node process-meeting.js <path_to_timeline.json>
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

// ============================================================================
// CONFIGURATION
// ============================================================================

const RECORDINGS_BASE_PATH = process.env.RECORDINGS_PATH ||
    (process.platform === 'win32'
        ? path.join(__dirname)
        : path.join(__dirname));
const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_CHANNELS = 1;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format seconds to HH:MM:SS.mmm
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Check if FFmpeg is installed
 */
function checkFFmpegInstalled() {
    try {
        const cmd = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
        execSync(cmd, { stdio: 'pipe' });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get audio file duration using ffprobe
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
}

// ============================================================================
// TIMELINE PARSER
// ============================================================================

/**
 * Parse timeline.json and extract recording segments for each user
 */
function parseTimeline(timelineData) {
    const events = timelineData.events;
    const userSegments = {};
    const recordingStarts = {};
    
    // Build user segments from events
    for (const event of events) {
        const userName = event.user_name;
        
        if (event.event_type === 'recording_start') {
            if (!userSegments[userName]) {
                userSegments[userName] = [];
            }
            recordingStarts[event.producer_id] = {
                userName,
                startTime: parseFloat(event.timestamp_rel_sec)
            };
        } else if (event.event_type === 'recording_stop') {
            const startInfo = recordingStarts[event.producer_id];
            if (startInfo) {
                userSegments[startInfo.userName].push({
                    start: startInfo.startTime,
                    end: parseFloat(event.timestamp_rel_sec),
                    duration: parseFloat(event.timestamp_rel_sec) - startInfo.startTime
                });
                delete recordingStarts[event.producer_id];
            }
        } else if (event.event_type === 'user_leave') {
            // Check if user has any open recording segments
            for (const [producerId, startInfo] of Object.entries(recordingStarts)) {
                if (startInfo.userName === userName) {
                    userSegments[userName].push({
                        start: startInfo.startTime,
                        end: parseFloat(event.timestamp_rel_sec),
                        duration: parseFloat(event.timestamp_rel_sec) - startInfo.startTime
                    });
                    delete recordingStarts[producerId];
                }
            }
        }
    }
    
    // Handle any unclosed segments (use meeting end time)
    const totalDuration = parseFloat(timelineData.total_duration_sec);
    for (const [producerId, startInfo] of Object.entries(recordingStarts)) {
        if (!userSegments[startInfo.userName]) {
            userSegments[startInfo.userName] = [];
        }
        userSegments[startInfo.userName].push({
            start: startInfo.startTime,
            end: totalDuration,
            duration: totalDuration - startInfo.startTime
        });
    }
    
    return userSegments;
}

/**
 * Calculate overlap periods where multiple users are speaking
 */
function calculateOverlaps(userSegments, totalDuration) {
    // Create a timeline of active speakers
    const timeline = [];
    
    for (const [userName, segments] of Object.entries(userSegments)) {
        for (const segment of segments) {
            timeline.push({ time: segment.start, type: 'start', user: userName });
            timeline.push({ time: segment.end, type: 'end', user: userName });
        }
    }
    
    timeline.sort((a, b) => a.time - b.time);
    
    let activeUsers = new Set();
    let overlapTime = 0;
    let lastTime = 0;
    
    for (const event of timeline) {
        if (activeUsers.size > 1) {
            overlapTime += (event.time - lastTime);
        }
        
        if (event.type === 'start') {
            activeUsers.add(event.user);
        } else {
            activeUsers.delete(event.user);
        }
        
        lastTime = event.time;
    }
    
    return overlapTime;
}

/**
 * Detect silence gaps (periods with no active recordings)
 */
function detectSilenceGaps(userSegments, totalDuration) {
    const timeline = [];
    
    for (const [userName, segments] of Object.entries(userSegments)) {
        for (const segment of segments) {
            timeline.push({ time: segment.start, type: 'start' });
            timeline.push({ time: segment.end, type: 'end' });
        }
    }
    
    timeline.sort((a, b) => a.time - b.time);
    
    let activeCount = 0;
    let lastTime = 0;
    const silenceGaps = [];
    
    for (const event of timeline) {
        if (activeCount === 0 && event.time > lastTime) {
            silenceGaps.push({
                start: lastTime,
                end: event.time,
                duration: event.time - lastTime
            });
        }
        
        if (event.type === 'start') {
            activeCount++;
        } else {
            activeCount--;
        }
        
        lastTime = event.time;
    }
    
    // Check for silence at the end
    if (activeCount === 0 && lastTime < totalDuration) {
        silenceGaps.push({
            start: lastTime,
            end: totalDuration,
            duration: totalDuration - lastTime
        });
    }
    
    // Filter out very short gaps (< 0.1 seconds)
    return silenceGaps.filter(gap => gap.duration >= 0.1);
}

// ============================================================================
// TRANSCRIPT GENERATOR
// ============================================================================

/**
 * Generate voice activity transcript
 */
function generateTranscript(timelineData, userSegments, silenceGaps) {
    const roomId = timelineData.room_id;
    const meetingStart = new Date(timelineData.meeting_start_iso);
    const totalDuration = parseFloat(timelineData.total_duration_sec);
    
    let transcript = '';
    
    // Header
    transcript += `Meeting: ${roomId}\n`;
    transcript += `Date: ${meetingStart.toISOString().replace('T', ' ').replace('Z', ' UTC')}\n`;
    transcript += `Total Duration: ${formatTime(totalDuration)}\n`;
    transcript += `\n`;
    
    // Voice Activity Timeline
    transcript += `=== VOICE ACTIVITY TRANSCRIPT ===\n\n`;
    
    // Collect all segments for chronological display
    const allSegments = [];
    for (const [userName, segments] of Object.entries(userSegments)) {
        for (const segment of segments) {
            allSegments.push({
                userName,
                start: segment.start,
                end: segment.end,
                duration: segment.duration
            });
        }
    }
    
    // Sort by start time
    allSegments.sort((a, b) => a.start - b.start);
    
    // Display segments
    for (const segment of allSegments) {
        transcript += `${formatTime(segment.start)} - ${formatTime(segment.end)} | ${segment.userName}\n`;
    }
    
    // Add silence gaps if any
    if (silenceGaps.length > 0) {
        transcript += `\n`;
        for (const gap of silenceGaps) {
            transcript += `${formatTime(gap.start)} - ${formatTime(gap.end)} | [silence]\n`;
        }
    }
    
    // Speaking Time Statistics
    transcript += `\n=== SPEAKING TIME STATISTICS ===\n\n`;
    
    const userNames = Object.keys(userSegments);
    let totalSpeakingTime = 0;
    
    for (const userName of userNames) {
        const segments = userSegments[userName];
        const userTotalTime = segments.reduce((sum, seg) => sum + seg.duration, 0);
        totalSpeakingTime += userTotalTime;
        
        const percentage = ((userTotalTime / totalDuration) * 100).toFixed(1);
        
        transcript += `${userName}:\n`;
        transcript += `  Total Time: ${userTotalTime.toFixed(3)} seconds (${percentage}% of meeting)\n`;
        transcript += `  Recording Segments: ${segments.length}\n`;
        
        if (segments.length > 0) {
            transcript += `  Start Time: ${formatTime(segments[0].start)}\n`;
            transcript += `  End Time: ${formatTime(segments[segments.length - 1].end)}\n`;
        }
        
        transcript += `\n`;
    }
    
    transcript += `Total Speaking Time: ${totalSpeakingTime.toFixed(3)} seconds\n`;
    transcript += `Total Meeting Duration: ${totalDuration.toFixed(3)} seconds\n`;
    
    if (totalSpeakingTime > totalDuration) {
        transcript += `Note: Speaking times may overlap when multiple users talk simultaneously\n`;
    }
    
    transcript += `\n`;
    transcript += `Participants: ${userNames.length}\n`;
    for (const userName of userNames) {
        transcript += `- ${userName}\n`;
    }
    
    // Visual Timeline
    transcript += `\n=== VISUAL TIMELINE ===\n\n`;
    transcript += generateVisualTimeline(userSegments, totalDuration);
    
    return transcript;
}

/**
 * Generate visual timeline representation
 */
function generateVisualTimeline(userSegments, totalDuration) {
    const timelineWidth = 60;
    const timeScale = totalDuration / timelineWidth;
    
    let visual = '';
    
    // Time markers
    const markers = [0, totalDuration / 2, totalDuration];
    visual += formatTime(0).padEnd(30) + formatTime(totalDuration / 2).padEnd(30) + formatTime(totalDuration) + '\n';
    visual += '├' + '─'.repeat(timelineWidth / 2 - 1) + '┼' + '─'.repeat(timelineWidth / 2 - 1) + '┤\n';
    
    // User timelines
    for (const [userName, segments] of Object.entries(userSegments)) {
        const maxNameLength = 15;
        const paddedName = userName.substring(0, maxNameLength).padEnd(maxNameLength);
        let timeline = ' '.repeat(timelineWidth);
        
        for (const segment of segments) {
            const startPos = Math.floor(segment.start / timeScale);
            const endPos = Math.ceil(segment.end / timeScale);
            
            for (let i = startPos; i < endPos && i < timelineWidth; i++) {
                timeline = timeline.substring(0, i) + '═' + timeline.substring(i + 1);
            }
        }
        
        visual += `${paddedName}[${timeline}]\n`;
    }
    
    return visual;
}

// ============================================================================
// STATISTICS GENERATOR
// ============================================================================

/**
 * Generate statistics JSON
 */
function generateStatistics(timelineData, userSegments, audioFiles) {
    const roomId = timelineData.room_id;
    const totalDuration = parseFloat(timelineData.total_duration_sec);
    const participants = {};
    
    let totalSpeakingTime = 0;
    
    for (const [userName, segments] of Object.entries(userSegments)) {
        const userTotalTime = segments.reduce((sum, seg) => sum + seg.duration, 0);
        totalSpeakingTime += userTotalTime;
        
        const percentage = parseFloat(((userTotalTime / totalDuration) * 100).toFixed(1));
        
        // Find matching audio file
        const audioFile = audioFiles.find(file => file.includes(`_${userName}_`));
        
        participants[userName] = {
            total_time_sec: parseFloat(userTotalTime.toFixed(3)),
            total_time_formatted: formatTime(userTotalTime),
            percentage: percentage,
            segments: segments.map(seg => ({
                start_sec: parseFloat(seg.start.toFixed(3)),
                start_formatted: formatTime(seg.start),
                end_sec: parseFloat(seg.end.toFixed(3)),
                end_formatted: formatTime(seg.end),
                duration_sec: parseFloat(seg.duration.toFixed(3))
            })),
            recording_file: audioFile ? path.basename(audioFile) : `Rec_${roomId}_${userName}_*.wav`
        };
    }
    
    const overlapTime = calculateOverlaps(userSegments, totalDuration);
    const silenceGaps = detectSilenceGaps(userSegments, totalDuration);
    
    return {
        meeting_id: roomId,
        meeting_start: timelineData.meeting_start_iso,
        total_duration_sec: parseFloat(totalDuration.toFixed(3)),
        total_duration_formatted: formatTime(totalDuration),
        participant_count: Object.keys(userSegments).length,
        participants: participants,
        total_speaking_time_sec: parseFloat(totalSpeakingTime.toFixed(3)),
        overlap_time_sec: parseFloat(overlapTime.toFixed(3)),
        silence_gaps: silenceGaps.map(gap => ({
            start_sec: parseFloat(gap.start.toFixed(3)),
            start_formatted: formatTime(gap.start),
            end_sec: parseFloat(gap.end.toFixed(3)),
            end_formatted: formatTime(gap.end),
            duration_sec: parseFloat(gap.duration.toFixed(3))
        }))
    };
}

// ============================================================================
// AUDIO MERGER
// ============================================================================

/**
 * Find all audio files (WAV or WebM) in the meeting directory
 */
async function findAudioFiles(meetingDir) {
    const files = await fs.readdir(meetingDir);
    return files
        .filter(file => (file.endsWith('.wav') || file.endsWith('.webm')) && file.startsWith('Rec_'))
        .map(file => path.join(meetingDir, file));
}

/**
 * Convert WebM to WAV if needed
 */
async function convertToWavIfNeeded(inputFile, meetingDir) {
    // If already WAV, return as-is
    if (inputFile.endsWith('.wav')) {
        return inputFile;
    }
    
    // Convert WebM to WAV
    const outputFile = inputFile.replace('.webm', '_converted.wav');
    
    // Check if converted file already exists
    if (fsSync.existsSync(outputFile)) {
        console.log(`   Using existing converted file: ${path.basename(outputFile)}`);
        return outputFile;
    }
    
    return new Promise((resolve, reject) => {
        console.log(`   Converting ${path.basename(inputFile)} to WAV...`);
        
        ffmpeg(inputFile)
            .audioCodec('pcm_s16le')
            .audioFrequency(DEFAULT_SAMPLE_RATE)
            .audioChannels(DEFAULT_CHANNELS)
            .output(outputFile)
            .on('start', (commandLine) => {
                // Silent - don't log full command
            })
            .on('end', () => {
                console.log(`   ✓ Converted: ${path.basename(outputFile)}`);
                resolve(outputFile);
            })
            .on('error', (err) => {
                console.error(`   ✗ Conversion failed: ${err.message}`);
                reject(err);
            })
            .run();
    });
}

/**
 * Match audio files to users based on timeline data
 * Also converts WebM to WAV if needed
 */
async function matchAudioFilesToUsers(audioFiles, timelineData, userSegments, meetingDir) {
    const matches = [];
    
    for (const [userName, segments] of Object.entries(userSegments)) {
        if (segments.length === 0) continue;
        
        // Sanitize userName the same way MiroTalk does in filenames
        // MiroTalk replaces non-alphanumeric characters with underscores
        const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
        
        const audioFile = audioFiles.find(file => {
            const filename = path.basename(file);
            // Match both original username and sanitized version
            return filename.includes(`_${userName}_`) || filename.includes(`_${sanitizedUserName}_`);
        });
        
        if (audioFile) {
            // Convert to WAV if needed
            let wavFile = audioFile;
            try {
                wavFile = await convertToWavIfNeeded(audioFile, meetingDir);
            } catch (error) {
                console.warn(`⚠ Warning: Failed to convert audio for user "${userName}": ${error.message}`);
                continue;
            }
            
            matches.push({
                userName,
                filePath: wavFile,
                originalPath: audioFile,
                delaySeconds: segments[0].start, // Use first segment start time
                delayMs: Math.round(segments[0].start * 1000)
            });
        } else {
            console.warn(`⚠ Warning: No audio file found for user "${userName}"`);
        }
    }
    
    return matches;
}

/**
 * Merge audio files using FFmpeg
 */
async function mergeAudioFiles(audioMatches, outputPath, totalDuration) {
    return new Promise((resolve, reject) => {
        if (audioMatches.length === 0) {
            return reject(new Error('No audio files to merge'));
        }
        
        if (audioMatches.length === 1) {
            // Single file - just add delay if needed and set duration
            const match = audioMatches[0];
            const command = ffmpeg(match.filePath);
            
            if (match.delayMs > 0) {
                command.audioFilters(`adelay=${match.delayMs}|${match.delayMs}`);
            }
            
            command
                .audioCodec('pcm_s16le')
                .audioFrequency(DEFAULT_SAMPLE_RATE)
                .audioChannels(DEFAULT_CHANNELS)
                .duration(totalDuration)
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log('   FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        process.stdout.write(`\r   Merging audio: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('end', () => {
                    process.stdout.write('\n');
                    resolve();
                })
                .on('error', (err) => {
                    reject(err);
                })
                .run();
        } else {
            // Multiple files - merge with delays
            const command = ffmpeg();
            
            // Add all input files
            audioMatches.forEach(match => {
                command.input(match.filePath);
            });
            
            // Build filter_complex for delays and mixing
            let filterComplex = '';
            const delayedStreams = [];
            
            audioMatches.forEach((match, index) => {
                if (match.delayMs > 0) {
                    filterComplex += `[${index}:a]adelay=${match.delayMs}|${match.delayMs}[a${index}];`;
                    delayedStreams.push(`[a${index}]`);
                } else {
                    delayedStreams.push(`[${index}:a]`);
                }
            });
            
            // Mix all streams
            filterComplex += `${delayedStreams.join('')}amix=inputs=${audioMatches.length}:duration=longest:normalize=0`;
            
            command
                .complexFilter(filterComplex)
                .audioCodec('pcm_s16le')
                .audioFrequency(DEFAULT_SAMPLE_RATE)
                .audioChannels(DEFAULT_CHANNELS)
                .duration(totalDuration)
                .output(outputPath)
                .on('start', (commandLine) => {
                    console.log('   FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        process.stdout.write(`\r   Merging audio: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('end', () => {
                    process.stdout.write('\n');
                    resolve();
                })
                .on('error', (err) => {
                    reject(err);
                })
                .run();
        }
    });
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process a meeting recording
 */
async function processMeeting(inputPath) {
    const startTime = Date.now();
    
    console.log('🎬 MiroTalk Meeting Recording Processor\n');
    console.log('=' .repeat(60));
    
    // Determine meeting directory and timeline path
    let meetingDir;
    let timelinePath;
    
    if (inputPath.endsWith('.json')) {
        // Full path to timeline.json provided
        timelinePath = path.resolve(inputPath);
        meetingDir = path.dirname(timelinePath);
    } else {
        // Meeting ID provided
        meetingDir = path.join(RECORDINGS_BASE_PATH, inputPath);
        timelinePath = path.join(meetingDir, 'timeline.json');
    }
    
    console.log(`📁 Meeting Directory: ${meetingDir}`);
    console.log(`📄 Timeline File: ${timelinePath}\n`);
    
    // Step 1: Validate inputs
    console.log('🔍 Step 1: Validating inputs...');
    
    // Check if timeline.json exists
    if (!fsSync.existsSync(timelinePath)) {
        throw new Error(`Timeline file not found: ${timelinePath}`);
    }
    console.log('   ✓ Timeline file exists');
    
    // Check if FFmpeg is installed
    if (!checkFFmpegInstalled()) {
        throw new Error('FFmpeg is not installed. Please install FFmpeg first.');
    }
    console.log('   ✓ FFmpeg is installed');
    
    // Step 2: Parse timeline
    console.log('\n📊 Step 2: Parsing timeline...');
    const timelineContent = await fs.readFile(timelinePath, 'utf-8');
    const timelineData = JSON.parse(timelineContent);
    
    const roomId = timelineData.room_id;
    const totalDuration = parseFloat(timelineData.total_duration_sec);
    
    console.log(`   Meeting ID: ${roomId}`);
    console.log(`   Duration: ${formatTime(totalDuration)}`);
    console.log(`   Events: ${timelineData.events.length}`);
    
    const userSegments = parseTimeline(timelineData);
    const userCount = Object.keys(userSegments).length;
    
    console.log(`   Participants: ${userCount}`);
    for (const userName of Object.keys(userSegments)) {
        console.log(`   - ${userName}`);
    }
    console.log('   ✓ Timeline parsed successfully');
    
    // Step 3: Find audio files
    console.log('\n🎵 Step 3: Finding audio files...');
    const audioFiles = await findAudioFiles(meetingDir);
    console.log(`   Found ${audioFiles.length} audio file(s)`);
    
    for (const file of audioFiles) {
        console.log(`   - ${path.basename(file)}`);
    }
    
    if (audioFiles.length === 0) {
        console.warn('   ⚠ Warning: No audio files found. Skipping audio merge.');
    }
    
    // Step 4: Generate transcript
    console.log('\n📝 Step 4: Generating voice activity transcript...');
    const silenceGaps = detectSilenceGaps(userSegments, totalDuration);
    const transcript = generateTranscript(timelineData, userSegments, silenceGaps);
    
    const transcriptPath = path.join(meetingDir, `${roomId}_transcript.txt`);
    await fs.writeFile(transcriptPath, transcript, 'utf-8');
    console.log(`   ✓ Transcript saved: ${path.basename(transcriptPath)}`);
    
    // Step 5: Generate statistics
    console.log('\n📈 Step 5: Generating statistics...');
    const statistics = generateStatistics(timelineData, userSegments, audioFiles);
    
    const statsPath = path.join(meetingDir, `${roomId}_statistics.json`);
    await fs.writeFile(statsPath, JSON.stringify(statistics, null, 2), 'utf-8');
    console.log(`   ✓ Statistics saved: ${path.basename(statsPath)}`);
    
    // Step 6: Merge audio files
    if (audioFiles.length > 0) {
        console.log('\n🎚️  Step 6: Merging audio files...');
        
        const audioMatches = await matchAudioFilesToUsers(audioFiles, timelineData, userSegments, meetingDir);
        console.log(`   Matched ${audioMatches.length} audio file(s) to users`);
        
        for (const match of audioMatches) {
            console.log(`   - ${match.userName}: delay ${match.delaySeconds.toFixed(3)}s`);
        }
        
        const mergedAudioPath = path.join(meetingDir, `${roomId}_merged_audio.wav`);
        
        try {
            await mergeAudioFiles(audioMatches, mergedAudioPath, totalDuration);
            
            // Validate merged audio duration
            const actualDuration = await getAudioDuration(mergedAudioPath);
            const durationDiff = Math.abs(actualDuration - totalDuration);
            
            console.log(`   ✓ Audio merged: ${path.basename(mergedAudioPath)}`);
            console.log(`   Expected duration: ${totalDuration.toFixed(3)}s`);
            console.log(`   Actual duration: ${actualDuration.toFixed(3)}s`);
            
            if (durationDiff > 0.1) {
                console.warn(`   ⚠ Warning: Duration mismatch of ${durationDiff.toFixed(3)}s`);
            } else {
                console.log(`   ✓ Duration validation passed`);
            }
        } catch (error) {
            console.error(`   ✗ Audio merge failed: ${error.message}`);
            throw error;
        }
    } else {
        console.log('\n⏭️  Step 6: Skipping audio merge (no audio files found)');
    }
    
    // Summary
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Processing completed successfully!\n');
    console.log(`📄 Generated files:`);
    console.log(`   - ${roomId}_transcript.txt`);
    console.log(`   - ${roomId}_statistics.json`);
    if (audioFiles.length > 0) {
        console.log(`   - ${roomId}_merged_audio.wav (${totalDuration.toFixed(3)}s)`);
    }
    console.log(`\n⏱️  Processing time: ${processingTime} seconds`);
    console.log('='.repeat(60));
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Error: Missing required argument\n');
        console.error('Usage:');
        console.error('  node process-meeting.js <meeting_id>');
        console.error('  node process-meeting.js <path_to_timeline.json>');
        console.error('\nExample:');
        console.error('  node process-meeting.js 06119OldSheep2752LuckyCat');
        console.error('  node process-meeting.js /path/to/timeline.json');
        process.exit(1);
    }
    
    const inputPath = args[0];
    
    try {
        await processMeeting(inputPath);
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    processMeeting,
    parseTimeline,
    generateTranscript,
    generateStatistics,
    formatTime,
    calculateOverlaps,
    detectSilenceGaps
};
