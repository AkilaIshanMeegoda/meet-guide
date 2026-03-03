#!/bin/bash

# Create sample audio files for testing the meeting processor
# This generates synthetic audio files that match the timeline.json

MEETING_DIR="$1"

if [ -z "$MEETING_DIR" ]; then
    echo "Usage: $0 <meeting_directory>"
    echo ""
    echo "Example:"
    echo "  $0 /home/ubuntu/mirotalk/app/src/recordings/06119OldSheep2752LuckyCat"
    exit 1
fi

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: FFmpeg is not installed"
    echo "Please install FFmpeg first: sudo apt install ffmpeg"
    exit 1
fi

# Check if timeline.json exists
TIMELINE_FILE="$MEETING_DIR/timeline.json"
if [ ! -f "$TIMELINE_FILE" ]; then
    echo "Error: timeline.json not found in $MEETING_DIR"
    exit 1
fi

echo "Creating sample audio files for testing..."
echo "Meeting directory: $MEETING_DIR"
echo ""

# Extract meeting info from timeline.json
ROOM_ID=$(jq -r '.room_id' "$TIMELINE_FILE")
TOTAL_DURATION=$(jq -r '.total_duration_sec' "$TIMELINE_FILE")

echo "Room ID: $ROOM_ID"
echo "Total Duration: ${TOTAL_DURATION}s"
echo ""

# Parse users and their recording times from timeline.json
USERS=$(jq -r '.events[] | select(.event_type == "recording_start") | .user_name' "$TIMELINE_FILE" | sort -u)

for USER in $USERS; do
    # Get the recording start timestamp for this user
    START_TIME=$(jq -r ".events[] | select(.event_type == \"recording_start\" and .user_name == \"$USER\") | .timestamp_rel_sec" "$TIMELINE_FILE" | head -1)
    
    # Get the recording end time (either recording_stop or user_leave)
    END_TIME=$(jq -r ".events[] | select((.event_type == \"recording_stop\" or .event_type == \"user_leave\") and .user_name == \"$USER\") | .timestamp_rel_sec" "$TIMELINE_FILE" | head -1)
    
    if [ -z "$END_TIME" ]; then
        END_TIME="$TOTAL_DURATION"
    fi
    
    # Calculate duration
    DURATION=$(echo "$END_TIME - $START_TIME" | bc)
    
    # Generate timestamp for filename (use current timestamp)
    TIMESTAMP=$(date +%s)
    
    # Create output filename
    OUTPUT_FILE="$MEETING_DIR/Rec_${ROOM_ID}_${USER}_${TIMESTAMP}.wav"
    
    echo "Creating audio for user: $USER"
    echo "  Duration: ${DURATION}s"
    echo "  File: $(basename "$OUTPUT_FILE")"
    
    # Generate a sine wave tone at different frequencies for each user
    # This makes it easy to distinguish users in the merged audio
    FREQUENCY=440
    case "$USER" in
        akila|user1|alice)
            FREQUENCY=440  # A4 note
            ;;
        ishan|user2|bob)
            FREQUENCY=523  # C5 note
            ;;
        user3|charlie)
            FREQUENCY=659  # E5 note
            ;;
        *)
            FREQUENCY=349  # F4 note
            ;;
    esac
    
    # Generate audio file with tone
    ffmpeg -f lavfi -i "sine=frequency=${FREQUENCY}:duration=${DURATION}" \
           -ar 48000 -ac 1 \
           "$OUTPUT_FILE" \
           -y -loglevel quiet
    
    if [ $? -eq 0 ]; then
        echo "  ✓ Created successfully"
    else
        echo "  ✗ Failed to create"
    fi
    echo ""
done

echo "Sample audio files created!"
echo ""
echo "You can now test the processor:"
echo "  cd /home/ubuntu/mirotalk/app/src/recordings"
echo "  ./process.sh $(basename "$MEETING_DIR")"
echo ""
echo "Note: These are synthetic audio files for testing only."
echo "      Real recordings will have actual voice content."
