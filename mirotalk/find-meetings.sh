#!/bin/bash

# Script to find and process MiroTalk meeting recordings

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                           ║"
echo "║              🔍 FIND & PROCESS MEETING RECORDINGS                         ║"
echo "║                                                                           ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

RECORDING_DIR="/home/ubuntu/mirotalk/app/rec"

echo "📁 Searching for meetings in: $RECORDING_DIR"
echo ""

# Find all timeline.json files
TIMELINES=$(find "$RECORDING_DIR" -name "timeline.json" 2>/dev/null)

if [ -z "$TIMELINES" ]; then
    echo "❌ No meetings found with timeline.json"
    echo ""
    echo "This could mean:"
    echo "  1. No meetings have been conducted yet"
    echo "  2. The server hasn't been restarted with the new code"
    echo "  3. Recordings are in a different directory"
    echo ""
    echo "💡 To test the system, run:"
    echo "   node app/src/scripts/test-timeline.js"
    exit 1
fi

echo "✅ Found meeting timelines:"
echo ""

# List all meetings with timeline
MEETING_COUNT=0
declare -a MEETING_DIRS

while IFS= read -r timeline; do
    MEETING_COUNT=$((MEETING_COUNT + 1))
    MEETING_DIR=$(dirname "$timeline")
    MEETING_DIRS+=("$MEETING_DIR")
    
    ROOM_ID=$(basename "$MEETING_DIR")
    
    # Check if already processed
    if [ -f "$MEETING_DIR/merged_meeting.wav" ]; then
        STATUS="✅ PROCESSED"
    else
        STATUS="⏳ NOT PROCESSED"
    fi
    
    # Get meeting info from timeline
    if [ -f "$timeline" ]; then
        DURATION=$(grep -o '"total_duration_sec":"[^"]*"' "$timeline" | cut -d'"' -f4)
        EVENT_COUNT=$(grep -o '"event_count":[0-9]*' "$timeline" | cut -d':' -f2)
        echo "[$MEETING_COUNT] $STATUS - Meeting: $ROOM_ID"
        echo "    Directory: $MEETING_DIR"
        echo "    Duration: ${DURATION}s | Events: $EVENT_COUNT"
        
        # Check for audio files
        AUDIO_FILES=$(find "$MEETING_DIR" -name "*.webm" -o -name "*.wav" | wc -l)
        echo "    Audio files: $AUDIO_FILES"
        
        # Show files
        echo "    Files:"
        ls -lh "$MEETING_DIR" | awk 'NR>1 {printf "      - %s (%s)\n", $9, $5}'
        echo ""
    fi
done <<< "$TIMELINES"

echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Offer to process unprocessed meetings
if [ $MEETING_COUNT -gt 0 ]; then
    echo "💡 NEXT STEPS:"
    echo ""
    
    UNPROCESSED=0
    for dir in "${MEETING_DIRS[@]}"; do
        if [ ! -f "$dir/merged_meeting.wav" ]; then
            UNPROCESSED=$((UNPROCESSED + 1))
        fi
    done
    
    if [ $UNPROCESSED -gt 0 ]; then
        echo "You have $UNPROCESSED unprocessed meeting(s)."
        echo ""
        echo "To process a specific meeting:"
        echo "  node app/src/scripts/merge-meeting-audio.js <meeting-directory>"
        echo ""
        echo "Example:"
        echo "  node app/src/scripts/merge-meeting-audio.js ${MEETING_DIRS[0]}"
        echo ""
        echo "Or process ALL unprocessed meetings:"
        echo ""
        
        for dir in "${MEETING_DIRS[@]}"; do
            if [ ! -f "$dir/merged_meeting.wav" ]; then
                echo "  node app/src/scripts/merge-meeting-audio.js $dir"
            fi
        done
        echo ""
    else
        echo "✅ All meetings have been processed!"
        echo ""
        echo "To view results:"
        echo "  cat ${MEETING_DIRS[0]}/transcript.txt"
        echo "  cat ${MEETING_DIRS[0]}/statistics.json"
        echo "  ffplay ${MEETING_DIRS[0]}/merged_meeting.wav"
    fi
fi

echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📚 For more information:"
echo "  • Quick Start: cat TIMELINE_QUICK_START.md"
echo "  • Full Guide: cat TIMELINE_TRACKING_README.md"
echo ""
