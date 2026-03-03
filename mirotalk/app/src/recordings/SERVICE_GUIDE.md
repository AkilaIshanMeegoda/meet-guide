# 🤖 Automatic Processing Service - Testing & Usage Guide

## ✅ Service Status: ACTIVE

The automatic meeting processor is now **running and tested** successfully!

## 📊 Current Configuration

| Setting | Value |
|---------|-------|
| **Service Name** | `meeting-processor` |
| **Script** | `watch-and-process.js` |
| **Scan Interval** | 30 seconds |
| **Recordings Directory** | `/home/ubuntu/mirotalk/app/src/recordings/` |
| **Status** | ✅ Online |
| **Auto-Start on Boot** | ✅ Enabled (via PM2) |

## 🎯 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ AUTOMATIC WORKFLOW                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Meeting starts in MiroTalk                               │
│    → timeline.json created automatically                    │
│    → Events logged in real-time                             │
│                                                             │
│ 2. Meeting ends                                             │
│    → "meeting_end" event added to timeline.json             │
│                                                             │
│ 3. Within 30 seconds (automatic)                            │
│    → Service detects completed meeting                      │
│    → Runs process-meeting.js automatically                  │
│    → Generates transcript, stats, merged audio              │
│    → Creates .processed marker                              │
│                                                             │
│ 4. Future scans                                             │
│    → Service sees .processed marker                         │
│    → Skips this meeting (no duplicate processing)           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Commands

### View Service Status
```bash
pm2 list
```

Expected output:
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 1  │ meeting-processor  │ fork     │ 0    │ online    │ 0%       │ 62.3mb   │
│ 0  │ miro               │ fork     │ 0    │ online    │ 0%       │ 165.0mb  │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

### View Live Logs
```bash
pm2 logs meeting-processor
```

### View Last 50 Log Lines
```bash
pm2 logs meeting-processor --lines 50 --nostream
```

### Restart Service
```bash
pm2 restart meeting-processor
```

### Stop Service
```bash
./stop-processor.sh
# OR
pm2 stop meeting-processor
```

### Start Service Again
```bash
./start-processor.sh
# OR
pm2 start meeting-processor
```

## 📋 Service Log Examples

### Successful Processing
```
[2025-11-26T14:43:22.184Z] 📋 Processing meeting: 06119OldSheep2752LuckyCat
[2025-11-26T14:43:22.932Z] ✅ ✓ Completed: 06119OldSheep2752LuckyCat (0.7s)
[2025-11-26T14:43:22.933Z] 📋   → Generated transcript
[2025-11-26T14:43:22.933Z] 📋   → Generated statistics
[2025-11-26T14:43:22.933Z] 📋   → Merged audio
[2025-11-26T14:43:22.933Z] 📋 Scan complete: 1 processed, 0 already processed, 0 pending
```

### Already Processed (Skipped)
```
[2025-11-26T14:43:52.184Z] 📋 Scan complete: 0 processed, 1 already processed, 0 pending
```

### Meeting Not Complete Yet
```
[2025-11-26T14:45:22.184Z] 📋 Scan complete: 0 processed, 1 already processed, 1 pending
```

### Processing Error
```
[2025-11-26T14:46:22.184Z] 📋 Processing meeting: TestMeeting123
[2025-11-26T14:46:23.456Z] ❌ ✗ Failed: TestMeeting123 (1.3s) - FFmpeg not found
```

## 🧪 Testing the Service

### Test 1: Verify Service is Running
```bash
pm2 status meeting-processor
```

Expected: Status should be "online"

### Test 2: Check Recent Activity
```bash
pm2 logs meeting-processor --lines 20 --nostream
```

Expected: Should show startup message and scan activity

### Test 3: Reprocess a Meeting (Manual Override)
```bash
# Remove processed marker
rm /home/ubuntu/mirotalk/app/src/recordings/06119OldSheep2752LuckyCat/.processed

# Wait up to 30 seconds for automatic processing
sleep 35

# Check logs
pm2 logs meeting-processor --lines 10 --nostream
```

Expected: Should show the meeting being processed again

### Test 4: Process Time Measurement
```bash
# Watch logs in real-time
pm2 logs meeting-processor

# In another terminal, remove a processed marker
rm /home/ubuntu/mirotalk/app/src/recordings/{meeting_id}/.processed

# Observe automatic processing within 30 seconds
```

### Test 5: Service Restart
```bash
# Restart the service
pm2 restart meeting-processor

# Verify it comes back online
pm2 status meeting-processor

# Check logs show restart
pm2 logs meeting-processor --lines 5 --nostream
```

## 🔍 Troubleshooting

### Service Not Running
```bash
# Check PM2 status
pm2 list

# If not listed, start it
./start-processor.sh

# If failed, check error logs
pm2 logs meeting-processor --err
```

### Meetings Not Being Processed

**Check 1: Does timeline.json exist?**
```bash
ls /home/ubuntu/mirotalk/app/src/recordings/{meeting_id}/timeline.json
```

**Check 2: Does timeline have meeting_end event?**
```bash
jq '.events[] | select(.event_type == "meeting_end")' \
  /home/ubuntu/mirotalk/app/src/recordings/{meeting_id}/timeline.json
```

**Check 3: Is meeting already processed?**
```bash
ls /home/ubuntu/mirotalk/app/src/recordings/{meeting_id}/.processed
```

**Check 4: View service logs for errors**
```bash
pm2 logs meeting-processor --err --lines 50
```

### Service Consuming Too Much Memory
```bash
# Check memory usage
pm2 status meeting-processor

# If high (>200MB), restart service
pm2 restart meeting-processor
```

### Service Crashed
```bash
# PM2 will auto-restart, but check error logs
pm2 logs meeting-processor --err --lines 50

# If repeated crashes, check for:
# - Disk space issues
# - Permission problems
# - Missing dependencies
```

## 📁 File Structure

### Before Processing
```
/home/ubuntu/mirotalk/app/src/recordings/
└── {meeting_id}/
    ├── timeline.json                    # ✅ Created by MiroTalk
    ├── Rec_{meeting_id}_user1_*.wav    # ✅ Created by MiroTalk
    └── Rec_{meeting_id}_user2_*.wav    # ✅ Created by MiroTalk
```

### After Automatic Processing
```
/home/ubuntu/mirotalk/app/src/recordings/
└── {meeting_id}/
    ├── timeline.json
    ├── Rec_{meeting_id}_user1_*.wav
    ├── Rec_{meeting_id}_user2_*.wav
    ├── .processed                           # ✨ Marker file (prevents reprocessing)
    ├── {meeting_id}_transcript.txt         # ✨ Generated automatically
    ├── {meeting_id}_statistics.json        # ✨ Generated automatically
    └── {meeting_id}_merged_audio.wav       # ✨ Generated automatically
```

## 🎯 Service Features

### ✅ Automatic Detection
- Scans every 30 seconds for completed meetings
- No manual intervention required
- Processes within 30 seconds of meeting end

### ✅ Duplicate Prevention
- Creates `.processed` marker after successful processing
- Skips meetings that have already been processed
- Manual override available by deleting marker file

### ✅ Error Resilience
- Continues running even if one meeting fails
- Logs errors but doesn't crash
- PM2 automatically restarts if service crashes

### ✅ Resource Efficient
- Only scans every 30 seconds (not continuously)
- Lightweight memory footprint (~60MB)
- Minimal CPU usage when idle

### ✅ Production Ready
- Starts automatically on server reboot (PM2 startup)
- Comprehensive logging with timestamps
- Graceful shutdown handling
- Error reporting and recovery

## 📊 Monitoring Dashboard

### Real-Time Monitoring
```bash
# Interactive monitoring
pm2 monit
```

This shows:
- CPU usage
- Memory usage
- Logs in real-time
- Restart count

### Service Metrics
```bash
# Detailed service info
pm2 describe meeting-processor
```

Shows:
- Uptime
- Restart count
- Memory usage
- CPU usage
- Last restart time
- Error logs location

## 🔄 Maintenance Tasks

### Daily
```bash
# Quick status check
pm2 list | grep meeting-processor
```

### Weekly
```bash
# Review logs for errors
pm2 logs meeting-processor --err --lines 100 --nostream

# Check processed meetings count
ls -d /home/ubuntu/mirotalk/app/src/recordings/*/.processed | wc -l
```

### Monthly
```bash
# Clear old logs (optional)
pm2 flush meeting-processor

# Check disk space
df -h /home/ubuntu/mirotalk/app/src/recordings/

# Review service metrics
pm2 describe meeting-processor
```

## 🚨 Common Issues & Solutions

### Issue: "Service not found"
**Solution**: Start the service
```bash
./start-processor.sh
```

### Issue: "Permission denied"
**Solution**: Check file permissions
```bash
chmod +x start-processor.sh stop-processor.sh
```

### Issue: "FFmpeg not found"
**Solution**: Install FFmpeg
```bash
sudo apt update && sudo apt install ffmpeg
```

### Issue: "Cannot find module 'fluent-ffmpeg'"
**Solution**: Install dependencies
```bash
cd /home/ubuntu/mirotalk/app/src/recordings
npm install
pm2 restart meeting-processor
```

### Issue: "Meetings not being processed"
**Solution**: Check if meeting has ended
```bash
jq '.events[] | select(.event_type == "meeting_end")' \
  /home/ubuntu/mirotalk/app/src/recordings/{meeting_id}/timeline.json
```

## 🎓 Advanced Usage

### Change Scan Interval
Edit `watch-and-process.js` and modify:
```javascript
const SCAN_INTERVAL = 30000; // Change to desired milliseconds
```
Then restart:
```bash
pm2 restart meeting-processor
```

### Process Multiple Directories
Edit `watch-and-process.js` and modify:
```javascript
const RECORDINGS_DIR = '/path/to/recordings';
```

### Custom Processing Logic
Modify the `processMeeting()` function in `watch-and-process.js`

### Batch Reprocess All Meetings
```bash
# Remove all processed markers
find /home/ubuntu/mirotalk/app/src/recordings -name ".processed" -delete

# Service will automatically process all completed meetings
# Monitor progress:
pm2 logs meeting-processor
```

## 📞 Support Commands Reference

| Task | Command |
|------|---------|
| Start service | `./start-processor.sh` |
| Stop service | `./stop-processor.sh` |
| View status | `pm2 status meeting-processor` |
| View logs | `pm2 logs meeting-processor` |
| Restart | `pm2 restart meeting-processor` |
| Monitor | `pm2 monit` |
| Detailed info | `pm2 describe meeting-processor` |
| Clear logs | `pm2 flush meeting-processor` |
| Stop & remove | `pm2 delete meeting-processor` |

---

## 🎉 Success Indicators

Your service is working correctly if:

✅ `pm2 list` shows status as "online"  
✅ Logs show "Service started successfully!"  
✅ New meetings get `.processed` marker within 30 seconds  
✅ Transcript, statistics, and merged audio files are generated  
✅ Service restarts automatically if it crashes  
✅ Service starts automatically on server reboot  

---

**Service Version**: 1.0.0  
**Last Updated**: November 26, 2025  
**Status**: ✅ Production Ready & Tested
