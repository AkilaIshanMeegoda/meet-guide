#!/bin/bash

# MiroTalk Recording Processor - Convenience Script
# This script makes it easier to process meeting recordings

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RECORDINGS_DIR="/home/ubuntu/mirotalk/app/src/recordings"

# Print header
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    MiroTalk Meeting Recording Processor - Helper          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if argument provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No meeting ID provided${NC}"
    echo ""
    echo "Usage:"
    echo "  $0 <meeting_id>"
    echo "  $0 <path_to_timeline.json>"
    echo ""
    echo "Examples:"
    echo "  $0 06119OldSheep2752LuckyCat"
    echo "  $0 /path/to/timeline.json"
    echo ""
    echo -e "${YELLOW}Available meetings:${NC}"
    
    # List available meetings
    if [ -d "$RECORDINGS_DIR" ]; then
        count=0
        for dir in "$RECORDINGS_DIR"/*/; do
            if [ -f "$dir/timeline.json" ]; then
                meeting_id=$(basename "$dir")
                echo "  - $meeting_id"
                count=$((count + 1))
            fi
        done
        
        if [ $count -eq 0 ]; then
            echo "  (no meetings found with timeline.json)"
        fi
    else
        echo "  (recordings directory not found: $RECORDINGS_DIR)"
    fi
    
    exit 1
fi

MEETING_INPUT="$1"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js first:"
    echo "  sudo apt install nodejs npm"
    exit 1
fi

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${RED}Error: FFmpeg is not installed${NC}"
    echo "Please install FFmpeg first:"
    echo "  sudo apt install ffmpeg"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$SCRIPT_DIR" && npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to install dependencies${NC}"
        exit 1
    fi
    echo ""
fi

# Run the processor
echo -e "${GREEN}Starting processing...${NC}"
echo ""

cd "$SCRIPT_DIR" && node process-meeting.js "$MEETING_INPUT"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Processing completed successfully!${NC}"
    
    # Show output file locations
    if [[ "$MEETING_INPUT" == *.json ]]; then
        OUTPUT_DIR=$(dirname "$MEETING_INPUT")
    else
        OUTPUT_DIR="$RECORDINGS_DIR/$MEETING_INPUT"
    fi
    
    echo ""
    echo -e "${BLUE}Output files location:${NC}"
    echo "  $OUTPUT_DIR"
    echo ""
    echo -e "${BLUE}Generated files:${NC}"
    
    if [ -d "$OUTPUT_DIR" ]; then
        if [ -f "$OUTPUT_DIR"/*_transcript.txt ]; then
            echo -e "  ${GREEN}✓${NC} Transcript: $(ls "$OUTPUT_DIR"/*_transcript.txt 2>/dev/null | xargs basename)"
        fi
        if [ -f "$OUTPUT_DIR"/*_statistics.json ]; then
            echo -e "  ${GREEN}✓${NC} Statistics: $(ls "$OUTPUT_DIR"/*_statistics.json 2>/dev/null | xargs basename)"
        fi
        if [ -f "$OUTPUT_DIR"/*_merged_audio.wav ]; then
            echo -e "  ${GREEN}✓${NC} Merged Audio: $(ls "$OUTPUT_DIR"/*_merged_audio.wav 2>/dev/null | xargs basename)"
        fi
    fi
else
    echo ""
    echo -e "${RED}❌ Processing failed with exit code $EXIT_CODE${NC}"
    exit $EXIT_CODE
fi

exit 0
