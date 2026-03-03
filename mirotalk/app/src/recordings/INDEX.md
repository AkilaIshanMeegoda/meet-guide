# 📁 MiroTalk Recording Processor - File Index

## 📋 Core Scripts

| File | Size | Description | Usage |
|------|------|-------------|-------|
| **process-meeting.js** | 26KB | Main processing script | `node process-meeting.js <meeting_id>` |
| **watch-and-process.js** | 15KB | Automatic processor service | `node watch-and-process.js` (runs via PM2) |
| **process.sh** | 3.9KB | User-friendly CLI wrapper | `./process.sh <meeting_id>` |
| **batch-process.sh** | 5.2KB | Process multiple meetings | `./batch-process.sh -y` |
| **start-processor.sh** | 4.5KB | Start automatic service | `./start-processor.sh` |
| **stop-processor.sh** | 1.8KB | Stop automatic service | `./stop-processor.sh` |
| **create-sample-audio.sh** | 3.3KB | Generate test audio files | `./create-sample-audio.sh <meeting_dir>` |

## 📚 Documentation

| File | Size | Purpose | Audience |
|------|------|---------|----------|
| **README.md** | 18KB | Comprehensive documentation | All users - complete reference |
| **QUICK_START.md** | 8.0KB | Quick reference guide | New users - fast onboarding |
| **SERVICE_GUIDE.md** | 11KB | Automatic service guide | Admins - service management |
| **EXAMPLE.md** | 12KB | Complete working example | Developers - see it in action |
| **IMPLEMENTATION_SUMMARY.md** | 9.1KB | Project completion summary | Project managers - overview |
| **INDEX.md** | This file | File directory and navigation | All users - find what you need |

## ⚙️ Configuration

| File | Size | Description |
|------|------|-------------|
| **package.json** | 444B | Node.js dependencies |
| **package-lock.json** | 1.8KB | Dependency lock file |

## 📂 Example Meeting Data

### Meeting: 06119OldSheep2752LuckyCat

#### Input Files
| File | Size | Type | Description |
|------|------|------|-------------|
| `timeline.json` | <1KB | JSON | Meeting timeline with events |
| `Rec_..._akila_*.wav` | 5.2MB | WAV | akila's audio recording |
| `Rec_..._ishan_*.wav` | 4.3MB | WAV | ishan's audio recording |

#### Generated Output Files
| File | Size | Type | Description |
|------|------|------|-------------|
| `*_transcript.txt` | <5KB | Text | Voice activity transcript |
| `*_statistics.json` | <2KB | JSON | Meeting statistics |
| `*_merged_audio.wav` | 5.5MB | WAV | Synchronized merged audio |

## 🚀 Quick Navigation

### For First-Time Users
1. Start with **QUICK_START.md** for installation and basic usage
2. Run `./process.sh` to see available meetings
3. Try `./process.sh 06119OldSheep2752LuckyCat` for a test run
4. View the generated transcript and statistics

### For Developers
1. Read **README.md** for complete technical documentation
2. Review **process-meeting.js** for implementation details
3. Check **EXAMPLE.md** for a detailed walkthrough
4. Use **create-sample-audio.sh** to generate test data

### For Project Managers
1. Review **IMPLEMENTATION_SUMMARY.md** for project status
2. Check features and testing results
3. View performance metrics and specifications

## 📖 Documentation Map

```
┌─────────────────────────────────────────────────┐
│  New User?                                      │
│  Start here: QUICK_START.md                     │
│  ↓                                              │
│  Run: ./process.sh <meeting_id>                 │
└─────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────┐
│  Want Details?                                  │
│  Read: README.md                                │
│  ↓                                              │
│  See: EXAMPLE.md                                │
└─────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────┐
│  Need to Customize?                             │
│  Edit: process-meeting.js                       │
│  ↓                                              │
│  Test: create-sample-audio.sh                   │
└─────────────────────────────────────────────────┘
```

## 🎯 Common Tasks

### Task 1: Process a Single Meeting
```bash
./process.sh meeting_id
```
**Documentation**: QUICK_START.md → "Process Single Meeting"

### Task 2: Process All Meetings
```bash
./batch-process.sh -y
```
**Documentation**: QUICK_START.md → "Process All Meetings"

### Task 3: Create Test Audio
```bash
./create-sample-audio.sh /path/to/meeting
```
**Documentation**: EXAMPLE.md → "Testing"

### Task 4: View Statistics
```bash
jq '.' meeting_id/meeting_id_statistics.json
```
**Documentation**: QUICK_START.md → "Extract Meeting Statistics"

### Task 5: Customize Processing
Edit **process-meeting.js** - see inline comments
**Documentation**: README.md → "Technical Details"

## 🔧 Maintenance

### Update Dependencies
```bash
npm update
```

### Check for Errors
```bash
node process-meeting.js --help
```

### Run Tests
```bash
# Create test meeting
./create-sample-audio.sh test_meeting

# Process it
./process.sh test_meeting

# Verify output
ls -lh test_meeting/
```

## 📊 File Relationships

```
timeline.json
    ↓
process-meeting.js
    ↓
    ├──→ *_transcript.txt     (Human-readable timeline)
    ├──→ *_statistics.json    (Machine-readable stats)
    └──→ *_merged_audio.wav   (Synchronized audio)
```

## 🆘 Troubleshooting

### Issue: Can't find file
**Solution**: Check INDEX.md (this file) for location

### Issue: Don't know where to start
**Solution**: Read QUICK_START.md first

### Issue: Need technical details
**Solution**: Read README.md

### Issue: Want to see example
**Solution**: Read EXAMPLE.md

### Issue: Need project overview
**Solution**: Read IMPLEMENTATION_SUMMARY.md

## 📦 File Categories

### Essential Files (Don't Delete!)
- ✅ process-meeting.js
- ✅ package.json
- ✅ README.md

### Helper Scripts (Recommended)
- 🔧 process.sh
- 🔧 batch-process.sh
- 🔧 create-sample-audio.sh

### Documentation (Reference)
- 📖 QUICK_START.md
- 📖 EXAMPLE.md
- 📖 IMPLEMENTATION_SUMMARY.md
- 📖 INDEX.md (this file)

### Auto-Generated (Can Regenerate)
- 🔄 package-lock.json
- 🔄 node_modules/
- 🔄 *_transcript.txt
- 🔄 *_statistics.json
- 🔄 *_merged_audio.wav

## 🎓 Learning Path

### Beginner (5 minutes)
1. Read: QUICK_START.md → "Prerequisites Check"
2. Run: `./process.sh 06119OldSheep2752LuckyCat`
3. View: `cat 06119OldSheep2752LuckyCat/06119OldSheep2752LuckyCat_transcript.txt`

### Intermediate (15 minutes)
1. Read: EXAMPLE.md (complete walkthrough)
2. Create: `./create-sample-audio.sh my_test_meeting`
3. Process: `./process.sh my_test_meeting`
4. Analyze: Compare results with EXAMPLE.md

### Advanced (30 minutes)
1. Read: README.md → "Technical Details"
2. Review: process-meeting.js source code
3. Customize: Modify formatTime() or generateVisualTimeline()
4. Test: Process multiple meetings with modifications

## 🌟 Feature Highlights by File

### process-meeting.js
- ✨ Timeline parsing
- ✨ Voice activity detection
- ✨ FFmpeg audio merging
- ✨ Statistics calculation
- ✨ Error handling

### process.sh
- 🎨 Colorful output
- 🔍 Meeting discovery
- ✅ Dependency checking
- 📊 Result summary

### batch-process.sh
- 📦 Multi-meeting processing
- 📈 Progress tracking
- ♻️ Skip/force options
- 📊 Batch statistics

### create-sample-audio.sh
- 🎵 Synthetic audio generation
- 🎼 Different frequencies per user
- ⏱️ Timeline-synchronized durations
- ✅ Quick testing

## 💡 Tips

### For Quick Results
Use **process.sh** instead of direct Node.js calls

### For Multiple Meetings
Use **batch-process.sh** with `-y` flag

### For Testing Changes
Use **create-sample-audio.sh** to make test data

### For Integration
Import functions from **process-meeting.js** in your code

### For Understanding
Read **EXAMPLE.md** for a complete walkthrough

---

## 📞 Quick Reference Card

| I want to... | File to use | Command |
|--------------|-------------|---------|
| Get started quickly | QUICK_START.md | `./process.sh meeting_id` |
| See complete docs | README.md | - |
| View working example | EXAMPLE.md | - |
| Process one meeting | process.sh | `./process.sh <id>` |
| Process all meetings | batch-process.sh | `./batch-process.sh -y` |
| Create test data | create-sample-audio.sh | `./create-sample-audio.sh <dir>` |
| Customize code | process-meeting.js | Edit source |
| Check project status | IMPLEMENTATION_SUMMARY.md | - |
| Find files | INDEX.md | This file |

---

**Current Version**: 1.0.0  
**Last Updated**: November 26, 2025  
**Status**: ✅ Production Ready  
**Total Files**: 16 files (4 scripts, 5 docs, 2 configs, 5 example outputs)
