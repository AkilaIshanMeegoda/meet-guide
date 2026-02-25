"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";

import { dashboardApi, type TrendData } from "@/lib/api";
import { generateTrendAnalyticsReport } from "@/lib/pdfGenerator";
import ExportButton from "@/components/ExportButton";

// Poll interval for auto-refresh (60 seconds)
const POLL_INTERVAL_MS = 60000;

export default function TrendAnalysisDisplay() {
    const [data, setData] = useState<TrendData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    const fetchTrend = useCallback(async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            setError("");
            const res = await dashboardApi.getTrend();
            if (res.success && res.data) {
                setData(res.data);
            } else {
                setData(null);
            }
        } catch (err) {
            console.error(err);
            if (!data) {
                setError("Failed to load trend data.");
            }
        } finally {
            setLoading(false);
        }
    }, [data]);

    useEffect(() => {
        fetchTrend(true);

        // Poll periodically for auto-updated trend analysis
        const interval = setInterval(() => {
            fetchTrend(false);
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, []);

    const handleExport = useCallback(() => {
        if (!data?.analysis) return;

        try {
            setIsExporting(true);
            generateTrendAnalyticsReport(data);
        } finally {
            setIsExporting(false);
        }
    }, [data]);

    if (loading && !data) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-24 bg-gray-200 rounded mb-4"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
                <p>{error}</p>
                <button onClick={() => fetchTrend(true)} className="text-sm underline mt-2">Retry</button>
            </div>
        )
    }

    if (!data || !data.analysis) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                <div className="flex justify-center mb-4">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting for Trend Analysis</h3>
                <p className="text-gray-500">Trend analysis is generated automatically when meeting culture analyses are available. This page will update automatically.</p>
            </div>
        );
    }

    const { analysis_window, analysis } = data;

    const getTrendColor = (trend: string) => {
        switch (trend?.toLowerCase()) {
            case "improving": return "text-green-600 bg-green-50";
            case "declining": return "text-red-600 bg-red-50";
            case "stable": return "text-blue-600 bg-blue-50";
            default: return "text-gray-600 bg-gray-50";
        }
    };

    const trendDescriptions: Record<string, string> = {
        improving: "Getting better over time.",
        declining: "Getting worse over time.",
        stable: "Staying about the same.",
        mixed: "Sometimes better, sometimes worse — no clear pattern.",
        unknown: "Not enough information to tell."
    };

    return (
        <div className="space-y-6">
            {/* Header Summary */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Cultural Trends Report</h2>
                        <p className="text-sm text-gray-500">
                            {format(new Date(analysis_window.start_date), "MMM d")} - {format(new Date(analysis_window.end_date), "MMM d, yyyy")} • Based on {analysis_window.meeting_count} meetings
                        </p>
                    </div>
                    <ExportButton
                        onClick={handleExport}
                        loading={isExporting}
                        label="Export PDF"
                    />
                </div>

                <p className="text-gray-800 text-lg leading-relaxed border-l-4 border-indigo-500 pl-4 py-1 bg-gray-50 rounded-r">
                    {analysis.overall_trend_summary}
                </p>

                {/* Limitations warning if present */}
                {(analysis as any).limitations && (
                    <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        Note: {(analysis as any).limitations}
                    </div>
                )}
            </div>

            {/* Dimension Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(analysis.dimension_trends || {}).map(([key, trendData]) => (
                    <div key={key} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-gray-900 capitalize">
                                {key.replace(/_/g, " ")}
                            </h3>
                            <div className="relative group cursor-help">
                                <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${getTrendColor(trendData.trend)}`}>
                                    {trendData.trend}
                                </span>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded py-2 px-3 text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-10 shadow-xl font-normal normal-case">
                                    {trendDescriptions[trendData.trend?.toLowerCase()] || trendDescriptions.unknown}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-4 grow">
                            {trendData.summary}
                        </p>

                        {trendData.top_signals && trendData.top_signals.length > 0 && (
                            <div className="mt-2 pt-3 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-500 mb-1">Key Signals:</p>
                                <ul className="space-y-1">
                                    {trendData.top_signals.slice(0, 2).map((signal, idx) => (
                                        <li key={idx} className="text-xs text-gray-700 flex items-start">
                                            <span className="mr-1.5 mt-0.5 text-indigo-400">•</span>
                                            {signal}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-3 text-xs text-gray-400 text-right">
                            Confidence: {trendData.confidence}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actionable Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recommendations */}
                <div className="bg-linear-to-br from-indigo-50 to-white p-6 rounded-lg shadow-sm border border-indigo-100">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Management Recommendations
                    </h3>
                    <ul className="space-y-3">
                        {analysis.recommendations_for_management?.map((rec, idx) => (
                            <li key={idx} className="flex items-start bg-white p-3 rounded-md shadow-sm border border-indigo-50">
                                <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold mr-3 mt-0.5">
                                    {idx + 1}
                                </span>
                                <span className="text-sm text-gray-800">{rec}</span>
                            </li>
                        )) || <li className="text-sm text-gray-500 italic">No specific recommendations generated.</li>}
                    </ul>
                </div>

                {/* Risks & Strengths */}
                <div className="space-y-6">
                    {/* Strengths */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-green-200">
                        <h3 className="font-bold mb-3 text-green-700 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Recurring Strengths
                        </h3>
                        <ul className="list-disc pl-5 space-y-1">
                            {analysis.recurring_strengths?.map((item, idx) => (
                                <li key={idx} className="text-sm text-gray-700">{item}</li>
                            )) || <li className="text-sm text-gray-500 italic">None identified.</li>}
                        </ul>
                    </div>

                    {/* Risks */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-red-200">
                        <h3 className="font-bold mb-3 text-red-700 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Recurring Risks
                        </h3>
                        <ul className="list-disc pl-5 space-y-1">
                            {analysis.recurring_risks?.map((item, idx) => (
                                <li key={idx} className="text-sm text-gray-700">{item}</li>
                            )) || <li className="text-sm text-gray-500 italic">None identified.</li>}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
