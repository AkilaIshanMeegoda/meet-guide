/**
 * Process Meeting Service - Executes process_meeting.py for pronunciation analysis
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Path to the mispronunciation detection system
const PYTHON_SCRIPTS_PATH = path.resolve(__dirname, '../../../meet-guide-components/mispronunciation-detection-system');

class ProcessMeetingService {
    constructor() {
        this.processingJobs = new Map(); // Track ongoing processing jobs
    }

    /**
     * Check if the Python scripts directory exists
     */
    async checkScriptsExist() {
        try {
            await fs.access(PYTHON_SCRIPTS_PATH);
            await fs.access(path.join(PYTHON_SCRIPTS_PATH, 'process_meeting.py'));
            return true;
        } catch (error) {
            console.error('Python scripts not found:', error.message);
            return false;
        }
    }

    /**
     * Check if a meeting folder exists or create it
     * @param {string} meetingId - Meeting folder name
     */
    async ensureMeetingFolder(meetingId) {
        const meetingPath = path.join(PYTHON_SCRIPTS_PATH, meetingId);
        try {
            await fs.access(meetingPath);
            return true;
        } catch {
            // Create the folder if it doesn't exist
            try {
                await fs.mkdir(meetingPath, { recursive: true });
                return true;
            } catch (error) {
                console.error('Failed to create meeting folder:', error.message);
                return false;
            }
        }
    }

    /**
     * Run process_meeting.py for a specific meeting
     * @param {string} meetingId - Meeting ID/folder name
     * @param {boolean} useWhisper - Use fine-tuned Whisper instead of Deepgram
     * @returns {Promise<{success: boolean, output: string, error?: string}>}
     */
    async processMeeting(meetingId, useWhisper = false) {
        // Check if already processing (in-memory check)
        if (this.processingJobs.has(meetingId)) {
            console.log(`[ProcessMeeting] Skipping ${meetingId} - already processing in memory`);
            return {
                success: false,
                error: 'Meeting is already being processed',
                status: 'in_progress'
            };
        }

        // Filesystem lock to prevent duplicate processing across processes
        const lockPath = path.join(PYTHON_SCRIPTS_PATH, meetingId, '.processing_lock');
        try {
            const fsSync = require('fs');
            if (fsSync.existsSync(lockPath)) {
                // Check if lock is stale (older than 15 minutes)
                const lockStat = fsSync.statSync(lockPath);
                const ageMinutes = (Date.now() - lockStat.mtimeMs) / 60000;
                if (ageMinutes < 15) {
                    console.log(`[ProcessMeeting] Skipping ${meetingId} - lock file exists (${ageMinutes.toFixed(1)}min old)`);
                    return {
                        success: false,
                        error: 'Meeting is already being processed by another process',
                        status: 'in_progress'
                    };
                }
                console.log(`[ProcessMeeting] Removing stale lock for ${meetingId} (${ageMinutes.toFixed(1)}min old)`);
            }
            // Create lock file
            const meetingDir = path.join(PYTHON_SCRIPTS_PATH, meetingId);
            if (fsSync.existsSync(meetingDir)) {
                fsSync.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
            }
        } catch (lockErr) {
            console.error(`[ProcessMeeting] Lock check error for ${meetingId}:`, lockErr.message);
        }

        // Verify scripts exist
        const scriptsExist = await this.checkScriptsExist();
        if (!scriptsExist) {
            return {
                success: false,
                error: 'Python processing scripts not found. Please ensure meet-guide-components is installed.'
            };
        }

        // Check meeting folder exists
        const meetingFolderExists = await this.checkMeetingFolderExists(meetingId);
        if (!meetingFolderExists) {
            return {
                success: false,
                error: `Meeting folder '${meetingId}' not found. Recording files may not have been saved yet.`
            };
        }

        // Ensure merged audio WAV exists before running Python pronunciation analysis
        const meetingDir = path.join(PYTHON_SCRIPTS_PATH, meetingId);
        const mergedAudioPath = path.join(meetingDir, `${meetingId}_merged_audio.wav`);
        const fsSync = require('fs');

        if (!fsSync.existsSync(mergedAudioPath)) {
            console.log(`[ProcessMeeting] Merged audio not found for ${meetingId}, converting webm recordings...`);
            try {
                const webmFiles = fsSync.readdirSync(meetingDir).filter(f => f.endsWith('.webm'));
                if (webmFiles.length === 0) {
                    return { success: false, error: `No audio recordings (.webm) found for ${meetingId}` };
                }
                const { execSync } = require('child_process');
                if (webmFiles.length === 1) {
                    // Single participant — convert directly
                    const input = path.join(meetingDir, webmFiles[0]);
                    execSync(
                        `ffmpeg -y -i "${input}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${mergedAudioPath}"`,
                        { stdio: 'pipe' }
                    );
                } else {
                    // Multiple participants — convert each then merge with amix
                    const wavFiles = [];
                    for (const webm of webmFiles) {
                        const wavOut = path.join(meetingDir, webm.replace('.webm', '_converted.wav'));
                        execSync(
                            `ffmpeg -y -i "${path.join(meetingDir, webm)}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${wavOut}"`,
                            { stdio: 'pipe' }
                        );
                        wavFiles.push(wavOut);
                    }
                    const inputs = wavFiles.map(f => `-i "${f}"`).join(' ');
                    execSync(
                        `ffmpeg -y ${inputs} -filter_complex amix=inputs=${wavFiles.length}:duration=longest "${mergedAudioPath}"`,
                        { stdio: 'pipe' }
                    );
                }
                console.log(`[ProcessMeeting] ✓ Created merged audio for ${meetingId}`);
            } catch (audioErr) {
                console.error(`[ProcessMeeting] Audio conversion failed for ${meetingId}:`, audioErr.message);
                return { success: false, error: `Audio conversion failed: ${audioErr.message}` };
            }
        }

        // Start processing
        return new Promise((resolve) => {
            // Use mispronunciation system venv python if available, otherwise system python3
            const venvPython = path.join(PYTHON_SCRIPTS_PATH, 'venv', 'bin', 'python3');
            const pythonCmd = process.platform === 'win32'
                ? (process.env.PYTHON_PATH || 'C:\\Users\\maas5\\AppData\\Local\\Programs\\Python\\Python310\\python.exe')
                : (fsSync.existsSync(venvPython) ? venvPython : 'python3');

            const args = [path.join(PYTHON_SCRIPTS_PATH, 'process_meeting.py'), meetingId];
            if (useWhisper) {
                args.push('--use-whisper');
            }

            console.log(`\n${'='.repeat(60)}`);
            console.log(`Starting pronunciation processing for: ${meetingId}`);
            console.log(`Using: ${useWhisper ? 'Fine-tuned Whisper' : 'Deepgram API'}`);
            console.log(`Command: ${pythonCmd} ${args.join(' ')}`);
            console.log(`${'='.repeat(60)}\n`);

            const pythonProcess = spawn(pythonCmd, args, {
                cwd: PYTHON_SCRIPTS_PATH,
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            // Track the job
            this.processingJobs.set(meetingId, {
                process: pythonProcess,
                startTime: new Date(),
                status: 'running'
            });

            pythonProcess.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.log(`[${meetingId}] ${text}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                console.error(`[${meetingId}] ERROR: ${text}`);
            });

            pythonProcess.on('close', (code) => {
                this.processingJobs.delete(meetingId);
                // Remove lock file
                try { require('fs').unlinkSync(lockPath); } catch (_) {}

                if (code === 0) {
                    console.log(`\n✓ Processing complete for ${meetingId}`);
                    resolve({
                        success: true,
                        output: output,
                        message: 'Meeting processed successfully. Pronunciation feedback is now available.'
                    });
                } else {
                    console.error(`\n✗ Processing failed for ${meetingId} with code ${code}`);
                    resolve({
                        success: false,
                        error: errorOutput || `Process exited with code ${code}`,
                        output: output
                    });
                }
            });

            pythonProcess.on('error', (error) => {
                this.processingJobs.delete(meetingId);
                // Remove lock file
                try { require('fs').unlinkSync(lockPath); } catch (_) {}
                console.error(`\n✗ Failed to start process for ${meetingId}:`, error.message);
                resolve({
                    success: false,
                    error: `Failed to start Python process: ${error.message}`
                });
            });
        });
    }

    /**
     * Check if meeting folder exists
     */
    async checkMeetingFolderExists(meetingId) {
        const meetingPath = path.join(PYTHON_SCRIPTS_PATH, meetingId);
        try {
            const stat = await fs.stat(meetingPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Get processing status for a meeting
     */
    getProcessingStatus(meetingId) {
        const job = this.processingJobs.get(meetingId);
        if (job) {
            return {
                status: 'processing',
                startTime: job.startTime,
                elapsedSeconds: Math.floor((new Date() - job.startTime) / 1000)
            };
        }
        return { status: 'not_processing' };
    }

    /**
     * Get list of available meeting folders that can be processed
     */
    async getProcessableMeetings() {
        try {
            const entries = await fs.readdir(PYTHON_SCRIPTS_PATH, { withFileTypes: true });
            const meetings = [];

            for (const entry of entries) {
                if (entry.isDirectory() && (entry.name.startsWith('meet_') || entry.name.startsWith('projectmeeting'))) {
                    const meetingPath = path.join(PYTHON_SCRIPTS_PATH, entry.name);
                    
                    // Check if it has audio files or recordings
                    try {
                        const files = await fs.readdir(meetingPath);
                        const hasAudio = files.some(f => 
                            f.endsWith('.mp3') || 
                            f.endsWith('.wav') || 
                            f.endsWith('.webm') ||
                            f === 'participants'
                        );
                        
                        // Check if already processed
                        const hasSummary = files.includes('pronunciation_summary.json');
                        
                        meetings.push({
                            folder: entry.name,
                            hasAudio,
                            isProcessed: hasSummary,
                            isProcessing: this.processingJobs.has(entry.name)
                        });
                    } catch (err) {
                        console.error(`Error reading ${entry.name}:`, err.message);
                    }
                }
            }

            return meetings;
        } catch (error) {
            console.error('Error listing processable meetings:', error.message);
            return [];
        }
    }

    /**
     * Process meeting asynchronously (fire and forget with callback)
     */
    processMeetingAsync(meetingId, useWhisper = false, callback = null) {
        this.processMeeting(meetingId, useWhisper)
            .then(result => {
                if (callback) {
                    callback(null, result);
                }
            })
            .catch(error => {
                if (callback) {
                    callback(error, null);
                }
            });
        
        return { 
            success: true, 
            message: 'Processing started in background',
            meetingId 
        };
    }
}

// Export singleton instance
module.exports = new ProcessMeetingService();
