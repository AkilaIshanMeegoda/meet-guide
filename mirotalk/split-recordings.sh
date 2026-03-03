#!/bin/bash

################################################################################
# MiroTalk Recording Post-Processor
# Purpose: Convert MiroTalk WebM recordings to WAV and trigger transcription
################################################################################

RECORDING_DIR="/home/ubuntu/mirotalk/app/src/recordings"
OUTPUT_DIR="/var/recordings/meetings"
TRANSCRIBE_URL="http://localhost:3000/transcribe"

echo "======================================"
echo "MiroTalk Recording Post-Processor"
echo "======================================"
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Counter for processed files
processed=0
skipped=0

# Process each WebM file
for webm_file in "$RECORDING_DIR"/*/*.webm; do
    if [ ! -f "$webm_file" ]; then
        echo "No recordings found."
        exit 0
    fi
    
    # Extract meeting ID and filename
    meeting=$(basename $(dirname "$webm_file"))
    filename=$(basename "$webm_file" .webm)
    
    # Create meeting directory
    mkdir -p "$OUTPUT_DIR/$meeting"
    
    # Output WAV path
    wav_file="$OUTPUT_DIR/$meeting/${filename}.wav"
    
    # Skip if already processed
    if [ -f "$wav_file" ]; then
        echo "⏭️  Skipping (already exists): $wav_file"
        ((skipped++))
        continue
    fi
    
    echo "🎵 Processing: $webm_file"
    echo "   → Output: $wav_file"
    
    # Convert to WAV (16kHz mono, optimal for speech recognition)
    ffmpeg -i "$webm_file" \
           -vn \
           -acodec pcm_s16le \
           -ar 16000 \
           -ac 1 \
           -f wav \
           "$wav_file" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Conversion successful"
        
        # Get file size and duration
        size=$(stat -f%z "$wav_file" 2>/dev/null || stat -c%s "$wav_file" 2>/dev/null)
        duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$wav_file" 2>/dev/null | cut -d. -f1)
        
        echo "   📊 Size: $size bytes, Duration: ${duration}s"
        
        # Get file modification time
        file_time=$(stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%SZ" "$webm_file" 2>/dev/null || date -u -r "$webm_file" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
        
        # Trigger transcription webhook
        echo "   🔗 Triggering transcription webhook..."
        
        # Create JSON payload file to avoid escaping issues
        cat > /tmp/transcribe_payload.json <<EOF
{
  "meetingId": "$meeting",
  "userId": "$filename",
  "displayName": "Participant",
  "localPath": "$wav_file",
  "duration": ${duration:-0},
  "startTimeUTC": "$file_time"
}
EOF
        
        response=$(curl -s -X POST "$TRANSCRIBE_URL" \
             -H "Content-Type: application/json" \
             -d @/tmp/transcribe_payload.json)
        
        job_id=$(echo "$response" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
        
        if [ -n "$job_id" ]; then
            echo "   ✅ Transcription queued: Job ID $job_id"
        else
            echo "   ⚠️  Warning: Transcription webhook may have failed"
            echo "   Response: $response"
        fi
        
        ((processed++))
    else
        echo "   ❌ Conversion failed"
    fi
    
    echo ""
done

echo "======================================"
echo "Processing Complete"
echo "======================================"
echo "Processed: $processed files"
echo "Skipped: $skipped files"
echo ""
echo "Check results:"
echo "  Recordings: ls -lh $OUTPUT_DIR/*/"
echo "  Jobs: ls -lh /var/transcribe/jobs/"
echo "  Logs: cat /tmp/transcribe.log"
echo ""
