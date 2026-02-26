/**
 * API Client for MeetGuide Backend
 */

// Normalize base URL to avoid trailing slashes that cause // in paths
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

// Token management
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
    if (typeof window !== 'undefined') {
        if (token) {
            localStorage.setItem('access_token', token);
        } else {
            localStorage.removeItem('access_token');
        }
    }
}

export function getAccessToken(): string | null {
    // Always read from localStorage as the source of truth to handle
    // module re-evaluation across route changes in Next.js App Router
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('access_token');
        if (stored) {
            accessToken = stored; // keep in-memory cache in sync
            return stored;
        }
    }
    return accessToken;
}

// HTTP request helper
async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAccessToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_URL}${endpoint}`;
    console.log('API Request:', url, options.method || 'GET');

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        console.log('API Response status:', response.status);

        if (response.status === 401) {
            // Token expired or invalid - clear it
            setAccessToken(null);
            // Only redirect to login if not already on an auth page
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (!path.startsWith('/auth')) {
                    window.location.href = '/auth/login';
                }
            }
            throw new Error('Unauthorized');
        }

        if (response.status === 403) {
            throw new Error('Access denied. Management privileges required.');
        }

        const data = await response.json();
        console.log('API Response data:', data);

        if (!response.ok) {
            // Extract error message from various response formats
            const errorMessage = data.message || data.detail || data.error || 'Request failed';
            throw new Error(errorMessage);
        }

        return data;
    } catch (error: any) {
        const isNetworkFailure =
            error instanceof TypeError ||
            (typeof error?.message === 'string' && error.message.toLowerCase().includes('failed to fetch'));

        if (isNetworkFailure) {
            throw new Error('Unable to connect to the server. Please check your backend service and network connection.');
        }

        if (process.env.NODE_ENV !== 'production') {
            console.error('API Request failed:', error);
        }
        throw error;
    }
}

// ==================== Generic Response Types ====================

export interface APIResponse<T = any> {
    success: boolean;
    message: string;
    data: T;
}

// ==================== Auth API ====================

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignupData {
    email: string;
    username: string;
    password: string;
    confirm_password: string;
    full_name?: string;
}

export interface User {
    id: string;
    email: string;
    username: string;
    full_name?: string;
    is_active: boolean;
    is_management?: boolean;
    profile_image?: string;
    created_at: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data: {
        user: User;
        access_token: string;
        token_type: string;
    };
}

export const authApi = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await request<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });

        if (response.success && response.data.access_token) {
            setAccessToken(response.data.access_token);
        }

        return response;
    },

    async signup(data: SignupData): Promise<AuthResponse> {
        const response = await request<AuthResponse>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        if (response.success && response.data.access_token) {
            setAccessToken(response.data.access_token);
        }

        return response;
    },

    async logout(): Promise<void> {
        try {
            await request('/auth/logout', { method: 'POST' });
        } finally {
            setAccessToken(null);
        }
    },

    async getCurrentUser(): Promise<{ success: boolean; data: User }> {
        return request('/auth/me');
    },
};

// ==================== Meetings API ====================

export interface Meeting {
    id: string;
    meeting_id: string;
    title: string;
    description?: string;
    host_id: string;
    host_name: string;
    participants: string[];
    status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    scheduled_start?: string;
    scheduled_end?: string;
    actual_start?: string;
    actual_end?: string;
    recording_folder?: string;
    created_at: string;
    mirotalk_url?: string;
    join_url?: string;
    has_pronunciation_data?: boolean;
}

export interface CreateMeetingData {
    title: string;
    description?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    invited_emails?: string[];
}

export const meetingsApi = {
    async create(data: CreateMeetingData): Promise<{ success: boolean; data: Meeting }> {
        return request('/meetings/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async getAll(): Promise<{ success: boolean; data: Meeting[] }> {
        return request('/meetings/');
    },

    async getEnded(): Promise<{ success: boolean; data: Meeting[] }> {
        return request('/meetings/ended');
    },

    async getById(meetingId: string): Promise<{ success: boolean; data: Meeting }> {
        return request(`/meetings/${meetingId}`);
    },

    async getFeedback(meetingId: string): Promise<{ success: boolean; data: any }> {
        return request(`/meetings/${meetingId}/feedback`);
    },

    async start(meetingId: string): Promise<{ success: boolean; data: Meeting }> {
        return request(`/meetings/${meetingId}/start`, { method: 'POST' });
    },

    async end(meetingId: string): Promise<{ success: boolean; data: Meeting }> {
        return request(`/meetings/${meetingId}/end`, { method: 'POST' });
    },

    async join(meetingId: string): Promise<{ success: boolean; data: Meeting }> {
        return request(`/meetings/${meetingId}/join`, { method: 'POST' });
    },
};

// ==================== Culture Analysis API ====================

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

export interface CultureAnalysisRecord {
    meeting_id: string;
    meeting_title?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    analysis: CultureAnalysisJson | null;
    error_message?: string;
}

export const cultureAnalysisApi = {
    async get(meetingId: string): Promise<{ success: boolean; data: CultureAnalysisRecord }> {
        return request(`/culture-analysis/${meetingId}`);
    },
};

// ==================== Pronunciation API ====================

export interface MispronunciationError {
    word: string;
    spoken: string;
    expected?: string;
    expected_phonemes?: string;
    actual_phonemes?: string;
    error_type: string;
    severity: string;
    confidence: number;
    timestamp?: number;
    start_time?: number;
    end_time?: number;
    context?: string;
    suggestion?: string;
}

export interface ParticipantFeedback {
    user_id: string;
    user_name: string;
    total_words: number;
    errors: number;
    accuracy: number;
    error_rate: number;
    mispronunciations: MispronunciationError[];
    transcript: string;
}

export interface MeetingFeedbackData {
    meeting: {
        meeting_id: string;
        title: string;
        status: string;
        start_time: string;
        end_time: string;
        host_name: string;
    } | null;
    timeline: {
        start_time: string;
        duration_sec: string;
        event_count: number;
    } | null;
    overall_stats: {
        total_words: number;
        total_errors: number;
        average_accuracy: number;
    } | null;
    participants: ParticipantFeedback[];
}

export interface PronunciationFeedback {
    id?: string;
    meeting_id: string;
    user_id?: string;
    user_name?: string;
    word_count: number;
    error_count: number;
    error_rate: number;
    errors: MispronunciationError[];
    transcript?: string;
    analyzed_at: string;
}

export interface CommonError {
    word: string;
    count: number;
    correct_pronunciation?: string;
}

export interface PronunciationSummary {
    user_id?: string;
    user_name?: string;
    total_meetings: number;
    total_words: number;
    total_errors: number;
    error_rate: number;
    average_accuracy?: number;
    common_errors: CommonError[];
    improvement_over_time?: Array<{ date: string; meeting_id: string; error_rate: number }>;
}

export const pronunciationApi = {
    async getAll(): Promise<{ success: boolean; data: PronunciationFeedback[] }> {
        return request('/pronunciation/my-feedback');
    },

    async getSummary(): Promise<{ success: boolean; data: PronunciationSummary }> {
        return request('/pronunciation/my-summary');
    },

    async getMyFeedback(meetingId?: string): Promise<{ success: boolean; data: PronunciationFeedback[] }> {
        const url = meetingId
            ? `/pronunciation/my-feedback?meeting_id=${meetingId}`
            : '/pronunciation/my-feedback';
        return request(url);
    },

    async getMySummary(): Promise<{ success: boolean; data: PronunciationSummary }> {
        return request('/pronunciation/my-summary');
    },

    async getMeetingFeedback(meetingId: string): Promise<{ success: boolean; data: MeetingFeedbackData }> {
        return request(`/pronunciation/meeting/${meetingId}`);
    },

    async getRawMeetingData(meetingId: string): Promise<{ success: boolean; data: any }> {
        return request(`/pronunciation/meeting/${meetingId}/raw`);
    },

    async getParticipantDetail(meetingId: string, participantName: string): Promise<{ success: boolean; data: any }> {
        return request(`/pronunciation/meeting/${meetingId}/participant/${participantName}`);
    },

    async getAvailableMeetings(): Promise<{ success: boolean; data: Array<{ folder: string; name: string; has_data: boolean }> }> {
        return request('/pronunciation/available-meetings');
    },
};

// ==================== Dashboard API ====================

export interface DashboardStats {
    total_meetings: number;
    total_words_spoken: number;
    total_mispronunciations: number;
    average_error_rate: number;
    recent_meetings: Meeting[];
    pronunciation_trend: Array<{
        date: string;
        meeting_id: string;
        error_rate: number;
        words: number;
        errors: number;
    }>;
}

export interface TrendData {
    analysis_window: {
        start_date: string;
        end_date: string;
        meeting_count: number;
        label: string;
    };
    analysis: {
        overall_trend_summary: string;
        dimension_trends: {
            [key: string]: {
                trend: string;
                summary: string;
                confidence: string;
                top_signals: string[];
            };
        };
        recurring_strengths: string[];
        recurring_risks: string[];
        recommendations_for_management: string[];
        limitations?: string;
    };
}

export const dashboardApi = {
    async getStats(): Promise<{ success: boolean; data: DashboardStats }> {
        return request('/dashboard/stats');
    },

    async getRecentActivity(): Promise<{ success: boolean; data: any[] }> {
        return request('/dashboard/recent-activity');
    },

    async getPronunciationOverview(): Promise<{ success: boolean; data: PronunciationSummary }> {
        return request('/dashboard/pronunciation-overview');
    },

    async getTrend(): Promise<{ success: boolean; data: TrendData }> {
        return request('/trend-analysis');
    },
};

// ==================== Processing API ====================

export interface ProcessableMeeting {
    folder: string;
    hasAudio: boolean;
    isProcessed: boolean;
    isProcessing: boolean;
}

export interface ProcessingResult {
    success: boolean;
    message: string;
    output?: string;
    error?: string;
}

export interface ProcessingStatus {
    meetingId: string;
    status: 'processing' | 'not_processing';
    startTime?: string;
    elapsedSeconds?: number;
}

export const processingApi = {
    async getProcessableMeetings(): Promise<{ success: boolean; data: ProcessableMeeting[] }> {
        return request('/processing/meetings');
    },

    async runProcessing(meetingId: string, options?: { useWhisper?: boolean; async?: boolean }): Promise<{ success: boolean; message: string; data?: any }> {
        return request(`/processing/run/${meetingId}`, {
            method: 'POST',
            body: JSON.stringify(options || {}),
        });
    },

    async getProcessingStatus(meetingId: string): Promise<{ success: boolean; data: ProcessingStatus }> {
        return request(`/processing/status/${meetingId}`);
    },

    async importMeetingData(meetingId: string): Promise<{ success: boolean; message: string; data?: any }> {
        return request(`/processing/import/${meetingId}`, { method: 'POST' });
    },
};

// ==================== Summarization API ====================

export interface IntentResult {
    speaker: string;
    sentence: string;
    intent: string;
    text?: string;
    task?: string;
    assignee?: string;
    deadline?: string;
    priority?: string;
    topic?: string;
    start_time?: number;
}

export interface Topic {
    topic_id: number;
    label: string;
    utterances: Array<{
        speaker: string;
        sentence: string;
        intent: string;
    }>;
    start_index?: number;
    end_index?: number;
}

export interface ActionItem {
    _id: string;
    meeting_id: string;
    meeting_title: string;
    meeting_date: string;
    task: string;
    sentence: string;
    assigned_by: string;
    assigned_by_email: string;
    assignee: string;
    assignee_email: string;
    assignee_emails: string[];
    deadline?: string;
    deadline_date?: string;
    priority: string;
    status: string;
    topic_label?: string;
    start_time?: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

export interface MeetingSummarization {
    _id: string;
    meeting_id: string;
    meeting_title: string;
    meeting_date: string;
    results: IntentResult[];
    topics: Topic[];
    intent_counts: {
        'action-item': number;
        question: number;
        decision: number;
        information: number;
        other: number;
    };
    total_utterances: number;
    action_item_count: number;
    question_count: number;
    decision_count: number;
    analyzed_at: string;
    processing_time_ms: number;
    model_version: string;
}

export const summarizationApi = {
    async analyzeMeeting(meetingId: string, participantEmails?: Record<string, string>): Promise<any> {
        return request(`/summarization/analyze-meeting/${meetingId}`, {
            method: 'POST',
            body: JSON.stringify({ participant_emails: participantEmails || {} }),
        });
    },

    async getSummarization(meetingId: string): Promise<MeetingSummarization> {
        return request(`/summarization/meeting/${meetingId}`);
    },

    async getSummary(meetingId: string): Promise<any> {
        return request(`/summarization/meeting/${meetingId}/summary`);
    },

    async getTopics(meetingId: string): Promise<{ meeting_id: string; topic_count: number; topics: Topic[] }> {
        return request(`/summarization/meeting/${meetingId}/topics`);
    },

    async getIntentResults(meetingId: string, intentType: string): Promise<{ meeting_id: string; intent_type: string; count: number; results: IntentResult[] }> {
        return request(`/summarization/meeting/${meetingId}/intents/${intentType}`);
    },

    async getActionItemsForMeeting(meetingId: string): Promise<APIResponse<{ meeting_id: string; count: number; action_items: ActionItem[] }>> {
        return request(`/summarization/action-items/meeting/${meetingId}`);
    },

    async getActionItemsForUser(email: string, status?: string): Promise<APIResponse<{ user_email: string; status: string; count: number; action_items: ActionItem[] }>> {
        const statusParam = status ? `?status=${status}` : '';
        return request(`/summarization/action-items/user/${email}${statusParam}`);
    },

    async updateActionItem(id: string, updates: { status?: string; priority?: string }): Promise<APIResponse<ActionItem>> {
        return request(`/summarization/action-items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    async checkHealth(): Promise<{ status: string; service: string; timestamp: string }> {
        return request('/summarization/health');
    },
};

// Combined API object
export const api = {
    auth: authApi,
    meetings: meetingsApi,
    pronunciation: pronunciationApi,
    dashboard: dashboardApi,
    processing: processingApi,
    summarization: summarizationApi,
};

export default api;
