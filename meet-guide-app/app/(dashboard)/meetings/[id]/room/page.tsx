'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { meetingsApi } from '@/lib/api';
import MiroTalkEmbed from '@/components/MiroTalkEmbed';
import { ChevronLeft } from 'lucide-react';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function MeetingRoomPage({ params }: PageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const resolvedParams = React.use(params);
    const meetingId = resolvedParams.id;
    const [isMeetingEnded, setIsMeetingEnded] = useState(false);

    const handleMeetingEnd = async () => {
        setIsMeetingEnded(true);
        try {
            // Call backend API to end meeting - this triggers process_meeting.py
            // for automatic transcript generation and pronunciation analysis
            await meetingsApi.end(meetingId);
            console.log('Meeting ended and processing started for:', meetingId);
        } catch (err) {
            console.error('Failed to end meeting via API:', err);
        }
        // Redirect to meeting details after 3 seconds
        setTimeout(() => {
            router.push(`/meetings/${meetingId}`);
        }, 3000);
    };

    const handleBackClick = () => {
        if (confirm('Are you sure you want to leave the meeting?')) {
            router.push('/meetings');
        }
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-900 flex flex-col">
            {/* Header Bar */}
            <div className="bg-gray-800 shadow-lg z-10 flex items-center justify-between px-6 py-3 border-b border-gray-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBackClick}
                        className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                        title="Leave Meeting"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <div className="border-l border-gray-600 h-6 mx-2"></div>
                    <div>
                        <h1 className="text-white font-semibold text-lg">Meeting - {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</h1>
                        <p className="text-gray-400 text-sm">
                            Room: <span className="text-gray-300">{meetingId}</span> - Host: <span className="text-gray-300">{user.full_name || user.username}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-green-400 text-sm font-medium">Live</span>
                    </div>
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to end the meeting?')) {
                                handleMeetingEnd();
                            }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        End Meeting
                    </button>
                </div>
            </div>

            {/* Meeting Ended Overlay */}
            {isMeetingEnded && (
                <div className="absolute inset-0 bg-gray-900 bg-opacity-95 flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="text-green-500 text-6xl mb-4">✓</div>
                        <h2 className="text-white text-2xl font-semibold mb-2">Meeting Ended</h2>
                        <p className="text-gray-400 mb-2">Processing transcripts and pronunciation analysis...</p>
                        <p className="text-gray-500 text-sm mb-4">Redirecting to meeting details shortly</p>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                    </div>
                </div>
            )}

            {/* MiroTalk Iframe Container */}
            <div className="flex-1 overflow-hidden">
                <MiroTalkEmbed
                    meetingId={meetingId}
                    userEmail={user.email}
                    userName={user.full_name || user.username}
                    onMeetingEnd={handleMeetingEnd}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
}
