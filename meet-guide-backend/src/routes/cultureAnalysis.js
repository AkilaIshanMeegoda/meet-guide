/**
 * Culture Analysis Routes - Trigger LLM-based culture analysis for meetings
 */
const express = require("express");
const router = express.Router();
const { protect, requireManagement } = require("../middleware/auth");
const { analyzeMeetingCulture } = require("../services/cultureAnalysisService");
const CultureAnalysis = require("../models/CultureAnalysis");
const cultureAnalysisWatcher = require("../services/cultureAnalysisWatcher");

/**
 * POST /api/culture-analysis/internal/:meetingId
 * Internal endpoint for automated pipeline use (no auth required).
 * Called by the meeting-processor service after summarization completes.
 */
router.post("/internal/:meetingId", async (req, res) => {
  try {
    const { meetingId } = req.params;
    const force = req.query.force === "true";

    const analysis = await analyzeMeetingCulture(meetingId, { force });

    res.json({
      success: true,
      message:
        analysis.status === "completed"
          ? "Culture analysis completed successfully"
          : "Culture analysis triggered but did not complete successfully",
      data: analysis,
    });
  } catch (error) {
    console.error("Internal culture analysis error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze meeting culture",
    });
  }
});

/**
 * POST /api/culture-analysis/:meetingId
 * Trigger culture analysis for a meeting using HuggingFace LLM.
 * Optional query: ?force=true to re-run even if completed.
 * Requires management role.
 */
router.post("/:meetingId", protect, requireManagement, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const force = req.query.force === "true";

    const analysis = await analyzeMeetingCulture(meetingId, { force });

    res.json({
      success: true,
      message:
        analysis.status === "completed"
          ? "Culture analysis completed successfully"
          : "Culture analysis triggered but did not complete successfully",
      data: analysis,
    });
  } catch (error) {
    console.error("Culture analysis error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze meeting culture",
    });
  }
});

/**
 * GET /api/culture-analysis/:meetingId
 * Get existing culture analysis for a meeting.
 * Requires management role.
 */
router.get("/:meetingId", protect, requireManagement, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const analysis = await CultureAnalysis.findOne({ meeting_id: meetingId });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "No culture analysis found for this meeting",
      });
    }

    res.json({
      success: true,
      message: "Culture analysis retrieved",
      data: analysis,
    });
  } catch (error) {
    console.error("Get culture analysis error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get culture analysis",
    });
  }
});

/**
 * GET /api/culture-analysis/watcher/status
 * Get the culture analysis watcher status.
 * Requires management role.
 */
router.get("/watcher/status", protect, requireManagement, async (req, res) => {
  try {
    const status = cultureAnalysisWatcher.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error("Watcher status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get watcher status",
    });
  }
});

module.exports = router;

