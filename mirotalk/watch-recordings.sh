#!/bin/bash

################################################################################
# MiroTalk Recording Watcher
# Purpose: Monitor recordings directory and organize recording files
################################################################################

RECORDING_DIR="/home/ubuntu/mirotalk/app/src/recordings"
OUTPUT_DIR="/var/recordings/meetings"
PROCESSED_LOG="/tmp/processed_recordings.log"

# Create processed log if doesn't exist
touch "$PROCESSED_LOG"

echo "[$(date)] Recording watcher started - monitoring $RECORDING_DIR"

# Function to process a single recording
process_recording() {
    local webm_file="$1"
    local meeting=$(basename $(dirname "$webm_file"))
    local filename=$(basename "$webm_file" .webm)
    local output_file="$OUTPUT_DIR/$meeting/${filename}.webm"
    
    # Check if already processed
    if grep -q "$webm_file" "$PROCESSED_LOG"; then
        return 0
    fi
    
    # Create meeting directory
    mkdir -p "$OUTPUT_DIR/$meeting"
    
    echo "[$(date)] 🎵 Processing new recording: $webm_file"
    
    # Copy to organized location
    cp "$webm_file" "$output_file"
    
    if [ $? -eq 0 ]; then
        echo "[$(date)]    ✅ Recording saved: $output_file"
        echo "$webm_file|$(date)" >> "$PROCESSED_LOG"
    else
        echo "[$(date)]    ❌ Copy failed"
    fi
}

# Process existing files first
echo "[$(date)] Scanning for existing recordings..."
for webm_file in "$RECORDING_DIR"/*/*.webm; do
    if [ -f "$webm_file" ]; then
        process_recording "$webm_file"
    fi
done

echo "[$(date)] Initial scan complete. Watching for new recordings..."

# Watch for new recordings using inotifywait if available
if command -v inotifywait &> /dev/null; then
    inotifywait -m -r -e close_write --format '%w%f' "$RECORDING_DIR" 2>/dev/null | while read file; do
        if [[ "$file" == *.webm ]]; then
            sleep 2  # Give file time to finish writing
            process_recording "$file"
        fi
    done
else
    # Fallback: poll every 30 seconds
    echo "[$(date)] inotifywait not available, using polling mode (every 30s)"
    while true; do
        for webm_file in "$RECORDING_DIR"/*/*.webm; do
            if [ -f "$webm_file" ]; then
                process_recording "$webm_file"
            fi
        done
        sleep 30
    done
fi
