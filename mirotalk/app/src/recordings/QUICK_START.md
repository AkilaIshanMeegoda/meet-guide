# Quick Start Guide - MiroTalk Recording Processor

## 📋 Prerequisites Check

```bash
# Check Node.js
node --version  # Should be v14+

# Check FFmpeg
ffmpeg -version  # Should display FFmpeg info

# If missing, install:
sudo apt update
sudo apt install nodejs npm ffmpeg
```

## 🚀 Installation

```bash
cd /home/ubuntu/mirotalk/app/src/recordings
npm install
```

## 💡 Quick Usage

### Process a Single Meeting

```bash
# Method 1: Using the helper script (recommended)
./process.sh 06119OldSheep2752LuckyCat

# Method 2: Direct Node.js call
node process-meeting.js 06119OldSheep2752LuckyCat

# Method 3: Using full path
node process-meeting.js /path/to/timeline.json
```

### Process All Meetings

```bash
# Interactive (asks for confirmation)
./batch-process.sh

# Auto-process without confirmation
./batch-process.sh -y

# Reprocess already-processed meetings
./batch-process.sh -f
```

### List Available Meetings

```bash
./process.sh
# Shows all meetings that have timeline.json files
```

## 📁 Expected File Structure

**Before processing:**
```
/home/ubuntu/mirotalk/app/src/recordings/
└── 06119OldSheep2752LuckyCat/
    ├── timeline.json                           # Required
    ├── Rec_06119OldSheep2752LuckyCat_akila_*.wav   # Optional (for audio merge)
    └── Rec_06119OldSheep2752LuckyCat_ishan_*.wav   # Optional (for audio merge)
```

**After processing:**
```
/home/ubuntu/mirotalk/app/src/recordings/
└── 06119OldSheep2752LuckyCat/
    ├── timeline.json
    ├── Rec_06119OldSheep2752LuckyCat_akila_*.wav
    ├── Rec_06119OldSheep2752LuckyCat_ishan_*.wav
    ├── 06119OldSheep2752LuckyCat_transcript.txt     # ✨ Generated
    ├── 06119OldSheep2752LuckyCat_statistics.json    # ✨ Generated
    └── 06119OldSheep2752LuckyCat_merged_audio.wav   # ✨ Generated (if audio files exist)
```

## 📊 Output Files

| File | Description | Use Case |
|------|-------------|----------|
| `*_transcript.txt` | Human-readable voice activity timeline | Review who spoke when |
| `*_statistics.json` | Machine-readable meeting statistics | Automated analysis, dashboards |
| `*_merged_audio.wav` | Synchronized audio mix of all participants | Playback, archival, analysis |

## 🎯 Common Use Cases

### 1. View Voice Activity

```bash
./process.sh 06119OldSheep2752LuckyCat
cat 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_transcript.txt
```

### 2. Extract Meeting Statistics

```bash
./process.sh 06119OldSheep2752LuckyCat
jq '.' 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_statistics.json
```

### 3. Get Speaking Time for Each User

```bash
./process.sh 06119OldSheep2752LuckyCat
jq '.participants | to_entries[] | {user: .key, time: .value.total_time_sec, percentage: .value.percentage}' \
  06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_statistics.json
```

### 4. Play Merged Audio

```bash
./process.sh 06119OldSheep2752LuckyCat
ffplay 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_merged_audio.wav
```

### 5. Convert Merged Audio to MP3

```bash
./process.sh 06119OldSheep2752LuckyCat
ffmpeg -i 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_merged_audio.wav \
       -codec:a libmp3lame -qscale:a 2 \
       06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_merged_audio.mp3
```

## 🔧 Troubleshooting

### Issue: "Timeline file not found"

**Cause**: Meeting ID doesn't exist or has no timeline.json

**Solution**:
```bash
# List available meetings
./process.sh

# Check if timeline exists
ls -la 06119OldSheep2752LuckyCat/timeline.json
```

### Issue: "FFmpeg is not installed"

**Solution**:
```bash
sudo apt update
sudo apt install ffmpeg
ffmpeg -version  # Verify installation
```

### Issue: No audio files found (Warning)

**This is normal!** The script will still generate:
- ✅ Transcript (voice activity timeline)
- ✅ Statistics (meeting data)
- ❌ Merged audio (requires WAV files)

### Issue: Duration mismatch warning

```
⚠ Warning: Duration mismatch of 0.234s
```

**Cause**: FFmpeg rounding or codec behavior

**Solution**: Small differences (<0.5s) are normal and can be ignored

### Issue: Permission denied

```bash
# Make scripts executable
chmod +x process.sh batch-process.sh

# Check file permissions
ls -la *.sh
```

## 📈 Performance Tips

### Fast Processing
```bash
# Process only what's needed
./process.sh meeting_id
```

### Batch Processing
```bash
# Process all meetings overnight
nohup ./batch-process.sh -y > batch-process.log 2>&1 &

# Check progress
tail -f batch-process.log
```

### Parallel Processing (Advanced)
```bash
# Process multiple meetings in parallel
for meeting in meeting1 meeting2 meeting3; do
  ./process.sh "$meeting" &
done
wait  # Wait for all to complete
```

## 🔍 Inspecting Results

### View Transcript
```bash
less 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_transcript.txt
```

### Pretty Print JSON
```bash
jq '.' 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_statistics.json
```

### Check Audio Properties
```bash
ffprobe 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_merged_audio.wav
```

### Get File Sizes
```bash
du -h 06119OldSheep2752LuckyCat/*
```

## 📚 Example Workflow

### Complete Meeting Analysis

```bash
# 1. Process the meeting
./process.sh 06119OldSheep2752LuckyCat

# 2. View the transcript
cat 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_transcript.txt

# 3. Get participant statistics
jq '.participants' 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_statistics.json

# 4. Check for overlaps
jq '.overlap_time_sec' 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_statistics.json

# 5. Play the merged audio (if available)
ffplay 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_merged_audio.wav

# 6. Archive the results
tar -czf 06119OldSheep2752LuckyCat.tar.gz 06119OldSheep2752LuckyCat/
```

## 🎓 Integration Examples

### Automated Email Report
```bash
#!/bin/bash
./process.sh "$MEETING_ID"
cat "$MEETING_ID/${MEETING_ID}_transcript.txt" | \
  mail -s "Meeting Report: $MEETING_ID" user@example.com
```

### Upload to S3
```bash
#!/bin/bash
./process.sh "$MEETING_ID"
aws s3 cp "$MEETING_ID/${MEETING_ID}_merged_audio.wav" \
  s3://my-bucket/meetings/$MEETING_ID/
```

### Database Import
```bash
#!/bin/bash
./process.sh "$MEETING_ID"
jq '.' "$MEETING_ID/${MEETING_ID}_statistics.json" | \
  psql -d mydb -c "INSERT INTO meeting_stats (data) VALUES ('$(cat -)');"
```

## 💻 Programmatic Usage (Node.js)

```javascript
const { processMeeting } = require('./process-meeting.js');

async function analyzeMeeting(meetingId) {
  try {
    await processMeeting(meetingId);
    console.log('Processing complete!');
    
    // Read results
    const stats = require(`./${meetingId}/${meetingId}_statistics.json`);
    console.log('Participants:', stats.participant_count);
    console.log('Duration:', stats.total_duration_formatted);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeMeeting('06119OldSheep2752LuckyCat');
```

## 🆘 Getting Help

### Check Logs
```bash
# Enable verbose logging
DEBUG=* node process-meeting.js meeting_id
```

### Test FFmpeg
```bash
# Test FFmpeg installation
ffmpeg -version

# Test simple merge
ffmpeg -i input1.wav -i input2.wav -filter_complex amix output.wav
```

### Validate Timeline JSON
```bash
# Check JSON syntax
jq '.' timeline.json

# Validate structure
node -e "console.log(JSON.parse(require('fs').readFileSync('timeline.json')))"
```

## 📋 Checklist for New Meetings

- [ ] Timeline.json exists in meeting directory
- [ ] Timeline.json is valid JSON
- [ ] Audio files follow naming convention: `Rec_{meeting_id}_{username}_{timestamp}.wav`
- [ ] FFmpeg is installed and accessible
- [ ] Node.js dependencies are installed (`npm install`)
- [ ] Meeting directory is readable/writable

## 🎯 Next Steps

1. ✅ Process your first meeting: `./process.sh meeting_id`
2. ✅ Review the generated transcript
3. ✅ Check the statistics JSON
4. ✅ Listen to the merged audio (if available)
5. ✅ Set up automated processing for new meetings

---

**Need more help?** Check the full [README.md](README.md) for detailed documentation.
