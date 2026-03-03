# MiroTalk Meeting Recording Processor

A comprehensive Node.js tool for processing MiroTalk SFU meeting recordings. This script analyzes timeline data, generates voice activity transcripts, merges individual audio recordings with precise timing, and produces detailed statistics.

## Features

- ✅ **Voice Activity Transcript**: Timeline-based transcript showing who spoke when (NO speech recognition)
- ✅ **Audio Merging**: Synchronizes and merges individual WAV files using FFmpeg with millisecond precision
- ✅ **Statistics Generation**: Comprehensive JSON statistics with speaking time, overlaps, and percentages
- ✅ **Visual Timeline**: ASCII art representation of user activity
- ✅ **Silence Detection**: Identifies gaps with no active recordings
- ✅ **Overlap Analysis**: Calculates simultaneous speaking periods
- ✅ **Duration Validation**: Verifies merged audio matches expected duration
- ✅ **Automatic Processing**: Background service that automatically processes completed meetings

## Prerequisites

### System Requirements
- **Node.js**: v14.0.0 or higher
- **FFmpeg**: Must be installed and available in PATH

### Install FFmpeg

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Install Node Dependencies

```bash
cd /home/ubuntu/mirotalk/app/src/recordings
npm install
```

## Usage

### Basic Usage

```bash
# Process by meeting ID
node process-meeting.js <meeting_id>

# Process by timeline.json path
node process-meeting.js <path_to_timeline.json>
```

### Examples

```bash
# Using meeting ID (looks in /home/ubuntu/mirotalk/app/src/recordings/<meeting_id>/)
node process-meeting.js 06119OldSheep2752LuckyCat

# Using full path to timeline.json
node process-meeting.js /var/recordings/meetings/06119OldSheep2752LuckyCat/timeline.json
```

## 🤖 Automatic Processing Service

The meeting processor can run automatically in the background using PM2, eliminating the need for manual processing.

### Start Automatic Processing

```bash
cd /home/ubuntu/mirotalk/app/src/recordings
./start-processor.sh
```

This will:
- ✅ Start a background service that watches for completed meetings
- ✅ Automatically process meetings when they end (within 30 seconds)
- ✅ Generate transcripts, merged audio, and statistics automatically
- ✅ Run continuously in the background
- ✅ Restart automatically if it crashes
- ✅ Start on server reboot (via PM2 startup)

### Check Service Status

```bash
# View service status
pm2 list

# View live logs
pm2 logs meeting-processor

# View last 50 log lines
pm2 logs meeting-processor --lines 50

# Monitor service in real-time
pm2 monit
```

### Stop Automatic Processing

```bash
cd /home/ubuntu/mirotalk/app/src/recordings
./stop-processor.sh
```

### Service Behavior

**Automatic Detection:**
- Scans `/home/ubuntu/mirotalk/app/src/recordings/` every 30 seconds
- Checks for meetings with `timeline.json` files
- Only processes meetings that have a `meeting_end` event

**Duplicate Prevention:**
- Creates a `.processed` marker file after successful processing
- Won't process the same meeting twice
- Marker file contains processing timestamp and status

**Error Handling:**
- Logs all activities with timestamps
- Continues running even if one meeting fails
- PM2 automatically restarts service if it crashes
- Failed meetings are marked and logged

**Example Log Output:**
```
[2025-11-26T14:05:30.123Z] 📋 Processing meeting: 06119OldSheep2752LuckyCat
[2025-11-26T14:05:31.456Z] 📋   → Generated transcript
[2025-11-26T14:05:32.789Z] 📋   → Generated statistics
[2025-11-26T14:05:33.012Z] 📋   → Merged audio
[2025-11-26T14:05:33.345Z] ✅ ✓ Completed: 06119OldSheep2752LuckyCat (3.2s)
```

### Manual Override

If you need to manually reprocess a meeting that's already been processed:

```bash
# Remove the marker file
rm /home/ubuntu/mirotalk/app/src/recordings/{meeting_id}/.processed

# The service will automatically process it on the next scan (within 30 seconds)

# OR process immediately:
./process.sh {meeting_id}
```

### Monitoring & Maintenance

```bash
# View service metrics
pm2 describe meeting-processor

# Restart service (applies after code changes)
pm2 restart meeting-processor

# View error logs only
pm2 logs meeting-processor --err

# Clear logs
pm2 flush meeting-processor
```

### Processed Marker File

After successful processing, a `.processed` file is created:

```json
{
  "processed_at": "2025-11-26T14:05:33.345Z",
  "meeting_id": "06119OldSheep2752LuckyCat",
  "success": true
}
```

If processing fails:
```json
{
  "processed_at": "2025-11-26T14:05:33.345Z",
  "meeting_id": "06119OldSheep2752LuckyCat",
  "success": false,
  "error": "FFmpeg not found"
}
```

## Input Structure

### Timeline JSON Format

The script expects a `timeline.json` file with this structure:

```json
{
  "room_id": "06119OldSheep2752LuckyCat",
  "meeting_start_time": 1764165629391,
  "meeting_start_iso": "2025-11-26T14:00:29.391Z",
  "total_duration_ms": 59805,
  "total_duration_sec": "59.805",
  "events": [
    {"event_type": "meeting_start", "timestamp_rel_sec": "0.001"},
    {"event_type": "user_join", "user_name": "akila", "timestamp_rel_sec": "0.068"},
    {"event_type": "recording_start", "user_name": "akila", "timestamp_rel_sec": "0.586", "producer_id": "6abc6806"},
    {"event_type": "user_join", "user_name": "ishan", "timestamp_rel_sec": "12.972"},
    {"event_type": "recording_start", "user_name": "ishan", "timestamp_rel_sec": "13.561", "producer_id": "0bb4e33e"},
    {"event_type": "user_leave", "user_name": "akila", "timestamp_rel_sec": "57.195"},
    {"event_type": "user_leave", "user_name": "ishan", "timestamp_rel_sec": "59.801"},
    {"event_type": "meeting_end", "timestamp_rel_sec": "59.804"}
  ]
}
```

### Recording Files Structure

```
/home/ubuntu/mirotalk/app/src/recordings/
└── {meeting_id}/
    ├── timeline.json
    ├── Rec_{meeting_id}_{user1}_{timestamp}.wav
    ├── Rec_{meeting_id}_{user2}_{timestamp}.wav
    └── ... (one WAV file per user)
```

## Output Files

The script generates three output files in the same directory as `timeline.json`:

### 1. Voice Activity Transcript (`{meeting_id}_transcript.txt`)

Human-readable transcript showing:
- Meeting metadata (ID, date, duration)
- Voice activity timeline (who spoke when)
- Silence periods
- Speaking time statistics per user
- Visual timeline representation

**Example:**
```
Meeting: 06119OldSheep2752LuckyCat
Date: 2025-11-26 14:00:29.391 UTC
Total Duration: 00:00:59.804

=== VOICE ACTIVITY TRANSCRIPT ===

00:00:00.586 - 00:00:57.195 | akila
00:00:13.561 - 00:00:59.801 | ishan

00:00:00.000 - 00:00:00.586 | [silence]

=== SPEAKING TIME STATISTICS ===

akila:
  Total Time: 56.609 seconds (94.7% of meeting)
  Recording Segments: 1
  Start Time: 00:00:00.586
  End Time: 00:00:57.195

ishan:
  Total Time: 46.240 seconds (77.3% of meeting)
  Recording Segments: 1
  Start Time: 00:00:13.561
  End Time: 00:00:59.801

Total Speaking Time: 102.849 seconds
Total Meeting Duration: 59.805 seconds
Note: Speaking times may overlap when multiple users talk simultaneously

Participants: 2
- akila
- ishan

=== VISUAL TIMELINE ===

00:00:00.000                  00:00:29.902                  00:00:59.804
├─────────────────────────────┼─────────────────────────────┤
akila          [══════════════════════════════════════════════════════════  ]
ishan          [             ═══════════════════════════════════════════════]
```

### 2. Merged Audio (`{meeting_id}_merged_audio.wav`)

Single synchronized WAV file containing all user audio:
- **Format**: PCM 16-bit WAV
- **Sample Rate**: 48,000 Hz
- **Channels**: 1 (mono mix)
- **Duration**: Matches `total_duration_sec` from timeline
- **Synchronization**: Each user's audio starts at their `recording_start` timestamp

**FFmpeg Processing:**
- Individual delays calculated from `timestamp_rel_sec`
- All tracks mixed with `amix` filter
- No normalization to preserve original levels
- Duration truncated to exact meeting length

### 3. Statistics JSON (`{meeting_id}_statistics.json`)

Machine-readable statistics for programmatic analysis:

```json
{
  "meeting_id": "06119OldSheep2752LuckyCat",
  "meeting_start": "2025-11-26T14:00:29.391Z",
  "total_duration_sec": 59.805,
  "total_duration_formatted": "00:00:59.804",
  "participant_count": 2,
  "participants": {
    "akila": {
      "total_time_sec": 56.609,
      "total_time_formatted": "00:00:56.609",
      "percentage": 94.7,
      "segments": [
        {
          "start_sec": 0.586,
          "start_formatted": "00:00:00.586",
          "end_sec": 57.195,
          "end_formatted": "00:00:57.195",
          "duration_sec": 56.609
        }
      ],
      "recording_file": "Rec_06119OldSheep2752LuckyCat_akila_*.wav"
    },
    "ishan": {
      "total_time_sec": 46.24,
      "total_time_formatted": "00:00:46.240",
      "percentage": 77.3,
      "segments": [
        {
          "start_sec": 13.561,
          "start_formatted": "00:00:13.561",
          "end_sec": 59.801,
          "end_formatted": "00:00:59.801",
          "duration_sec": 46.24
        }
      ],
      "recording_file": "Rec_06119OldSheep2752LuckyCat_ishan_*.wav"
    }
  },
  "total_speaking_time_sec": 102.849,
  "overlap_time_sec": 43.634,
  "silence_gaps": [
    {
      "start_sec": 0,
      "start_formatted": "00:00:00.000",
      "end_sec": 0.586,
      "end_formatted": "00:00:00.586",
      "duration_sec": 0.586
    }
  ]
}
```

## Processing Logic

### 1. Timeline Parsing

- Reads `timeline.json` and validates structure
- Extracts `recording_start` and `recording_stop` events
- Uses `user_leave` as fallback if `recording_stop` is missing
- Builds recording segments for each user

### 2. Transcript Generation

- Sorts all segments chronologically
- Formats timestamps as `HH:MM:SS.mmm`
- Calculates speaking time and percentages
- Detects silence gaps (≥0.1 seconds)
- Identifies overlapping speech periods
- Generates visual ASCII timeline

### 3. Audio Merging

**For single user:**
```bash
ffmpeg -i user1.wav \
  -af "adelay=586|586" \
  -ar 48000 -ac 1 -t 59.805 \
  output.wav
```

**For multiple users:**
```bash
ffmpeg \
  -i user1.wav -i user2.wav \
  -filter_complex "\
    [0:a]adelay=586|586[a0];\
    [1:a]adelay=13561|13561[a1];\
    [a0][a1]amix=inputs=2:duration=longest:normalize=0" \
  -ar 48000 -ac 1 -t 59.805 \
  output.wav
```

**Key points:**
- Delay in milliseconds: `timestamp_rel_sec × 1000`
- `amix` with `normalize=0` preserves original levels
- `duration=longest` extends to longest input
- `-t` flag truncates to exact meeting duration

### 4. Statistics Generation

- Calculates per-user speaking time and percentage
- Detects overlap periods (multiple users speaking)
- Identifies silence gaps
- Formats all times in both seconds and `HH:MM:SS.mmm`
- Links audio files to users

## Error Handling

The script includes comprehensive error checking:

- ✅ **Timeline file existence**: Validates `timeline.json` exists
- ✅ **FFmpeg availability**: Checks if FFmpeg is installed
- ✅ **Audio file matching**: Warns if audio files are missing for users
- ✅ **Duration validation**: Compares merged audio duration with expected value
- ✅ **Edge case handling**:
  - Missing `recording_stop` events (uses `user_leave`)
  - Meetings with only 1 participant
  - Unclosed recording segments (uses meeting end time)
  - Very short silence gaps (< 0.1s filtered out)

## Example Console Output

```
🎬 MiroTalk Meeting Recording Processor

============================================================
📁 Meeting Directory: /home/ubuntu/mirotalk/app/src/recordings/06119OldSheep2752LuckyCat
📄 Timeline File: /home/ubuntu/mirotalk/app/src/recordings/06119OldSheep2752LuckyCat/timeline.json

🔍 Step 1: Validating inputs...
   ✓ Timeline file exists
   ✓ FFmpeg is installed

📊 Step 2: Parsing timeline...
   Meeting ID: 06119OldSheep2752LuckyCat
   Duration: 00:00:59.804
   Events: 8
   Participants: 2
   - akila
   - ishan
   ✓ Timeline parsed successfully

🎵 Step 3: Finding audio files...
   Found 2 audio file(s)
   - Rec_06119OldSheep2752LuckyCat_akila_1764165630.wav
   - Rec_06119OldSheep2752LuckyCat_ishan_1764165643.wav

📝 Step 4: Generating voice activity transcript...
   ✓ Transcript saved: 06119OldSheep2752LuckyCat_transcript.txt

📈 Step 5: Generating statistics...
   ✓ Statistics saved: 06119OldSheep2752LuckyCat_statistics.json

🎚️  Step 6: Merging audio files...
   Matched 2 audio file(s) to users
   - akila: delay 0.586s
   - ishan: delay 13.561s
   FFmpeg command: ffmpeg -i Rec_06119OldSheep2752LuckyCat_akila_1764165630.wav ...
   Merging audio: 100.0%
   ✓ Audio merged: 06119OldSheep2752LuckyCat_merged_audio.wav
   Expected duration: 59.805s
   Actual duration: 59.805s
   ✓ Duration validation passed

============================================================
✅ Processing completed successfully!

📄 Generated files:
   - 06119OldSheep2752LuckyCat_transcript.txt
   - 06119OldSheep2752LuckyCat_statistics.json
   - 06119OldSheep2752LuckyCat_merged_audio.wav (59.805s)

⏱️  Processing time: 2.3 seconds
============================================================
```

## Programmatic Usage

The script can also be imported as a module:

```javascript
const { processMeeting, parseTimeline, generateStatistics } = require('./process-meeting.js');

// Process a meeting
await processMeeting('06119OldSheep2752LuckyCat');

// Use individual functions
const timelineData = JSON.parse(fs.readFileSync('timeline.json'));
const segments = parseTimeline(timelineData);
const stats = generateStatistics(timelineData, segments, audioFiles);
```

## Troubleshooting

### FFmpeg not found
```bash
Error: FFmpeg is not installed. Please install FFmpeg first.
```
**Solution**: Install FFmpeg using your package manager (see Prerequisites)

### Timeline file not found
```bash
Error: Timeline file not found: /path/to/timeline.json
```
**Solution**: Verify the meeting ID or path is correct

### No audio files found
```bash
⚠ Warning: No audio files found. Skipping audio merge.
```
**Solution**: This is not an error - transcript and statistics will still be generated

### Duration mismatch
```bash
⚠ Warning: Duration mismatch of 0.234s
```
**Solution**: This can happen due to FFmpeg rounding. Small differences (<0.2s) are normal.

## Configuration

You can modify these constants in `process-meeting.js`:

```javascript
// Base path for recordings (default: /home/ubuntu/mirotalk/app/src/recordings)
const RECORDINGS_BASE_PATH = '/home/ubuntu/mirotalk/app/src/recordings';

// Audio output settings
const DEFAULT_SAMPLE_RATE = 48000;  // 48kHz
const DEFAULT_CHANNELS = 1;          // Mono
```

## Performance

- **Small meetings** (2-3 participants, <5 min): ~1-2 seconds
- **Medium meetings** (4-6 participants, 10-30 min): ~3-10 seconds
- **Large meetings** (7+ participants, >30 min): ~15-30 seconds

Processing time depends mainly on:
- Audio file sizes
- Meeting duration
- Number of participants
- System CPU performance

## License

This tool is part of the MiroTalk SFU project.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify FFmpeg installation: `ffmpeg -version`
3. Test with a simple meeting (2 participants, short duration)
4. Check console output for specific error messages

## Technical Details

### Timeline Synchronization

The script ensures perfect synchronization by:
1. Using `recording_start` timestamp as the delay reference
2. Converting timestamps to milliseconds for FFmpeg
3. Applying delays to each audio track individually
4. Mixing all tracks without normalization
5. Truncating output to exact meeting duration

### Overlap Detection Algorithm

```
For each time point:
  - Count active speakers
  - If count > 1: accumulate overlap time
  - Track period until next event
```

### Silence Detection Algorithm

```
For each time point:
  - Count active speakers  
  - If count = 0: accumulate silence time
  - Filter gaps < 0.1 seconds
```

## Future Enhancements

Possible improvements:
- [ ] Support for video merging
- [ ] Speech-to-text integration
- [ ] Speaker diarization
- [ ] Export to multiple formats (MP3, OGG, etc.)
- [ ] Web UI for processing
- [ ] Batch processing multiple meetings
- [ ] Real-time processing during meetings

---

**Version**: 1.0.0  
**Last Updated**: November 26, 2025
