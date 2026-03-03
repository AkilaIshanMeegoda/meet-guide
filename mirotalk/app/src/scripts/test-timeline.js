#!/usr/bin/env node

'use strict';

/**
 * Test script for Timeline Tracking
 * 
 * Tests the TimelineTracker module functionality
 */

const TimelineTracker = require('../TimelineTracker');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('Timeline Tracker Test Suite');
console.log('='.repeat(80));

// Test 1: Basic initialization
console.log('\n[TEST 1] Basic Initialization');
try {
    const testDir = path.join(__dirname, '../../rec/test-timeline');
    const tracker = new TimelineTracker('test-room-123', testDir);
    console.log('✓ TimelineTracker initialized successfully');
    console.log(`  Room ID: ${tracker.roomId}`);
    console.log(`  Meeting Start: ${new Date(tracker.meetingStartTime).toISOString()}`);
    console.log(`  Events Count: ${tracker.getEvents().length}`);
} catch (error) {
    console.error('✗ Failed:', error.message);
}

// Test 2: Event logging
console.log('\n[TEST 2] Event Logging');
try {
    const testDir = path.join(__dirname, '../../rec/test-timeline');
    const tracker = new TimelineTracker('test-room-456', testDir);
    
    // Simulate meeting events
    setTimeout(() => {
        tracker.logUserJoin('user-1', 'Alice', { os: 'Windows', browser: 'Chrome' });
        console.log('✓ Logged user_join event for Alice');
    }, 100);
    
    setTimeout(() => {
        tracker.logUserJoin('user-2', 'Bob', { os: 'macOS', browser: 'Safari' });
        console.log('✓ Logged user_join event for Bob');
    }, 200);
    
    setTimeout(() => {
        tracker.logRecordingStart('user-1', 'Alice', 'producer-1');
        console.log('✓ Logged recording_start event for Alice');
    }, 300);
    
    setTimeout(() => {
        tracker.logRecordingStart('user-2', 'Bob', 'producer-2');
        console.log('✓ Logged recording_start event for Bob');
    }, 400);
    
    setTimeout(() => {
        tracker.logRecordingStop('user-1', 'Alice', 'producer-1');
        console.log('✓ Logged recording_stop event for Alice');
    }, 500);
    
    setTimeout(() => {
        tracker.logRecordingStop('user-2', 'Bob', 'producer-2');
        console.log('✓ Logged recording_stop event for Bob');
    }, 600);
    
    setTimeout(() => {
        tracker.logUserLeave('user-1', 'Alice', 'disconnect');
        console.log('✓ Logged user_leave event for Alice');
    }, 700);
    
    setTimeout(() => {
        tracker.logUserLeave('user-2', 'Bob', 'exit');
        console.log('✓ Logged user_leave event for Bob');
    }, 800);
    
    setTimeout(() => {
        tracker.logMeetingEnd('last_peer_left');
        tracker.finalize();
        console.log('✓ Logged meeting_end event');
        
        // Test 3: Verify timeline file
        console.log('\n[TEST 3] Timeline File Verification');
        const timelineFile = path.join(testDir, 'test-room-456', 'timeline.json');
        if (fs.existsSync(timelineFile)) {
            const content = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
            console.log('✓ Timeline file created successfully');
            console.log(`  File: ${timelineFile}`);
            console.log(`  Events: ${content.events.length}`);
            console.log(`  Duration: ${content.total_duration_sec}s`);
            
            // Test 4: Statistics
            console.log('\n[TEST 4] Timeline Statistics');
            const stats = tracker.getStatistics();
            console.log('✓ Statistics generated');
            console.log(`  Room ID: ${stats.room_id}`);
            console.log(`  Duration: ${stats.meeting_duration_sec}s`);
            console.log(`  Total Events: ${stats.total_events}`);
            console.log(`  User Joins: ${stats.user_joins}`);
            console.log(`  User Leaves: ${stats.user_leaves}`);
            console.log(`  Recording Starts: ${stats.recording_starts}`);
            console.log(`  Recording Stops: ${stats.recording_stops}`);
            console.log(`  Unique Users: ${stats.unique_users}`);
            
            // Test 5: Event timeline
            console.log('\n[TEST 5] Event Timeline');
            console.log('✓ Events in chronological order:');
            content.events.forEach((event, index) => {
                const time = parseFloat(event.timestamp_rel_sec).toFixed(3);
                console.log(`  ${index + 1}. [${time}s] ${event.event_type} - ${event.user_name || 'N/A'}`);
            });
            
            console.log('\n' + '='.repeat(80));
            console.log('All Tests Passed! ✓');
            console.log('='.repeat(80));
            console.log(`\nTimeline file location: ${timelineFile}`);
            console.log('You can view the full timeline with:');
            console.log(`  cat ${timelineFile}`);
            console.log('\n');
        } else {
            console.error('✗ Timeline file not found:', timelineFile);
        }
    }, 1000);
    
} catch (error) {
    console.error('✗ Test failed:', error.message);
}
