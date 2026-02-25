"use server";

/**
 * Server actions for culture analysis.
 * These run on the Next.js server and proxy requests to the Express backend.
 */

const BACKEND_URL = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
).replace(/\/+$/, "");

interface CultureAnalysisResponse {
    success: boolean;
    message?: string;
    data?: {
        meeting_id: string;
        meeting_title?: string;
        status: "pending" | "processing" | "completed" | "failed";
        analysis: CultureAnalysisJson | null;
        error_message?: string;
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

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        const errorMessage =
            data.message || data.detail || data.error || "Request failed";
        throw new Error(errorMessage);
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
