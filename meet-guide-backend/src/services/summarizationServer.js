/**
 * Summarization Server Manager
 * Starts and manages the FastAPI server for meeting summarization
 */
const { spawn } = require("child_process");
const path = require("path");

const SUMMARIZATION_PATH = path.resolve(
  __dirname,
  "../../../meet-guide-components/meeting-summarization-system",
);
// Derive port from SUMMARIZATION_API_URL env var to stay in sync with summarizationService.js
const SUMMARIZATION_PORT = (() => {
  try {
    return parseInt(new URL(process.env.SUMMARIZATION_API_URL || "http://127.0.0.1:8001").port) || 8001;
  } catch {
    return 8001;
  }
})();
const SUMMARIZATION_URL = `http://localhost:${SUMMARIZATION_PORT}`;

let serverProcess = null;
let serverReady = false;

/**
 * Start the FastAPI summarization server
 */
function start() {
  if (serverProcess) {
    console.log("[SummarizationServer] Already running");
    return;
  }

  console.log("[SummarizationServer] Starting FastAPI server...");
  console.log(`[SummarizationServer] Path: ${SUMMARIZATION_PATH}`);
  console.log(`[SummarizationServer] Port: ${SUMMARIZATION_PORT}`);

  // Use venv python if available, otherwise fall back to system python
  const venvPython = path.join(SUMMARIZATION_PATH, "venv", "bin", "python3");
  const fs = require("fs");
  const pythonCmd = (() => {
    if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
    if (process.platform !== "win32" && fs.existsSync(venvPython)) return venvPython;
    return process.platform === "win32" ? "python" : "python3";
  })();

  // Start uvicorn server
  const args = [
    "-m",
    "uvicorn",
    "web_server:app",
    "--host",
    "0.0.0.0",
    "--port",
    String(SUMMARIZATION_PORT),
  ];

  serverProcess = spawn(pythonCmd, args, {
    cwd: SUMMARIZATION_PATH,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startupOutput = "";

  serverProcess.stdout.on("data", (data) => {
    const text = data.toString();
    startupOutput += text;

    // Check if server has started
    if (
      text.includes("Uvicorn running") ||
      text.includes("Application startup complete")
    ) {
      console.log(
        "✅ [SummarizationServer] FastAPI server started successfully",
      );
      serverReady = true;
    }

    // Log important messages
    if (
      text.includes("Loading") ||
      text.includes("Loaded") ||
      text.includes("ERROR") ||
      text.includes("WARNING")
    ) {
      console.log("[SummarizationServer]", text.trim());
    }
  });

  serverProcess.stderr.on("data", (data) => {
    const text = data.toString();
    // Log all stderr output so startup and errors are visible
    console.log("[SummarizationServer STDERR]", text.trim());

    if (
      text.includes("Uvicorn running") ||
      text.includes("Application startup complete")
    ) {
      console.log("✅ [SummarizationServer] FastAPI server started successfully");
      serverReady = true;
    }
  });

  serverProcess.on("error", (error) => {
    console.error("[SummarizationServer] Failed to start:", error.message);
    serverProcess = null;
    serverReady = false;
  });

  serverProcess.on("close", (code) => {
    console.log(`[SummarizationServer] Process exited with code ${code}`);
    serverProcess = null;
    serverReady = false;

    // Auto-restart if it crashed unexpectedly
    if (code !== 0 && code !== null) {
      console.log(
        "[SummarizationServer] Attempting to restart in 5 seconds...",
      );
      setTimeout(() => {
        start();
      }, 5000);
    }
  });

  // Wait and check if server is responsive
  setTimeout(async () => {
    await checkHealth();
  }, 8000); // Give it 8 seconds to start and load models
}

/**
 * Check if the server is healthy
 */
async function checkHealth() {
  try {
    const response = await fetch(`${SUMMARIZATION_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ [SummarizationServer] Health check passed:", data);
      serverReady = true;
    }
  } catch (error) {
    console.warn("[SummarizationServer] Health check failed:", error.message);
    serverReady = false;
  }
}

/**
 * Stop the FastAPI server
 */
function stop() {
  if (serverProcess) {
    console.log("[SummarizationServer] Stopping FastAPI server...");
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    serverReady = false;
  }
}

/**
 * Check if server is ready
 */
function isReady() {
  return serverReady;
}

/**
 * Get the server URL
 */
function getUrl() {
  return SUMMARIZATION_URL;
}

// Cleanup on process exit
process.on("exit", () => {
  stop();
});

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

module.exports = {
  start,
  stop,
  isReady,
  getUrl,
  checkHealth,
};
