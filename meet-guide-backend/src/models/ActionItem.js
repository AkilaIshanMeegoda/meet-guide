/**
 * ActionItem Model - For meeting action items extracted from transcripts
 */
const mongoose = require("mongoose");

const actionItemSchema = new mongoose.Schema(
  {
    // Meeting reference
    meeting_id: {
      type: String,
      required: true,
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

    // Action item content
    task: {
      type: String,
      required: true,
      trim: true,
    },
    sentence: {
      type: String,
      default: "",
    },

    // WHO assigned the task (speaker/delegator)
    assigned_by: {
      type: String,
      required: true,
    },
    assigned_by_email: {
      type: String,
      required: true,
      index: true,
    },

    // WHO needs to do it (assignee)
    assignee: {
      type: String,
      required: true,
    },
    assignee_email: {
      type: String,
      required: true,
      index: true,
    },
    // Support for team/all assignees - array of email addresses
    assignee_emails: {
      type: [String],
      default: function() {
        return [this.assignee_email];
      },
      index: true,
    },

    // When & priority
    deadline: {
      type: String,
      default: null,
    },
    deadline_date: {
      type: Date,
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },

    // Status tracking
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "blocked"],
      default: "pending",
      index: true,
    },
    completed_at: {
      type: Date,
      default: null,
    },

    // Additional context
    topic_label: {
      type: String,
      default: "",
    },
    start_time: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// Compound indexes for common queries
actionItemSchema.index({ assignee_email: 1, status: 1 });
actionItemSchema.index({ meeting_id: 1, status: 1 });
actionItemSchema.index({ deadline_date: 1, status: 1 });

// Virtual for checking if overdue
actionItemSchema.virtual("is_overdue").get(function () {
  if (!this.deadline_date || this.status === "completed") {
    return false;
  }
  return new Date() > this.deadline_date;
});

// Method to mark as completed
actionItemSchema.methods.markCompleted = function () {
  this.status = "completed";
  this.completed_at = new Date();
  return this.save();
};

module.exports = mongoose.model("ActionItem", actionItemSchema);
