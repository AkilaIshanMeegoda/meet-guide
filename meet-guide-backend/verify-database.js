/**
 * Database Verification Script
 * Run: node verify-database.js
 *
 * This script checks if summarization data was saved to MongoDB
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Import models
const Meeting = require("./src/models/Meeting");
const MeetingSummarization = require("./src/models/MeetingSummarization");
const ActionItem = require("./src/models/ActionItem");

async function verifyDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // 1. Check MeetingSummarization collection
    console.log("📊 === MEETING SUMMARIZATION DATA ===\n");
    const summaries = await MeetingSummarization.find({})
      .sort({ created_at: -1 })
      .limit(10);

    console.log(`Found ${summaries.length} summarization records:\n`);

    for (const summary of summaries) {
      console.log(`  Meeting ID: ${summary.meeting_id}`);
      console.log(`  Meeting Title: ${summary.meeting_title || "N/A"}`);
      console.log(`  Analyzed At: ${summary.analyzed_at}`);
      console.log(`  Results: ${summary.results?.length || 0} items`);
      console.log(`  Action Items: ${summary.action_items?.length || 0}`);
      console.log(`  Topics: ${summary.topics?.length || 0}`);
      console.log(
        `  Intent Counts:`,
        JSON.stringify(summary.intent_counts || {}, null, 2),
      );
      console.log(`  Processing Time: ${summary.processing_time_ms}ms`);
      console.log("  ---\n");
    }

    // 2. Check ActionItem collection
    console.log("\n📝 === ACTION ITEMS ===\n");
    const actionItems = await ActionItem.find({})
      .sort({ created_at: -1 })
      .limit(10);

    console.log(`Found ${actionItems.length} action items:\n`);

    for (const item of actionItems) {
      console.log(`  Meeting: ${item.meeting_id} (${item.meeting_title})`);
      console.log(`  Task: ${item.task}`);
      console.log(`  Assignee: ${item.assignee} (${item.assignee_email})`);
      console.log(`  Assigned By: ${item.assigned_by}`);
      console.log(`  Priority: ${item.priority}`);
      console.log(`  Status: ${item.status}`);
      console.log(`  Deadline: ${item.deadline || "None"}`);
      console.log(`  Topic: ${item.topic_label || "N/A"}`);
      console.log("  ---\n");
    }

    // 3. Summary statistics
    console.log("\n📈 === SUMMARY STATISTICS ===\n");
    const totalMeetings = await Meeting.countDocuments({});
    const totalSummaries = await MeetingSummarization.countDocuments({});
    const totalActionItems = await ActionItem.countDocuments({});

    console.log(`  Total Meetings: ${totalMeetings}`);
    console.log(`  Total Summarizations: ${totalSummaries}`);
    console.log(`  Total Action Items: ${totalActionItems}`);

    // Check which meetings have summarizations
    const meetingsWithTranscripts = await Meeting.countDocuments({
      "transcript.utterances": { $exists: true, $ne: [] },
    });
    const coverage =
      totalMeetings > 0
        ? ((totalSummaries / meetingsWithTranscripts) * 100).toFixed(1)
        : 0;
    console.log(`  Meetings with Transcripts: ${meetingsWithTranscripts}`);
    console.log(`  Summarization Coverage: ${coverage}%`);

    // 4. Action items by status
    const actionItemsByStatus = await ActionItem.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    console.log("\n  Action Items by Status:");
    for (const stat of actionItemsByStatus) {
      console.log(`    ${stat._id}: ${stat.count}`);
    }

    // 5. Action items by priority
    const actionItemsByPriority = await ActionItem.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    console.log("\n  Action Items by Priority:");
    for (const stat of actionItemsByPriority) {
      console.log(`    ${stat._id}: ${stat.count}`);
    }

    console.log("\n✅ Verification complete!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run verification
verifyDatabase();
