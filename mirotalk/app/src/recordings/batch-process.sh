#!/bin/bash

# Batch process all meetings in the recordings directory
# This script processes all meetings that have a timeline.json file

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RECORDINGS_DIR="/home/ubuntu/mirotalk/app/src/recordings"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    MiroTalk Batch Recording Processor                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if recordings directory exists
if [ ! -d "$RECORDINGS_DIR" ]; then
    echo -e "${RED}Error: Recordings directory not found: $RECORDINGS_DIR${NC}"
    exit 1
fi

# Find all meetings with timeline.json
MEETINGS=()
for dir in "$RECORDINGS_DIR"/*/; do
    if [ -f "$dir/timeline.json" ]; then
        meeting_id=$(basename "$dir")
        MEETINGS+=("$meeting_id")
    fi
done

# Check if any meetings found
if [ ${#MEETINGS[@]} -eq 0 ]; then
    echo -e "${YELLOW}No meetings found with timeline.json files${NC}"
    echo ""
    echo "Meetings should be in: $RECORDINGS_DIR"
    echo "Each meeting should have a timeline.json file"
    exit 0
fi

# Display found meetings
echo -e "${CYAN}Found ${#MEETINGS[@]} meeting(s) to process:${NC}"
for meeting in "${MEETINGS[@]}"; do
    echo "  - $meeting"
done
echo ""

# Ask for confirmation
if [ "$1" != "-y" ] && [ "$1" != "--yes" ]; then
    read -p "Do you want to process all meetings? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
    echo ""
fi

# Process each meeting
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_MEETINGS=()

for i in "${!MEETINGS[@]}"; do
    meeting_id="${MEETINGS[$i]}"
    meeting_num=$((i + 1))
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Processing meeting $meeting_num/${#MEETINGS[@]}: $meeting_id${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Check if already processed
    MEETING_DIR="$RECORDINGS_DIR/$meeting_id"
    if [ -f "$MEETING_DIR/${meeting_id}_transcript.txt" ] && 
       [ -f "$MEETING_DIR/${meeting_id}_statistics.json" ]; then
        
        if [ "$1" != "-f" ] && [ "$1" != "--force" ]; then
            echo -e "${YELLOW}⏭️  Skipping (already processed)${NC}"
            echo -e "${YELLOW}   Use -f or --force to reprocess${NC}"
            SKIP_COUNT=$((SKIP_COUNT + 1))
            echo ""
            continue
        else
            echo -e "${YELLOW}♻️  Reprocessing (forced)${NC}"
            echo ""
        fi
    fi
    
    # Process the meeting
    cd "$SCRIPT_DIR" && node process-meeting.js "$meeting_id"
    
    if [ $? -eq 0 ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo ""
        echo -e "${GREEN}✅ Successfully processed: $meeting_id${NC}"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAILED_MEETINGS+=("$meeting_id")
        echo ""
        echo -e "${RED}❌ Failed to process: $meeting_id${NC}"
    fi
    
    echo ""
done

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Batch Processing Summary                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total meetings: ${#MEETINGS[@]}"
echo -e "${GREEN}Successfully processed: $SUCCESS_COUNT${NC}"
if [ $SKIP_COUNT -gt 0 ]; then
    echo -e "${YELLOW}Skipped (already processed): $SKIP_COUNT${NC}"
fi
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}Failed: $FAIL_COUNT${NC}"
    echo ""
    echo -e "${RED}Failed meetings:${NC}"
    for meeting in "${FAILED_MEETINGS[@]}"; do
        echo "  - $meeting"
    done
fi

echo ""

# Calculate total output files
TOTAL_TRANSCRIPTS=$(find "$RECORDINGS_DIR" -name "*_transcript.txt" | wc -l)
TOTAL_STATISTICS=$(find "$RECORDINGS_DIR" -name "*_statistics.json" | wc -l)
TOTAL_AUDIO=$(find "$RECORDINGS_DIR" -name "*_merged_audio.wav" | wc -l)

echo -e "${CYAN}Total output files:${NC}"
echo "  Transcripts: $TOTAL_TRANSCRIPTS"
echo "  Statistics: $TOTAL_STATISTICS"
echo "  Merged Audio: $TOTAL_AUDIO"

echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}All meetings processed successfully! 🎉${NC}"
    exit 0
else
    echo -e "${YELLOW}Some meetings failed to process${NC}"
    exit 1
fi
