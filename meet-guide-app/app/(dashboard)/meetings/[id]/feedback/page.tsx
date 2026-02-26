'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Volume2, AlertTriangle } from 'lucide-react';

interface MispronunciationError {
    word: string;
    expected: string;
    expected_phonemes?: string[] | string;
    error_type: string;
    severity: string;
    confidence: number;
    accuracy?: number;
    context: string;
    suggestion: string;
    start_time: number;
    end_time: number;
}

interface ParticipantFeedback {
    user_id: string;
    user_name: string;
    total_words: number;
    errors: number;
    accuracy: number;
    error_rate: number;
    mispronunciations: MispronunciationError[];
    transcript: string;
}

interface MeetingFeedback {
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

export default function MeetingFeedbackPage() {
    const router = useRouter();
    const params = useParams();
    const meetingId = params.id as string;
    const { user, isLoading: authLoading } = useAuth();
    const [feedback, setFeedback] = useState<MeetingFeedback | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [myFeedback, setMyFeedback] = useState<ParticipantFeedback | null>(null);
    const [activeTab, setActiveTab] = useState<'transcript' | 'mispronounced'>('transcript');
    const [selectedWord, setSelectedWord] = useState<MispronunciationError | null>(null);
    const [selectedWordIndex, setSelectedWordIndex] = useState<number>(-1);
    const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user && meetingId) {
            fetchFeedback();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, meetingId]);

    const fetchFeedback = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await api.pronunciation.getMeetingFeedback(meetingId);

            if (res.success && res.data) {
                const feedbackData = res.data as MeetingFeedback;
                setFeedback(feedbackData);
                // The API now returns only the current user's data
                if (feedbackData.participants?.length > 0) {
                    setMyFeedback(feedbackData.participants[0]);
                }
            } else {
                setError('No feedback data available for this meeting. You may not have participated in this meeting.');
            }
        } catch (err) {
            console.error('Error fetching feedback:', err);
            setError('Failed to load feedback data');
        } finally {
            setLoading(false);
        }
    };

    // Play word pronunciation using Web Speech API or Google Translate
    const playWord = (word: string) => {
        if (!word || word === '-' || word.trim() === '') {
            console.warn('No word to play');
            return;
        }

        try {
            // Option 1: Web Speech API (works offline)
            if ('speechSynthesis' in window) {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(word);
                utterance.lang = 'en-US';
                utterance.rate = 0.8;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;

                utterance.onerror = (error) => {
                    console.error('Speech synthesis error:', error);
                };

                window.speechSynthesis.speak(utterance);
                return;
            }

            // Option 2: Google Translate TTS (requires internet)
            const audio = new Audio(
                `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`
            );
            audio.play().catch(err => {
                console.error('Could not play audio:', err);
                alert('Could not play pronunciation audio. Please check your internet connection.');
            });
        } catch (err) {
            console.error('Error playing word:', err);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'high':
            case 'severe':
                return 'text-red-600 bg-red-50 border-red-200';
            case 'medium':
            case 'moderate':
                return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'low':
            case 'mild':
                return 'text-green-600 bg-green-50 border-green-200';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const normalizeSeverity = (severity?: string): 'high' | 'medium' | 'low' => {
        if (!severity) return 'medium';
        const s = severity.toLowerCase().trim();
        if (s === 'high' || s === 'severe') return 'high';
        if (s === 'medium' || s === 'moderate') return 'medium';
        if (s === 'low' || s === 'mild') return 'low';
        return 'medium';
    };

    const getAccuracyColor = (accuracy: number) => {
        if (accuracy >= 90) return 'text-green-600';
        if (accuracy >= 75) return 'text-yellow-600';
        return 'text-red-600';
    };

    const handleWordClick = (error: MispronunciationError, errorIndex: number) => {
        setSelectedWord(error);
        setSelectedWordIndex(errorIndex);
        setActiveTab('mispronounced');

        setTimeout(() => {
            const detailElement = document.querySelector('.word-detail-card');
            if (detailElement) {
                detailElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const highlightTranscript = (transcript: string, mispronunciations: MispronunciationError[]) => {
        if (!transcript) {
            return <p className="text-gray-500 italic">No transcript available</p>;
        }

        if (!mispronunciations || mispronunciations.length === 0) {
            return <p className="text-gray-700 leading-relaxed whitespace-pre-line">{transcript}</p>;
        }

        const errorMap = new Map<string, { error: MispronunciationError; index: number }[]>();
        mispronunciations.forEach((err, idx) => {
            const word = err.word?.toLowerCase()?.trim();
            if (word) {
                if (!errorMap.has(word)) {
                    errorMap.set(word, []);
                }
                errorMap.get(word)?.push({ error: err, index: idx });
            }
        });

        const words = transcript.split(/(\s+|[.,!?;:])/);
        const usedErrors = new Set<number>();

        return (
            <p className="text-gray-700 leading-relaxed">
                {words.map((word, idx) => {
                    const cleanWord = word.toLowerCase().trim().replace(/[.,!?;:]/g, '');
                    if (!cleanWord) return <span key={idx}>{word}</span>;

                    const errorList = errorMap.get(cleanWord);
                    if (errorList && errorList.length > 0) {
                        const errorData = errorList.find(e => !usedErrors.has(e.index));
                        if (errorData) {
                            usedErrors.add(errorData.index);
                            const severity = normalizeSeverity(errorData.error.severity || 'medium');
                            return (
                                <span
                                    key={idx}
                                    onClick={() => handleWordClick(errorData.error, errorData.index)}
                                    className={`cursor-pointer font-medium underline decoration-2 hover:opacity-75 transition ${
                                        severity === 'high' ? 'text-red-600 decoration-red-400' :
                                        severity === 'medium' ? 'text-yellow-700 decoration-yellow-400' :
                                        'text-green-700 decoration-green-400'
                                    }`}
                                    title="Click for pronunciation details"
                                >
                                    {word}
                                </span>
                            );
                        }
                    }
                    return <span key={idx}>{word}</span>;
                })}
            </p>
        );
    };

    const filteredMispronunciations = myFeedback?.mispronunciations?.filter(err => {
        if (severityFilter === 'all') return true;
        return normalizeSeverity(err?.severity) === severityFilter;
    }) || [];

    useEffect(() => {
        if (activeTab !== 'mispronounced') {
            // Don't reset if we're switching TO mispronounced tab via word click
        }
    }, [activeTab]);

    useEffect(() => {
        if (selectedWordIndex >= 0 && activeTab === 'mispronounced') {
            setTimeout(() => {
                const listItem = document.querySelector(`[data-word-index="${selectedWordIndex}"]`);
                if (listItem) {
                    listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 150);
        }
    }, [selectedWordIndex, activeTab]);

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading pronunciation feedback...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{error}</h3>
                    <button
                        onClick={() => router.push('/meetings')}
                        className="text-indigo-600 hover:underline"
                    >
                        Back to Meetings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.push('/meetings')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Meetings
                </button>
                <h1 className="text-3xl font-bold text-gray-900">
                    Pronunciation Analysis for {myFeedback?.user_name || 'User'}
                </h1>
                <p className="text-gray-600 mt-2">
                    {feedback?.meeting?.title || meetingId.replace(/projectmeeting/i, 'Project Meeting ')}
                </p>
            </div>

            {/* No data for this user */}
            {!myFeedback && (
                <div className="bg-yellow-50 rounded-xl p-8 text-center border border-yellow-200">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Pronunciation Data Found</h3>
                    <p className="text-yellow-700">
                        No pronunciation feedback is available for you in this meeting.
                    </p>
                </div>
            )}

            {/* Your Stats */}
            {myFeedback && (
                <div className="space-y-6">
                    {/* Performance Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Words Spoken</p>
                            <p className="text-3xl font-bold text-gray-900">{myFeedback.total_words}</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Mispronunciations</p>
                            <p className="text-3xl font-bold text-red-600">{myFeedback.errors}</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500 mb-1">Your Accuracy</p>
                            <p className={`text-3xl font-bold ${getAccuracyColor(myFeedback.accuracy)}`}>
                                {myFeedback.accuracy.toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('transcript')}
                            className={`px-6 py-3 font-medium transition border-b-2 ${
                                activeTab === 'transcript'
                                    ? 'text-indigo-600 border-indigo-600'
                                    : 'text-gray-500 border-transparent hover:text-gray-700'
                            }`}
                        >
                            📄 Full Transcript
                        </button>
                        <button
                            onClick={() => setActiveTab('mispronounced')}
                            className={`px-6 py-3 font-medium transition border-b-2 flex items-center gap-2 ${
                                activeTab === 'mispronounced'
                                    ? 'text-indigo-600 border-indigo-600'
                                    : 'text-gray-500 border-transparent hover:text-gray-700'
                            }`}
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Mispronounced Words
                            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                                {myFeedback.mispronunciations?.length || 0}
                            </span>
                        </button>
                    </div>

                    {/* Full Transcript Tab */}
                    {activeTab === 'transcript' && (
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900">📄 Full Transcript</h3>
                                {myFeedback.mispronunciations && myFeedback.mispronunciations.length > 0 && (
                                    <span className="text-sm text-gray-500">Click on highlighted words to see pronunciation details</span>
                                )}
                            </div>
                            <div className="prose max-w-none">
                                {myFeedback.transcript ? (
                                    highlightTranscript(myFeedback.transcript, myFeedback.mispronunciations || [])
                                ) : (
                                    <p className="text-gray-500 italic">No transcript available for this meeting.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mispronounced Words Tab */}
                    {activeTab === 'mispronounced' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Side: Word List */}
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-4">
                                    <div className="p-4 border-b border-gray-200">
                                        <h3 className="font-semibold text-gray-900 mb-3">≡ Mispronounced Words</h3>
                                        <div className="flex gap-2 flex-wrap">
                                            {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
                                                <button
                                                    key={sev}
                                                    onClick={() => setSeverityFilter(sev)}
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                                                        severityFilter === sev
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="max-h-[600px] overflow-y-auto">
                                        {filteredMispronunciations.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500">
                                                <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>No words match filter</p>
                                            </div>
                                        ) : (
                                            filteredMispronunciations.map((err, idx) => {
                                                const severity = normalizeSeverity(err?.severity);
                                                const originalIndex = myFeedback.mispronunciations?.findIndex(m => m === err) ?? -1;
                                                const isActive = selectedWordIndex === originalIndex;
                                                return (
                                                    <div
                                                        key={`${err.word}-${idx}`}
                                                        data-word-index={originalIndex}
                                                        onClick={() => {
                                                            setSelectedWord(err);
                                                            setSelectedWordIndex(originalIndex);
                                                        }}
                                                        className={`p-4 border-b border-gray-100 cursor-pointer transition hover:bg-gray-50 ${
                                                            isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium text-gray-900">{err.word || 'Unknown'}</span>
                                                            <span
                                                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                                    severity === 'high' ? 'bg-red-100 text-red-700' :
                                                                    severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-green-100 text-green-700'
                                                                }`}
                                                            >
                                                                {severity}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Word Details */}
                            <div className="lg:col-span-2">
                                {!selectedWord ? (
                                    <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
                                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-600">Select a word from the list to see pronunciation details</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden word-detail-card">
                                        <div className="p-6 border-b border-gray-200">
                                            <h3 className="font-semibold text-gray-900">Pronunciation Details</h3>
                                        </div>

                                        {/* Correct Pronunciation Box */}
                                        <div className="p-6 bg-green-50 border-b border-green-100">
                                            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                                                CORRECT PRONUNCIATION
                                            </span>
                                            <div className="mt-3 mb-4">
                                                <div className="text-4xl font-bold text-green-700">
                                                    {selectedWord.expected || selectedWord.word || 'Unknown'}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-sm text-gray-600 font-mono">
                                                    {(() => {
                                                        const phonemes = selectedWord.expected_phonemes;
                                                        if (!phonemes) return 'Phonemes not available';
                                                        if (Array.isArray(phonemes) && phonemes.length > 0) {
                                                            return phonemes.join(' ');
                                                        }
                                                        if (typeof phonemes === 'string' && phonemes.trim()) {
                                                            return phonemes;
                                                        }
                                                        return 'Phonemes not available';
                                                    })()}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const wordToPlay = selectedWord.expected || selectedWord.word || '';
                                                        if (wordToPlay) playWord(wordToPlay);
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!selectedWord.expected && !selectedWord.word}
                                                >
                                                    <Volume2 className="w-4 h-4" />
                                                    Listen
                                                </button>
                                            </div>
                                        </div>

                                        {/* Error Details */}
                                        <div className="p-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-sm text-gray-500">Error Type:</span>
                                                    <p className="font-medium text-gray-900 capitalize">{selectedWord.error_type || 'pronunciation'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-sm text-gray-500">Severity:</span>
                                                    <p className={`font-medium capitalize ${
                                                        normalizeSeverity(selectedWord.severity) === 'high' ? 'text-red-600' :
                                                        normalizeSeverity(selectedWord.severity) === 'medium' ? 'text-yellow-600' :
                                                        'text-green-600'
                                                    }`}>
                                                        {normalizeSeverity(selectedWord.severity)}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-sm text-gray-500">Accuracy:</span>
                                                    <p className="font-medium text-gray-900">
                                                        {selectedWord.accuracy && selectedWord.accuracy > 0
                                                            ? `${(selectedWord.accuracy * 100).toFixed(1)}%`
                                                            : selectedWord.confidence && selectedWord.confidence > 0
                                                            ? `${(selectedWord.confidence * 100).toFixed(1)}%`
                                                            : '100.0%'
                                                        }
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-sm text-gray-500">Time in Audio:</span>
                                                    <p className="font-medium text-gray-900">
                                                        {selectedWord.start_time !== undefined && selectedWord.end_time !== undefined
                                                            ? `${selectedWord.start_time.toFixed(2)}s - ${selectedWord.end_time.toFixed(2)}s`
                                                            : 'Not available'
                                                        }
                                                    </p>
                                                </div>
                                            </div>

                                            {selectedWord.context && (
                                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                    <span className="text-sm text-gray-500">Context:</span>
                                                    <p className="text-gray-700 mt-1 italic">&quot;...{selectedWord.context}...&quot;</p>
                                                </div>
                                            )}

                                            {selectedWord.suggestion && (
                                                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <span className="text-sm text-blue-700 font-medium">💡 Suggestion:</span>
                                                    <p className="text-blue-700 mt-1">{selectedWord.suggestion}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty State for Perfect Pronunciation */}
                    {myFeedback.mispronunciations?.length === 0 && activeTab === 'mispronounced' && (
                        <div className="bg-green-50 rounded-xl p-8 text-center border border-green-200">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-green-700">Excellent Pronunciation!</h3>
                            <p className="text-green-600">No mispronunciations detected in this meeting.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
