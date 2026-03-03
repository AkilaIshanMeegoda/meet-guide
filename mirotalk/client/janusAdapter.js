/**
 * Janus WebRTC Adapter for MiroTalk
 * 
 * Purpose: Replace mediasoup client with Janus Gateway for per-participant recording
 * 
 * Usage:
 * 1. Include janus.js library: <script src="https://unpkg.com/janus-gateway@1.2.2/html/janus.js"></script>
 * 2. Import this adapter in your main client code
 * 3. Initialize with: await JanusAdapter.init(janusServerUrl, recorderUrl)
 * 4. Create room: await janusAdapter.createRoom(meetingId)
 * 5. Join & publish: await janusAdapter.joinAndPublish(userId, displayName)
 * 
 * This adapter maintains API compatibility with MiroTalk's existing mediasoup patterns
 * while routing media through Janus for recording.
 */

class JanusAdapter {
    constructor(janusServerUrl, recorderUrl) {
        this.janusServerUrl = janusServerUrl;
        this.recorderUrl = recorderUrl;
        this.janus = null;
        this.videoRoomHandle = null;
        this.localStream = null;
        this.meetingId = null;
        this.userId = null;
        this.displayName = null;
        this.publishers = new Map(); // Remote publishers
        this.recordingStarted = false;
        this.myPrivateId = null;
        this.myFeedId = null;
    }

    /**
     * Initialize Janus Gateway connection
     */
    static async init(janusServerUrl = 'http://localhost:8088/janus', recorderUrl = 'http://localhost:3001') {
        return new Promise((resolve, reject) => {
            Janus.init({
                debug: 'all',
                callback: () => {
                    console.log('[JanusAdapter] Janus library initialized');
                    const adapter = new JanusAdapter(janusServerUrl, recorderUrl);
                    resolve(adapter);
                }
            });
        });
    }

    /**
     * Connect to Janus server
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.janus = new Janus({
                server: this.janusServerUrl,
                success: () => {
                    console.log('[JanusAdapter] Connected to Janus server');
                    resolve();
                },
                error: (error) => {
                    console.error('[JanusAdapter] Connection error:', error);
                    reject(error);
                },
                destroyed: () => {
                    console.log('[JanusAdapter] Janus connection destroyed');
                }
            });
        });
    }

    /**
     * Attach to VideoRoom plugin
     */
    async attachToVideoRoom() {
        return new Promise((resolve, reject) => {
            this.janus.attach({
                plugin: 'janus.plugin.videoroom',
                success: (pluginHandle) => {
                    this.videoRoomHandle = pluginHandle;
                    console.log('[JanusAdapter] Attached to VideoRoom plugin');
                    resolve(pluginHandle);
                },
                error: (error) => {
                    console.error('[JanusAdapter] Plugin attach error:', error);
                    reject(error);
                },
                onmessage: (msg, jsep) => this.handleMessage(msg, jsep),
                onlocaltrack: (track, on) => this.handleLocalTrack(track, on),
                onremotetrack: (track, mid, on) => this.handleRemoteTrack(track, mid, on),
                oncleanup: () => this.handleCleanup()
            });
        });
    }

    /**
     * Create or join a room
     */
    async createRoom(meetingId, options = {}) {
        this.meetingId = meetingId;
        
        if (!this.janus) {
            await this.connect();
        }
        
        if (!this.videoRoomHandle) {
            await this.attachToVideoRoom();
        }

        return new Promise((resolve, reject) => {
            // First, try to create the room
            const createRequest = {
                request: 'create',
                room: parseInt(meetingId) || Math.floor(Math.random() * 1000000),
                permanent: false,
                description: options.description || `MiroTalk Meeting ${meetingId}`,
                publishers: options.maxPublishers || 50,
                audiolevel_event: true,
                audio_active_packets: 100,
                audio_level_average: 25,
                record: true, // Enable recording
                rec_dir: `/var/recordings/meetings/${meetingId}`
            };

            this.videoRoomHandle.send({
                message: createRequest,
                success: (result) => {
                    console.log('[JanusAdapter] Room created:', result);
                    resolve(result);
                },
                error: (error) => {
                    // Room might already exist, that's ok
                    if (error.includes('already exists')) {
                        console.log('[JanusAdapter] Room already exists, will join');
                        resolve({ room: meetingId });
                    } else {
                        console.error('[JanusAdapter] Create room error:', error);
                        reject(error);
                    }
                }
            });
        });
    }

    /**
     * Join room and publish local media
     */
    async joinAndPublish(userId, displayName, audioEnabled = true, videoEnabled = true) {
        this.userId = userId;
        this.displayName = displayName;

        // Get local media first
        const constraints = {
            audio: audioEnabled ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000 // Optimal for speech recognition
            } : false,
            video: videoEnabled ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            } : false
        };

        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[JanusAdapter] Got local media stream');

        return new Promise((resolve, reject) => {
            const joinRequest = {
                request: 'join',
                room: parseInt(this.meetingId),
                ptype: 'publisher',
                display: displayName
            };

            this.videoRoomHandle.send({
                message: joinRequest,
                success: (result) => {
                    console.log('[JanusAdapter] Join success, publishing...', result);
                    this.myPrivateId = result.private_id;
                    
                    // Now publish our media
                    this.publish().then(resolve).catch(reject);
                },
                error: (error) => {
                    console.error('[JanusAdapter] Join error:', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Publish local media stream
     */
    async publish() {
        return new Promise((resolve, reject) => {
            this.videoRoomHandle.createOffer({
                tracks: [
                    { type: 'audio', capture: true, recv: false },
                    { type: 'video', capture: true, recv: false }
                ],
                stream: this.localStream,
                success: (jsep) => {
                    console.log('[JanusAdapter] Created offer, sending to Janus');
                    const publishRequest = {
                        request: 'configure',
                        audio: true,
                        video: true
                    };

                    this.videoRoomHandle.send({
                        message: publishRequest,
                        jsep: jsep,
                        success: (result) => {
                            console.log('[JanusAdapter] Published successfully');
                            this.myFeedId = result.id;
                            
                            // Announce to recorder service
                            this.announceToRecorder().then(resolve).catch(reject);
                        },
                        error: reject
                    });
                },
                error: reject
            });
        });
    }

    /**
     * Announce stream to recorder service with metadata
     * CRITICAL: This tells the recorder which Janus stream belongs to which user
     */
    async announceToRecorder() {
        const announceData = {
            meetingId: this.meetingId,
            userId: this.userId,
            displayName: this.displayName,
            streamId: this.myFeedId,
            privateId: this.myPrivateId,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch(`${this.recorderUrl}/recorder/announce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(announceData)
            });

            if (!response.ok) {
                throw new Error(`Announce failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('[JanusAdapter] Announced to recorder:', result);
            this.recordingStarted = true;
            return result;
        } catch (error) {
            console.error('[JanusAdapter] Failed to announce to recorder:', error);
            // Don't fail the entire flow if recording announcement fails
            return { success: false, error: error.message };
        }
    }

    /**
     * Subscribe to remote publisher
     */
    async subscribeToPublisher(publisherId, displayName) {
        console.log(`[JanusAdapter] Subscribing to publisher ${publisherId} (${displayName})`);
        
        // Create a new handle for subscribing
        return new Promise((resolve, reject) => {
            this.janus.attach({
                plugin: 'janus.plugin.videoroom',
                success: (pluginHandle) => {
                    const subscribeRequest = {
                        request: 'join',
                        room: parseInt(this.meetingId),
                        ptype: 'subscriber',
                        feed: publisherId,
                        private_id: this.myPrivateId
                    };

                    pluginHandle.send({
                        message: subscribeRequest,
                        success: (result) => {
                            console.log('[JanusAdapter] Subscribed to publisher:', result);
                            this.publishers.set(publisherId, { handle: pluginHandle, displayName });
                            resolve(pluginHandle);
                        },
                        error: reject
                    });
                },
                error: reject,
                onmessage: (msg, jsep) => {
                    if (jsep) {
                        pluginHandle.createAnswer({
                            jsep: jsep,
                            tracks: [{ type: 'data' }],
                            success: (answerJsep) => {
                                pluginHandle.send({ message: { request: 'start' }, jsep: answerJsep });
                            },
                            error: (error) => console.error('Answer error:', error)
                        });
                    }
                },
                onremotetrack: (track, mid, on) => {
                    this.handleRemotePublisherTrack(publisherId, track, mid, on);
                }
            });
        });
    }

    /**
     * Handle messages from Janus
     */
    handleMessage(msg, jsep) {
        console.log('[JanusAdapter] Message from Janus:', msg);

        if (msg.videoroom === 'joined') {
            // We successfully joined
            this.myPrivateId = msg.private_id;
            console.log('[JanusAdapter] Successfully joined room, private_id:', this.myPrivateId);
            
            // Handle existing publishers
            if (msg.publishers && msg.publishers.length > 0) {
                msg.publishers.forEach(pub => {
                    this.subscribeToPublisher(pub.id, pub.display);
                });
            }
        } else if (msg.videoroom === 'event') {
            // Handle events (new publishers, leaving, etc.)
            if (msg.publishers && msg.publishers.length > 0) {
                msg.publishers.forEach(pub => {
                    this.subscribeToPublisher(pub.id, pub.display);
                });
            }
            
            if (msg.leaving) {
                console.log(`[JanusAdapter] Publisher ${msg.leaving} left`);
                const publisher = this.publishers.get(msg.leaving);
                if (publisher) {
                    publisher.handle.detach();
                    this.publishers.delete(msg.leaving);
                }
            }
        }

        if (jsep) {
            this.videoRoomHandle.handleRemoteJsep({ jsep });
        }
    }

    /**
     * Handle local track
     */
    handleLocalTrack(track, on) {
        console.log('[JanusAdapter] Local track:', track.kind, on ? 'added' : 'removed');
        // Emit event for UI to attach track to video element
        this.emit('localTrack', { track, enabled: on });
    }

    /**
     * Handle remote track
     */
    handleRemoteTrack(track, mid, on) {
        console.log('[JanusAdapter] Remote track:', track.kind, mid, on ? 'added' : 'removed');
    }

    /**
     * Handle remote publisher track
     */
    handleRemotePublisherTrack(publisherId, track, mid, on) {
        console.log(`[JanusAdapter] Remote publisher ${publisherId} track:`, track.kind, on ? 'added' : 'removed');
        this.emit('remoteTrack', { publisherId, track, mid, enabled: on });
    }

    /**
     * Handle cleanup
     */
    handleCleanup() {
        console.log('[JanusAdapter] Cleanup called');
        this.localStream = null;
    }

    /**
     * Leave the room and stop recording
     */
    async leave() {
        if (this.videoRoomHandle) {
            const leaveRequest = { request: 'leave' };
            this.videoRoomHandle.send({ message: leaveRequest });
            this.videoRoomHandle.detach();
        }

        // Notify recorder that we're leaving
        if (this.recordingStarted) {
            await this.notifyRecorderLeave();
        }

        if (this.janus) {
            this.janus.destroy();
        }

        this.localStream = null;
        this.publishers.clear();
    }

    /**
     * Notify recorder that user is leaving
     */
    async notifyRecorderLeave() {
        try {
            await fetch(`${this.recorderUrl}/recorder/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meetingId: this.meetingId,
                    userId: this.userId,
                    streamId: this.myFeedId,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('[JanusAdapter] Failed to notify recorder of leave:', error);
        }
    }

    /**
     * Simple event emitter
     */
    emit(event, data) {
        const customEvent = new CustomEvent(`janus:${event}`, { detail: data });
        window.dispatchEvent(customEvent);
    }

    on(event, callback) {
        window.addEventListener(`janus:${event}`, (e) => callback(e.detail));
    }
}

// Export for use in MiroTalk
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JanusAdapter;
}
