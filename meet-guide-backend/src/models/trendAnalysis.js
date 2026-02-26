/**
 * Trend Analysis Routes
 *
 * Endpoints for cultural trend analysis (aggregated across meetings).
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getLatestTrendAnalysis,
} = require("../services/trendAnalysisService");

/**
 * GET /api/trend-analysis
 * Get the latest cultural trend analysis
 */
router.get("/", protect, async (req, res) => {
  try {
    const trend = await getLatestTrendAnalysis();

    if (!trend) {
      return res.json({
        success: true,
        data: null,
        message: "No trend analysis found",
      });
    }

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error("Error fetching trend analysis:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trend analysis",
    });
  }
});

/**
 * GET /api/trend-analysis/status
 * Get trend analysis watcher status
 */
router.get("/status", protect, async (req, res) => {
  try {
    const trendWatcher = require("../services/trendAnalysisWatcher");
    res.json({
      success: true,
      data: trendWatcher.getStatus(),
    });
  } catch (error) {
    console.error("Error fetching trend watcher status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch trend watcher status",
    });
  }
});

module.exports = router;
