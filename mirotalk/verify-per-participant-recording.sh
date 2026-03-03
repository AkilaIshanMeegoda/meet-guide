#!/bin/bash

################################################################################
# Per-Participant Recording Verification Script
# Run this after testing to verify everything worked
################################################################################

echo "=========================================="
echo "Per-Participant Recording Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: MiroTalk Server
echo -n "1. MiroTalk Server: "
if pm2 list | grep -q "miro.*online"; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
fi

# Check 2: Transcription Service
echo -n "2. Transcription Service: "
if curl -s http://localhost:3000/health | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
fi

# Check 3: Recording Watcher
echo -n "3. Recording Watcher: "
if ps aux | grep -v grep | grep -q "watch-recordings.sh"; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not running${NC}"
fi

echo ""
echo "=========================================="
echo "Recording Files Check"
echo "=========================================="
echo ""

# Check 4: Look for per-user WebM files
echo "4. Original Recordings (WebM):"
webm_count=$(find /home/ubuntu/mirotalk/app/src/recordings -name "user_*.webm" 2>/dev/null | wc -l)
if [ $webm_count -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $webm_count per-user recordings${NC}"
    find /home/ubuntu/mirotalk/app/src/recordings -name "user_*.webm" -exec ls -lh {} \; | tail -5
else
    echo -e "   ${YELLOW}⚠️  No per-user recordings found yet${NC}"
    echo "   Tip: Record a new meeting to generate files"
fi

echo ""

# Check 5: Look for converted WAV files
echo "5. Converted Audio (WAV):"
wav_count=$(find /var/recordings/meetings -name "user_*.wav" 2>/dev/null | wc -l)
if [ $wav_count -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $wav_count converted files${NC}"
    find /var/recordings/meetings -name "user_*.wav" -exec ls -lh {} \; | tail -5
else
    echo -e "   ${YELLOW}⚠️  No converted files found yet${NC}"
fi

echo ""

# Check 6: Transcription Jobs
echo "6. Transcription Jobs:"
job_count=$(ls -1 /var/transcribe/jobs/*.json 2>/dev/null | wc -l)
if [ $job_count -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $job_count queued jobs${NC}"
    
    # Show stats
    stats=$(curl -s http://localhost:3000/transcribe/stats)
    echo "   Stats: $stats"
else
    echo -e "   ${YELLOW}⚠️  No jobs found yet${NC}"
fi

echo ""
echo "=========================================="
echo "File Name Format Check"
echo "=========================================="
echo ""

# Check 7: Verify filename format
echo "7. Per-User Filename Format:"
sample_file=$(find /home/ubuntu/mirotalk/app/src/recordings -name "user_*.webm" 2>/dev/null | head -1)
if [ -n "$sample_file" ]; then
    filename=$(basename "$sample_file")
    echo -e "   ${GREEN}✅ Correct format detected${NC}"
    echo "   Example: $filename"
    echo ""
    echo "   Format breakdown:"
    echo "   - Prefix: user_"
    echo "   - Peer ID: $(echo "$filename" | cut -d_ -f2)"
    echo "   - User Name: $(echo "$filename" | cut -d_ -f3 | cut -d- -f1)"
    echo "   - Timestamp: $(echo "$filename" | cut -d_ -f3- | sed 's/.webm//')"
else
    echo -e "   ${YELLOW}⚠️  No sample file available${NC}"
    echo "   Expected format: user_<peerId>_<userName>_<timestamp>.webm"
fi

echo ""
echo "=========================================="
echo "Recent Activity"
echo "=========================================="
echo ""

# Check 8: Recent watcher activity
echo "8. Watcher Log (Last 10 lines):"
if [ -f /tmp/recording-watcher.log ]; then
    tail -10 /tmp/recording-watcher.log | sed 's/^/   /'
else
    echo -e "   ${YELLOW}⚠️  No log file found${NC}"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

# Calculate success
success_count=0
total_checks=3

pm2 list | grep -q "miro.*online" && ((success_count++))
curl -s http://localhost:3000/health | grep -q '"status":"ok"' && ((success_count++))
ps aux | grep -v grep | grep -q "watch-recordings.sh" && ((success_count++))

if [ $success_count -eq $total_checks ]; then
    echo -e "${GREEN}✅ All services running!${NC}"
else
    echo -e "${YELLOW}⚠️  $success_count/$total_checks services running${NC}"
fi

if [ $webm_count -gt 0 ]; then
    echo -e "${GREEN}✅ Per-user recordings are working!${NC}"
    echo "   Found $webm_count user-specific files"
else
    echo -e "${YELLOW}⚠️  No per-user recordings yet - Record a meeting to test${NC}"
fi

echo ""
echo "=========================================="
echo "Testing Instructions"
echo "=========================================="
echo ""
echo "To test per-participant recording:"
echo ""
echo "1. Open https://jitsi.awdspark.com in 2 browser windows"
echo "2. Join the same meeting as different users"
echo "3. Click 'Start Recording' in one window"
echo "4. Talk for 10-15 seconds"
echo "5. Click 'Stop Recording'"
echo "6. Wait 5-10 seconds"
echo "7. Run this script again to verify files"
echo ""
echo "Expected result:"
echo "  - 2+ WebM files (one per participant)"
echo "  - 2+ WAV files (converted automatically)"
echo "  - 2+ Transcription jobs (queued automatically)"
echo ""
echo "=========================================="
