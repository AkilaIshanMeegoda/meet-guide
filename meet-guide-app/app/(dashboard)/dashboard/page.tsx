"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardApi, DashboardStats, meetingsApi, Meeting, pronunciationApi, PronunciationSummary } from "@/lib/api";

export default function DashboardPage() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [pronunciationSummary, setPronunciationSummary] = useState<PronunciationSummary | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/auth/login");
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingStats(true);
                setError('');
                
                console.log('=== Dashboard: Fetching data ===');
                
                // Fetch stats
                let statsResponse;
                try {
                    console.log('Fetching dashboard stats...');
                    statsResponse = await dashboardApi.getStats();
                    if (statsResponse.success) {
                        setStats(statsResponse.data);
                        console.log('✅ Stats loaded');
                    }
                } catch (err: any) {
                    console.error('❌ Failed to fetch stats:', err);
                    // Continue even if stats fail
                }
                
                // Fetch meetings
                let meetingsResponse;
                try {
                    console.log('Fetching meetings...');
                    meetingsResponse = await meetingsApi.getAll();
                    if (meetingsResponse.success) {
                        setMeetings(meetingsResponse.data);
                        console.log('✅ Meetings loaded:', meetingsResponse.data.length);
                    }
                } catch (err: any) {
                    console.error('❌ Failed to fetch meetings:', err);
                    // Continue even if meetings fail
                }
                
                // Fetch pronunciation summary
                let pronunciationResponse;
                try {
                    console.log('Fetching pronunciation summary...');
                    pronunciationResponse = await pronunciationApi.getSummary();
                    if (pronunciationResponse.success) {
                        setPronunciationSummary(pronunciationResponse.data);
                        console.log('✅ Pronunciation summary loaded');
                    }
                } catch (err: any) {
                    console.error('❌ Failed to fetch pronunciation:', err);
                    // Continue even if pronunciation fails
                }
                
                console.log('=== Dashboard: Data fetch complete ===');
                
            } catch (err: any) {
                console.error('❌ Dashboard error:', err);
                setError(err.message || "Failed to load dashboard data");
            } finally {
                setLoadingStats(false);
            }
        };

        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="space-y-8 p-6">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Welcome back, {user?.full_name || user?.username}!
                </h1>
                <p className="text-gray-500 mt-1">
                    Here&apos;s your meeting and pronunciation overview
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Meetings"
                    value={stats?.total_meetings || 0}
                    icon="📅"
                    loading={loadingStats}
                />
                <StatCard
                    title="Words Spoken"
                    value={stats?.total_words_spoken?.toLocaleString() || "0"}
                    icon="💬"
                    loading={loadingStats}
                />
                <StatCard
                    title="Mispronunciations"
                    value={stats?.total_mispronunciations || 0}
                    icon="🔤"
                    loading={loadingStats}
                />
                <StatCard
                    title="Avg Error Rate"
                    value={`${(stats?.average_error_rate || 0).toFixed(1)}%`}
                    icon="📊"
                    loading={loadingStats}
                />
            </div>

            {/* Pronunciation Feedback Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        🎯 Your Pronunciation Feedback
                    </h2>
                    <button
                        onClick={() => router.push("/pronunciation")}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                        View Details →
                    </button>
                </div>

                {loadingStats ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse h-16 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                ) : pronunciationSummary ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-2xl font-bold text-gray-900">
                                    {pronunciationSummary.total_words}
                                </p>
                                <p className="text-sm text-gray-500">Total Words</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg">
                                <p className="text-2xl font-bold text-red-600">
                                    {pronunciationSummary.total_errors}
                                </p>
                                <p className="text-sm text-gray-500">Errors Found</p>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-lg">
                                <p className="text-2xl font-bold text-indigo-600">
                                    {(pronunciationSummary.error_rate ?? 0).toFixed(1)}%
                                </p>
                                <p className="text-sm text-gray-500">Error Rate</p>
                            </div>
                        </div>

                        {pronunciationSummary.common_errors.length > 0 && (
                            <div className="mt-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                    Common Mispronunciations:
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {pronunciationSummary.common_errors.slice(0, 10).map((error, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                                        >
                                            {error.word} ({error.count}x)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <p>No pronunciation data available yet.</p>
                        <p className="text-sm mt-2">Join a meeting to get started!</p>
                    </div>
                )}
            </div>

            {/* Recent Meetings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Meetings</h2>
                    <button
                        onClick={() => router.push("/meetings")}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                        View All →
                    </button>
                </div>

                {loadingStats ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse flex space-x-4">
                                <div className="h-12 bg-gray-200 rounded w-full"></div>
                            </div>
                        ))}
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No meetings yet</p>
                        <button
                            onClick={() => router.push("/meetings")}
                            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Schedule Your First Meeting
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {meetings.slice(0, 5).map((meeting, index) => (
                            <MeetingCard
                                key={meeting.id || index}
                                meeting={meeting}
                                onClick={() => router.push(`/meetings/${meeting.meeting_id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Pronunciation Trend */}
            {stats?.pronunciation_trend && stats.pronunciation_trend.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        📈 Pronunciation Trend
                    </h2>
                    <div className="space-y-2">
                        {stats.pronunciation_trend.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                            >
                                <span className="text-sm text-gray-600">
                                    {new Date(item.date).toLocaleDateString()}
                                </span>
                                <span className="text-sm font-medium">
                                    {item.words} words, {item.errors} errors
                                </span>
                                <span className={`text-sm font-bold ${
                                    item.error_rate < 3 ? 'text-green-600' :
                                    item.error_rate < 6 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                    {item.error_rate.toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Stat Card Component
function StatCard({ 
    title, 
    value, 
    icon, 
    loading 
}: { 
    title: string; 
    value: string | number; 
    icon: string; 
    loading: boolean;
}) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    {loading ? (
                        <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mt-1"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                    )}
                </div>
                <span className="text-3xl">{icon}</span>
            </div>
        </div>
    );
}

// Meeting Card Component
function MeetingCard({ 
    meeting, 
    onClick 
}: { 
    meeting: Meeting; 
    onClick: () => void;
}) {
    const statusColors: Record<string, string> = {
        scheduled: "bg-blue-100 text-blue-700",
        active: "bg-green-100 text-green-700",
        ended: "bg-gray-100 text-gray-700",
        cancelled: "bg-red-100 text-red-700",
    };

    return (
        <div
            onClick={onClick}
            className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600">📹</span>
                </div>
                <div>
                    <h3 className="font-medium text-gray-900">{meeting.title}</h3>
                    <p className="text-sm text-gray-500">
                        {new Date(meeting.created_at).toLocaleDateString()} • Host: {meeting.host_name}
                    </p>
                </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[meeting.status] || 'bg-gray-100 text-gray-700'}`}>
                {meeting.status}
            </span>
        </div>
    );
}
