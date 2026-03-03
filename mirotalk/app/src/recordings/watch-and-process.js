#!/usr/bin/env node

/**
 * MiroTalk Meeting Auto-Processor Service
 * 
 * This service automatically watches for completed meetings and processes them.
 * - Scans meetings directory every 30 seconds
 * - Checks if meeting has ended (meeting_end event in timeline.json)
 * - Processes meetings that haven't been processed yet
 * - Creates .processed marker to avoid duplicate processing
 * - Logs all activities with timestamps
 * 
 * Usage:
 *   node watch-and-process.js
 *   pm2 start watch-and-process.js --name meeting-processor
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// ============================================================================
// CONFIGURATION
// ============================================================================

const RECORDINGS_DIR = path.join(__dirname);
const PROCESS_SCRIPT = path.join(__dirname, 'process-meeting.js');
const SCAN_INTERVAL = 30000; // 30 seconds
const PROCESSED_MARKER = '.processed';
const PRONUNCIATION_PROCESSED_MARKER = '.pronunciation_processed';
const TRANSCRIPT_IMPORTED_MARKER = '.transcript_imported';
const HYBRID_DETECTION_MARKER = '.hybrid_detection_processed';
const SUMMARIZATION_MARKER = '.summarization_processed';

// Mispronunciation Detection System Configuration
const MISPRONUNCIATION_SYSTEM_DIR = path.resolve(__dirname, '../../../../meet-guide-components/mispronunciation-detection-system');
const PYTHON_SCRIPT = 'process_meeting.py';
const _venvPython = path.join(MISPRONUNCIATION_SYSTEM_DIR, 'venv', 'bin', 'python3');
const PYTHON_CMD = process.platform === 'win32'
    ? 'C:\\Users\\maas5\\AppData\\Local\\Programs\\Python\\Python310\\python.exe'
    : (fsSync.existsSync(_venvPython) ? _venvPython : 'python3');

// Hybrid Detection System Configuration
const HYBRID_DETECTION_SYSTEM_DIR = path.resolve(__dirname, '../../../../meet-guide-components/hybrid-detection-system');
const HYBRID_DETECTION_SCRIPT = 'process_hybrid_detection.py';

// Meeting Summarization System Configuration
const SUMMARIZATION_SYSTEM_DIR = path.resolve(__dirname, '../../../../meet-guide-components/meeting-summarization-system');
const SUMMARIZATION_SCRIPT = 'process_meeting_summarization.py';

// Backend API for auto-import
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const SUMMARIZATION_API_URL = process.env.SUMMARIZATION_API_URL || 'http://127.0.0.1:8001';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current timestamp in ISO format
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
    const timestamp = getTimestamp();
    const prefix = level === 'ERROR' ? '❌' : level === 'SUCCESS' ? '✅' : '📋';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read and parse JSON file
 */
async function readJSON(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`Failed to read JSON from ${filePath}: ${error.message}`);
    }
}

/**
 * Write JSON file
 */
async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        throw new Error(`Failed to write JSON to ${filePath}: ${error.message}`);
    }
}

/**
 * Import pronunciation data to MongoDB via the backend API
 */
async function importToMongoDB(meetingId) {
    try {
        log(`  → Importing pronunciation data to MongoDB for ${meetingId}...`);
        
        const http = require('http');
        const url = new URL(`${BACKEND_URL}/api/pronunciation/internal-import/${meetingId}`);
        
        const result = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
            req.end();
        });
        
        if (result.status === 200 || result.status === 201) {
            log(`  → MongoDB import successful for ${meetingId}`, 'SUCCESS');
        } else {
            log(`  → MongoDB import returned status ${result.status}: ${JSON.stringify(result.body)}`, 'ERROR');
        }
    } catch (error) {
        log(`  → MongoDB import failed for ${meetingId}: ${error.message}`, 'ERROR');
        log(`  → You can manually import via: POST ${BACKEND_URL}/api/pronunciation/import/${meetingId}`);
    }
}

/**
 * Import transcript data to MongoDB via the backend API
 * Reads speaker_attributed.json and .txt from global_transcript folder
 * Checks both the analysis system directory and recordings directory
 */
async function importTranscriptToMongoDB(meetingId) {
    try {
        log(`  → Importing transcript to MongoDB for ${meetingId}...`);

        // Check multiple possible locations for transcript files
        const possibleDirs = [
            path.join(MISPRONUNCIATION_SYSTEM_DIR, meetingId, 'global_transcript'),
            path.join(RECORDINGS_DIR, meetingId, 'global_transcript')
        ];

        let analysisDir = null;
        for (const dir of possibleDirs) {
            if (fsSync.existsSync(dir)) {
                analysisDir = dir;
                break;
            }
        }

        if (!analysisDir) {
            log(`  → No global_transcript folder found for ${meetingId} (checked analysis + recordings dir)`, 'ERROR');
            // Create marker to prevent retrying endlessly for meetings without transcripts
            const recordingPath = path.join(RECORDINGS_DIR, meetingId);
            await createTranscriptImportedMarker(recordingPath, meetingId, true, 'no_transcript_folder');
            return;
        }

        // Find speaker_attributed files (named as {meetingId}_speaker_attributed.json/txt)
        const files = await fs.readdir(analysisDir);
        const jsonFile = files.find(f => f.endsWith('_speaker_attributed.json'));
        const txtFile = files.find(f => f.endsWith('_speaker_attributed.txt'));

        if (!jsonFile) {
            log(`  → No speaker_attributed.json found for ${meetingId}`, 'ERROR');
            // Create marker so we don't keep retrying
            const recordingPath = path.join(RECORDINGS_DIR, meetingId);
            await createTranscriptImportedMarker(recordingPath, meetingId, true, 'no_speaker_attributed_json');
            return;
        }

        const jsonPath = path.join(analysisDir, jsonFile);
        const jsonData = await readJSON(jsonPath);

        let txtData = '';
        if (txtFile) {
            const txtPath = path.join(analysisDir, txtFile);
            txtData = await fs.readFile(txtPath, 'utf-8');
        }

        // Skip if transcript is empty (e.g., single participant meetings)
        if (!jsonData.utterances || jsonData.utterances.length === 0) {
            log(`  → Transcript is empty for ${meetingId}, marking as done (no data to import)`);
            // Create marker so we don't keep retrying empty transcripts
            const recordingPath = path.join(RECORDINGS_DIR, meetingId);
            await createTranscriptImportedMarker(recordingPath, meetingId, true, 'empty_transcript');
            return;
        }

        // POST to backend API
        const http = require('http');
        const url = new URL(`${BACKEND_URL}/api/meetings/${meetingId}/transcript/internal`);
        const postData = JSON.stringify({
            speaker_attributed_json: jsonData,
            speaker_attributed_txt: txtData
        });

        const result = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 30000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
            req.write(postData);
            req.end();
        });

        if (result.status === 200 || result.status === 201) {
            log(`  → Transcript import successful for ${meetingId} (${jsonData.utterances.length} utterances)`, 'SUCCESS');
            // Create marker in both recording path and analysis path
            const recordingPath = path.join(RECORDINGS_DIR, meetingId);
            const analysisPath = path.join(MISPRONUNCIATION_SYSTEM_DIR, meetingId);
            await createTranscriptImportedMarker(recordingPath, meetingId, true);
            await createTranscriptImportedMarker(analysisPath, meetingId, true);
        } else {
            log(`  → Transcript import returned status ${result.status}: ${JSON.stringify(result.body)}`, 'ERROR');
        }
    } catch (error) {
        log(`  → Transcript import failed for ${meetingId}: ${error.message}`, 'ERROR');
    }
}

// ============================================================================
// MEETING DETECTION & VALIDATION
// ============================================================================

/**
 * Get all meeting directories
 */
async function getMeetingDirectories() {
    try {
        const entries = await fs.readdir(RECORDINGS_DIR, { withFileTypes: true });
        
        const meetingDirs = [];
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                const meetingPath = path.join(RECORDINGS_DIR, entry.name);
                meetingDirs.push({
                    name: entry.name,
                    path: meetingPath
                });
            }
        }
        
        return meetingDirs;
    } catch (error) {
        log(`Error reading recordings directory: ${error.message}`, 'ERROR');
        return [];
    }
}

/**
 * Check if meeting has ended
 */
async function isMeetingComplete(meetingPath) {
    const timelinePath = path.join(meetingPath, 'timeline.json');
    
    // Check if timeline.json exists
    if (!await fileExists(timelinePath)) {
        return false;
    }
    
    try {
        const timeline = await readJSON(timelinePath);
        
        // Check if events array exists
        if (!timeline.events || !Array.isArray(timeline.events)) {
            return false;
        }
        
        // Check if meeting_end event exists
        const hasEndEvent = timeline.events.some(
            event => event.event_type === 'meeting_end'
        );
        
        return hasEndEvent;
    } catch (error) {
        log(`Error reading timeline for ${path.basename(meetingPath)}: ${error.message}`, 'ERROR');
        return false;
    }
}

/**
 * Check if meeting has already been processed
 */
async function isAlreadyProcessed(meetingPath) {
    const markerPath = path.join(meetingPath, PROCESSED_MARKER);
    return await fileExists(markerPath);
}

/**
 * Check if pronunciation analysis has already been done successfully
 */
async function isPronunciationProcessed(meetingPath) {
    const markerPath = path.join(meetingPath, PRONUNCIATION_PROCESSED_MARKER);
    if (!await fileExists(markerPath)) {
        return false;
    }
    // Check if the marker indicates success; retry if it was a failure
    try {
        const marker = await readJSON(markerPath);
        return marker.success === true;
    } catch {
        return false;
    }
}

/**
 * Check if transcript has already been imported to MongoDB
 */
async function isTranscriptImported(meetingPath) {
    const markerPath = path.join(meetingPath, TRANSCRIPT_IMPORTED_MARKER);
    if (!await fileExists(markerPath)) {
        return false;
    }
    try {
        const marker = await readJSON(markerPath);
        return marker.success === true;
    } catch {
        return false;
    }
}

/**
 * Create transcript imported marker file
 */
async function createTranscriptImportedMarker(meetingPath, meetingId, success = true, error = null) {
    const markerPath = path.join(meetingPath, TRANSCRIPT_IMPORTED_MARKER);
    const markerData = {
        imported_at: getTimestamp(),
        meeting_id: meetingId,
        success: success
    };
    if (error) {
        markerData.error = error;
    }
    try {
        await writeJSON(markerPath, markerData);
    } catch (err) {
        log(`Warning: Could not create transcript import marker for ${meetingId}: ${err.message}`, 'ERROR');
    }
}

/**
 * Create processed marker file
 */
async function createProcessedMarker(meetingPath, meetingId, success = true, error = null) {
    const markerPath = path.join(meetingPath, PROCESSED_MARKER);
    
    const markerData = {
        processed_at: getTimestamp(),
        meeting_id: meetingId,
        success: success
    };
    
    if (error) {
        markerData.error = error;
    }
    
    try {
        await writeJSON(markerPath, markerData);
    } catch (error) {
        log(`Warning: Could not create processed marker for ${meetingId}: ${error.message}`, 'ERROR');
    }
}

/**
 * Create pronunciation processed marker file
 */
async function createPronunciationProcessedMarker(meetingPath, meetingId, success = true, error = null) {
    const markerPath = path.join(meetingPath, PRONUNCIATION_PROCESSED_MARKER);
    
    const markerData = {
        processed_at: getTimestamp(),
        meeting_id: meetingId,
        success: success,
        system: 'mispronunciation-detection-system'
    };
    
    if (error) {
        markerData.error = error;
    }
    
    try {
        await writeJSON(markerPath, markerData);
    } catch (error) {
        log(`Warning: Could not create pronunciation marker for ${meetingId}: ${error.message}`, 'ERROR');
    }
}

/**
 * Check if hybrid detection has already been done or permanently failed
 * Returns true if succeeded OR permanently failed (no need to retry)
 */
async function isHybridDetectionProcessed(meetingPath) {
    const markerPath = path.join(meetingPath, HYBRID_DETECTION_MARKER);
    if (!await fileExists(markerPath)) {
        return false;
    }
    try {
        const marker = await readJSON(markerPath);
        // Success = done
        if (marker.success === true) return true;
        // Permanent skip (no transcript in DB) = done, don't retry
        if (marker.skip === true) return true;
        // Failed but already retried = done, use manual batch scripts as fallback
        if (marker.success === false) return true;
        return false;
    } catch {
        return false;
    }
}

/**
 * Check if meeting summarization has already been done or permanently failed
 * Returns true if succeeded OR permanently failed (no need to retry)
 */
async function isSummarizationProcessed(meetingPath) {
    const markerPath = path.join(meetingPath, SUMMARIZATION_MARKER);
    if (!await fileExists(markerPath)) {
        return false;
    }
    try {
        const marker = await readJSON(markerPath);
        // Success = done
        if (marker.success === true) return true;
        // Permanent skip (no transcript in DB) = done, don't retry
        if (marker.skip === true) return true;
        // Failed but already retried = done, use manual batch scripts as fallback
        if (marker.success === false) return true;
        return false;
    } catch {
        return false;
    }
}

/**
 * Check if meeting has a real transcript imported to MongoDB (not just skipped)
 * This determines whether hybrid detection & summarization can run
 */
async function hasTranscriptInDB(meetingPath) {
    const markerPath = path.join(meetingPath, TRANSCRIPT_IMPORTED_MARKER);
    if (!await fileExists(markerPath)) {
        return false;
    }
    try {
        const marker = await readJSON(markerPath);
        // Transcript was actually imported (not skipped due to no_transcript_folder, empty_transcript, etc.)
        return marker.success === true && !marker.error;
    } catch {
        return false;
    }
}

/**
 * Create hybrid detection processed marker file
 */
async function createHybridDetectionMarker(meetingPath, meetingId, success = true, error = null) {
    const markerPath = path.join(meetingPath, HYBRID_DETECTION_MARKER);
    const markerData = {
        processed_at: getTimestamp(),
        meeting_id: meetingId,
        success: success,
        system: 'hybrid-detection-system'
    };
    if (error) {
        markerData.error = error;
    }
    try {
        await writeJSON(markerPath, markerData);
    } catch (err) {
        log(`Warning: Could not create hybrid detection marker for ${meetingId}: ${err.message}`, 'ERROR');
    }
}

/**
 * Create summarization processed marker file
 */
async function createSummarizationMarker(meetingPath, meetingId, success = true, error = null) {
    const markerPath = path.join(meetingPath, SUMMARIZATION_MARKER);
    const markerData = {
        processed_at: getTimestamp(),
        meeting_id: meetingId,
        success: success,
        system: 'meeting-summarization-system'
    };
    if (error) {
        markerData.error = error;
    }
    try {
        await writeJSON(markerPath, markerData);
    } catch (err) {
        log(`Warning: Could not create summarization marker for ${meetingId}: ${err.message}`, 'ERROR');
    }
}

// ============================================================================
// MEETING PROCESSING
// ============================================================================

/**
 * Process a meeting
 */
async function processMeeting(meetingId, meetingPath) {
    log(`Processing meeting: ${meetingId}`);
    
    const startTime = Date.now();
    
    try {
        // Run the process-meeting.js script
        const command = `node "${PROCESS_SCRIPT}" "${meetingId}"`;
        const { stdout, stderr } = await execAsync(command, {
            cwd: RECORDINGS_DIR,
            timeout: 300000, // 5 minutes timeout
            encoding: 'utf-8',
            windowsHide: true
        });
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Check if processing was successful
        if (stderr && !stderr.includes('Warning')) {
            throw new Error(stderr);
        }
        
        // Create success marker
        await createProcessedMarker(meetingPath, meetingId, true);
        
        log(`✓ Completed: ${meetingId} (${processingTime}s)`, 'SUCCESS');
        
        // Log a summary of what was generated
        const transcriptPath = path.join(meetingPath, `${meetingId}_transcript.txt`);
        const statsPath = path.join(meetingPath, `${meetingId}_statistics.json`);
        const audioPath = path.join(meetingPath, `${meetingId}_merged_audio.wav`);
        
        const hasTranscript = await fileExists(transcriptPath);
        const hasStats = await fileExists(statsPath);
        const hasAudio = await fileExists(audioPath);
        
        if (hasTranscript) log(`  → Generated transcript`);
        if (hasStats) log(`  → Generated statistics`);
        if (hasAudio) log(`  → Merged audio`);
        
        return true;
    } catch (error) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        log(`✗ Failed: ${meetingId} (${processingTime}s) - ${error.message}`, 'ERROR');
        
        // Create failure marker
        await createProcessedMarker(meetingPath, meetingId, false, error.message);
        
        return false;
    }
}

/**
 * Copy meeting folder to mispronunciation detection system directory
 */
async function copyMeetingToAnalysisDir(meetingId, sourcePath) {
    const destPath = path.join(MISPRONUNCIATION_SYSTEM_DIR, meetingId);
    
    try {
        // Create destination directory if it doesn't exist
        await fs.mkdir(destPath, { recursive: true });
        
        // Always sync files from source to destination (copy missing files)
        const files = await fs.readdir(sourcePath);
        let copiedCount = 0;
        for (const file of files) {
            const srcFile = path.join(sourcePath, file);
            const destFile = path.join(destPath, file);
            
            const stats = await fs.stat(srcFile);
            if (stats.isFile()) {
                // Copy if file doesn't exist or source is newer
                let shouldCopy = !fsSync.existsSync(destFile);
                if (!shouldCopy) {
                    const destStats = fsSync.statSync(destFile);
                    shouldCopy = stats.mtimeMs > destStats.mtimeMs;
                }
                if (shouldCopy) {
                    await fs.copyFile(srcFile, destFile);
                    copiedCount++;
                }
            }
        }
        
        if (copiedCount > 0) {
            log(`  → Synced ${copiedCount} files to analysis system`);
        } else {
            log(`  → Analysis system folder up to date: ${meetingId}`);
        }
        return destPath;
    } catch (error) {
        throw new Error(`Failed to copy meeting folder: ${error.message}`);
    }
}

/**
 * Process pronunciation analysis for a meeting
 */
async function processPronunciation(meetingId, meetingPath) {
    log(`Running pronunciation analysis: ${meetingId}`);
    
    const startTime = Date.now();
    
    try {
        // Check if mispronunciation system directory exists
        if (!fsSync.existsSync(MISPRONUNCIATION_SYSTEM_DIR)) {
            throw new Error(`Mispronunciation system not found: ${MISPRONUNCIATION_SYSTEM_DIR}`);
        }
        
        // Copy meeting folder to the analysis system directory
        const analysisPath = await copyMeetingToAnalysisDir(meetingId, meetingPath);
        
        // Run the Python pronunciation detection script
        const pythonScript = path.join(MISPRONUNCIATION_SYSTEM_DIR, PYTHON_SCRIPT);
        
        if (!fsSync.existsSync(pythonScript)) {
            throw new Error(`Python script not found: ${pythonScript}`);
        }
        
        log(`  → Running mispronunciation detection...`);
        
        const command = `"${PYTHON_CMD}" "${pythonScript}" "${meetingId}"`;
        const { stdout, stderr } = await execAsync(command, {
            cwd: MISPRONUNCIATION_SYSTEM_DIR,
            timeout: 600000, // 10 minutes timeout for pronunciation analysis
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            encoding: 'utf-8',
            windowsHide: true
        });
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Create pronunciation processed marker in both locations
        await createPronunciationProcessedMarker(meetingPath, meetingId, true);
        await createPronunciationProcessedMarker(analysisPath, meetingId, true);
        
        log(`✓ Pronunciation analysis completed: ${meetingId} (${processingTime}s)`, 'SUCCESS');
        
        // Check for generated outputs
        const transcriptsDir = path.join(analysisPath, 'participant_transcripts');
        const hasTranscripts = fsSync.existsSync(transcriptsDir);
        
        if (hasTranscripts) {
            log(`  → Generated participant transcripts and pronunciation analysis`);
        }
        
        // Auto-import pronunciation data to MongoDB via backend API
        await importToMongoDB(meetingId);
        
        // Auto-import transcript data to MongoDB
        await importTranscriptToMongoDB(meetingId);
        
        return true;
    } catch (error) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        log(`✗ Pronunciation analysis failed: ${meetingId} (${processingTime}s) - ${error.message}`, 'ERROR');
        
        // Create failure marker
        await createPronunciationProcessedMarker(meetingPath, meetingId, false, error.message);
        
        return false;
    }
}

/**
 * Process hybrid detection (Gen-Z slang analysis) for a meeting
 * Runs after transcript is imported to MongoDB
 */
async function processHybridDetection(meetingId, meetingPath) {
    log(`Running hybrid detection analysis: ${meetingId}`);
    
    const startTime = Date.now();
    
    try {
        // Check if hybrid detection system directory exists
        if (!fsSync.existsSync(HYBRID_DETECTION_SYSTEM_DIR)) {
            throw new Error(`Hybrid detection system not found: ${HYBRID_DETECTION_SYSTEM_DIR}`);
        }
        
        const pythonScript = path.join(HYBRID_DETECTION_SYSTEM_DIR, HYBRID_DETECTION_SCRIPT);
        
        if (!fsSync.existsSync(pythonScript)) {
            throw new Error(`Hybrid detection script not found: ${pythonScript}`);
        }
        
        log(`  → Running hybrid slang detection...`);
        
        const command = `"${PYTHON_CMD}" "${pythonScript}" "${meetingId}"`;
        const { stdout, stderr } = await execAsync(command, {
            cwd: HYBRID_DETECTION_SYSTEM_DIR,
            timeout: 600000, // 10 minutes timeout
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            encoding: 'utf-8',
            windowsHide: true
        });
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Create success marker
        await createHybridDetectionMarker(meetingPath, meetingId, true);
        
        log(`✓ Hybrid detection completed: ${meetingId} (${processingTime}s)`, 'SUCCESS');
        
        // Log output summary
        if (stdout) {
            const lines = stdout.trim().split('\n');
            const summaryLines = lines.filter(l => l.includes('Score:') || l.includes('Slang Count:') || l.includes('PROCESSING COMPLETE'));
            summaryLines.forEach(l => log(`  → ${l.trim()}`));
        }
        
        return true;
    } catch (error) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        log(`✗ Hybrid detection failed: ${meetingId} (${processingTime}s) - ${error.message}`, 'ERROR');
        
        // Create failure marker
        await createHybridDetectionMarker(meetingPath, meetingId, false, error.message);
        
        return false;
    }
}

/**
 * Process meeting summarization (NLP analysis) for a meeting
 * Uses the FastAPI summarization server if running, otherwise falls back to Python script
 */
async function processSummarization(meetingId, meetingPath) {
    log(`Running meeting summarization: ${meetingId}`);
    
    const startTime = Date.now();
    
    try {
        // Try FastAPI server first (faster since models stay in memory)
        const success = await processSummarizationViaAPI(meetingId);
        
        if (success) {
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
            await createSummarizationMarker(meetingPath, meetingId, true);
            log(`✓ Summarization completed via API: ${meetingId} (${processingTime}s)`, 'SUCCESS');
            return true;
        }
        
        // Fallback to Python script
        log(`  → FastAPI server not available, falling back to Python script...`);
        return await processSummarizationViaScript(meetingId, meetingPath);
        
    } catch (error) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        log(`✗ Summarization failed: ${meetingId} (${processingTime}s) - ${error.message}`, 'ERROR');
        
        // Create failure marker
        await createSummarizationMarker(meetingPath, meetingId, false, error.message);
        
        return false;
    }
}

/**
 * Process summarization via FastAPI endpoint (preferred - faster)
 */
async function processSummarizationViaAPI(meetingId) {
    try {
        const http = require('http');
        const url = new URL(`${SUMMARIZATION_API_URL}/api/process-meeting`);
        const postData = JSON.stringify({ meeting_id: meetingId });
        
        log(`  → Calling summarization API: ${url.href}`);
        
        const result = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 300000 // 5 minutes
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
            req.write(postData);
            req.end();
        });
        
        if (result.status === 200 || result.status === 201) {
            const summary = result.body.summary || {};
            log(`  → Summarization API success: ${summary.totalResults || 0} results, ${summary.topics || 0} topics, ${summary.actionItems || 0} action items`);
            
            // Also save to MeetingSummarization + ActionItem collections via Node.js backend
            await saveSummarizationToBackend(meetingId, result.body);
            
            return true;
        } else {
            log(`  → Summarization API returned status ${result.status}`, 'ERROR');
            return false;
        }
    } catch (error) {
        log(`  → Summarization API not available: ${error.message}`);
        return false;
    }
}

/**
 * Save summarization results to backend MongoDB collections
 */
async function saveSummarizationToBackend(meetingId, apiResult) {
    try {
        const http = require('http');
        const url = new URL(`${BACKEND_URL}/api/summarization/analyze-meeting/${meetingId}`);
        
        // The backend endpoint will fetch from MongoDB and process
        // Since the FastAPI server already saved to the meetings collection,
        // we trigger the Node.js backend to also save to MeetingSummarization + ActionItem collections
        const result = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
            req.write(JSON.stringify({}));
            req.end();
        });
        
        if (result.status === 200 || result.status === 201) {
            log(`  → Saved summarization to MeetingSummarization + ActionItem collections`);
        }
    } catch (error) {
        log(`  → Warning: Could not save to backend collections: ${error.message}`, 'ERROR');
    }
}

/**
 * Process summarization via Python script (fallback)
 */
async function processSummarizationViaScript(meetingId, meetingPath) {
    const startTime = Date.now();
    
    try {
        if (!fsSync.existsSync(SUMMARIZATION_SYSTEM_DIR)) {
            throw new Error(`Summarization system not found: ${SUMMARIZATION_SYSTEM_DIR}`);
        }
        
        const pythonScript = path.join(SUMMARIZATION_SYSTEM_DIR, SUMMARIZATION_SCRIPT);
        
        if (!fsSync.existsSync(pythonScript)) {
            throw new Error(`Summarization script not found: ${pythonScript}`);
        }
        
        log(`  → Running summarization via Python script...`);
        
        const command = `"${PYTHON_CMD}" "${pythonScript}" "${meetingId}"`;
        const { stdout, stderr } = await execAsync(command, {
            cwd: SUMMARIZATION_SYSTEM_DIR,
            timeout: 600000, // 10 minutes timeout
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            encoding: 'utf-8',
            windowsHide: true
        });
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Create success marker
        await createSummarizationMarker(meetingPath, meetingId, true);
        
        log(`✓ Summarization completed via script: ${meetingId} (${processingTime}s)`, 'SUCCESS');
        
        return true;
    } catch (error) {
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        log(`✗ Summarization script failed: ${meetingId} (${processingTime}s) - ${error.message}`, 'ERROR');
        
        // Create failure marker
        await createSummarizationMarker(meetingPath, meetingId, false, error.message);
        
        return false;
    }
}

/**
 * Find and process meetings that need processing
 */
async function scanAndProcessMeetings() {
    try {
        // Get all meeting directories
        const meetings = await getMeetingDirectories();
        
        if (meetings.length === 0) {
            return;
        }
        
        let processedCount = 0;
        let pronunciationProcessedCount = 0;
        let transcriptImportedCount = 0;
        let hybridDetectionCount = 0;
        let summarizationCount = 0;
        let skippedCount = 0;
        let pendingCount = 0;
        
        // Check each meeting - pipeline: base → pronunciation → transcript import → hybrid detection → summarization
        for (const meeting of meetings) {
            try {
                const isBaseProcessed = await isAlreadyProcessed(meeting.path);
                const isPronunciationDone = await isPronunciationProcessed(meeting.path);
                const isTranscriptDone = await isTranscriptImported(meeting.path);
                const isHybridDone = await isHybridDetectionProcessed(meeting.path);
                const isSummarizationDone = await isSummarizationProcessed(meeting.path);
                
                // Step 1: If meeting is complete but not base-processed, do basic processing first
                if (!isBaseProcessed) {
                    // Check if meeting is complete
                    if (!await isMeetingComplete(meeting.path)) {
                        pendingCount++;
                        continue;
                    }
                    
                    // Process the meeting (basic processing: merge audio, generate transcript, etc.)
                    const success = await processMeeting(meeting.name, meeting.path);
                    if (success) {
                        processedCount++;
                        
                        // Step 2: After successful basic processing, run pronunciation analysis
                        const pronSuccess = await processPronunciation(meeting.name, meeting.path);
                        if (pronSuccess) {
                            pronunciationProcessedCount++;
                            
                            // Step 3: Run hybrid detection (scripts handle empty transcripts gracefully)
                            const hybridSuccess = await processHybridDetection(meeting.name, meeting.path);
                            if (hybridSuccess) hybridDetectionCount++;
                            
                            // Step 4: Run summarization
                            const sumSuccess = await processSummarization(meeting.name, meeting.path);
                            if (sumSuccess) summarizationCount++;
                        }
                    }
                } else if (!isPronunciationDone) {
                    // Step 2 (fallback): Basic processing done but pronunciation not done yet
                    log(`Running pending pronunciation analysis for: ${meeting.name}`);
                    const pronSuccess = await processPronunciation(meeting.name, meeting.path);
                    if (pronSuccess) {
                        pronunciationProcessedCount++;
                        
                        // Continue pipeline - run hybrid detection and summarization
                        const hybridSuccess = await processHybridDetection(meeting.name, meeting.path);
                        if (hybridSuccess) hybridDetectionCount++;
                        
                        const sumSuccess = await processSummarization(meeting.name, meeting.path);
                        if (sumSuccess) summarizationCount++;
                    }
                } else if (!isTranscriptDone) {
                    // Step 3 (fallback): Pronunciation done but transcript not imported yet
                    log(`Importing pending transcript for: ${meeting.name}`);
                    await importTranscriptToMongoDB(meeting.name);
                    transcriptImportedCount++;
                    
                    // Continue pipeline - attempt hybrid detection and summarization
                    if (!isHybridDone) {
                        const hybridSuccess = await processHybridDetection(meeting.name, meeting.path);
                        if (hybridSuccess) hybridDetectionCount++;
                    }
                    if (!isSummarizationDone) {
                        const sumSuccess = await processSummarization(meeting.name, meeting.path);
                        if (sumSuccess) summarizationCount++;
                    }
                } else if (!isHybridDone) {
                    // Step 4 (fallback): Transcript imported but hybrid detection not done
                    log(`Running pending hybrid detection for: ${meeting.name}`);
                    const hybridSuccess = await processHybridDetection(meeting.name, meeting.path);
                    if (hybridSuccess) hybridDetectionCount++;
                    
                    // Also check summarization
                    if (!isSummarizationDone) {
                        const sumSuccess = await processSummarization(meeting.name, meeting.path);
                        if (sumSuccess) summarizationCount++;
                    }
                } else if (!isSummarizationDone) {
                    // Step 5 (fallback): Everything else done but summarization not done
                    log(`Running pending summarization for: ${meeting.name}`);
                    const sumSuccess = await processSummarization(meeting.name, meeting.path);
                    if (sumSuccess) summarizationCount++;
                } else {
                    // All processing steps complete
                    skippedCount++;
                }
                
            } catch (error) {
                log(`Error checking meeting ${meeting.name}: ${error.message}`, 'ERROR');
            }
        }
        
        // Log summary if any meetings were processed
        if (processedCount > 0 || pronunciationProcessedCount > 0 || transcriptImportedCount > 0 || hybridDetectionCount > 0 || summarizationCount > 0 || pendingCount > 0) {
            log(`Scan complete: ${processedCount} base, ${pronunciationProcessedCount} pronunciation, ${transcriptImportedCount} transcripts, ${hybridDetectionCount} hybrid, ${summarizationCount} summarization, ${skippedCount} complete, ${pendingCount} pending`);
        }
        
    } catch (error) {
        log(`Error during scan: ${error.message}`, 'ERROR');
    }
}

// ============================================================================
// SERVICE LIFECYCLE
// ============================================================================

/**
 * Validate environment before starting
 */
async function validateEnvironment() {
    // Check if recordings directory exists
    if (!fsSync.existsSync(RECORDINGS_DIR)) {
        throw new Error(`Recordings directory not found: ${RECORDINGS_DIR}`);
    }
    
    // Check if process-meeting.js exists
    if (!fsSync.existsSync(PROCESS_SCRIPT)) {
        throw new Error(`Processing script not found: ${PROCESS_SCRIPT}`);
    }
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(RECORDINGS_DIR, 'node_modules');
    if (!fsSync.existsSync(nodeModulesPath)) {
        log('Warning: node_modules not found. Dependencies may not be installed.', 'ERROR');
    }
    
    // Check if mispronunciation system exists
    if (!fsSync.existsSync(MISPRONUNCIATION_SYSTEM_DIR)) {
        log(`Warning: Mispronunciation system not found: ${MISPRONUNCIATION_SYSTEM_DIR}`, 'ERROR');
        log('Pronunciation analysis will be skipped', 'ERROR');
    } else {
        const pythonScript = path.join(MISPRONUNCIATION_SYSTEM_DIR, PYTHON_SCRIPT);
        if (!fsSync.existsSync(pythonScript)) {
            log(`Warning: Python script not found: ${pythonScript}`, 'ERROR');
        } else {
            log(`Mispronunciation System: ${MISPRONUNCIATION_SYSTEM_DIR} ✓`);
        }
    }
    
    // Check if hybrid detection system exists
    if (!fsSync.existsSync(HYBRID_DETECTION_SYSTEM_DIR)) {
        log(`Warning: Hybrid detection system not found: ${HYBRID_DETECTION_SYSTEM_DIR}`, 'ERROR');
        log('Hybrid detection (slang analysis) will be skipped', 'ERROR');
    } else {
        const hybridScript = path.join(HYBRID_DETECTION_SYSTEM_DIR, HYBRID_DETECTION_SCRIPT);
        if (!fsSync.existsSync(hybridScript)) {
            log(`Warning: Hybrid detection script not found: ${hybridScript}`, 'ERROR');
        } else {
            log(`Hybrid Detection System: ${HYBRID_DETECTION_SYSTEM_DIR} ✓`);
        }
    }
    
    // Check if summarization system exists
    if (!fsSync.existsSync(SUMMARIZATION_SYSTEM_DIR)) {
        log(`Warning: Summarization system not found: ${SUMMARIZATION_SYSTEM_DIR}`, 'ERROR');
        log('Meeting summarization will be skipped', 'ERROR');
    } else {
        const sumScript = path.join(SUMMARIZATION_SYSTEM_DIR, SUMMARIZATION_SCRIPT);
        if (!fsSync.existsSync(sumScript)) {
            log(`Warning: Summarization script not found: ${sumScript}`, 'ERROR');
        } else {
            log(`Summarization System: ${SUMMARIZATION_SYSTEM_DIR} ✓`);
        }
    }
    
    log('Environment validation passed ✓');
}

/**
 * Start the service
 */
async function startService() {
    log('='.repeat(60));
    log('Meeting Auto-Processor Service Starting...');
    log('='.repeat(60));
    log(`Recordings Directory: ${RECORDINGS_DIR}`);
    log(`Process Script: ${PROCESS_SCRIPT}`);
    log(`Mispronunciation System: ${MISPRONUNCIATION_SYSTEM_DIR}`);
    log(`Hybrid Detection System: ${HYBRID_DETECTION_SYSTEM_DIR}`);
    log(`Summarization System: ${SUMMARIZATION_SYSTEM_DIR}`);
    log(`Summarization API: ${SUMMARIZATION_API_URL}`);
    log(`Scan Interval: ${SCAN_INTERVAL / 1000} seconds`);
    log('='.repeat(60));
    
    try {
        // Validate environment
        await validateEnvironment();
        
        log('Service started successfully! Watching for completed meetings...');
        
        // Initial scan
        await scanAndProcessMeetings();
        
        // Set up periodic scanning
        setInterval(async () => {
            await scanAndProcessMeetings();
        }, SCAN_INTERVAL);
        
    } catch (error) {
        log(`Failed to start service: ${error.message}`, 'ERROR');
        process.exit(1);
    }
}

/**
 * Handle graceful shutdown
 */
function setupShutdownHandlers() {
    const shutdown = (signal) => {
        log(`Received ${signal} signal. Shutting down gracefully...`);
        log('Service stopped.');
        process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================================================
// ENTRY POINT
// ============================================================================

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error.message}`, 'ERROR');
    log(error.stack, 'ERROR');
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled rejection at ${promise}: ${reason}`, 'ERROR');
});

// Setup shutdown handlers
setupShutdownHandlers();

// Start the service
if (require.main === module) {
    startService().catch(error => {
        log(`Fatal error: ${error.message}`, 'ERROR');
        process.exit(1);
    });
}

module.exports = {
    scanAndProcessMeetings,
    processMeeting,
    processPronunciation,
    processHybridDetection,
    processSummarization,
    isMeetingComplete,
    isAlreadyProcessed,
    isPronunciationProcessed,
    isHybridDetectionProcessed,
    isSummarizationProcessed,
    hasTranscriptInDB
};
