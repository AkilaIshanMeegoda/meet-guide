/**
 * Recording Watcher Service
 *
 * Watches for new meeting recordings and automatically triggers
 * pronunciation analysis when meetings end.
 */
const chokidar = require("chokidar");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const processMeetingService = require("./processMeetingService");
const pronunciationService = require("./pronunciationService");
const hybridDetectionService = require("./hybridDetectionService");
const summarizationService = require("./summarizationService");
const cultureAnalysisService = require("./cultureAnalysisService");
const HybridDetection = require("../models/HybridDetection");
const MeetingSummarization = require("../models/MeetingSummarization");
const CultureAnalysis = require("../models/CultureAnalysis");

// Paths to watch
const MIROTALK_RECORDINGS_PATH =
  process.env.MIROTALK_RECORDINGS_PATH ||
  path.resolve(__dirname, "../../../mirotalk/app/src/recordings");
const MISPRONUNCIATION_PATH = path.resolve(
  __dirname,
  "../../../meet-guide-components/mispronunciation-detection-system",
);

// Track processed meetings to avoid duplicates
const processedMeetings = new Set();
const processingQueue = new Map();

class RecordingWatcher {
  constructor() {
    this.watcher = null;
    this.isRunning = false;
  }

  /**
   * Start watching for new recordings
   */
  start() {
    if (this.isRunning) {
      console.log("[RecordingWatcher] Already running");
      return;
    }

    console.log(
      `[RecordingWatcher] Starting watcher for: ${MIROTALK_RECORDINGS_PATH}`,
    );

    // Check if directory exists
    if (!fsSync.existsSync(MIROTALK_RECORDINGS_PATH)) {
      console.log(
        `[RecordingWatcher] Directory does not exist: ${MIROTALK_RECORDINGS_PATH}`,
      );
      console.log("[RecordingWatcher] Will create and watch when available");
    }

    // Watch for timeline.json files which indicate meeting activity
    this.watcher = chokidar.watch(MIROTALK_RECORDINGS_PATH, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 5000,
        pollInterval: 1000,
      },
    });

    this.watcher
      .on("add", (filePath) => this.handleFileAdd(filePath))
      .on("change", (filePath) => this.handleFileChange(filePath))
      .on("error", (error) =>
        console.error("[RecordingWatcher] Error:", error),
      );

    this.isRunning = true;
    console.log("[RecordingWatcher] Watcher started successfully");

    // Scan existing directories for unprocessed meetings
    this.scanExistingMeetings();

    // Scan database for meetings with pronunciation but missing hybrid detection
    this.scanDatabaseForMissingHybridDetection();

    // Scan database for meetings with transcripts but missing summarization
    this.scanDatabaseForMissingSummarization();

    // Scan database for meetings with transcripts but missing culture analysis
    this.scanDatabaseForMissingCultureAnalysis();
  }

  /**
   * Stop watching
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.isRunning = false;
      console.log("[RecordingWatcher] Watcher stopped");
    }
  }

  /**
   * Handle new file additions
   */
  async handleFileAdd(filePath) {
    const fileName = path.basename(filePath);
    const meetingFolder = path.basename(path.dirname(filePath));

    console.log(`[RecordingWatcher] New file detected: ${filePath}`);

    // Check for meeting end indicators
    if (fileName === "timeline.json" || fileName.endsWith(".processed")) {
      await this.checkMeetingComplete(meetingFolder, filePath);
    }
  }

  /**
   * Handle file changes
   */
  async handleFileChange(filePath) {
    const fileName = path.basename(filePath);
    const meetingFolder = path.basename(path.dirname(filePath));

    // Check timeline.json for meeting_end event
    if (fileName === "timeline.json") {
      await this.checkMeetingComplete(meetingFolder, filePath);
    }
  }

  /**
   * Check if a meeting is complete and ready for processing
   */
  async checkMeetingComplete(meetingId, timelinePath) {
    // Skip if already processed or processing
    if (processedMeetings.has(meetingId) || processingQueue.has(meetingId)) {
      return;
    }

    const meetingPath = path.dirname(timelinePath);

    try {
      // Read timeline.json
      const timelineContent = await fs.readFile(timelinePath, "utf-8");
      const timeline = JSON.parse(timelineContent);

      // Check for meeting_end event (timeline uses event_type field, not event)
      const events = timeline.events || [];
      const hasMeetingEnd = events.some((e) => e.event_type === "meeting_end");

      if (hasMeetingEnd) {
        console.log(`[RecordingWatcher] Meeting ended: ${meetingId}`);

        // Check if .processed marker exists
        const processedMarker = path.join(meetingPath, ".processed");
        const alreadyProcessed = fsSync.existsSync(processedMarker);

        if (alreadyProcessed) {
          console.log(
            `[RecordingWatcher] Meeting already processed: ${meetingId}`,
          );
          processedMeetings.add(meetingId);
          return;
        }

        // Queue for processing
        await this.queueMeetingForProcessing(meetingId, meetingPath);
      }
    } catch (error) {
      console.error(
        `[RecordingWatcher] Error checking meeting ${meetingId}:`,
        error.message,
      );
    }
  }

  /**
   * Queue a meeting for pronunciation processing
   */
  async queueMeetingForProcessing(meetingId, meetingPath) {
    if (processingQueue.has(meetingId)) {
      return;
    }

    console.log(
      `[RecordingWatcher] Queueing meeting for processing: ${meetingId}`,
    );
    processingQueue.set(meetingId, { status: "queued", startTime: new Date() });

    // Wait a bit for all files to be written
    setTimeout(async () => {
      await this.processMeeting(meetingId, meetingPath);
    }, 10000); // 10 second delay
  }

  /**
   * Process a meeting's recordings
   */
  async processMeeting(meetingId, meetingPath) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[RecordingWatcher] Processing meeting: ${meetingId}`);
    console.log(`${"=".repeat(60)}`);

    processingQueue.set(meetingId, {
      status: "processing",
      startTime: new Date(),
    });

    try {
      // First, copy/link the meeting folder to mispronunciation system directory
      const targetPath = path.join(MISPRONUNCIATION_PATH, meetingId);

      // Check if source and target are different
      if (meetingPath !== targetPath) {
        // Create symlink or copy files
        if (!fsSync.existsSync(targetPath)) {
          console.log(
            `[RecordingWatcher] Linking meeting folder to processing directory`,
          );
          // On Windows, use junction. On Unix, use symlink
          try {
            await fs.symlink(meetingPath, targetPath, "junction");
          } catch (linkError) {
            console.log(
              `[RecordingWatcher] Symlink failed, copying files instead`,
            );
            await this.copyDirectory(meetingPath, targetPath);
          }
        }
      }

      // Run process_meeting.py
      const result = await processMeetingService.processMeeting(
        meetingId,
        false,
      );

      if (result.success) {
        console.log(
          `[RecordingWatcher] ✓ Pronunciation processing complete for ${meetingId}`,
        );

        // Import pronunciation data to database
        const importResult =
          await pronunciationService.importMeetingData(meetingId);
        console.log(
          `[RecordingWatcher] Pronunciation import result:`,
          importResult,
        );

        // Auto-trigger hybrid detection after pronunciation completes
        console.log(
          `[RecordingWatcher] Auto-triggering hybrid detection for ${meetingId}...`,
        );
        try {
          const hybridResult =
            await hybridDetectionService.processHybridDetection(meetingId);

          if (hybridResult.success) {
            console.log(
              `[RecordingWatcher] Hybrid detection complete for ${meetingId}`,
            );
          } else {
            console.error(
              `[RecordingWatcher] Hybrid detection failed for ${meetingId}:`,
              hybridResult.error,
            );
          }
        } catch (hybridError) {
          console.error(
            `[RecordingWatcher] Hybrid detection error for ${meetingId}:`,
            hybridError.message,
          );
        }

        // Auto-trigger summarization after hybrid detection
        console.log(
          `[RecordingWatcher] Auto-triggering summarization for ${meetingId}...`,
        );
        try {
          const summaryResult =
            await summarizationService.processMeetingSummarization(meetingId);

          if (summaryResult.success) {
            console.log(
              `[RecordingWatcher] Summarization complete for ${meetingId}`,
            );
          } else {
            console.error(
              `[RecordingWatcher] Summarization failed for ${meetingId}:`,
              summaryResult.error,
            );
          }
        } catch (summaryError) {
          console.error(
            `[RecordingWatcher] Summarization error for ${meetingId}:`,
            summaryError.message,
          );
        }

        // Auto-trigger culture analysis after summarization
        console.log(
          `[RecordingWatcher] Auto-triggering culture analysis for ${meetingId}...`,
        );
        try {
          const cultureResult =
            await cultureAnalysisService.analyzeMeetingCulture(meetingId);

          if (cultureResult && cultureResult.status === "completed") {
            console.log(
              `[RecordingWatcher] Culture analysis complete for ${meetingId}`,
            );
          } else {
            console.error(
              `[RecordingWatcher] Culture analysis did not complete for ${meetingId}: status=${cultureResult && cultureResult.status}`,
            );
          }
        } catch (cultureError) {
          console.error(
            `[RecordingWatcher] Culture analysis error for ${meetingId}:`,
            cultureError.message,
          );
        }

        // Mark as processed
        const processedMarker = path.join(meetingPath, ".processed");
        await fs.writeFile(
          processedMarker,
          JSON.stringify(
            {
              processed_at: new Date().toISOString(),
              pronunciation_import: importResult,
              hybrid_detection: "triggered",
            },
            null,
            2,
          ),
        );

        processedMeetings.add(meetingId);
      } else {
        console.error(
          `[RecordingWatcher] ✗ Processing failed for ${meetingId}:`,
          result.error,
        );
      }
    } catch (error) {
      console.error(
        `[RecordingWatcher] Error processing ${meetingId}:`,
        error.message,
      );
    } finally {
      processingQueue.delete(meetingId);
    }
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Scan existing meetings for unprocessed ones
   */
  async scanExistingMeetings() {
    console.log(
      "[RecordingWatcher] Scanning filesystem for unprocessed meetings...",
    );

    try {
      if (!fsSync.existsSync(MIROTALK_RECORDINGS_PATH)) {
        console.log(
          "[RecordingWatcher] Recordings directory does not exist yet",
        );
        return;
      }

      const entries = await fs.readdir(MIROTALK_RECORDINGS_PATH, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("meet_")) {
          const meetingPath = path.join(MIROTALK_RECORDINGS_PATH, entry.name);
          const timelinePath = path.join(meetingPath, "timeline.json");

          if (fsSync.existsSync(timelinePath)) {
            await this.checkMeetingComplete(entry.name, timelinePath);
          }
        }
      }

      console.log("[RecordingWatcher] Filesystem scan complete");
    } catch (error) {
      console.error(
        "[RecordingWatcher] Error scanning meetings:",
        error.message,
      );
    }
  }

  /**
   * Scan database for meetings that have pronunciation feedback but no hybrid detection
   * This handles retroactive processing of existing transcripts
   */
  async scanDatabaseForMissingHybridDetection() {
    console.log(
      "[RecordingWatcher] Scanning database for meetings missing hybrid detection...",
    );

    try {
      const Meeting = require("../models/Meeting");

      // Get all meetings with transcripts
      const meetings = await Meeting.find({
        "transcript.utterances": { $exists: true, $ne: [] },
      }).select("recording_folder transcript");

      if (meetings.length === 0) {
        console.log(
          "[RecordingWatcher] No meetings with transcripts found in database",
        );
        return;
      }

      console.log(
        `[RecordingWatcher] Found ${meetings.length} meetings with transcripts`,
      );

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const meeting of meetings) {
        const meetingId = meeting.recording_folder;

        if (!meetingId) {
          skipped++;
          continue;
        }

        // Check if hybrid detection already exists for this meeting
        const existingDetection = await HybridDetection.findOne({
          meeting_id: meetingId,
        });

        if (existingDetection) {
          skipped++;
          continue;
        }

        // Process hybrid detection for this meeting
        console.log(
          `[RecordingWatcher] Processing missing hybrid detection: ${meetingId}`,
        );

        try {
          const result =
            await hybridDetectionService.processHybridDetection(meetingId);

          if (result.success) {
            processed++;
            console.log(`[RecordingWatcher] Processed: ${meetingId}`);
          } else {
            failed++;
            console.error(
              `[RecordingWatcher] Failed: ${meetingId} - ${result.error}`,
            );
          }
        } catch (error) {
          failed++;
          console.error(
            `[RecordingWatcher] Error processing ${meetingId}:`,
            error.message,
          );
        }

        // Add small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("[RecordingWatcher] Database scan complete:");
      console.log(`   Processed: ${processed}`);
      console.log(`   Skipped (already exists): ${skipped}`);
      console.log(`   Failed: ${failed}`);
    } catch (error) {
      console.error(
        "[RecordingWatcher] Error scanning database:",
        error.message,
      );
    }
  }

  /**
   * Scan database for meetings that have transcripts but no summarization
   * This handles retroactive processing of existing transcripts
   */
  async scanDatabaseForMissingSummarization() {
    console.log(
      "[RecordingWatcher] Scanning database for meetings missing summarization...",
    );

    try {
      const Meeting = require("../models/Meeting");

      // Get all meetings with transcripts
      const meetings = await Meeting.find({
        "transcript.utterances": { $exists: true, $ne: [] },
      }).select("meeting_id transcript");

      if (meetings.length === 0) {
        console.log(
          "[RecordingWatcher] No meetings with transcripts found in database",
        );
        return;
      }

      console.log(
        `[RecordingWatcher] Found ${meetings.length} meetings with transcripts`,
      );

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const meeting of meetings) {
        const meetingId = meeting.meeting_id;

        if (!meetingId) {
          skipped++;
          continue;
        }

        // Check if summarization already exists for this meeting
        const existingSummarization = await MeetingSummarization.findOne({
          meeting_id: meetingId,
        });

        if (existingSummarization) {
          skipped++;
          continue;
        }

        // Process summarization for this meeting
        console.log(
          `[RecordingWatcher] Processing missing summarization: ${meetingId}`,
        );

        try {
          const result =
            await summarizationService.processMeetingSummarization(meetingId);

          if (result.success) {
            processed++;
            console.log(`[RecordingWatcher] Processed: ${meetingId}`);
          } else {
            failed++;
            console.error(
              `[RecordingWatcher] Failed: ${meetingId} - ${result.error}`,
            );
          }
        } catch (error) {
          failed++;
          console.error(
            `[RecordingWatcher] Error processing ${meetingId}:`,
            error.message,
          );
        }

        // Add small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log("[RecordingWatcher] Summarization scan complete:");
      console.log(`   Processed: ${processed}`);
      console.log(`   Skipped (already exists): ${skipped}`);
      console.log(`   Failed: ${failed}`);
    } catch (error) {
      console.error(
        "[RecordingWatcher] Error scanning database for summarizations:",
        error.message,
      );
    }
  }

  /**
   * Scan database for meetings that have transcripts but no culture analysis.
   * This handles retroactive processing of existing transcripts.
   */
  async scanDatabaseForMissingCultureAnalysis() {
    console.log(
      "[RecordingWatcher] Scanning database for meetings missing culture analysis...",
    );

    try {
      const Meeting = require("../models/Meeting");

      // Get all meetings with transcripts that have enough utterances
      const meetings = await Meeting.find({
        "transcript.utterances": { $exists: true, $not: { $size: 0 } },
      }).select("meeting_id transcript");

      if (meetings.length === 0) {
        console.log(
          "[RecordingWatcher] No meetings with transcripts found in database",
        );
        return;
      }

      console.log(
        `[RecordingWatcher] Found ${meetings.length} meetings with transcripts for culture analysis scan`,
      );

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const meeting of meetings) {
        const meetingId = meeting.meeting_id;

        if (!meetingId) {
          skipped++;
          continue;
        }

        // Skip if a completed analysis already exists
        const existing = await CultureAnalysis.findOne({
          meeting_id: meetingId,
          status: "completed",
        });

        if (existing) {
          skipped++;
          continue;
        }

        console.log(
          `[RecordingWatcher] Processing missing culture analysis: ${meetingId}`,
        );

        try {
          const result =
            await cultureAnalysisService.analyzeMeetingCulture(meetingId);

          if (result && result.status === "completed") {
            processed++;
            console.log(`[RecordingWatcher] Culture analysis done: ${meetingId}`);
          } else {
            failed++;
            console.error(
              `[RecordingWatcher] Culture analysis incomplete: ${meetingId} - status=${result && result.status}`,
            );
          }
        } catch (error) {
          failed++;
          console.error(
            `[RecordingWatcher] Culture analysis error for ${meetingId}:`,
            error.message,
          );
        }

        // Small delay to avoid hammering the HuggingFace API
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log("[RecordingWatcher] Culture analysis scan complete:");
      console.log(`   Processed: ${processed}`);
      console.log(`   Skipped (already exists): ${skipped}`);
      console.log(`   Failed: ${failed}`);
    } catch (error) {
      console.error(
        "[RecordingWatcher] Error scanning database for culture analyses:",
        error.message,
      );
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      watchPath: MIROTALK_RECORDINGS_PATH,
      processedCount: processedMeetings.size,
      queuedCount: processingQueue.size,
      processing: Array.from(processingQueue.entries()).map(([id, data]) => ({
        meetingId: id,
        ...data,
      })),
    };
  }
}

// Export singleton
module.exports = new RecordingWatcher();
