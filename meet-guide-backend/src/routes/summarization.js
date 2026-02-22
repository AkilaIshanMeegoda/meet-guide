const express = require("express");
const router = express.Router();
const { protect, requireManagement } = require("../middleware/auth");
const {
  analyzeTranscript,
  analyzeMeetingById,
  checkServiceHealth,
} = require("../services/summarizationService");
const ActionItem = require("../models/ActionItem");
const MeetingSummarization = require("../models/MeetingSummarization");

// Health check for summarization service
router.get("/health", async (req, res) => {
  try {
    const isHealthy = await checkServiceHealth();
    res.json({
      status: isHealthy ? "healthy" : "unavailable",
      service: "meeting-summarization",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: error.message,
    });
  }
});

// Check if meeting exists and has transcript (diagnostic endpoint)
router.get("/check-meeting/:meetingId", protect, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const Meeting = require("../models/Meeting");

    const meeting = await Meeting.findOne({ meeting_id: meetingId });

    if (!meeting) {
      return res.status(404).json({
        exists: false,
        message: `Meeting ${meetingId} not found in database`,
      });
    }

    const hasTranscript =
      meeting.transcript &&
      meeting.transcript.utterances &&
      meeting.transcript.utterances.length > 0;

    res.json({
      exists: true,
      meeting_id: meeting.meeting_id,
      title: meeting.title,
      status: meeting.status,
      hasTranscript,
      utteranceCount: hasTranscript ? meeting.transcript.utterances.length : 0,
      canAnalyze: hasTranscript,
    });
  } catch (error) {
    console.error("Error checking meeting:", error);
    res.status(500).json({
      error: "Failed to check meeting",
      message: error.message,
    });
  }
});

// Analyze meeting by ID from MongoDB
router.post(
  "/analyze-meeting/:meetingId",
  protect,
  requireManagement,
  async (req, res) => {
    try {
      const { meetingId } = req.params;
      const { participant_emails } = req.body; // Optional: { "Speaker Name": "email@gmail.com" }

      const result = await analyzeMeetingById(
        meetingId,
        participant_emails || {},
      );
      res.json(result);
    } catch (error) {
      console.error("Meeting analysis error:", error);
      res.status(500).json({
        error: "Analysis failed",
        message: error.message,
      });
    }
  },
);

// Get complete summarization for a meeting
router.get("/meeting/:meetingId", protect, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const summarization = await MeetingSummarization.findOne({
      meeting_id: meetingId,
    });

    if (!summarization) {
      return res.status(404).json({
        error: "Summarization not found",
        message: `No analysis found for meeting: ${meetingId}. Run /analyze-meeting first.`,
      });
    }

    res.json(summarization);
  } catch (error) {
    console.error("Error fetching summarization:", error);
    res.status(500).json({
      error: "Failed to fetch summarization",
      message: error.message,
    });
  }
});

// Get summarization summary/stats only
router.get("/meeting/:meetingId/summary", protect, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const summarization = await MeetingSummarization.findOne({
      meeting_id: meetingId,
    });

    if (!summarization) {
      return res.status(404).json({
        error: "Summarization not found",
        message: `No analysis found for meeting: ${meetingId}`,
      });
    }

    res.json(summarization.getSummaryStats());
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      error: "Failed to fetch summary",
      message: error.message,
    });
  }
});

// Get topics for a meeting
router.get("/meeting/:meetingId/topics", protect, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const summarization = await MeetingSummarization.findOne({
      meeting_id: meetingId,
    });

    if (!summarization) {
      return res.status(404).json({
        error: "Summarization not found",
        message: `No analysis found for meeting: ${meetingId}`,
      });
    }

    res.json({
      meeting_id: meetingId,
      topic_count: summarization.topics.length,
      topics: summarization.topics,
    });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({
      error: "Failed to fetch topics",
      message: error.message,
    });
  }
});

// Get all results with specific intent
router.get(
  "/meeting/:meetingId/intents/:intentType",
  protect,
  async (req, res) => {
    try {
      const { meetingId, intentType } = req.params;
      const summarization = await MeetingSummarization.findOne({
        meeting_id: meetingId,
      });

      if (!summarization) {
        return res.status(404).json({
          error: "Summarization not found",
          message: `No analysis found for meeting: ${meetingId}`,
        });
      }

      let results;
      switch (intentType) {
        case "action-item":
        case "action-items":
          results = summarization.getActionItems();
          break;
        case "question":
        case "questions":
          results = summarization.getQuestions();
          break;
        case "decision":
        case "decisions":
          results = summarization.getDecisions();
          break;
        default:
          results = summarization.results.filter(
            (r) => r.intent === intentType,
          );
      }

      res.json({
        meeting_id: meetingId,
        intent_type: intentType,
        count: results.length,
        results,
      });
    } catch (error) {
      console.error("Error fetching intent results:", error);
      res.status(500).json({
        error: "Failed to fetch results",
        message: error.message,
      });
    }
  },
);

// Get action items for a meeting
router.get("/action-items/meeting/:meetingId", protect, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const actionItems = await ActionItem.find({ meeting_id: meetingId }).sort({
      deadline_date: 1,
    });
    res.json({
      success: true,
      message: "Action items retrieved successfully",
      data: {
        meeting_id: meetingId,
        count: actionItems.length,
        action_items: actionItems,
      },
    });
  } catch (error) {
    console.error("Error fetching action items:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
});

// Get action items for a user
router.get("/action-items/user/:email", protect, async (req, res) => {
  try {
    const { email } = req.params;
    const { status } = req.query; // Optional filter: ?status=pending

    // Security: Users can only view their own action items unless they're management
    if (req.user.email !== email && req.user.role !== "management") {
      return res.status(403).json({
        success: false,
        message: "You can only view your own action items",
        data: null,
      });
    }

    // Query for email in assignee_emails array (supports team/all assignees)
    const query = { assignee_emails: email };
    if (status) {
      query.status = status;
    }

    const actionItems = await ActionItem.find(query).sort({
      deadline_date: 1,
      priority: -1,
    });

    res.json({
      success: true,
      message: "User action items retrieved successfully",
      data: {
        user_email: email,
        status: status || "all",
        count: actionItems.length,
        action_items: actionItems,
      },
    });
  } catch (error) {
    console.error("Error fetching user action items:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
});

// Update action item status
router.patch("/action-items/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    // First, find the action item to verify ownership
    const actionItem = await ActionItem.findById(id);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        message: "Action item not found",
        data: null,
      });
    }

    // Security: Users can only update their own action items unless they're management
    if (
      !actionItem.assignee_emails.includes(req.user.email) &&
      req.user.role !== "management"
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update action items assigned to you",
        data: null,
      });
    }

    const updates = {};
    if (status) {
      updates.status = status;
      if (status === "completed") {
        updates.completed_at = new Date();
      }
    }
    if (priority) {
      updates.priority = priority;
    }
    updates.updated_at = new Date();

    const updatedActionItem = await ActionItem.findByIdAndUpdate(id, updates, {
      new: true,
    });

    res.json({
      success: true,
      message: "Action item updated successfully",
      data: updatedActionItem,
    });
  } catch (error) {
    console.error("Error updating action item:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
});

// Analyze raw transcript (for testing)
router.post("/analyze", protect, requireManagement, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Transcript must be a non-empty string",
      });
    }

    const analysis = await analyzeTranscript(transcript);
    res.json(analysis);
  } catch (error) {
    console.error("Transcript analysis error:", error);
    res.status(500).json({
      error: "Analysis failed",
      message: error.message,
    });
  }
});

module.exports = router;
