/**
 * Trend Analysis Service - Uses HuggingFace LLM (DeepSeek) to analyze meeting culture trends
 */
const fs = require("fs").promises;
const path = require("path");
const CultureAnalysis = require("../models/CultureAnalysis");
const CulturalTrendAnalysis = require("../models/CulturalTrendAnalysis");

const HUGGINGFACE_API_URL =
    process.env.HUGGINGFACE_API_URL ||
    "https://router.huggingface.co/v1/chat/completions";
// Using DeepSeek model as requested
const HUGGINGFACE_MODEL_ID = "deepseek-ai/DeepSeek-V3";
const HUGGINGFACE_ACCESS_TOKEN = process.env.HUGGINGFACE_ACCESS_TOKEN;

// Retry configuration
const MAX_RETRIES = 1;
const INITIAL_BACKOFF_MS = 2000;

// Path to trend analysis prompt file (relative to backend src)
const TREND_PROMPT_PATH = path.resolve(
    __dirname,
    "../../../meet-guide-components/cultural-analysis-system/prompts/trend-analyse/latest.md",
);

async function readTrendPrompt() {
    try {
        const content = await fs.readFile(TREND_PROMPT_PATH, "utf-8");
        return content;
    } catch (error) {
        console.error("Error reading trend prompt file:", error);
        throw new Error(`Failed to read trend analysis prompt from ${TREND_PROMPT_PATH}`);
    }
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call HuggingFace Router API using OpenAI-compatible chat completions format.
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
        max_tokens: 8192, // Increased token limit for trend analysis
    };

    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                console.log(
                    `[TrendAnalysis] Retry attempt ${attempt}/${MAX_RETRIES} after ${backoff}ms...`,
                );
                await sleep(backoff);
            }

            console.log(
                `[TrendAnalysis] Calling HuggingFace API (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
            );

            // Use AbortController for timeout (e.g. 300 seconds for larger analysis)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);

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
                            `[TrendAnalysis] Transient error (${statusCode}), will retry...`,
                        );
                        continue;
                    }

                    throw new Error(
                        `HuggingFace API error: ${statusCode} ${response.statusText} - ${errorText}`,
                    );
                }

                const data = await response.json();

                if (
                    data.choices &&
                    Array.isArray(data.choices) &&
                    data.choices.length > 0 &&
                    data.choices[0].message &&
                    data.choices[0].message.content
                ) {
                    return data.choices[0].message.content;
                }

                if (data.message && data.message.content) {
                    return data.message.content;
                }

                console.warn(
                    "[TrendAnalysis] Unexpected response shape:",
                    JSON.stringify(data).slice(0, 500),
                );
                return typeof data === "string" ? data : JSON.stringify(data);

            } catch (fetchErr) {
                clearTimeout(timeoutId);
                if (fetchErr.name === 'AbortError') {
                    throw new Error("HuggingFace API request timed out after 300 seconds");
                }
                throw fetchErr;
            }
        } catch (err) {
            lastError = err;
            if (attempt < MAX_RETRIES) {
                console.warn(
                    `[TrendAnalysis] Request failed: ${err.message}. Will retry...`,
                );
                continue;
            }
            throw err;
        }
    }

    throw lastError || new Error("HuggingFace API call failed after retries");
}

/**
 * Try to extract a JSON object from a text blob.
 */
function extractJsonFromText(text) {
    if (!text) return null;

    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Strip markdown code fences
    const codeFenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeFenceMatch) {
        cleaned = codeFenceMatch[1].trim();
    }

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
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
 * Analyze meeting culture trends for the last N days
 */
async function analyzeCulturalTrends(days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Fetch completed CultureAnalysis docs within the date range
    // We use analyzed_at or meeting_created_at depending on business logic. Usually analysis is done shortly after meeting.
    // Using meeting_created_at is safer for "meeting trends over time".
    const analyses = await CultureAnalysis.find({
        status: "completed",
        meeting_created_at: { $gte: startDate, $lte: endDate },
    }).sort({ meeting_created_at: 1 }); // Oldest to newest for trend detection

    if (!analyses || analyses.length === 0) {
        // Save empty result to indicate no data
        const noDataAnalysis = new CulturalTrendAnalysis({
            analysis_window: {
                label: `Last ${days} days`,
                start_date: startDate,
                end_date: endDate,
                meeting_count: 0
            },
            status: "completed",
            model_id: HUGGINGFACE_MODEL_ID,
            analyzed_at: new Date(),
            analysis: {
                overall_trend_summary: "No meeting data available for analysis in this period.",
                limitations: "Insufficient data"
            }
        });
        await noDataAnalysis.save();
        return noDataAnalysis;
    }

    // Check for existing recent analysis to avoid duplicates/spamming API?
    // User didn't ask for caching specifically, but good practice.
    // Let's implement force option if needed later, for now we always run new on request.

    const systemPrompt = await readTrendPrompt();

    // Prepare the input list of reports
    // We need to minimize token usage while giving enough context.
    // Extract key fields from each analysis.
    const reports = analyses.map(doc => {
        const analysis = doc.analysis || {};
        return {
            meeting_id: doc.meeting_id,
            meeting_date: doc.meeting_created_at ? doc.meeting_created_at.toISOString().split('T')[0] : "Unknown",
            // Extract summary fields if available in the per-meeting analysis schema
            // Assuming structure based on system prompt v2.1.0 (implied usage)
            // We pass the whole relevant analysis object if it's not huge, or specific summary fields.
            // To be safe and comprehensive for the trend model, we pass the JSON analysis.
            analysis_summary: analysis
        };
    });

    const userMessage = `
ANALYZE TRENDS FOR THE FOLLOWING MEETINGS (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}):

${JSON.stringify(reports, null, 2)}

Remember: match the required JSON schema EXACTLY.
  `;

    const startedAt = Date.now();

    const trendDoc = new CulturalTrendAnalysis({
        analysis_window: {
            label: `Last ${days} days`,
            start_date: startDate,
            end_date: endDate,
            meeting_count: analyses.length
        },
        status: "processing",
        model_id: HUGGINGFACE_MODEL_ID,
        analyzed_at: null,
    });
    await trendDoc.save();

    try {
        const raw = await callHuggingFace(systemPrompt, userMessage);
        const parsed = extractJsonFromText(raw);

        trendDoc.raw_response = raw;
        trendDoc.analysis = parsed;
        trendDoc.status = parsed ? "completed" : "failed";
        trendDoc.analyzed_at = new Date();
        trendDoc.processing_time_ms = Date.now() - startedAt;

        if (!parsed) {
            trendDoc.error_message = "Failed to parse JSON from trend model response.";
        }

        await trendDoc.save();
        return trendDoc;

    } catch (err) {
        trendDoc.status = "failed";
        trendDoc.error_message = err.message || "Unknown error during trend analysis";
        trendDoc.processing_time_ms = Date.now() - startedAt;
        await trendDoc.save();
        throw err;
    }
}

async function getLatestTrendAnalysis() {
    return await CulturalTrendAnalysis.findOne().sort({ created_at: -1 });
}

module.exports = {
    analyzeCulturalTrends,
    getLatestTrendAnalysis
};
