/**
 * MeetGuide Backend - Main Entry Point
 */
const path = require("path");
const fs = require("fs");

// Load .env file (prefer .env, fallback to .env.example)
const envPath = path.join(__dirname, "../.env");
const envExamplePath = path.join(__dirname, "../.env.example");

if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
  console.log("📄 Loaded environment from .env");
} else if (fs.existsSync(envExamplePath)) {
  require("dotenv").config({ path: envExamplePath });
  console.log("📄 Loaded environment from .env.example (create .env for production)");
} else {
  console.warn("⚠️ No .env or .env.example file found");
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/database");
const { createInitialUsers } = require("./services/userService");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const meetingRoutes = require("./routes/meetings");
const pronunciationRoutes = require("./routes/pronunciation");
const dashboardRoutes = require("./routes/dashboard");
const processingRoutes = require("./routes/processing");
const hybridDetectionRoutes = require("./routes/hybridDetection");
const summarizationRoutes = require("./routes/summarization");
const cultureAnalysisRoutes = require("./routes/cultureAnalysis");

const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
    : [
        "http://localhost:3000",
        "http://localhost:4001",
        "http://localhost:3010",
        "https://localhost:3010",
      ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Static files for pronunciation data
const mispronunciationPath = path.resolve(
  __dirname,
  "../../meet-guide-components/mispronunciation-detection-system",
);
app.use("/pronunciation-data", express.static(mispronunciationPath));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/pronunciation", pronunciationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/processing", processingRoutes);
app.use("/api/hybrid-detection", hybridDetectionRoutes);
app.use("/api/summarization", summarizationRoutes);
app.use("/api/culture-analysis", cultureAnalysisRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "MeetGuide API",
    version: "1.0.0",
    status: "running",
    docs: "/docs",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      meetings: "/api/meetings",
      pronunciation: "/api/pronunciation",
      dashboard: "/api/dashboard",
      processing: "/api/processing",
      hybridDetection: "/api/hybrid-detection",
    },
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Create initial test users
    await createInitialUsers();

    // Start summarization FastAPI server
    const summarizationServer = require("./services/summarizationServer");
    summarizationServer.start();
    console.log("🚀 Summarization server starting...");

    // Wait for summarization server to be ready
    const { waitForSummarizationServer } = require("./services/summarizationService");
    const isReady = await waitForSummarizationServer(100, 1000, 5000);
    
    if (!isReady) {
      console.warn("⚠️ Summarization server not ready, but continuing startup...");
    }

    // Start recording watcher for automatic pronunciation processing
    const recordingWatcher = require("./services/recordingWatcher");
    recordingWatcher.start();
    console.log("👁️ Recording watcher started");

    // Start listening
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ MeetGuide Backend running on http://0.0.0.0:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
