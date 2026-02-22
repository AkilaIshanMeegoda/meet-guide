// Service to communicate with Python meeting summarization microservice

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const Meeting = require("../models/Meeting");
const ActionItem = require("../models/ActionItem");
const MeetingSummarization = require("../models/MeetingSummarization");

const SUMMARIZATION_API_URL =
  process.env.SUMMARIZATION_API_URL || "http://127.0.0.1:8001";

// Path to the summarization system Python scripts
const PYTHON_SCRIPTS_PATH = path.resolve(
  __dirname,
  "../../../meet-guide-components/meeting-summarization-system",
);

// Track ongoing processing jobs
const processingJobs = new Map();

/**
 * Convert MongoDB transcript to format expected by Python service
 * @param {Object} meeting - Meeting document from MongoDB
 * @returns {string} Formatted transcript string
 */
function formatTranscriptForAnalysis(meeting) {
  if (!meeting.transcript || !meeting.transcript.utterances) {
    throw new Error("Meeting has no transcript data");
  }

  // Format: "Speaker: text\nSpeaker: text"
  return meeting.transcript.utterances
    .map((u) => `${u.speaker}: ${u.text}`)
    .join("\n");
}

/**
 * Analyze meeting transcript using Python NLP pipeline
 * @param {string} transcript - Raw transcript text (format: "Speaker: text\nSpeaker: text")
 * @returns {Promise<Object>} Analysis results with topics, action items, and intent counts
 */
async function analyzeTranscript(transcript) {
  try {
    const response = await fetch(`${SUMMARIZATION_API_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      // Try to get error details from response
      const contentType = response.headers.get("content-type");
      let errorMessage = `Summarization service error (${response.status})`;

      if (contentType && contentType.includes("application/json")) {
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          // Failed to parse JSON, use default message
        }
      } else {
        // HTML or text error response
        const text = await response.text();
        errorMessage = `Python service error: ${text.substring(0, 200)}`;
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling summarization service:", error);
    throw new Error(`Failed to analyze transcript: ${error.message}`);
  }
}

/**
 * Analyze meeting by ID - fetches from MongoDB and processes
 * @param {string} meetingId - Meeting ID to analyze
 * @param {Object} participantEmails - Map of speaker names to emails
 * @returns {Promise<Object>} Analysis results with saved action items and summarization
 */
async function analyzeMeetingById(meetingId, participantEmails = {}) {
  const startTime = Date.now();

  // Fetch meeting from MongoDB
  const meeting = await Meeting.findOne({ meeting_id: meetingId });

  if (!meeting) {
    throw new Error(`Meeting not found: ${meetingId}`);
  }

  if (
    !meeting.transcript ||
    !meeting.transcript.utterances ||
    meeting.transcript.utterances.length === 0
  ) {
    throw new Error(`Meeting ${meetingId} has no transcript to analyze`);
  }

  // Format transcript for Python service
  const transcriptText = formatTranscriptForAnalysis(meeting);

  // Call Python service for analysis
  const analysis = await analyzeTranscript(transcriptText);

  const processingTime = Date.now() - startTime;

  // Save complete summarization to MongoDB
  const summarization = await saveMeetingSummarization(
    meeting,
    analysis,
    processingTime,
  );

  // Create topic lookup map for action items
  const topicLabelMap = {};
  (analysis.topics || []).forEach((topic) => {
    topicLabelMap[topic.topic_id] = topic.topic_label;
  });

  // Save individual action items to MongoDB
  const savedActionItems = await saveActionItems(
    meeting,
    analysis.actionItems || [],
    participantEmails,
    topicLabelMap,
  );

  return {
    meeting_id: meetingId,
    meeting_title: meeting.title,
    meeting_date: meeting.actual_start || meeting.created_at,
    analysis: {
      results: analysis.results,
      intentCounts: analysis.intentCounts,
      topics: analysis.topics,
    },
    actionItems: savedActionItems,
    actionItemCount: savedActionItems.length,
    summarization_id: summarization._id,
    processing_time_ms: processingTime,
  };
}

/**
 * Save complete meeting summarization to MongoDB
 * @param {Object} meeting - Meeting document
 * @param {Object} analysis - Complete analysis from Python service
 * @param {Number} processingTime - Processing time in milliseconds
 * @returns {Promise<Object>} Saved summarization document
 */
async function saveMeetingSummarization(meeting, analysis, processingTime) {
  // Calculate counts from analysis
  const intentCounts = analysis.intentCounts || {};

  // Create topic lookup map: topic_id -> topic_label
  const topicLabelMap = {};
  (analysis.topics || []).forEach((topic) => {
    topicLabelMap[topic.topic_id] = topic.topic_label;
  });

  // Transform Python results to MongoDB format
  const transformedResults = (analysis.results || []).map((result) => {
    const details = result.details || {};
    const topicLabel = topicLabelMap[result.topic_id] || null;

    return {
      speaker: result.speaker,
      sentence: result.sentence,
      intent: result.intent,
      text: result.sentence,
      task: details.what || null,
      assignee: details.who || null,
      deadline: details.when || null,
      priority: result.priority || null,
      topic: topicLabel,
      start_time: result.start_time || 0,
    };
  });

  // Transform Python topics to MongoDB format
  const transformedTopics = (analysis.topics || []).map((topic) => ({
    topic_id: topic.topic_id,
    label: topic.topic_label,
    utterances: (topic.items || []).map((item) => ({
      speaker: item.speaker,
      sentence: item.sentence,
      intent: item.intent,
    })),
    start_index: topic.start_index || 0,
    end_index: topic.end_index || 0,
  }));

  const summarizationData = {
    meeting_id: meeting.meeting_id,
    meeting_title: meeting.title,
    meeting_date: meeting.actual_start || meeting.created_at,
    results: transformedResults,
    topics: transformedTopics,
    intent_counts: intentCounts,
    total_utterances: transformedResults.length,
    action_item_count: intentCounts["action-item"] || 0,
    question_count: intentCounts["question"] || 0,
    decision_count: intentCounts["decision"] || 0,
    analyzed_at: new Date(),
    processing_time_ms: processingTime,
    model_version: "1.0.0",
  };

  // Upsert: update if exists, create if not
  const summarization = await MeetingSummarization.findOneAndUpdate(
    { meeting_id: meeting.meeting_id },
    summarizationData,
    { new: true, upsert: true },
  );

  return summarization;
}

/**
 * Save action items to MongoDB
 * @param {Object} meeting - Meeting document
 * @param {Array} actionItems - Action items from analysis
 * @param {Object} participantEmails - Map of speaker names to emails
 * @param {Object} topicLabelMap - Map of topic_id to topic_label
 * @returns {Promise<Array>} Saved action items
 */
async function saveActionItems(
  meeting,
  actionItems,
  participantEmails,
  topicLabelMap = {},
) {
  const saved = [];

  for (const item of actionItems) {
    const speaker = item.speaker || "Unknown";

    // Extract details from Python response structure
    const details = item.details || {};
    const assignee = details.who || speaker; // Python returns 'who'
    const task = details.what || item.sentence; // Python returns 'what'
    const deadline = details.when || null; // Python returns 'when'

    // Get topic label from topic_id
    const topicLabel = topicLabelMap[item.topic_id] || "";

    const speakerEmail =
      participantEmails[speaker] ||
      `${speaker.toLowerCase().replace(/\s+/g, ".")}@gmail.com`;
    const assigneeEmail = participantEmails[assignee] || speakerEmail;

    // Map priority values to schema enum
    const priorityMap = {
      unscheduled: "low",
      high: "high",
      medium: "medium",
      low: "low",
    };
    const validPriority = priorityMap[item.priority] || "medium";

    try {
      const actionItem = new ActionItem({
        meeting_id: meeting.meeting_id,
        meeting_title: meeting.title,
        meeting_date: meeting.actual_start || meeting.created_at,
        task: task,
        sentence: item.sentence,
        assigned_by: speaker,
        assigned_by_email: speakerEmail,
        assignee: assignee,
        assignee_email: assigneeEmail,
        deadline: deadline,
        deadline_date: deadline ? parsePythonDeadline(deadline) : null,
        priority: validPriority,
        status: item.status || "pending",
        topic_label: topicLabel,
        start_time: item.start_time || 0,
      });

      const savedItem = await actionItem.save();
      saved.push(savedItem);
    } catch (error) {
      console.error("Error saving action item:", error);
    }
  }

  return saved;
}

/**
 * Parse deadline string from Python service to Date object
 * Python returns formats like: "2026-02-17", "ASAP (2026-02-10 17:00)", "soon (2026-02-11 17:00)"
 */
function parsePythonDeadline(deadlineStr) {
  if (!deadlineStr) return null;

  try {
    // Extract date from formats like "ASAP (2026-02-10 17:00)" or "soon (2026-02-11 17:00)"
    const dateMatch = deadlineStr.match(
      /\((\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)\)/,
    );
    if (dateMatch) {
      return new Date(dateMatch[1]);
    }

    // Direct date format "2026-02-17"
    return new Date(deadlineStr);
  } catch (error) {
    console.error("Error parsing deadline:", deadlineStr, error);
    return null;
  }
}

/**
 * Check if summarization service is available
 * @returns {Promise<boolean>} True if service is reachable
 */
async function checkServiceHealth() {
  try {
    const response = await fetch(`${SUMMARIZATION_API_URL}/api/sample`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.error("[SummarizationServer] Health check failed:", error.message);
    return false;
  }
}

/**
 * Wait for summarization server to be ready
 * @param {number} maxRetries - Maximum number of retries (default: 30)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<boolean>} True if server is ready, false if timeout
 */
async function waitForSummarizationServer(maxRetries = 30, retryDelay = 1000) {
  console.log("[SummarizationServer] Waiting for service to be ready...");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isHealthy = await checkServiceHealth();

    if (isHealthy) {
      console.log(
        `[SummarizationServer] ✅ Service is ready (attempt ${attempt}/${maxRetries})`,
      );
      return true;
    }

    if (attempt < maxRetries) {
      console.log(
        `[SummarizationServer] Waiting... (attempt ${attempt}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  console.error(
    `[SummarizationServer] ❌ Service failed to start after ${maxRetries} attempts`,
  );
  return false;
}

/**
 * Check if the Python scripts directory exists
 */
async function checkScriptsExist() {
  try {
    await fs.access(PYTHON_SCRIPTS_PATH);
    await fs.access(
      path.join(PYTHON_SCRIPTS_PATH, "process_meeting_summarization.py"),
    );
    await fs.access(path.join(PYTHON_SCRIPTS_PATH, "pipeline.py"));
    return true;
  } catch (error) {
    console.error("Summarization scripts not found:", error.message);
    return false;
  }
}

/**
 * Run process_meeting_summarization via FastAPI for a specific meeting
 * This is used for automated processing after meetings end
 * Uses persistent FastAPI server to keep ML models in memory (much faster)
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
async function processMeetingSummarization(meetingId) {
  // Check if already processing
  if (processingJobs.has(meetingId)) {
    return {
      success: false,
      error: "Summarization already in progress for this meeting",
      status: "in_progress",
    };
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Starting summarization for: ${meetingId}`);
  console.log(
    `Using FastAPI endpoint: ${SUMMARIZATION_API_URL}/api/process-meeting`,
  );
  console.log(`${"=".repeat(60)}\n`);

  // Track the job
  const startTime = Date.now();
  processingJobs.set(meetingId, {
    startTime: new Date(),
    status: "running",
  });

  try {
    const response = await fetch(
      `${SUMMARIZATION_API_URL}/api/process-meeting`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meeting_id: meetingId }),
      },
    );

    processingJobs.delete(meetingId);

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `Summarization service error (${response.status})`;

      if (contentType && contentType.includes("application/json")) {
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          // Failed to parse JSON, use default message
        }
      } else {
        const text = await response.text();
        errorMessage = `Python service error: ${text.substring(0, 200)}`;
      }

      console.error(`\nSummarization failed for ${meetingId}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        meetingId: meetingId,
      };
    }

    const result = await response.json();
    const elapsed = Date.now() - startTime;

    console.log(`\n✅ Summarization complete for ${meetingId} in ${elapsed}ms`);
    console.log(`   Action items: ${result.summary?.actionItems || 0}`);
    console.log(`   Topics: ${result.summary?.topics || 0}`);
    console.log(`   Total results: ${result.summary?.totalResults || 0}`);

    // Save results to MongoDB (MeetingSummarization and ActionItem collections)
    if (result.analysis) {
      try {
        // Fetch meeting document
        const meeting = await Meeting.findOne({ meeting_id: meetingId });

        if (meeting) {
          // Save summarization to MeetingSummarization collection
          await saveMeetingSummarization(
            meeting,
            result.analysis,
            result.processingTime,
          );
          console.log(`   ✓ Saved to MeetingSummarization collection`);

          // Save action items to ActionItem collection
          const topicLabelMap = {};
          (result.analysis.topics || []).forEach((topic) => {
            topicLabelMap[topic.topic_id] = topic.topic_label;
          });

          const savedActionItems = await saveActionItems(
            meeting,
            result.analysis.actionItems || [],
            {},
            topicLabelMap,
          );
          console.log(`   ✓ Saved ${savedActionItems.length} action items`);
        }
      } catch (saveError) {
        console.error(
          `   ⚠️  Warning: Failed to save to database:`,
          saveError.message,
        );
        // Don't fail the whole operation if saving fails
      }
    }

    return {
      success: true,
      output: JSON.stringify(result, null, 2),
      meetingId: meetingId,
      processingTime: elapsed,
      summary: result.summary,
      analysis: result.analysis,
    };
  } catch (error) {
    processingJobs.delete(meetingId);
    console.error(`\nFailed to process summarization for ${meetingId}:`, error);
    return {
      success: false,
      error: `Failed to communicate with summarization service: ${error.message}`,
      meetingId: meetingId,
    };
  }
}

module.exports = {
  analyzeTranscript,
  analyzeMeetingById,
  saveActionItems,
  saveMeetingSummarization,
  checkServiceHealth,
  waitForSummarizationServer,
  processMeetingSummarization,
};
