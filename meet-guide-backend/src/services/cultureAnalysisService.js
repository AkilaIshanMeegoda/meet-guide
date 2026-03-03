/**
 * Culture Analysis Service - Uses HuggingFace LLM (kimi-k2) to analyze meeting culture
 *
 * Uses the OpenAI-compatible chat completions endpoint on HuggingFace Router API.
 */
const fs = require("fs").promises;
const path = require("path");
const Meeting = require("../models/Meeting");
const CultureAnalysis = require("../models/CultureAnalysis");

const HUGGINGFACE_API_URL =
  process.env.HUGGINGFACE_API_URL ||
  "https://router.huggingface.co/v1/chat/completions";
const HUGGINGFACE_MODEL_ID =
  process.env.HUGGINGFACE_MODEL_ID || "moonshotai/Kimi-K2-Thinking";
const HUGGINGFACE_ACCESS_TOKEN = process.env.HUGGINGFACE_ACCESS_TOKEN;

// Retry configuration
const MAX_RETRIES = 1;
const INITIAL_BACKOFF_MS = 2000;

// Path to system prompt file (relative to backend src)
const SYSTEM_PROMPT_PATH = path.resolve(
  __dirname,
  "../../../meet-guide-components/cultural-analysis-system/prompts/system/system-prompt-v2.1.0.md",
);

async function readSystemPrompt() {
  const content = await fs.readFile(SYSTEM_PROMPT_PATH, "utf-8");
  return content;
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call HuggingFace Router API using OpenAI-compatible chat completions format.
 *
 * @param {string} systemPrompt - The system prompt text
 * @param {string} userMessage  - The user message (transcript + instructions)
 * @returns {string} The assistant's response content
 */
async function callHuggingFace(systemPrompt, userMessage) {
  if (!HUGGINGFACE_ACCESS_TOKEN) {
    throw new Error(
      "HUGGINGFACE_ACCESS_TOKEN is not set in the environment variables.",
    );
  }

  const requestBody = {
    model: HUGGINGFACE_MODEL_ID,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.6,
    max_tokens: 4096,
  };

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(
          `[CultureAnalysis] Retry attempt ${attempt}/${MAX_RETRIES} after ${backoff}ms...`,
        );
        await sleep(backoff);
      }

      console.log(
        `[CultureAnalysis] Calling HuggingFace API (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
      );

      // Use AbortController for timeout (e.g. 180 seconds for deep thinking models)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      try {
        const response = await fetch(HUGGINGFACE_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const statusCode = response.status;

          // Retry on transient server errors (5xx) or rate limits (429)
          if (
            (statusCode >= 500 || statusCode === 429) &&
            attempt < MAX_RETRIES
          ) {
            lastError = new Error(
              `HuggingFace API error: ${statusCode} ${response.statusText} - ${errorText}`,
            );
            console.warn(
              `[CultureAnalysis] Transient error (${statusCode}), will retry...`,
            );
            continue;
          }

          throw new Error(
            `HuggingFace API error: ${statusCode} ${response.statusText} - ${errorText}`,
          );
        }

        const data = await response.json();

        // OpenAI chat completions format: data.choices[0].message.content
        if (
          data.choices &&
          Array.isArray(data.choices) &&
          data.choices.length > 0 &&
          data.choices[0].message &&
          data.choices[0].message.content
        ) {
          return data.choices[0].message.content;
        }

        // Fallback: some providers may return slightly different shapes
        if (data.message && data.message.content) {
          return data.message.content;
        }

        // Last resort: return stringified response for downstream parsing
        console.warn(
          "[CultureAnalysis] Unexpected response shape:",
          JSON.stringify(data).slice(0, 500),
        );
        return typeof data === "string" ? data : JSON.stringify(data);

      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error("HuggingFace API request timed out after 180 seconds");
        }
        throw fetchErr;
      }
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[CultureAnalysis] Request failed: ${err.message}. Will retry...`,
        );
        continue;
      }
      throw err;
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error("HuggingFace API call failed after retries");
}

/**
 * Try to extract a JSON object from a text blob.
 * Handles cases where the model wraps JSON in markdown code fences or includes thinking blocks.
 */
function extractJsonFromText(text) {
  if (!text) return null;

  // 1. Remove <think>...</think> blocks (including newlines)
  // These are often produced by reasoning models like Kimi-K2-Thinking
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const codeFenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeFenceMatch) {
    cleaned = codeFenceMatch[1].trim();
  }

  // 3. Find remaining JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    // If we failed to find braces in the "cleaned" text, try logically extracting from the original text 
    // just in case our cleaning was too aggressive or the format is weird.
    // However, usually if we can't find it in cleaned, it's not there or it's malformed.
    return null;
  }

  const candidate = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Extract best-available transcript text from meeting document
 */
function getTranscriptText(meeting) {
  const transcript = meeting.transcript || {};
  const plain =
    typeof transcript.plain_text === "string"
      ? transcript.plain_text.trim()
      : "";
  if (plain) return plain;

  const formatted =
    typeof transcript.formatted_transcript === "string"
      ? transcript.formatted_transcript.trim()
      : "";
  if (formatted) return formatted;

  if (
    Array.isArray(transcript.utterances) &&
    transcript.utterances.length > 0
  ) {
    const joined = transcript.utterances
      .map((u) => {
        if (!u || typeof u.text !== "string") return null;
        const speaker = typeof u.speaker === "string" ? u.speaker : "";
        return speaker ? `${speaker}: ${u.text}` : u.text;
      })
      .filter(Boolean)
      .join("\n\n");
    return joined.trim();
  }

  return "";
}

/**
 * Analyze meeting culture for a given meeting_id
 */
async function analyzeMeetingCulture(meetingId, options = {}) {
  const { force = false } = options;

  // Find meeting and ensure transcript exists
  const meeting = await Meeting.findOne({ meeting_id: meetingId });
  if (!meeting) {
    throw new Error(`Meeting with meeting_id '${meetingId}' not found`);
  }

  const transcriptText = getTranscriptText(meeting);
  if (!transcriptText) {
    throw new Error(
      `Meeting transcript is missing or empty for '${meetingId}'. Culture analysis requires a transcript.`,
    );
  }

  // Check for existing analysis
  let analysisDoc = await CultureAnalysis.findOne({ meeting_id: meetingId });
  if (analysisDoc && !force && analysisDoc.status === "completed") {
    return analysisDoc;
  }

  const systemPrompt = await readSystemPrompt();

  const userMessage = `Below is the transcript of a single meeting. Use it as the evidence source for your analysis.

MEETING TRANSCRIPT (PLAIN TEXT):
${transcriptText}

Remember: You must respond with a single valid JSON object following the required schema, with no extra text.`;

  const startedAt = Date.now();

  // Create or update analysis doc with processing status
  if (!analysisDoc) {
    analysisDoc = new CultureAnalysis({
      meeting_id: meetingId,
      meeting_title: meeting.title,
      meeting_created_at: meeting.created_at,
      status: "processing",
      transcript_plain_text: transcriptText,
      system_prompt_version: "v2.1.0",
      model_id: HUGGINGFACE_MODEL_ID,
      system_prompt_path:
        "meet-guide-components/cultural-analysis-system/prompts/system/system-prompt-v2.1.0.md",
    });
  } else {
    analysisDoc.status = "processing";
    analysisDoc.error_message = "";
    if (meeting.created_at) {
      analysisDoc.meeting_created_at = meeting.created_at;
    }
  }

  await analysisDoc.save();

  try {
    const raw = await callHuggingFace(systemPrompt, userMessage);
    const parsed = extractJsonFromText(raw);

    analysisDoc.raw_response = raw;
    analysisDoc.analysis = parsed;
    analysisDoc.status = parsed ? "completed" : "failed";
    analysisDoc.analyzed_at = new Date();
    analysisDoc.processing_time_ms = Date.now() - startedAt;

    if (!parsed) {
      analysisDoc.error_message =
        "Failed to parse JSON from model response. See raw_response for details.";
    }

    await analysisDoc.save();
    return analysisDoc;
  } catch (err) {
    analysisDoc.status = "failed";
    analysisDoc.error_message = err.message || "Unknown error during analysis";
    analysisDoc.processing_time_ms = Date.now() - startedAt;
    await analysisDoc.save();
    throw err;
  }
}

module.exports = {
  analyzeMeetingCulture,
};

