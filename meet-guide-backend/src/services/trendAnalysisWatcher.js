/**
 * Trend Analysis Watcher Service
 *
 * Watches the CultureAnalysis collection for newly completed analyses.
 * When a new culture analysis is completed (within the last 30 days),
 * it automatically triggers a trend analysis across all completed
 * culture analyses from the past 30 days.
 *
 * This eliminates the need for users to manually click "Generate Report".
 *
 * Logic:
 *   - Poll CultureAnalysis for completed docs
 *   - Compare the newest completed analysis timestamp against the latest
 *     CulturalTrendAnalysis timestamp
 *   - If a culture analysis was completed AFTER the most recent trend analysis
 *     (or no trend analysis exists yet), trigger a new trend analysis
 *   - Only trigger if there is at least 1 completed culture analysis in the
 *     30-day window
 *   - Avoid re-triggering while a trend analysis is already in progress
 */
const CultureAnalysis = require("../models/CultureAnalysis");
const CulturalTrendAnalysis = require("../models/CulturalTrendAnalysis");
const { analyzeCulturalTrends } = require("../services/trendAnalysisService");

// How often to check for new culture analyses (default: 90 seconds)
const SCAN_INTERVAL_MS =
  parseInt(process.env.TREND_SCAN_INTERVAL_MS, 10) || 90000;

// How many days of culture analyses to include in the trend window
const TREND_WINDOW_DAYS =
  parseInt(process.env.TREND_WINDOW_DAYS, 10) || 30;

// Minimum number of completed culture analyses required before running trend analysis
const MIN_ANALYSES_FOR_TREND =
  parseInt(process.env.MIN_ANALYSES_FOR_TREND, 10) || 2;

// Cooldown: minimum time between consecutive trend analyses (default: 10 minutes)
// Prevents rapid re-triggers when multiple culture analyses complete in quick succession
const TREND_COOLDOWN_MS =
  parseInt(process.env.TREND_COOLDOWN_MS, 10) || 10 * 60 * 1000;

class TrendAnalysisWatcher {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.isScanning = false;
    this.stats = {
      totalScans: 0,
      totalTriggered: 0,
      totalSkipped: 0,
      totalFailed: 0,
      lastScanAt: null,
      lastTriggeredAt: null,
      lastError: null,
    };
  }

  /**
   * Start the periodic scanner
   */
  start() {
    if (this.isRunning) {
      console.log("[TrendAnalysisWatcher] Already running");
      return;
    }

    console.log(
      `[TrendAnalysisWatcher] Starting watcher (scan every ${SCAN_INTERVAL_MS / 1000}s, trend window ${TREND_WINDOW_DAYS} days, min analyses ${MIN_ANALYSES_FOR_TREND}, cooldown ${TREND_COOLDOWN_MS / 1000}s)`,
    );

    this.isRunning = true;

    // Run an initial scan after a short startup delay (30s to let culture analyses settle)
    setTimeout(() => {
      this.scan();
    }, 30000);

    // Set up periodic scanning
    this.intervalId = setInterval(() => {
      this.scan();
    }, SCAN_INTERVAL_MS);

    console.log("[TrendAnalysisWatcher] Watcher started successfully");
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
    console.log("[TrendAnalysisWatcher] Watcher stopped");
  }

  /**
   * Run a single scan cycle
   */
  async scan() {
    // Prevent overlapping scans
    if (this.isScanning) {
      console.log("[TrendAnalysisWatcher] Scan already in progress, skipping");
      return;
    }

    this.isScanning = true;
    this.stats.totalScans++;
    this.stats.lastScanAt = new Date();

    try {
      const shouldTrigger = await this.shouldTriggerTrendAnalysis();

      if (!shouldTrigger.trigger) {
        this.stats.totalSkipped++;
        return; // Stay quiet in logs when nothing to do
      }

      console.log(
        `[TrendAnalysisWatcher] Triggering trend analysis: ${shouldTrigger.reason}`,
      );

      await this.runTrendAnalysis();
    } catch (error) {
      this.stats.lastError = {
        message: error.message,
        at: new Date(),
      };
      console.error("[TrendAnalysisWatcher] Scan error:", error.message);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Determine whether a new trend analysis should be triggered.
   *
   * Returns { trigger: boolean, reason: string }
   */
  async shouldTriggerTrendAnalysis() {
    try {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - TREND_WINDOW_DAYS);

      // 1. Count completed culture analyses in the 30-day window
      const completedCount = await CultureAnalysis.countDocuments({
        status: "completed",
        meeting_created_at: { $gte: windowStart },
      });

      if (completedCount < MIN_ANALYSES_FOR_TREND) {
        return {
          trigger: false,
          reason: `Only ${completedCount} completed analyses in window (need ${MIN_ANALYSES_FOR_TREND})`,
        };
      }

      // 2. Find the newest completed culture analysis in the window
      const newestCultureAnalysis = await CultureAnalysis.findOne({
        status: "completed",
        meeting_created_at: { $gte: windowStart },
      })
        .sort({ analyzed_at: -1 })
        .select("analyzed_at meeting_id")
        .lean();

      if (!newestCultureAnalysis || !newestCultureAnalysis.analyzed_at) {
        return { trigger: false, reason: "No analyzed_at timestamp found" };
      }

      // 3. Check if there's an in-progress trend analysis (avoid duplicate triggers)
      const inProgressTrend = await CulturalTrendAnalysis.findOne({
        status: "processing",
      }).lean();

      if (inProgressTrend) {
        return {
          trigger: false,
          reason: "A trend analysis is already in progress",
        };
      }

      // 4. Find the most recent completed trend analysis
      const latestTrend = await CulturalTrendAnalysis.findOne({
        status: "completed",
      })
        .sort({ created_at: -1 })
        .select("created_at analyzed_at")
        .lean();

      // 5. If no trend analysis exists at all, trigger one
      if (!latestTrend) {
        return {
          trigger: true,
          reason: `No trend analysis exists yet (${completedCount} culture analyses available)`,
        };
      }

      // 6. Check cooldown — don't re-trigger too quickly
      const trendCreatedAt = latestTrend.created_at || latestTrend.analyzed_at;
      if (trendCreatedAt) {
        const timeSinceLastTrend = Date.now() - new Date(trendCreatedAt).getTime();
        if (timeSinceLastTrend < TREND_COOLDOWN_MS) {
          return {
            trigger: false,
            reason: `Cooldown active (${Math.round((TREND_COOLDOWN_MS - timeSinceLastTrend) / 1000)}s remaining)`,
          };
        }
      }

      // 7. Compare: was the newest culture analysis completed AFTER the latest trend analysis?
      const newestAnalyzedAt = new Date(newestCultureAnalysis.analyzed_at).getTime();
      const trendTimestamp = new Date(trendCreatedAt).getTime();

      if (newestAnalyzedAt > trendTimestamp) {
        return {
          trigger: true,
          reason: `New culture analysis found (${newestCultureAnalysis.meeting_id}, analyzed at ${newestCultureAnalysis.analyzed_at.toISOString()}) after last trend (${new Date(trendCreatedAt).toISOString()})`,
        };
      }

      return {
        trigger: false,
        reason: "Trend analysis is up to date",
      };
    } catch (error) {
      console.error(
        "[TrendAnalysisWatcher] Error checking trigger conditions:",
        error.message,
      );
      return { trigger: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Run the actual trend analysis
   */
  async runTrendAnalysis() {
    try {
      console.log(
        `[TrendAnalysisWatcher] Starting trend analysis for the last ${TREND_WINDOW_DAYS} days...`,
      );

      const result = await analyzeCulturalTrends(TREND_WINDOW_DAYS);

      if (result && result.status === "completed") {
        this.stats.totalTriggered++;
        this.stats.lastTriggeredAt = new Date();
        console.log(
          `[TrendAnalysisWatcher] ✓ Trend analysis completed (${result.analysis_window?.meeting_count || 0} meetings analyzed)`,
        );
      } else {
        this.stats.totalFailed++;
        console.warn(
          `[TrendAnalysisWatcher] ✗ Trend analysis did not complete (status: ${result?.status})`,
        );
      }
    } catch (error) {
      this.stats.totalFailed++;
      this.stats.lastError = {
        message: error.message,
        at: new Date(),
      };
      console.error(
        `[TrendAnalysisWatcher] ✗ Failed to run trend analysis:`,
        error.message,
      );
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
      trendWindowDays: TREND_WINDOW_DAYS,
      minAnalysesForTrend: MIN_ANALYSES_FOR_TREND,
      cooldownMs: TREND_COOLDOWN_MS,
      stats: { ...this.stats },
    };
  }
}

// Export singleton
module.exports = new TrendAnalysisWatcher();
