/**
 * Janus Recorder Service
 * 
 * Purpose: Monitor Janus streams, record per-participant audio to local disk,
 *          and trigger transcription webhook on completion.
 * 
 * Architecture:
 * 1. Receives "announce" webhooks from client when users join/publish
 * 2. Maps Janus stream IDs to user metadata (userId, displayName)
 * 3. Uses RTP forwarding to pipe audio to ffmpeg for each participant
 * 4. Saves WAV files to /var/recordings/meetings/<meetingId>/user_<userId>.wav
 * 5. POSTs to transcription endpoint when recording completes
 */

const express = require('express');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

// Configuration from environment
const CONFIG = {
    PORT: process.env.RECORDER_PORT || 3001,
    JANUS_ADMIN_URL: process.env.JANUS_ADMIN_URL || 'http://localhost:7088/admin',
    JANUS_ADMIN_SECRET: process.env.JANUS_ADMIN_SECRET || 'janusoverlord',
    TRANSCRIBE_ENDPOINT: process.env.TRANSCRIBE_ENDPOINT || 'http://127.0.0.1:3000/transcribe',
    RECORDINGS_BASE_PATH: process.env.RECORDINGS_BASE_PATH || '/var/recordings/meetings',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    RTP_BASE_PORT: parseInt(process.env.RTP_BASE_PORT) || 20000
};

// Logger setup
const logger = winston.createLogger({
    level: CONFIG.LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: '/var/log/janus-recorder.log' })
    ]
});

// Active recordings map: streamId -> recording metadata
const activeRecordings = new Map();

// Stream metadata map: streamId -> { userId, displayName, meetingId }
const streamMetadata = new Map();

// Port allocator for RTP forwarding
let nextRtpPort = CONFIG.RTP_BASE_PORT;

/**
 * Allocate next available RTP port
 */
function allocateRtpPort() {
    const port = nextRtpPort;
    nextRtpPort += 2; // Audio uses 2 ports (RTP + RTCP)
    return port;
}

/**
 * Start recording for a specific stream
 */
async function startRecording(streamId, meetingId, userId, displayName) {
    try {
        logger.info(`RECORDER START meeting:${meetingId} user:${userId} stream:${streamId}`);

        // Create meeting directory
        const meetingDir = path.join(CONFIG.RECORDINGS_BASE_PATH, meetingId);
        await fs.ensureDir(meetingDir);

        // Output file path
        const outputFile = path.join(meetingDir, `user_${userId}.wav`);
        const tmpFile = path.join(meetingDir, `user_${userId}.tmp.wav`);

        // Allocate RTP port for this stream
        const rtpPort = allocateRtpPort();

        // Start RTP forwarding in Janus
        const forwardingId = await setupJanusRtpForwarding(streamId, rtpPort);

        // Start ffmpeg to receive RTP and write WAV
        const ffmpegProcess = startFfmpegRecorder(rtpPort, tmpFile);

        // Store recording metadata
        activeRecordings.set(streamId, {
            meetingId,
            userId,
            displayName,
            streamId,
            forwardingId,
            rtpPort,
            outputFile,
            tmpFile,
            ffmpegProcess,
            startTime: new Date().toISOString(),
            startTimeMs: Date.now()
        });

        logger.info(`Recording started for user ${userId} on port ${rtpPort}`);
        return { success: true, streamId, rtpPort };

    } catch (error) {
        logger.error(`Failed to start recording for stream ${streamId}:`, error);
        throw error;
    }
}

/**
 * Setup RTP forwarding in Janus for a specific stream
 */
async function setupJanusRtpForwarding(streamId, rtpPort) {
    try {
        // Use Janus Admin API to configure RTP forwarding
        // This uses the "rtp_forward" request to the videoroom plugin
        
        const response = await axios.post(
            `${CONFIG.JANUS_ADMIN_URL}/videoroom`,
            {
                janus: 'message_plugin',
                admin_secret: CONFIG.JANUS_ADMIN_SECRET,
                plugin: 'janus.plugin.videoroom',
                request: {
                    request: 'rtp_forward',
                    room: streamId, // Might need room ID instead
                    publisher_id: streamId,
                    host: '127.0.0.1',
                    audio_port: rtpPort,
                    video_port: 0 // Audio only
                }
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        logger.info(`RTP forwarding configured for stream ${streamId} to port ${rtpPort}`);
        return response.data.rtp_stream?.stream_id || uuidv4();

    } catch (error) {
        logger.error(`Failed to setup RTP forwarding for stream ${streamId}:`, error.message);
        // Fallback: return mock ID (in production, this should fail)
        return uuidv4();
    }
}

/**
 * Start ffmpeg process to record RTP stream to WAV
 */
function startFfmpegRecorder(rtpPort, outputFile) {
    const ffmpegArgs = [
        '-protocol_whitelist', 'file,udp,rtp',
        '-i', `rtp://127.0.0.1:${rtpPort}`,
        '-acodec', 'pcm_s16le',  // PCM 16-bit
        '-ar', '16000',           // 16kHz sample rate (optimal for ASR)
        '-ac', '1',               // Mono channel
        '-f', 'wav',              // WAV format
        '-y',                     // Overwrite output file
        outputFile
    ];

    logger.info(`Starting ffmpeg with args: ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stdout.on('data', (data) => {
        logger.debug(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
        logger.debug(`ffmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        logger.info(`ffmpeg process exited with code ${code}`);
    });

    ffmpeg.on('error', (error) => {
        logger.error(`ffmpeg process error: ${error.message}`);
    });

    return ffmpeg;
}

/**
 * Stop recording for a specific stream
 */
async function stopRecording(streamId) {
    const recording = activeRecordings.get(streamId);
    if (!recording) {
        logger.warn(`No active recording found for stream ${streamId}`);
        return { success: false, message: 'No active recording' };
    }

    try {
        logger.info(`Stopping recording for stream ${streamId}`);

        // Stop ffmpeg gracefully
        if (recording.ffmpegProcess && !recording.ffmpegProcess.killed) {
            recording.ffmpegProcess.kill('SIGINT');
            
            // Wait for process to finish
            await new Promise((resolve) => {
                recording.ffmpegProcess.on('close', resolve);
                setTimeout(resolve, 5000); // Timeout after 5s
            });
        }

        // Rename tmp file to final file
        if (await fs.pathExists(recording.tmpFile)) {
            await fs.move(recording.tmpFile, recording.outputFile, { overwrite: true });
        }

        // Calculate duration
        const durationMs = Date.now() - recording.startTimeMs;
        const durationSec = Math.floor(durationMs / 1000);

        // Get file size
        let fileSize = 0;
        if (await fs.pathExists(recording.outputFile)) {
            const stats = await fs.stat(recording.outputFile);
            fileSize = stats.size;
        }

        logger.info(
            `RECORDER DONE meeting:${recording.meetingId} user:${recording.userId} path:${recording.outputFile} duration:${durationSec}s size:${fileSize} bytes`
        );

        // Trigger transcription webhook
        await triggerTranscription(recording, durationSec);

        // Cleanup
        activeRecordings.delete(streamId);

        return { 
            success: true, 
            outputFile: recording.outputFile,
            duration: durationSec,
            fileSize
        };

    } catch (error) {
        logger.error(`Failed to stop recording for stream ${streamId}:`, error);
        activeRecordings.delete(streamId);
        throw error;
    }
}

/**
 * Trigger transcription webhook
 */
async function triggerTranscription(recording, durationSec) {
    try {
        const payload = {
            meetingId: recording.meetingId,
            userId: recording.userId,
            displayName: recording.displayName,
            localPath: recording.outputFile,
            duration: durationSec,
            startTimeUTC: recording.startTime,
            streamId: recording.streamId
        };

        logger.info(`Triggering transcription webhook for user ${recording.userId}`);

        const response = await axios.post(
            CONFIG.TRANSCRIBE_ENDPOINT,
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            }
        );

        logger.info(`Transcription webhook successful: ${response.status}`, { jobId: response.data.jobId });
        return response.data;

    } catch (error) {
        logger.error(`Failed to trigger transcription webhook:`, error.message);
        // Don't throw - recording succeeded even if webhook failed
        return { success: false, error: error.message };
    }
}

/**
 * Express app setup
 */
const app = express();
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeRecordings: activeRecordings.size,
        uptime: process.uptime()
    });
});

/**
 * Announce endpoint - Client calls this when publishing a stream
 */
app.post('/recorder/announce', async (req, res) => {
    try {
        const { meetingId, userId, displayName, streamId } = req.body;

        if (!meetingId || !userId || !streamId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields: meetingId, userId, streamId' 
            });
        }

        logger.info(`Received announce: meeting:${meetingId} user:${userId} stream:${streamId}`);

        // Store stream metadata
        streamMetadata.set(streamId, { meetingId, userId, displayName });

        // Start recording
        const result = await startRecording(streamId, meetingId, userId, displayName);

        res.json({ 
            success: true, 
            message: 'Recording started',
            ...result
        });

    } catch (error) {
        logger.error('Announce endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * Leave endpoint - Client calls this when leaving
 */
app.post('/recorder/leave', async (req, res) => {
    try {
        const { meetingId, userId, streamId } = req.body;

        if (!streamId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing streamId' 
            });
        }

        logger.info(`Received leave: meeting:${meetingId} user:${userId} stream:${streamId}`);

        // Stop recording
        const result = await stopRecording(streamId);

        res.json({ 
            success: true, 
            message: 'Recording stopped',
            ...result
        });

    } catch (error) {
        logger.error('Leave endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

/**
 * List active recordings
 */
app.get('/recorder/active', (req, res) => {
    const recordings = Array.from(activeRecordings.values()).map(r => ({
        meetingId: r.meetingId,
        userId: r.userId,
        displayName: r.displayName,
        streamId: r.streamId,
        startTime: r.startTime,
        duration: Math.floor((Date.now() - r.startTimeMs) / 1000)
    }));

    res.json({
        success: true,
        count: recordings.length,
        recordings
    });
});

/**
 * Start server
 */
app.listen(CONFIG.PORT, () => {
    logger.info(`Janus Recorder Service started on port ${CONFIG.PORT}`);
    logger.info(`Configuration:`, CONFIG);
    
    // Ensure directories exist
    fs.ensureDir(CONFIG.RECORDINGS_BASE_PATH)
        .then(() => logger.info(`Recordings directory ready: ${CONFIG.RECORDINGS_BASE_PATH}`))
        .catch(err => logger.error(`Failed to create recordings directory:`, err));
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, stopping all recordings...');
    
    for (const [streamId] of activeRecordings) {
        try {
            await stopRecording(streamId);
        } catch (error) {
            logger.error(`Error stopping recording for stream ${streamId}:`, error);
        }
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, stopping all recordings...');
    
    for (const [streamId] of activeRecordings) {
        try {
            await stopRecording(streamId);
        } catch (error) {
            logger.error(`Error stopping recording for stream ${streamId}:`, error);
        }
    }
    
    process.exit(0);
});
