'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { MeetingSummarization, ActionItem, Topic, IntentResult } from '@/lib/api';

export default function MeetingSummarizationPage() {
    const router = useRouter();
    const params = useParams();
    const meetingId = params?.id as string;
    const { user, isLoading: authLoading } = useAuth();
    
    const [summarization, setSummarization] = useState<MeetingSummarization | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'actions' | 'questions' | 'decisions'>('overview');

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    // Fetch summarization when user and meetingId are available
    useEffect(() => {
        if (!authLoading && user && meetingId) {
            fetchSummarization();
        } else if (!authLoading && !user) {
            setLoading(false);
        } else if (!meetingId) {
            setLoading(false);
            setError('Meeting ID not found');
        }
    }, [user, authLoading, meetingId]);

    const fetchSummarization = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Fetching summarization for:', meetingId);
            const data = await api.summarization.getSummarization(meetingId);
            setSummarization(data);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching summarization:', err);
            // If not found, it needs to be analyzed first
            const errMsg = err.message || 'Failed to load summarization';
            if (errMsg.includes('not found') || errMsg.includes('404')) {
                setError('This meeting has not been analyzed yet. Click "Analyze Now" to start.');
                setSummarization(null);
            } else {
                setError(errMsg);
                setSummarization(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyze = async () => {
        try {
            setAnalyzing(true);
            setError(null);
            console.log('Starting analysis for:', meetingId);
            
            // Get participant emails from the meeting if available
            const participantEmails: Record<string, string> = {};
            // You can fetch meeting details here if needed to get participant emails
            
            await api.summarization.analyzeMeeting(meetingId, participantEmails);
            
            // Wait a moment then fetch the results
            setTimeout(() => {
                fetchSummarization();
            }, 2000);
        } catch (err: any) {
            console.error('Error analyzing meeting:', err);
            setError(err.message || 'Failed to analyze meeting');
        } finally {
            setAnalyzing(false);
        }
    };

    const updateActionItemStatus = async (itemId: string, status: string) => {
        try {
            await api.summarization.updateActionItem(itemId, { status });
            // Refresh summarization to get updated action items
            fetchSummarization();
        } catch (err: any) {
            console.error('Failed to update action item:', err);
        }
    };

    // Show loading spinner while authenticating or fetching data
    if (authLoading || (loading && !error)) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    // Show error and analyze button if summarization not found
    if (error && !summarization) {
        return (
            <div className="max-w-7xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Meetings
                </button>

                <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Meeting Analysis Required</h3>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition font-medium disabled:opacity-50"
                    >
                        {analyzing ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </span>
                        ) : (
                            'Analyze Now'
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Show 404 if meetingId is missing
    if (!meetingId) {
        return (
            <div className="max-w-7xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Meetings
                </button>
                <div className="bg-white rounded-xl p-12 text-center">
                    <h3 className="text-xl font-semibold text-gray-900">Meeting Not Found</h3>
                    <p className="text-gray-500 mt-2">Unable to load meeting details.</p>
                </div>
            </div>
        );
    }

    // Return nothing if no summarization and no error (shouldn't happen)
    if (!summarization) {
        return null;
    }

    const actionItems = summarization.results.filter(r => r.intent === 'action-item');
    const questions = summarization.results.filter(r => r.intent === 'question');
    const decisions = summarization.results.filter(r => r.intent === 'decision');

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Meetings
            </button>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{summarization.meeting_title}</h1>
                <p className="text-gray-600 mt-1">
                    Analyzed on {new Date(summarization.analyzed_at).toLocaleDateString()} • 
                    Processed in {(summarization.processing_time_ms / 1000).toFixed(2)}s
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Utterances"
                    value={summarization.total_utterances}
                    icon="💬"
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    title="Action Items"
                    value={summarization.action_item_count}
                    icon="✅"
                    color="bg-green-50 text-green-600"
                />
                <StatCard
                    title="Questions"
                    value={summarization.question_count}
                    icon="❓"
                    color="bg-yellow-50 text-yellow-600"
                />
                <StatCard
                    title="Decisions"
                    value={summarization.decision_count}
                    icon="⚖️"
                    color="bg-purple-50 text-purple-600"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <TabButton
                    active={activeTab === 'overview'}
                    onClick={() => setActiveTab('overview')}
                    label="Overview"
                />
                <TabButton
                    active={activeTab === 'topics'}
                    onClick={() => setActiveTab('topics')}
                    label={`Topics (${summarization.topics.length})`}
                />
                <TabButton
                    active={activeTab === 'actions'}
                    onClick={() => setActiveTab('actions')}
                    label={`Action Items (${actionItems.length})`}
                />
                <TabButton
                    active={activeTab === 'questions'}
                    onClick={() => setActiveTab('questions')}
                    label={`Questions (${questions.length})`}
                />
                <TabButton
                    active={activeTab === 'decisions'}
                    onClick={() => setActiveTab('decisions')}
                    label={`Decisions (${decisions.length})`}
                />
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                {activeTab === 'overview' && (
                    <OverviewTab summarization={summarization} />
                )}
                {activeTab === 'topics' && (
                    <TopicsTab topics={summarization.topics} />
                )}
                {activeTab === 'actions' && (
                    <ActionItemsTab items={actionItems} />
                )}
                {activeTab === 'questions' && (
                    <QuestionsTab questions={questions} />
                )}
                {activeTab === 'decisions' && (
                    <DecisionsTab decisions={decisions} />
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`text-4xl ${color} w-16 h-16 rounded-full flex items-center justify-center`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`pb-3 px-4 font-medium transition border-b-2 ${
                active
                    ? 'text-teal-600 border-teal-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
        >
            {label}
        </button>
    );
}

function OverviewTab({ summarization }: { summarization: MeetingSummarization }) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(summarization.intent_counts).map(([intent, count]) => (
                        <div key={intent} className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600 capitalize">{intent.replace('-', ' ')}</p>
                            <p className="text-2xl font-bold text-gray-900">{count}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Topics Overview</h3>
                <div className="space-y-2">
                    {summarization.topics.map((topic) => (
                        <div key={topic.topic_id} className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
                            <div>
                                <span className="font-medium text-gray-900">{topic.label}</span>
                                <span className="text-sm text-gray-500 ml-3">{topic.utterances.length} utterances</span>
                            </div>
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded">Topic {topic.topic_id}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TopicsTab({ topics }: { topics: Topic[] }) {
    return (
        <div className="space-y-6">
            {topics.map((topic) => (
                <div key={topic.topic_id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-medium">
                            Topic {topic.topic_id}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900">{topic.label}</h3>
                    </div>
                    <div className="space-y-3">
                        {topic.utterances.map((utterance, idx) => (
                            <div key={idx} className="flex gap-3">
                                <div className="flex-shrink-0">
                                    <span className="inline-block w-2 h-2 rounded-full bg-teal-500 mt-2"></span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{utterance.speaker}</p>
                                    <p className="text-gray-700">{utterance.sentence}</p>
                                    <span className="text-xs text-gray-500 mt-1 inline-block">
                                        {utterance.intent}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ActionItemsTab({ items }: { items: IntentResult[] }) {
    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-700';
            case 'medium': return 'bg-yellow-100 text-yellow-700';
            case 'low': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-4">
            {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No action items identified</p>
            ) : (
                items.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-teal-300 transition">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(item.priority)}`}>
                                        {item.priority || 'medium'}
                                    </span>
                                    {item.topic && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                            {item.topic}
                                        </span>
                                    )}
                                </div>
                                <p className="font-medium text-gray-900 mb-1">{item.task || item.sentence}</p>
                                <p className="text-sm text-gray-600 mb-2">{item.sentence}</p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span>👤 {item.speaker}</span>
                                    {item.assignee && <span>→ Assigned to: {item.assignee}</span>}
                                    {item.deadline && <span>📅 {item.deadline}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function QuestionsTab({ questions }: { questions: IntentResult[] }) {
    return (
        <div className="space-y-4">
            {questions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No questions identified</p>
            ) : (
                questions.map((question, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">❓</span>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 mb-1">{question.speaker}</p>
                                <p className="text-gray-700">{question.sentence}</p>
                                {question.topic && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded mt-2 inline-block">
                                        {question.topic}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function DecisionsTab({ decisions }: { decisions: IntentResult[] }) {
    return (
        <div className="space-y-4">
            {decisions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No decisions identified</p>
            ) : (
                decisions.map((decision, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-purple-50">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚖️</span>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 mb-1">{decision.speaker}</p>
                                <p className="text-gray-700">{decision.sentence}</p>
                                {decision.topic && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded mt-2 inline-block">
                                        {decision.topic}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
