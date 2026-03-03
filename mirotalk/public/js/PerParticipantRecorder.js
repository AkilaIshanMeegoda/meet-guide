/**
 * Per-Participant Audio Recorder
 * Records each participant's audio stream separately
 */

class PerParticipantRecorder {
    constructor(roomClient) {
        this.rc = roomClient;
        this.recorders = new Map(); // Map<peerId, {recorder: MediaRecorder, chunks: [], name: string}>
        this.isRecording = false;
        this.meetingId = null;
        this.recSyncTime = 1000; // Sync every 1 second
        this.serverEndpoint = '/recSync';
    }

    /**
     * Start recording all participants
     */
    async startRecording() {
        if (this.isRecording) {
            console.warn('Already recording');
            return;
        }

        this.isRecording = true;
        this.meetingId = this.rc.room_id;
        
        console.log('[PerParticipant] Starting recording for meeting:', this.meetingId);

        // Record local user's audio
        await this.recordLocalAudio();

        // Record each remote participant's audio
        this.recordRemoteParticipants();

        // Listen for new participants joining
        this.setupParticipantListeners();

        return { success: true, message: 'Per-participant recording started' };
    }

    /**
     * Record local user's microphone
     */
    async recordLocalAudio() {
        try {
            const localAudioStream = this.rc.localAudioStream;
            if (!localAudioStream || localAudioStream.getAudioTracks().length === 0) {
                console.warn('[PerParticipant] No local audio stream available');
                return;
            }

            const peerId = this.rc.peer_id;
            const peerName = this.rc.peer_name || 'Unknown';
            
            this.startRecordingForPeer(peerId, localAudioStream, peerName, true);
            console.log('[PerParticipant] Started recording local user:', peerName);
        } catch (error) {
            console.error('[PerParticipant] Error recording local audio:', error);
        }
    }

    /**
     * Record all remote participants
     */
    recordRemoteParticipants() {
        // Get all audio elements for remote participants
        const audioElements = document.querySelectorAll('audio');
        
        audioElements.forEach((audioElement) => {
            // Skip avatar preview, local audio producer, and empty streams
            if (audioElement.id === 'avatarPreviewAudio' || 
                audioElement.getAttribute('name') === 'LOCAL-AUDIO' ||
                !audioElement.srcObject) {
                return;
            }

            try {
                // Extract peer info from element ID or attributes
                const peerId = audioElement.getAttribute('data-peer-id') || audioElement.id;
                const peerName = audioElement.getAttribute('data-peer-name') || 'Remote';
                
                const audioStream = audioElement.srcObject;
                if (audioStream && audioStream.getAudioTracks().length > 0) {
                    this.startRecordingForPeer(peerId, audioStream, peerName, false);
                    console.log('[PerParticipant] Started recording remote user:', peerName);
                }
            } catch (error) {
                console.error('[PerParticipant] Error recording remote participant:', error);
            }
        });
    }

    /**
     * Start recording for a specific peer
     */
    startRecordingForPeer(peerId, audioStream, peerName, isLocal) {
        if (this.recorders.has(peerId)) {
            console.warn('[PerParticipant] Already recording peer:', peerId);
            return;
        }

        try {
            // Create a new MediaStream with only this peer's audio
            const singleAudioStream = new MediaStream();
            const audioTracks = audioStream.getAudioTracks();
            
            if (audioTracks.length === 0) {
                console.warn('[PerParticipant] No audio tracks for peer:', peerId);
                return;
            }

            audioTracks.forEach(track => singleAudioStream.addTrack(track));

            // Get supported MIME type
            const mimeType = this.getSupportedMimeType();
            const options = { mimeType };

            // Create MediaRecorder for this peer
            const recorder = new MediaRecorder(singleAudioStream, options);
            const chunks = [];
            const fileName = this.generateFileName(peerId, peerName);

            recorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                    // Sync to server if enabled
                    if (this.rc.recording?.recSyncServerRecording) {
                        await this.syncChunkToServer(event.data, fileName);
                    }
                }
            };

            recorder.onstop = async () => {
                console.log('[PerParticipant] Recorder stopped for:', peerName);
                if (!this.rc.recording?.recSyncServerRecording && chunks.length > 0) {
                    await this.saveRecording(chunks, fileName);
                } else if (this.rc.recording?.recSyncServerRecording) {
                    await this.finalizeServerRecording(fileName);
                }
            };

            recorder.onerror = (error) => {
                console.error('[PerParticipant] Recorder error for', peerName, ':', error);
            };

            // Store recorder info
            this.recorders.set(peerId, {
                recorder,
                chunks,
                name: peerName,
                fileName,
                isLocal,
                startTime: Date.now()
            });

            // Start recording
            recorder.start(this.recSyncTime);
            console.log(`[PerParticipant] Recording started for ${peerName} (${peerId})`);

        } catch (error) {
            console.error('[PerParticipant] Error starting recorder for peer:', peerId, error);
        }
    }

    /**
     * Generate unique filename for this participant
     */
    generateFileName(peerId, peerName) {
        const sanitizedName = peerName.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        return `Rec_${this.meetingId}_${peerId}_${sanitizedName}_${timestamp}.webm`;
    }

    /**
     * Get supported MIME type
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return ''; // Default
    }

    /**
     * Sync recording chunk to server
     */
    async syncChunkToServer(blob, fileName) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const response = await axios.post(
                `${this.serverEndpoint}?fileName=${fileName}`,
                arrayBuffer,
                {
                    headers: {
                        'Content-Type': 'application/octet-stream',
                    },
                }
            );
            console.log('[PerParticipant] Chunk synced:', fileName);
        } catch (error) {
            console.error('[PerParticipant] Error syncing chunk:', error);
        }
    }

    /**
     * Finalize server recording
     */
    async finalizeServerRecording(fileName) {
        try {
            await axios.post('/recSyncFinalize', { fileName });
            console.log('[PerParticipant] Recording finalized:', fileName);
        } catch (error) {
            console.error('[PerParticipant] Error finalizing recording:', error);
        }
    }

    /**
     * Save recording locally
     */
    async saveRecording(chunks, fileName) {
        try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log('[PerParticipant] Recording saved:', fileName);
        } catch (error) {
            console.error('[PerParticipant] Error saving recording:', error);
        }
    }

    /**
     * Setup listeners for new participants joining
     */
    setupParticipantListeners() {
        // This would hook into the existing socket listeners
        // When a new peer joins, start recording their audio
        const originalConsumer = this.rc.consume;
        const self = this;

        this.rc.consume = async function(...args) {
            const result = await originalConsumer.apply(this, args);
            
            // If this is an audio track, start recording it
            if (self.isRecording && args[3] === 'audio') { // type parameter
                const [producer_id, peer_name, peer_info] = args;
                setTimeout(() => {
                    self.recordRemoteParticipants();
                }, 1000);
            }
            
            return result;
        };
    }

    /**
     * Stop recording all participants
     */
    async stopRecording() {
        if (!this.isRecording) {
            console.warn('[PerParticipant] Not recording');
            return;
        }

        console.log('[PerParticipant] Stopping all recordings...');
        this.isRecording = false;

        const stopPromises = [];
        
        for (const [peerId, recorderInfo] of this.recorders.entries()) {
            try {
                if (recorderInfo.recorder.state !== 'inactive') {
                    recorderInfo.recorder.stop();
                }
                const duration = ((Date.now() - recorderInfo.startTime) / 1000).toFixed(2);
                console.log(`[PerParticipant] Stopped recording for ${recorderInfo.name} (${duration}s)`);
            } catch (error) {
                console.error('[PerParticipant] Error stopping recorder:', peerId, error);
            }
        }

        // Clear recorders after a delay to allow finalizing
        setTimeout(() => {
            this.recorders.clear();
            console.log('[PerParticipant] All recordings stopped');
        }, 2000);

        return { success: true, message: 'Per-participant recording stopped', count: this.recorders.size };
    }

    /**
     * Get recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            participantCount: this.recorders.size,
            participants: Array.from(this.recorders.entries()).map(([peerId, info]) => ({
                peerId,
                name: info.name,
                isLocal: info.isLocal,
                duration: ((Date.now() - info.startTime) / 1000).toFixed(2)
            }))
        };
    }
}

// Export for use in RoomClient
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerParticipantRecorder;
}
