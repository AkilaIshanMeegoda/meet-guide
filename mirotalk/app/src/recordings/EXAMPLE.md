# 🎯 Complete Example - MiroTalk Recording Processor

This document shows a complete end-to-end example of processing a meeting recording.

## 📝 Scenario

We have a meeting with:
- **Meeting ID**: `06119OldSheep2752LuckyCat`
- **Duration**: 59.8 seconds
- **Participants**: 2 (akila and ishan)
- **Date**: November 26, 2025 at 14:00:29 UTC

## 📊 Input: timeline.json

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

## 🎵 Input: Audio Files

```
Rec_06119OldSheep2752LuckyCat_akila_1764167229.wav  (5.2 MB, 56.6 seconds)
Rec_06119OldSheep2752LuckyCat_ishan_1764167230.wav  (4.3 MB, 46.2 seconds)
```

## 🚀 Processing Command

```bash
cd /home/ubuntu/mirotalk/app/src/recordings
./process.sh 06119OldSheep2752LuckyCat
```

## 📺 Console Output

```
╔════════════════════════════════════════════════════════════╗
║    MiroTalk Meeting Recording Processor - Helper          ║
╚════════════════════════════════════════════════════════════╝

Starting processing...

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
   - Rec_06119OldSheep2752LuckyCat_akila_1764167229.wav
   - Rec_06119OldSheep2752LuckyCat_ishan_1764167230.wav

📝 Step 4: Generating voice activity transcript...
   ✓ Transcript saved: 06119OldSheep2752LuckyCat_transcript.txt

📈 Step 5: Generating statistics...
   ✓ Statistics saved: 06119OldSheep2752LuckyCat_statistics.json

🎚️  Step 6: Merging audio files...
   Matched 2 audio file(s) to users
   - akila: delay 0.586s
   - ishan: delay 13.561s
   FFmpeg command: ffmpeg -i ... -filter_complex [0:a]adelay=586|586[a0];...
   Merging audio: 100.0%
   ✓ Audio merged: 06119OldSheep2752LuckyCat_merged_audio.wav
   Expected duration: 59.805s
   Actual duration: 59.801s
   ✓ Duration validation passed

============================================================
✅ Processing completed successfully!

📄 Generated files:
   - 06119OldSheep2752LuckyCat_transcript.txt
   - 06119OldSheep2752LuckyCat_statistics.json
   - 06119OldSheep2752LuckyCat_merged_audio.wav (59.805s)

⏱️  Processing time: 0.7 seconds
============================================================

✅ Processing completed successfully!

Output files location:
  /home/ubuntu/mirotalk/app/src/recordings/06119OldSheep2752LuckyCat

Generated files:
  ✓ Transcript: 06119OldSheep2752LuckyCat_transcript.txt
  ✓ Statistics: 06119OldSheep2752LuckyCat_statistics.json
  ✓ Merged Audio: 06119OldSheep2752LuckyCat_merged_audio.wav
```

## 📄 Output 1: Voice Activity Transcript

**File**: `06119OldSheep2752LuckyCat_transcript.txt`

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

### Key Insights from Transcript:
- ✅ **akila** spoke for 56.6 seconds (94.7% of meeting)
- ✅ **ishan** spoke for 46.2 seconds (77.3% of meeting)
- ✅ **Overlap**: Both users had recordings active from 13.561s to 57.195s (43.6 seconds)
- ✅ **Silence**: 0.586 seconds at the start before akila's mic activated
- ✅ **Visual timeline** clearly shows akila started first, ishan joined later

## 📊 Output 2: Statistics JSON

**File**: `06119OldSheep2752LuckyCat_statistics.json`

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
      "recording_file": "Rec_06119OldSheep2752LuckyCat_akila_1764167229.wav"
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
      "recording_file": "Rec_06119OldSheep2752LuckyCat_ishan_1764167230.wav"
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

### Key Data Points:
- ✅ **Overlap time**: 43.634 seconds (both users speaking simultaneously)
- ✅ **Silence gap**: 0.586 seconds at start
- ✅ **Total speaking time**: 102.849 seconds (more than meeting duration due to overlaps)
- ✅ **Percentages**: Show relative participation (akila: 94.7%, ishan: 77.3%)

## 🎵 Output 3: Merged Audio

**File**: `06119OldSheep2752LuckyCat_merged_audio.wav`

```
Format: PCM 16-bit WAV
Sample Rate: 48,000 Hz
Channels: 1 (mono)
Duration: 59.801 seconds
Size: 5.5 MB
Bit Rate: 768 kbps
```

### Audio Timeline:
```
0.000s - 0.586s:  [Silence]
0.586s - 13.561s: [akila only] (440 Hz tone in test audio)
13.561s - 57.195s: [Both akila and ishan] (440 Hz + 523 Hz mixed)
57.195s - 59.801s: [ishan only] (523 Hz tone)
```

### FFmpeg Command Used:
```bash
ffmpeg \
  -i Rec_06119OldSheep2752LuckyCat_akila_1764167229.wav \
  -i Rec_06119OldSheep2752LuckyCat_ishan_1764167230.wav \
  -filter_complex "\
    [0:a]adelay=586|586[a0];\
    [1:a]adelay=13561|13561[a1];\
    [a0][a1]amix=inputs=2:duration=longest:normalize=0" \
  -ar 48000 -ac 1 -t 59.805 \
  06119OldSheep2752LuckyCat_merged_audio.wav
```

### Synchronization Breakdown:
1. **akila's audio**: Delayed by 586ms (0.586 seconds)
2. **ishan's audio**: Delayed by 13,561ms (13.561 seconds)
3. **Mixing**: Both tracks play simultaneously during overlap
4. **Duration**: Truncated to exactly 59.805 seconds

## 📈 Analysis Dashboard (Using Statistics)

### Participation Metrics
```
┌─────────────────────────────────────────┐
│ Meeting Participation Analysis          │
├─────────────────────────────────────────┤
│ Total Duration: 59.8 seconds           │
│ Total Participants: 2                   │
│                                         │
│ akila:    ████████████████████ 94.7%   │
│ ishan:    ████████████████     77.3%   │
│                                         │
│ Overlap Period: 43.6 seconds (72.9%)   │
│ Silence Gaps: 0.6 seconds (1.0%)       │
└─────────────────────────────────────────┘
```

### Speaking Time Comparison
```
User    | Time (s) | Percentage | Start    | End
--------|----------|------------|----------|----------
akila   | 56.609   | 94.7%      | 00:00:00 | 00:00:57
ishan   | 46.240   | 77.3%      | 00:00:13 | 00:00:59
```

### Timeline Visualization
```
Time (seconds):    0         10        20        30        40        50        59.8
                   |---------|---------|---------|---------|---------|---------|
akila:             ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■▒
ishan:                           ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

Legend: ■ = Recording Active    ▒ = Recording Stopped    - = Not Recording
```

## 🎯 Use Cases

### 1. Meeting Analysis
Review who participated and for how long, identify silent periods, detect overlapping conversations.

### 2. Quality Assurance
Verify all participants were recorded, check audio synchronization, validate meeting duration.

### 3. Automated Reporting
Generate participation reports, calculate speaker ratios, track engagement metrics.

### 4. Archival
Create single merged audio file for storage, preserve timeline metadata, maintain participant records.

### 5. Further Processing
Use merged audio for transcription services, apply noise reduction/enhancement, convert to other formats.

## 🔍 Verification Steps

### 1. Verify Transcript Accuracy
```bash
# Check user join times match timeline
grep "user_join" timeline.json
# Result: akila at 0.068s, ishan at 12.972s ✓

# Check recording start times match transcript
grep "recording_start" timeline.json
# Result: akila at 0.586s, ishan at 13.561s ✓
```

### 2. Verify Audio Duration
```bash
ffprobe merged_audio.wav 2>&1 | grep Duration
# Result: Duration: 00:00:59.80 ✓
```

### 3. Verify Statistics
```bash
jq '.overlap_time_sec' statistics.json
# Result: 43.634 seconds ✓

# Manual calculation:
# Overlap = min(57.195, 59.801) - max(0.586, 13.561)
# Overlap = 57.195 - 13.561 = 43.634 ✓
```

## ✅ Success Criteria

- ✅ All timeline events parsed correctly
- ✅ Voice activity periods calculated accurately
- ✅ Audio files matched to users
- ✅ Delays applied correctly (586ms and 13561ms)
- ✅ Audio mixed successfully
- ✅ Duration matches expected value (±0.1s tolerance)
- ✅ All output files generated
- ✅ Statistics calculations verified
- ✅ Processing completed in <1 second

## 🎓 Learning Points

1. **Timeline Precision**: Millisecond accuracy maintained throughout
2. **Overlap Handling**: Multiple users can record simultaneously
3. **Silence Detection**: Identifies gaps in conversation
4. **FFmpeg Mastery**: Complex audio processing with delays and mixing
5. **Error Handling**: Graceful degradation when audio files missing
6. **Modular Design**: Each processing step is independent and testable

---

**This example demonstrates all features of the MiroTalk Recording Processor working together to provide comprehensive meeting analysis and audio processing.**
