"use server";

/**
 * Server actions for culture analysis.
 * These run on the Next.js server and proxy requests to the Express backend.
 */

const BACKEND_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
).replace(/\/+$/, "");

export interface CultureAnalysisResponse {
    success: boolean;
    message?: string;
    errorCode?: "not_found" | "no_transcript" | "auth_error" | "server_error";
    data?: {
        meeting_id: string;
        meeting_title?: string;
        status: "pending" | "processing" | "completed" | "failed";
        analysis: CultureAnalysisJson | null;
        error_message?: string;
        analyzed_at?: string;
    };
}

export interface CultureAnalysisJson {
    meeting_summary: string;
    cultural_strengths: string[];
    cultural_risks: string[];
    core_cultural_problem: string;
    core_problem_evidence: string[];
    problem_chain_explanation: string;
    recommendations_for_management: string[];
    evidence_notes: string[];
    limitations: string;
}

async function backendFetch(
    endpoint: string,
    token: string,
    options: RequestInit = {},
): Promise<CultureAnalysisResponse> {
    const url = `${BACKEND_URL}${endpoint}`;

    let response: Response;
    let data: any;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });
        data = await response.json();
    } catch (networkError: any) {
        // Network-level failure (backend unreachable, JSON parse error, etc.)
        return {
            success: false,
            errorCode: "server_error",
            message: "Failed to reach the backend service.",
        };
    }

    // 404 → no analysis exists yet, treat as pending
    if (response.status === 404) {
        return { success: false, errorCode: "not_found", message: "No culture analysis found" };
    }

    // 401 / 403 → auth problem
    if (response.status === 401 || response.status === 403) {
        return { success: false, errorCode: "auth_error", message: "Authentication required." };
    }

    if (!response.ok) {
        const msg = data?.message || data?.detail || data?.error || "Request failed";
        const isTranscript =
            typeof msg === "string" &&
            (msg.toLowerCase().includes("transcript") || msg.toLowerCase().includes("utterance"));
        return {
            success: false,
            errorCode: isTranscript ? "no_transcript" : "server_error",
            message: msg,
        };
    }

    return data;
}

/**
 * Fetch existing culture analysis for a meeting.
 */
export async function getCultureAnalysis(
    meetingId: string,
    token: string,
): Promise<CultureAnalysisResponse> {
    return backendFetch(`/culture-analysis/${meetingId}`, token);
}
