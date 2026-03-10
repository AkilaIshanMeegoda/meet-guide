/**
 * Culture Analysis Watcher Service
 *
 * Periodically scans the database for meetings that:
 *   - status === 'ended'
 *   - transcript is not null
 *   - transcript.utterances has more than 5 items
 *   - no completed CultureAnalysis document exists yet
 *
 * When such a meeting is found, it automatically triggers culture analysis
 * using the existing cultureAnalysisService.
 *
 * This eliminates the need for users to manually click "Run Culture Overview".
 */
const Meeting = require("../models/Meeting");
const CultureAnalysis = require("../models/CultureAnalysis");
const {
  analyzeMeetingCulture,
} = require("../services/cultureAnalysisService");

// How often to scan for unanalyzed meetings (default: 60 seconds)
const SCAN_INTERVAL_MS =
  parseInt(process.env.CULTURE_SCAN_INTERVAL_MS, 10) || 60000;

// Max meetings to process per scan cycle (avoid overloading the LLM API)
const BATCH_SIZE = parseInt(process.env.CULTURE_BATCH_SIZE, 10) || 3;

// Min utterances required before triggering analysis
const MIN_UTTERANCES = 5;

// Delay between consecutive analyses within a batch (ms)
const INTER_ANALYSIS_DELAY_MS = 5000;

class CultureAnalysisWatcher {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.isScanning = false;
    this.stats = {
      totalScans: 0,
      totalAnalyzed: 0,
      totalFailed: 0,
      lastScanAt: null,
      lastError: null,
    };
  }

  /**
   * Start the periodic scanner
   */
  start() {
    if (this.isRunning) {
      console.log("[CultureAnalysisWatcher] Already running");
      return;
    }

    console.log(
      `[CultureAnalysisWatcher] Starting watcher (scan every ${SCAN_INTERVAL_MS / 1000}s, batch size ${BATCH_SIZE}, min utterances ${MIN_UTTERANCES})`,
    );

    this.isRunning = true;

    // Run an initial scan after a short startup delay
    setTimeout(() => {
      this.scan();
    }, 10000);

    // Set up periodic scanning
    this.intervalId = setInterval(() => {
      this.scan();
    }, SCAN_INTERVAL_MS);

    console.log("[CultureAnalysisWatcher] Watcher started successfully");
  }

  /**
   * Stop the watcher
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[CultureAnalysisWatcher] Watcher stopped");
  }

  /**
   * Run a single scan cycle
   */
  async scan() {
    // Prevent overlapping scans
    if (this.isScanning) {
      console.log("[CultureAnalysisWatcher] Scan already in progress, skipping");
      return;
    }

    this.isScanning = true;
    this.stats.totalScans++;
    this.stats.lastScanAt = new Date();

    try {
      const meetingsToAnalyze = await this.findEligibleMeetings();

      if (meetingsToAnalyze.length === 0) {
        return; // Nothing to do – stay quiet in logs
      }

      console.log(
        `[CultureAnalysisWatcher] Found ${meetingsToAnalyze.length} meeting(s) eligible for culture analysis`,
      );

      for (const meeting of meetingsToAnalyze) {
        await this.analyzeWithRetry(meeting);

        // Small delay between consecutive analyses to be kind to the LLM API
        if (meetingsToAnalyze.indexOf(meeting) < meetingsToAnalyze.length - 1) {
          await this._sleep(INTER_ANALYSIS_DELAY_MS);
        }
      }
    } catch (error) {
      this.stats.lastError = {
        message: error.message,
        at: new Date(),
      };
      console.error("[CultureAnalysisWatcher] Scan error:", error.message);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Find meetings that are eligible for automatic culture analysis.
   *
   * Criteria:
   *  1. status === 'ended'
   *  2. transcript exists, is not null
   *  3. transcript.utterances array has more than MIN_UTTERANCES elements
   *  4. No CultureAnalysis doc with status 'completed' or 'processing' exists
   *
   * @returns {Promise<Array>} Array of meeting documents (lean)
   */
  async findEligibleMeetings() {
    try {
      // Step 1: Find ended meetings with sufficient transcript data
      // We use $expr + $size to filter by utterance count > MIN_UTTERANCES
      const candidates = await Meeting.find({
        status: "ended",
        transcript: { $ne: null },
        "transcript.utterances": { $exists: true },
        // Filter: utterances array length > MIN_UTTERANCES
        $expr: {
          $gt: [{ $size: { $ifNull: ["$transcript.utterances", []] } }, MIN_UTTERANCES],
        },
      })
        .select("meeting_id title")
        .lean()
        .limit(BATCH_SIZE * 2); // Fetch extra since some may already be analyzed

      if (candidates.length === 0) {
        return [];
      }

      // Step 2: Exclude meetings that already have a completed or in-progress analysis
      const candidateIds = candidates.map((m) => m.meeting_id);

      const existingAnalyses = await CultureAnalysis.find({
        meeting_id: { $in: candidateIds },
        status: { $in: ["completed", "processing"] },
      })
        .select("meeting_id")
        .lean();

      const analyzedIds = new Set(existingAnalyses.map((a) => a.meeting_id));

      // Step 3: Also exclude meetings that have a recent 'failed' analysis
      // to avoid retrying failures every scan cycle.
      // We'll retry failed analyses only after 30 minutes.
      const recentFailures = await CultureAnalysis.find({
        meeting_id: { $in: candidateIds },
        status: "failed",
        updated_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
      })
        .select("meeting_id")
        .lean();

      const recentFailedIds = new Set(recentFailures.map((a) => a.meeting_id));

      const eligible = candidates.filter(
        (m) => !analyzedIds.has(m.meeting_id) && !recentFailedIds.has(m.meeting_id),
      );

      return eligible.slice(0, BATCH_SIZE);
    } catch (error) {
      console.error(
        "[CultureAnalysisWatcher] Error finding eligible meetings:",
        error.message,
      );
      return [];
    }
  }

  /**
   * Analyze a single meeting, with basic error handling
   *
   * @param {Object} meeting - Lean meeting doc with meeting_id and title
   */
  async analyzeWithRetry(meeting) {
    const { meeting_id, title } = meeting;

    try {
      console.log(
        `[CultureAnalysisWatcher] Starting culture analysis for: ${meeting_id} ("${title || "Untitled"}")`,
      );

      const result = await analyzeMeetingCulture(meeting_id, { force: false });

      if (result && result.status === "completed") {
        this.stats.totalAnalyzed++;
        console.log(
          `[CultureAnalysisWatcher] ✓ Culture analysis completed for: ${meeting_id}`,
        );
      } else {
        this.stats.totalFailed++;
        console.warn(
          `[CultureAnalysisWatcher] ✗ Culture analysis did not complete for: ${meeting_id} (status: ${result?.status})`,
        );
      }
    } catch (error) {
      this.stats.totalFailed++;
      this.stats.lastError = {
        meetingId: meeting_id,
        message: error.message,
        at: new Date(),
      };
      console.error(
        `[CultureAnalysisWatcher] ✗ Failed to analyze ${meeting_id}:`,
        error.message,
      );
      // Error is already persisted to CultureAnalysis doc by the service
    }
  }

  /**
   * Get watcher status (for health/status endpoints)
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScanning: this.isScanning,
      scanIntervalMs: SCAN_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      minUtterances: MIN_UTTERANCES,
      stats: { ...this.stats },
    };
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton
module.exports = new CultureAnalysisWatcher();
