/**
 * CulturalTrendAnalysis Model - Stores aggregated trend analysis results
 */
const mongoose = require("mongoose");

const culturalTrendAnalysisSchema = new mongoose.Schema(
  {
    // Analysis window details
    analysis_window: {
      label: {
        type: String,
        default: "Last 30 Days",
      },
      start_date: {
        type: Date,
        required: true,
      },
      end_date: {
        type: Date,
        required: true,
      },
      meeting_count: {
        type: Number,
        default: 0,
      },
    },
    // Processing status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    // Model metadata
    model_id: {
      type: String,
      default: "deepseek-ai/deepseek-v3-base", // Or appropriate model ID
    },
    prompt_version: {
      type: String,
      default: "trend-analyse-prompt-v1.0.0",
    },
    analyzed_at: {
      type: Date,
      default: null,
    },
    processing_time_ms: {
      type: Number,
      default: 0,
    },
    // The structured analysis result (matches schema in prompt)
    analysis: {
      type: mongoose.Schema.Types.Mixed, // flexible for nested JSON
      default: null,
    },
    // Raw response for debugging
    raw_response: {
      type: String,
      default: "",
    },
    error_message: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

culturalTrendAnalysisSchema.index({ created_at: -1 });

module.exports = mongoose.model(
  "CulturalTrendAnalysis",
  culturalTrendAnalysisSchema,
);
