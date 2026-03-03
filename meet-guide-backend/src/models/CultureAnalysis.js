/**
 * CultureAnalysis Model - Stores meeting culture analysis results from LLM
 */
const mongoose = require("mongoose");

const cultureAnalysisSchema = new mongoose.Schema(
  {
    // Reference to meeting
    meeting_id: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    meeting_title: {
      type: String,
      default: "",
    },
    meeting_created_at: {
      type: Date,
      default: null,
    },
    // Processing status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    // Snapshot of the transcript used for analysis (plain text)
    transcript_plain_text: {
      type: String,
      default: "",
    },
    // System prompt metadata
    system_prompt_version: {
      type: String,
      default: "v2.1.0",
    },
    system_prompt_path: {
      type: String,
      default:
        "meet-guide-components/cultural-analysis-system/prompts/system/system-prompt-v2.1.0.md",
    },
    // Model metadata
    model_id: {
      type: String,
      default: "kimi-k2-thinking",
    },
    analyzed_at: {
      type: Date,
      default: null,
    },
    processing_time_ms: {
      type: Number,
      default: 0,
    },
    // Parsed JSON analysis from LLM (follows system prompt schema)
    analysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Raw text response (for debugging / traceability)
    raw_response: {
      type: String,
      default: "",
    },
    // Error details if failed
    error_message: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

cultureAnalysisSchema.index({ analyzed_at: -1 });

module.exports = mongoose.model("CultureAnalysis", cultureAnalysisSchema);

