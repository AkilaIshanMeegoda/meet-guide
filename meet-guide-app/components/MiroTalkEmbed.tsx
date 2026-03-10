'use client';

import { useEffect, useRef, useState } from 'react';

interface MiroTalkEmbedProps {
    meetingId: string;
    userEmail: string;
    userName?: string;
    onMeetingEnd?: () => void;
    className?: string;
}

/**
 * MiroTalk Embedded Video Conference Component
 * 
 * Embeds MiroTalk in an iframe with auto-configured user settings
 * Uses email as display name for accurate speaker identification in recordings
 */
export default function MiroTalkEmbed({
    meetingId,
    userEmail,
    userName,
    onMeetingEnd,
    className = ''
}: MiroTalkEmbedProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');

    // Build MiroTalk URL with parameters
    const mirotalkBaseUrl = process.env.NEXT_PUBLIC_MIROTALK_URL || 'http://127.0.0.1:3010';
    
    // Use email as display name for recording identification
    // This ensures the recording files are named with emails
    const displayName = userEmail;
    
    // Use the join endpoint with query parameters for auto-join with name
    // Format: /join?room=ROOM&name=NAME&audio=1&video=1&notify=0
    const mirotalkUrl = `${mirotalkBaseUrl}/join?room=${encodeURIComponent(meetingId)}&name=${encodeURIComponent(displayName)}&audio=1&video=1&notify=0`;

    // Check media permissions before loading iframe
    useEffect(() => {
        const checkPermissions = async () => {
            try {
                // Request media permissions from the parent page first
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                // Stop all tracks after getting permission
                stream.getTracks().forEach(track => track.stop());
                setPermissionStatus('granted');
            } catch (err: any) {
                console.error('Permission check error:', err);
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setPermissionStatus('denied');
                } else {
                    setPermissionStatus('prompt');
                }
            }
        };
        checkPermissions();
    }, []);

    useEffect(() => {
        // Listen for messages from MiroTalk iframe
        const handleMessage = (event: MessageEvent) => {
            // Verify origin
            if (!event.origin.includes('localhost:3010') && !event.origin.includes(mirotalkBaseUrl)) {
                return;
            }

            const { type, data } = event.data || {};

            switch (type) {
                case 'meetingEnded':
                case 'userLeft':
                    console.log('Meeting ended event received');
                    onMeetingEnd?.();
                    break;
                case 'meetingJoined':
                    console.log('User joined meeting');
                    setIsLoading(false);
                    break;
                case 'error':
                    console.error('MiroTalk error:', data);
                    setError(data?.message || 'Connection error');
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [mirotalkBaseUrl, onMeetingEnd]);

    const handleIframeLoad = () => {
        setIsLoading(false);
        console.log('Iframe loaded successfully');
        console.log('Iframe src:', iframeRef.current?.src);
    };

    const handleIframeError = () => {
    };

    const requestPermissions = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream.getTracks().forEach(track => track.stop());
            setPermissionStatus('granted');
            setError(null);
        } catch (err) {
            console.error('Permission request failed:', err);
            setPermissionStatus('denied');
        }
    };

    // Permission denied overlay
    if (permissionStatus === 'denied') {
        return (
            <div className={`relative w-full h-full min-h-[500px] bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
                <div className="text-center p-8 max-w-md">
                    <div className="text-yellow-500 text-6xl mb-4">🎤</div>
                    <h3 className="text-white text-xl font-semibold mb-2">Camera & Microphone Access Required</h3>
                    <p className="text-gray-400 mb-4">
                        To join the meeting with audio and video, please allow access to your camera and microphone.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={requestPermissions}
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                            Allow Camera & Microphone
                        </button>
                        <p className="text-gray-500 text-sm">
                            If the button doesn&apos;t work, click the camera icon in your browser&apos;s address bar and allow permissions.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Still checking permissions
    if (permissionStatus === 'checking') {
        return (
            <div className={`relative w-full h-full min-h-[500px] bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-white text-lg">Checking permissions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative w-full h-full bg-gray-900 overflow-hidden ${className}`} style={{ minHeight: 'calc(100vh - 70px)' }}>
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-white text-lg">Connecting to meeting...</p>
                        <p className="text-gray-400 text-sm mt-2">Room: {meetingId}</p>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center p-6">
                        <div className="text-red-500 text-5xl mb-4">⚠</div>
                        <p className="text-white text-lg mb-2">Connection Error</p>
                        <p className="text-gray-400 text-sm mb-4">{error}</p>
                        <button
                            onClick={() => {
                                setError(null);
                                setIsLoading(true);
                                iframeRef.current?.contentWindow?.location.reload();
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                            Retry Connection
                        </button>
                    </div>
                </div>
            )}

            {/* MiroTalk iframe - full screen */}
            <iframe
                ref={iframeRef}
                src={mirotalkUrl}
                className="absolute inset-0 w-full h-full border-0"
                allow="camera *; microphone *; display-capture *; autoplay *; clipboard-write *; clipboard-read *; fullscreen *"
                allowFullScreen
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="MiroTalk Meeting Room"
            />
        </div>
    );
}
