/**
 * MeetingSummarization Model - Stores complete NLP analysis results
 */
const mongoose = require("mongoose");

// Intent result schema for individual utterances
const intentResultSchema = new mongoose.Schema({
  speaker: { type: String, required: true },
  sentence: { type: String, required: true },
  intent: { type: String, required: true },
  text: { type: String },
  task: { type: String },
  assignee: { type: String },
  deadline: { type: String },
  priority: { type: String },
  topic: { type: String },
  start_time: { type: Number, default: 0 },
  status: { type: String, default: "pending" }, // For action items
  updated_at: { type: Date, default: Date.now },
});

// Topic schema
const topicSchema = new mongoose.Schema(
  {
    topic_id: { type: Number, required: true },
    label: { type: String, required: true },
    utterances: [
      {
        speaker: String,
        sentence: String,
        intent: String,
      },
    ],
    start_index: { type: Number },
    end_index: { type: Number },
  },
  { _id: false },
);

// Intent counts schema
const intentCountsSchema = new mongoose.Schema(
  {
    "action-item": { type: Number, default: 0 },
    question: { type: Number, default: 0 },
    decision: { type: Number, default: 0 },
    information: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  { _id: false },
);

const meetingSummarizationSchema = new mongoose.Schema(
  {
    // Meeting reference
    meeting_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    meeting_title: {
      type: String,
      required: true,
    },
    meeting_date: {
      type: Date,
      required: true,
    },

    // Complete analysis results
    results: [intentResultSchema],

    // Topics extracted
    topics: [topicSchema],

    // Intent distribution
    intent_counts: {
      type: intentCountsSchema,
      default: {},
    },

    // Summary statistics
    total_utterances: {
      type: Number,
      default: 0,
    },
    action_item_count: {
      type: Number,
      default: 0,
    },
    question_count: {
      type: Number,
      default: 0,
    },
    decision_count: {
      type: Number,
      default: 0,
    },

    // Processing metadata
    analyzed_at: {
      type: Date,
      default: Date.now,
    },
    processing_time_ms: {
      type: Number,
      default: 0,
    },
    model_version: {
      type: String,
      default: "1.0.0",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// Index for queries
meetingSummarizationSchema.index({ analyzed_at: -1 });
meetingSummarizationSchema.index({ meeting_date: -1 });

// Method to get action items only
meetingSummarizationSchema.methods.getActionItems = function () {
  return this.results.filter((r) => r.intent === "action-item");
};

// Method to get questions only
meetingSummarizationSchema.methods.getQuestions = function () {
  return this.results.filter((r) => r.intent === "question");
};

// Method to get decisions only
meetingSummarizationSchema.methods.getDecisions = function () {
  return this.results.filter((r) => r.intent === "decision");
};

// Method to get summary stats
meetingSummarizationSchema.methods.getSummaryStats = function () {
  return {
    meeting_id: this.meeting_id,
    meeting_title: this.meeting_title,
    meeting_date: this.meeting_date,
    total_utterances: this.total_utterances,
    action_item_count: this.action_item_count,
    question_count: this.question_count,
    decision_count: this.decision_count,
    topic_count: this.topics.length,
    analyzed_at: this.analyzed_at,
    intent_counts: this.intent_counts,
  };
};

module.exports = mongoose.model(
  "MeetingSummarization",
  meetingSummarizationSchema,
);
