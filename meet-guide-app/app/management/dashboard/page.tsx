"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight, 
  Clock 
} from "lucide-react";
import { dashboardApi, meetingsApi, TrendData, Meeting } from "@/lib/api";

export default function ManagementDashboardPage() {
    const [trendData, setTrendData] = useState<TrendData | null>(null);
    const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Trend Data
                const trendRes = await dashboardApi.getTrend();
                if (trendRes.success) {
                    setTrendData(trendRes.data);
                }

                // Fetch Recent Meetings (To simulate "At Risk" detection)
                // In a real scenario, you might filter these on the backend for "status=failed" or "risks_count > 0"
                const meetingsRes = await meetingsApi.getAll();
                if (meetingsRes.success && Array.isArray(meetingsRes.data)) {
                    setRecentMeetings(meetingsRes.data.slice(0, 5));
                }
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getTrendColor = (trend: string) => {
        switch (trend?.toLowerCase()) {
            case "improving": return "text-green-600 bg-green-50 border-green-200";
            case "declining": return "text-red-600 bg-red-50 border-red-200";
            case "stable": return "text-blue-600 bg-blue-50 border-blue-200";
            default: return "text-gray-600 bg-gray-50 border-gray-200";
        }
    };

    const trendDescriptions: Record<string, string> = {
        improving: "Getting better over time.",
        declining: "Getting worse over time.",
        stable: "Staying about the same.",
        mixed: "Sometimes better, sometimes worse — no clear pattern.",
        unknown: "Not enough information to tell."
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Executive Overview</h1>
                    <p className="text-gray-500 mt-1">Cultural health and strategic insights across the organization.</p>
                </div>
                <Link 
                    href="/management/trend-analytics" 
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                    View Full Trend Report <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Top Cards: Cultural Pulse */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Overall Status */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp className="w-24 h-24 text-indigo-600" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Overall Culture Trend</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">
                            {trendData?.analysis?.overall_trend_summary ? "Active" : "Pending"}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                         {trendData?.analysis?.overall_trend_summary || "Insufficient data for trend analysis."}
                    </p>
                </div>

                {/* 2. Key Dimensions Status */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-500 mb-4">Key Dimensions</h3>
                    <div className="space-y-3">
                        {trendData?.analysis?.dimension_trends && Object.entries(trendData.analysis.dimension_trends).slice(0, 2).map(([key, data]) => (
                            <div key={key} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                <div className="relative group cursor-help">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getTrendColor(data.trend)}`}>
                                        {data.trend}
                                    </span>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded py-2 px-3 text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-10 shadow-xl font-normal normal-case">
                                        {trendDescriptions[data.trend?.toLowerCase()] || trendDescriptions.unknown}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Meetings Monitored */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Meetings Analyzed (30d)</h3>
                        <div className="text-3xl font-bold text-gray-900">
                             {trendData?.analysis_window?.meeting_count || 0}
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div 
                                className="bg-indigo-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(((trendData?.analysis_window?.meeting_count || 0) / 20) * 100, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Target: 20 meetings/month</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Column: Strategic Actions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                                Recommended Actions
                            </h2>
                        </div>
                        <div className="p-6">
                             {trendData?.analysis?.recommendations_for_management && trendData.analysis.recommendations_for_management.length > 0 ? (
                                <ul className="space-y-4">
                                    {trendData.analysis.recommendations_for_management.slice(0, 3).map((rec, idx) => (
                                        <li key={idx} className="flex gap-4 items-start">
                                            <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                                                {idx + 1}
                                            </span>
                                            <p className="text-gray-700 text-sm leading-relaxed">{rec}</p>
                                        </li>
                                    ))}
                                </ul>
                             ) : (
                                <p className="text-gray-500 italic">No recommendations generated yet.</p>
                             )}
                        </div>
                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 rounded-b-xl">
                            <p className="text-xs text-gray-500">
                                Based on analysis from {trendData?.analysis_window?.start_date ? new Date(trendData.analysis_window.start_date).toLocaleDateString() : '-'} to {trendData?.analysis_window?.end_date ? new Date(trendData.analysis_window.end_date).toLocaleDateString() : '-'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Side Column: Recent Activity / Watchlist */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gray-500" />
                                Recent Meetings
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {recentMeetings.length > 0 ? (
                                recentMeetings.map((meeting) => (
                                    <Link 
                                        key={meeting.id} 
                                        href={`/management/meetings/${meeting.id || meeting.meeting_id}/cultural-analysis`}
                                        className="block p-4 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-medium text-gray-900 truncate pr-2">{meeting.title || "Untitled Meeting"}</h4>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : ""}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                                                View Analysis
                                            </span>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-6 text-center text-gray-500 text-sm">No recent meetings found.</div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-200 text-center">
                            <Link href="/management/meetings" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                                View All Meetings
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
