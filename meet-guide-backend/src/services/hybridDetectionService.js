/**
 * Hybrid Detection Service - Executes process_hybrid_detection.py for slang analysis
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Path to the hybrid detection system
const PYTHON_SCRIPTS_PATH = path.resolve(__dirname, '../../../meet-guide-components/hybrid-detection-system');
const fsSync = require('fs');

// Use venv python if available, otherwise fall back to system python3
const _hybridVenvPython = path.join(PYTHON_SCRIPTS_PATH, 'venv', 'bin', 'python3');
const PYTHON_CMD = fsSync.existsSync(_hybridVenvPython) ? _hybridVenvPython : (process.platform === 'win32' ? 'python' : 'python3');

class HybridDetectionService {
    constructor() {
        this.processingJobs = new Map(); // Track ongoing processing jobs
    }

    /**
     * Check if the Python scripts directory exists
     */
    async checkScriptsExist() {
        try {
            await fs.access(PYTHON_SCRIPTS_PATH);
            await fs.access(path.join(PYTHON_SCRIPTS_PATH, 'process_hybrid_detection.py'));
            await fs.access(path.join(PYTHON_SCRIPTS_PATH, 'hybrid_detector.py'));
            await fs.access(path.join(PYTHON_SCRIPTS_PATH, 'score_calculator.py'));
            return true;
        } catch (error) {
            console.error('Hybrid detection scripts not found:', error.message);
            return false;
        }
    }

    /**
     * Run process_hybrid_detection.py for a specific meeting
     * @param {string} meetingId - Meeting ID
     * @returns {Promise<{success: boolean, output: string, error?: string}>}
     */
    async processHybridDetection(meetingId) {
        // Check if already processing
        if (this.processingJobs.has(meetingId)) {
            return {
                success: false,
                error: 'Hybrid detection already in progress for this meeting',
                status: 'in_progress'
            };
        }

        // Verify scripts exist
        const scriptsExist = await this.checkScriptsExist();
        if (!scriptsExist) {
            return {
                success: false,
                error: 'Hybrid detection scripts not found. Please ensure meet-guide-components/hybrid-detection-system is installed.'
            };
        }

        // Start processing
        return new Promise((resolve) => {
            const scriptPath = path.join(PYTHON_SCRIPTS_PATH, 'process_hybrid_detection.py');
            const args = [scriptPath, meetingId];

            console.log(`\n${'='.repeat(60)}`);
            console.log(`Starting hybrid detection for: ${meetingId}`);
            console.log(`Command: ${PYTHON_CMD} ${args.join(' ')}`);
            console.log(`${'='.repeat(60)}\n`);

            const pythonProcess = spawn(PYTHON_CMD, args, {
                cwd: PYTHON_SCRIPTS_PATH,
                env: { ...process.env },
                windowsHide: true
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
                console.log(`[HybridDetection] ${text}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                console.error(`[HybridDetection] ERROR: ${text}`);
            });

            pythonProcess.on('close', (code) => {
                this.processingJobs.delete(meetingId);

                if (code === 0) {
                    console.log(`\nHybrid detection complete for ${meetingId}`);
                    resolve({
                        success: true,
                        output: output,
                        message: 'Hybrid detection processed successfully. Results saved to database.'
                    });
                } else {
                    console.error(`\nHybrid detection failed for ${meetingId} with code ${code}`);
                    resolve({
                        success: false,
                        error: errorOutput || `Process exited with code ${code}`,
                        output: output
                    });
                }
            });

            pythonProcess.on('error', (error) => {
                this.processingJobs.delete(meetingId);
                console.error(`\nFailed to start hybrid detection for ${meetingId}:`, error.message);
                resolve({
                    success: false,
                    error: `Failed to start Python process: ${error.message}`,
                    hint: 'Make sure Python is installed and in your system PATH'
                });
            });
        });
    }

    /**
     * Process hybrid detection in background (async)
     * @param {string} meetingId - Meeting ID
     * @param {Function} callback - Callback function(err, result)
     */
    processHybridDetectionAsync(meetingId, callback) {
        this.processHybridDetection(meetingId)
            .then(result => callback(null, result))
            .catch(err => callback(err, null));
    }

    /**
     * Get processing status for a meeting
     * @param {string} meetingId - Meeting ID
     */
    getStatus(meetingId) {
        const job = this.processingJobs.get(meetingId);
        
        if (!job) {
            return {
                status: 'not_found',
                message: 'No processing job found for this meeting'
            };
        }

        return {
            status: job.status,
            startTime: job.startTime,
            duration: Date.now() - job.startTime.getTime()
        };
    }

    /**
     * Get all processing jobs
     */
    getAllJobs() {
        return Array.from(this.processingJobs.entries()).map(([meetingId, job]) => ({
            meetingId,
            status: job.status,
            startTime: job.startTime,
            duration: Date.now() - job.startTime.getTime()
        }));
    }
}

// Export singleton
module.exports = new HybridDetectionService();
