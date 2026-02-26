"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { pronunciationApi, PronunciationSummary, PronunciationFeedback } from "@/lib/api";

export default function PronunciationPage() {
    const router = useRouter();
    const { user, isLoading, isAuthenticated } = useAuth();
    const [summary, setSummary] = useState<PronunciationSummary | null>(null);
    const [feedbackList, setFeedbackList] = useState<PronunciationFeedback[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState("");
    const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/auth/login");
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingData(true);
                const [summaryResponse, feedbackResponse] = await Promise.all([
                    pronunciationApi.getSummary(),
                    pronunciationApi.getAll()
                ]);

                if (summaryResponse.success) {
                    setSummary(summaryResponse.data);
                }
                if (feedbackResponse.success) {
                    setFeedbackList(feedbackResponse.data);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load pronunciation data");
            } finally {
                setLoadingData(false);
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

    const selectedFeedback = selectedMeeting
        ? feedbackList.find(f => f.meeting_id === selectedMeeting)
        : null;

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    🎯 Pronunciation Feedback
                </h1>
                <p className="text-gray-500 mt-1">
                    Track your speaking performance and improve your pronunciation
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                </div>
            )}

            {/* Overall Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    📊 Overall Performance
                </h2>

                {loadingData ? (
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-lg"></div>
                        ))}
                    </div>
                ) : summary ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-indigo-50 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-indigo-600">
                                    {summary.total_meetings}
                                </p>
                                <p className="text-sm text-gray-600">Meetings Analyzed</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-blue-600">
                                    {summary.total_words.toLocaleString()}
                                </p>
                                <p className="text-sm text-gray-600">Total Words</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-red-600">
                                    {summary.total_errors}
                                </p>
                                <p className="text-sm text-gray-600">Mispronunciations</p>
                            </div>
                            <div className={`p-4 rounded-lg text-center ${
                                summary.error_rate < 3 ? 'bg-green-50' :
                                summary.error_rate < 6 ? 'bg-yellow-50' : 'bg-red-50'
                            }`}>
                                <p className={`text-3xl font-bold ${
                                    summary.error_rate < 3 ? 'text-green-600' :
                                    summary.error_rate < 6 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                    {summary.error_rate.toFixed(1)}%
                                </p>
                                <p className="text-sm text-gray-600">Error Rate</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Pronunciation Accuracy</span>
                                <span className="font-medium">{(100 - summary.error_rate).toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all ${
                                        summary.error_rate < 3 ? 'bg-green-500' :
                                        summary.error_rate < 6 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.max(0, 100 - summary.error_rate)}%` }}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        No pronunciation data available yet.
                    </div>
                )}
            </div>

            {/* Common Errors */}
            {summary && summary.common_errors.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        🔤 Most Common Mispronunciations
                    </h2>
                    <div className="space-y-3">
                        {summary.common_errors.map((error, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-gray-400">
                                        #{index + 1}
                                    </span>
                                    <div>
                                        <span className="font-semibold text-red-600 text-lg">
                                            {error.word}
                                        </span>
                                        {error.correct_pronunciation && (
                                            <p className="text-sm text-gray-500">
                                                Correct: <span className="text-green-600 font-medium">
                                                    {error.correct_pronunciation}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-gray-700">
                                        {error.count}x
                                    </span>
                                    <p className="text-xs text-gray-500">occurrences</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Meeting-wise Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    📋 Meeting-wise Breakdown
                </h2>

                {loadingData ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg"></div>
                        ))}
                    </div>
                ) : feedbackList.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No meetings with pronunciation feedback yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {feedbackList.map((feedback, index) => (
                            <div
                                key={feedback.meeting_id || index}
                                onClick={() => setSelectedMeeting(
                                    selectedMeeting === feedback.meeting_id ? null : feedback.meeting_id
                                )}
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                    selectedMeeting === feedback.meeting_id
                                        ? 'border-indigo-300 bg-indigo-50'
                                        : 'border-gray-100 hover:border-gray-200'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-gray-900">
                                            Meeting: {feedback.meeting_id}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {new Date(feedback.analyzed_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-bold ${
                                            feedback.error_rate < 3 ? 'text-green-600' :
                                            feedback.error_rate < 6 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                            {feedback.error_rate.toFixed(1)}%
                                        </span>
                                        <p className="text-sm text-gray-500">
                                            {feedback.word_count} words, {feedback.error_count} errors
                                        </p>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {selectedMeeting === feedback.meeting_id && feedback.errors && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                                            Errors in this meeting:
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {feedback.errors.slice(0, 20).map((err, i) => (
                                                <span
                                                    key={i}
                                                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                                                    title={`Said: ${err.spoken}, Should be: ${err.expected || 'N/A'}`}
                                                >
                                                    {err.spoken}
                                                </span>
                                            ))}
                                            {feedback.errors.length > 20 && (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                                                    +{feedback.errors.length - 20} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tips Section */}
            <div className="bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                <h2 className="text-lg font-semibold mb-3">
                    💡 Tips to Improve Your Pronunciation
                </h2>
                <ul className="space-y-2 text-indigo-100">
                    <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Practice commonly mispronounced words before meetings</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Slow down when speaking technical terms</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Record yourself and compare with correct pronunciations</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Focus on one or two challenging words each week</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
