'use strict';

/**
 * TimelineTracker - Real-time meeting timeline tracking
 * 
 * Tracks all meeting events with precise timestamps relative to meeting start time.
 * Records user join/leave events, recording start/stop events, and meeting lifecycle.
 * Saves all events to timeline.json for post-processing and synchronization.
 * 
 * @author MiroTalk SFU Timeline Extension
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');
const log = new Logger('TimelineTracker');

class TimelineTracker {
    /**
     * Initialize timeline tracker for a meeting
     * @param {string} roomId - Unique meeting/room identifier
     * @param {string} recordingsDir - Base directory for recordings (e.g., /var/recordings/meetings)
     */
    constructor(roomId, recordingsDir = '/var/recordings/meetings') {
        this.roomId = roomId;
        this.meetingStartTime = Date.now(); // Absolute timestamp in milliseconds
        this.events = [];
        
        // Create meeting-specific directory
        this.meetingDir = path.join(recordingsDir, roomId);
        this.timelineFile = path.join(this.meetingDir, 'timeline.json');
        
        // Ensure directory exists
        this._ensureDirectory();
        
        // Log meeting start event
        this.logEvent('meeting_start', {
            room_id: roomId,
            timestamp_abs: this.meetingStartTime,
        });
        
        log.info(`Timeline tracker initialized for room: ${roomId}`, {
            meeting_dir: this.meetingDir,
            start_time: new Date(this.meetingStartTime).toISOString(),
        });
    }

    /**
     * Ensure the meeting directory exists
     * @private
     */
    _ensureDirectory() {
        try {
            if (!fs.existsSync(this.meetingDir)) {
                fs.mkdirSync(this.meetingDir, { recursive: true });
                log.debug(`Created meeting directory: ${this.meetingDir}`);
            }
        } catch (error) {
            log.error('Failed to create meeting directory', {
                error: error.message,
                directory: this.meetingDir,
            });
            throw error;
        }
    }

    /**
     * Calculate relative timestamp from meeting start
     * @param {number} absoluteTimestamp - Absolute timestamp in milliseconds
     * @returns {number} Milliseconds since meeting start
     * @private
     */
    _getRelativeTimestamp(absoluteTimestamp = Date.now()) {
        return absoluteTimestamp - this.meetingStartTime;
    }

    /**
     * Log a timeline event
     * @param {string} eventType - Type of event (meeting_start, user_join, user_leave, recording_start, recording_stop, meeting_end)
     * @param {object} data - Event-specific data
     */
    logEvent(eventType, data = {}) {
        const absoluteTimestamp = Date.now();
        const relativeTimestamp = this._getRelativeTimestamp(absoluteTimestamp);

        const event = {
            event_type: eventType,
            timestamp_abs: absoluteTimestamp,
            timestamp_rel_ms: relativeTimestamp,
            timestamp_rel_sec: (relativeTimestamp / 1000).toFixed(3),
            iso_time: new Date(absoluteTimestamp).toISOString(),
            ...data,
        };

        this.events.push(event);

        log.debug(`Timeline event logged: ${eventType}`, {
            room_id: this.roomId,
            relative_time: `${event.timestamp_rel_sec}s`,
            data: data,
        });

        // Auto-save after each event to prevent data loss
        this._saveTimeline();
    }

    /**
     * Log user join event
     * @param {string} userId - User/peer socket ID
     * @param {string} userName - User display name
     * @param {object} peerInfo - Additional peer information
     */
    logUserJoin(userId, userName, peerInfo = {}) {
        this.logEvent('user_join', {
            user_id: userId,
            user_name: userName,
            peer_info: peerInfo,
        });
    }

    /**
     * Log user leave event
     * @param {string} userId - User/peer socket ID
     * @param {string} userName - User display name
     * @param {string} reason - Reason for leaving (disconnect, exit, kicked, etc.)
     */
    logUserLeave(userId, userName, reason = 'unknown') {
        this.logEvent('user_leave', {
            user_id: userId,
            user_name: userName,
            reason: reason,
        });
    }

    /**
     * Log recording start event (when user enables microphone)
     * @param {string} userId - User/peer socket ID
     * @param {string} userName - User display name
     * @param {string} producerId - MediaSoup producer ID
     * @param {string} audioFile - Expected audio filename (optional)
     */
    logRecordingStart(userId, userName, producerId, audioFile = null) {
        this.logEvent('recording_start', {
            user_id: userId,
            user_name: userName,
            producer_id: producerId,
            audio_file: audioFile,
        });
    }

    /**
     * Log recording stop event (when user disables microphone)
     * @param {string} userId - User/peer socket ID
     * @param {string} userName - User display name
     * @param {string} producerId - MediaSoup producer ID
     * @param {string} audioFile - Recorded audio filename (optional)
     */
    logRecordingStop(userId, userName, producerId, audioFile = null) {
        this.logEvent('recording_stop', {
            user_id: userId,
            user_name: userName,
            producer_id: producerId,
            audio_file: audioFile,
        });
    }

    /**
     * Log meeting end event
     * @param {string} reason - Reason for meeting end
     */
    logMeetingEnd(reason = 'last_peer_left') {
        this.logEvent('meeting_end', {
            reason: reason,
            total_duration_ms: this._getRelativeTimestamp(),
            total_duration_sec: (this._getRelativeTimestamp() / 1000).toFixed(3),
        });
    }

    /**
     * Save timeline to JSON file
     * @private
     */
    _saveTimeline() {
        try {
            const timelineData = {
                room_id: this.roomId,
                meeting_start_time: this.meetingStartTime,
                meeting_start_iso: new Date(this.meetingStartTime).toISOString(),
                total_duration_ms: this._getRelativeTimestamp(),
                total_duration_sec: (this._getRelativeTimestamp() / 1000).toFixed(3),
                event_count: this.events.length,
                events: this.events,
            };

            fs.writeFileSync(this.timelineFile, JSON.stringify(timelineData, null, 2), 'utf8');

            log.debug('Timeline saved', {
                room_id: this.roomId,
                file: this.timelineFile,
                event_count: this.events.length,
            });
        } catch (error) {
            log.error('Failed to save timeline', {
                error: error.message,
                file: this.timelineFile,
            });
        }
    }

    /**
     * Get all events
     * @returns {Array} Array of timeline events
     */
    getEvents() {
        return this.events;
    }

    /**
     * Get timeline statistics
     * @returns {object} Timeline statistics
     */
    getStatistics() {
        const userJoinEvents = this.events.filter(e => e.event_type === 'user_join');
        const userLeaveEvents = this.events.filter(e => e.event_type === 'user_leave');
        const recordingStartEvents = this.events.filter(e => e.event_type === 'recording_start');
        const recordingStopEvents = this.events.filter(e => e.event_type === 'recording_stop');

        return {
            room_id: this.roomId,
            meeting_duration_ms: this._getRelativeTimestamp(),
            meeting_duration_sec: (this._getRelativeTimestamp() / 1000).toFixed(3),
            total_events: this.events.length,
            user_joins: userJoinEvents.length,
            user_leaves: userLeaveEvents.length,
            recording_starts: recordingStartEvents.length,
            recording_stops: recordingStopEvents.length,
            unique_users: new Set(userJoinEvents.map(e => e.user_id)).size,
        };
    }

    /**
     * Force save timeline (useful before shutdown)
     */
    finalize() {
        this._saveTimeline();
        log.info('Timeline finalized', {
            room_id: this.roomId,
            statistics: this.getStatistics(),
        });
    }
}

module.exports = TimelineTracker;
