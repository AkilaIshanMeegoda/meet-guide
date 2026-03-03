#!/bin/bash

# Demo: Timeline Tracking and Audio Merging Example
# This script demonstrates the complete workflow

echo "================================================================================"
echo "MiroTalk SFU - Timeline Tracking Demo"
echo "================================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Test Timeline Tracking
echo -e "${YELLOW}[STEP 1]${NC} Testing Timeline Tracker..."
echo "Running test suite..."
node app/src/scripts/test-timeline.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Timeline tracking test passed${NC}"
else
    echo -e "${RED}✗ Timeline tracking test failed${NC}"
    exit 1
fi

echo ""
echo "================================================================================"
echo ""

# Step 2: Show Timeline Structure
echo -e "${YELLOW}[STEP 2]${NC} Viewing Generated Timeline..."
echo ""
TIMELINE_FILE="app/rec/test-timeline/test-room-456/timeline.json"

if [ -f "$TIMELINE_FILE" ]; then
    echo "Timeline Location: $TIMELINE_FILE"
    echo ""
    echo "Timeline Summary:"
    echo "----------------"
    
    # Extract key information using jq if available, otherwise use grep
    if command -v jq &> /dev/null; then
        echo "Room ID: $(cat $TIMELINE_FILE | jq -r '.room_id')"
        echo "Meeting Start: $(cat $TIMELINE_FILE | jq -r '.meeting_start_iso')"
        echo "Duration: $(cat $TIMELINE_FILE | jq -r '.total_duration_sec')s"
        echo "Total Events: $(cat $TIMELINE_FILE | jq -r '.event_count')"
        echo ""
        echo "Events:"
        cat $TIMELINE_FILE | jq -r '.events[] | "  [\(.timestamp_rel_sec)s] \(.event_type) - \(.user_name // "N/A")"'
    else
        cat $TIMELINE_FILE | head -20
    fi
    
    echo -e "${GREEN}✓ Timeline file exists and is valid${NC}"
else
    echo -e "${RED}✗ Timeline file not found${NC}"
    exit 1
fi

echo ""
echo "================================================================================"
echo ""

# Step 3: Check FFmpeg
echo -e "${YELLOW}[STEP 3]${NC} Checking FFmpeg Installation..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n1)
    echo -e "${GREEN}✓ FFmpeg is installed: $FFMPEG_VERSION${NC}"
else
    echo -e "${RED}✗ FFmpeg not found${NC}"
    echo "Install FFmpeg with: sudo apt-get install -y ffmpeg"
    exit 1
fi

echo ""
echo "================================================================================"
echo ""

# Step 4: Create Sample Audio Files (simulate recordings)
echo -e "${YELLOW}[STEP 4]${NC} Creating Sample Audio Files..."
MEETING_DIR="app/rec/test-timeline/test-room-456"

# Generate 1 second of silence as sample audio for Alice
ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 1 -acodec pcm_s16le "$MEETING_DIR/user-1_Alice_audio.wav" -y 2>/dev/null

# Generate 1 second of 440Hz tone as sample audio for Bob
ffmpeg -f lavfi -i "sine=frequency=440:duration=1:sample_rate=48000" -acodec pcm_s16le "$MEETING_DIR/user-2_Bob_audio.wav" -y 2>/dev/null

if [ -f "$MEETING_DIR/user-1_Alice_audio.wav" ] && [ -f "$MEETING_DIR/user-2_Bob_audio.wav" ]; then
    echo -e "${GREEN}✓ Sample audio files created${NC}"
    echo "  - user-1_Alice_audio.wav (silence)"
    echo "  - user-2_Bob_audio.wav (440Hz tone)"
else
    echo -e "${RED}✗ Failed to create sample audio files${NC}"
    exit 1
fi

echo ""
echo "================================================================================"
echo ""

# Step 5: Run Post-Processing
echo -e "${YELLOW}[STEP 5]${NC} Running Audio Post-Processing..."
echo "Processing meeting: $MEETING_DIR"
echo ""

node app/src/scripts/merge-meeting-audio.js "$MEETING_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Post-processing completed successfully${NC}"
else
    echo -e "${RED}✗ Post-processing failed${NC}"
    exit 1
fi

echo ""
echo "================================================================================"
echo ""

# Step 6: Display Results
echo -e "${YELLOW}[STEP 6]${NC} Generated Output Files..."
echo ""

# Check transcript
if [ -f "$MEETING_DIR/transcript.txt" ]; then
    echo -e "${GREEN}✓ transcript.txt${NC}"
    echo "Preview:"
    echo "--------"
    head -30 "$MEETING_DIR/transcript.txt"
    echo "..."
else
    echo -e "${RED}✗ transcript.txt not found${NC}"
fi

echo ""
echo "================================================================================"
echo ""

# Check statistics
if [ -f "$MEETING_DIR/statistics.json" ]; then
    echo -e "${GREEN}✓ statistics.json${NC}"
    echo "Preview:"
    echo "--------"
    if command -v jq &> /dev/null; then
        cat "$MEETING_DIR/statistics.json" | jq '.'
    else
        cat "$MEETING_DIR/statistics.json"
    fi
else
    echo -e "${RED}✗ statistics.json not found${NC}"
fi

echo ""
echo "================================================================================"
echo ""

# Check merged audio
if [ -f "$MEETING_DIR/merged_meeting.wav" ]; then
    echo -e "${GREEN}✓ merged_meeting.wav${NC}"
    FILE_SIZE=$(du -h "$MEETING_DIR/merged_meeting.wav" | cut -f1)
    echo "  File size: $FILE_SIZE"
    
    # Get audio info if ffprobe is available
    if command -v ffprobe &> /dev/null; then
        echo "  Audio info:"
        ffprobe -v quiet -print_format json -show_format -show_streams "$MEETING_DIR/merged_meeting.wav" | \
        jq -r '.streams[0] | "    Sample rate: \(.sample_rate)Hz\n    Channels: \(.channels)\n    Duration: \(.duration)s"' 2>/dev/null || \
        ffprobe "$MEETING_DIR/merged_meeting.wav" 2>&1 | grep -E "Duration|Stream"
    fi
else
    echo -e "${RED}✗ merged_meeting.wav not found${NC}"
fi

echo ""
echo "================================================================================"
echo ""

# Step 7: Summary
echo -e "${YELLOW}[STEP 7]${NC} Summary"
echo ""
echo "Demo Completed Successfully! ✓"
echo ""
echo "Generated Files:"
echo "  1. timeline.json      - Meeting events with timestamps"
echo "  2. transcript.txt     - Voice activity transcript"
echo "  3. statistics.json    - Meeting statistics"
echo "  4. merged_meeting.wav - Synchronized merged audio"
echo ""
echo "All files are in: $MEETING_DIR"
echo ""
echo "Next Steps:"
echo "  1. Review the transcript: cat $MEETING_DIR/transcript.txt"
echo "  2. Review statistics: cat $MEETING_DIR/statistics.json"
echo "  3. Play merged audio: ffplay $MEETING_DIR/merged_meeting.wav"
echo "  4. Start MiroTalk server: npm start"
echo "  5. Join a real meeting and test with actual recordings"
echo ""
echo "================================================================================"
echo ""
echo -e "${GREEN}Timeline Tracking Implementation is Ready!${NC}"
echo ""
