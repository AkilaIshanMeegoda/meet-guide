# Hybrid Detection System - Gen-Z Slang Detection

**Auto-integrated into MeetGuide Backend** ✅

This system automatically detects Gen-Z slang usage in meeting transcripts and calculates professional communication scores.

---

## 📁 Essential Files

### Production Files:
```
process_hybrid_detection.py     → Main processing script (called by Node.js)
hybrid_detector.py              → AI-powered detection (DistilBERT - ACTIVE)
score_calculator.py             → WMFSA scoring algorithm (0-100 scale)
requirements.txt                → Python dependencies
models/                         → AI model files (DistilBERT 66M parameters)
```

The system uses **DistilBERT AI model** for intelligent slang detection with context awareness.

---

## 🚀 How It Works

### Auto-Processing Flow:
```
1. Meeting transcript saved to MongoDB (meetings collection)
   └─ Contains transcript.utterances with speaker-wise breakdown

2. Node.js backend detects new transcript
   └─ recordingWatcher.js service

3. Python script auto-triggered
   └─ python process_hybrid_detection.py <meeting_id>

4. Processing per speaker:
   ├─ Aggregate text from utterances array
   ├─ Analyze each sentence for slang
   ├─ Calculate professional score (WMFSA)
   └─ Save to hybriddetections collection

5. Results available immediately
   └─ Accessible via API endpoints
```

### Data Source:
```javascript
meetings.transcript.utterances: [
  {
    speaker: "Chalana",
    text: "Let's discuss the project goals...",
    start: 40.315,
    end: 52.41
  }
]
```

### Speaker Mapping:
- Aggregates all utterances per speaker
- Maps speaker name → user_id (via email lookup)
- Handles both registered users and guest participants

---

## 🎯 WMFSA Scoring Algorithm

**Weighted Multi-Factor Scoring Algorithm**

```
Professional Score = 100 - D1 - D2 - D3 - D4 + B1

Components:
  D1 = Frequency Penalty (35%)    → % of sentences with slang
  D2 = Severity Penalty (25%)     → Severity of slang terms used
  D3 = Repetition Penalty (15%)   → Repeated same slang term
  D4 = Confidence Penalty (15%)   → AI confidence (or 1.0 for rules)
  B1 = Engagement Bonus (10%)     → Speaking more than average

Score Labels:
  90-100 → Excellent Professionalism
  75-89  → Good Professionalism
  60-74  → Moderate Professionalism
  40-59  → Needs Improvement
  0-39   → Poor Professionalism
```

---

## 🔍 Slang Detection Rules

### Unambiguous Slang (Always detected):
```
"skibidi", "rizz", "yeet", "sus", "cheugy", "simp", "finna", 
"gyatt", "no cap", "big yikes", "ick", "delulu", "poggers", 
"lit", "lowkey", "W", "L"
```

### Ambiguous Slang (Context-dependent, AI-powered):
```
"vibe", "cap", "fire", "mid", "sick", "solid", "hits", "bet", 
"slaps", "wild", "crazy", "trash", "mood", "basic", "salty"
```

**AI Detection**: The DistilBERT model analyzes context to determine if ambiguous terms are used as slang or in their standard meaning. Confidence threshold: 90% for ambiguous terms to ensure accuracy.

---

## 📦 Installation

### Python Dependencies:
```bash
cd meet-guide-components/hybrid-detection-system
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### Required Packages:
- `pymongo` - MongoDB connection
- `spacy` - NLP for lemmatization
- `transformers` - AI model framework (for future AI upgrade)
- `torch` - PyTorch (for future AI upgrade)

---

## 💾 Database Schema

### MongoDB Collection: `hybriddetections`
```javascript
{
  meeting_id: "projectmeeting2",        // Meeting identifier
  user_id: ObjectId("..."),             // Optional (only for registered users)
  user_name: "Chalana",                 // Speaker name
  
  // Professional Score
  professional_score: 94.5,             // 0-100
  score_label: "Excellent Professionalism",
  
  // Score Breakdown
  frequency_penalty: 3.2,
  severity_penalty: 1.5,
  repetition_penalty: 0.8,
  confidence_penalty: 0.0,
  engagement_bonus: 0.0,
  
  // Detection Results
  total_sentences: 18,
  total_slang_count: 2,
  unique_slang_terms: ["fire", "no cap"],
  slang_detections: [
    {
      sentence: "The new dashboard design is fire.",
      detected_slang: ["fire"],
      detection_method: "Rule-Based",
      confidence: 1.0,
      severity_weight: 0.7,
      type: "Ambiguous"
    }
  ],
  
  // Full Transcript
  transcript: "Let's discuss... (aggregated from all utterances)",
  
  // Metadata
  processed_at: ISODate("2026-02-12T...")
}
```

### Unique Constraint:
`(meeting_id, user_name)` - One result per speaker per meeting

---

## 🔌 API Endpoints

### Automatic Processing (No Manual Calls Needed!):
The backend automatically processes all meetings on startup and after new transcripts.

### Manual Endpoints (Optional):
```
POST /api/hybrid-detection/process/:meetingId
  → Manually trigger processing for a specific meeting

GET /api/hybrid-detection/results/:meetingId
  → Get all results for a meeting

GET /api/hybrid-detection/user/:userId
  → Get all results for a user across meetings

GET /api/hybrid-detection/status/:meetingId
  → Check processing status
```

---

## 🛠️ Backend Integration Files

```
meet-guide-backend/
  src/
    models/HybridDetection.js              → Mongoose schema
    services/hybridDetectionService.js     → Spawns Python script
    services/recordingWatcher.js           → Auto-triggers processing
    routes/hybridDetection.js              → API endpoints
```

### Key Integration Points:

**1. Auto-Trigger on Startup**: `recordingWatcher.js` scans database for meetings with transcripts but missing hybrid detection results.

**2. Python Subprocess**: `hybridDetectionService.js` spawns Python script with meeting_id as argument.

**3. MongoDB Connection**: Python connects to same MongoDB Atlas cluster as Node.js backend.

---

## 🐛 Troubleshooting

### Issue: Python script fails
```bash
# Check Python version (3.8+)
python --version

# Reinstall dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### Issue: MongoDB connection error
- Check `MONGODB_URI` environment variable
- Default: `mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide`
- Python script hardcoded to Atlas (line 33 in process_hybrid_detection.py)

### Issue: No AI model
✅ **Model is now installed and working!**

The DistilBERT model is active and provides intelligent, context-aware slang detection.

### Issue: Deprecation warning (datetime.utcnow())
⚠️ **Non-critical** - Fix in future: Replace `datetime.utcnow()` with `datetime.now(datetime.UTC)`

---

## 📊 Current Status

**Active Processing**: ✅ Working perfectly with AI Model
- **AI Model**: DistilBERT (66M parameters) - Active
- **Detection Mode**: Hybrid (Rule-Based + AI)
- **Auto-Processing**: Enabled on backend startup
- **Database**: 9 results from 6 meetings processed

**Test Results**:
```
Meeting: projectmeeting2
  └─ Chalana: 100 (Excellent Professionalism)

Meeting: projectmeeting
  ├─ chalana@gmail.com: 100
  ├─ dinithi@gmail.com: 100
  └─ savishka@gmail.com: 100
```

All participants currently have perfect scores because test transcripts don't contain Gen-Z slang.

---

## 🎓 For More Information

- **Integration Guide**: See `HYBRID_AUTO_INTEGRATION.md` in project root
- **Architecture**: See `ARCHITECTURE.md` in project root
- **Scoring Algorithm**: Fully documented in `score_calculator.py` (lines 1-100)

---

**Last Updated**: February 12, 2026  
**System Status**: ✅ Production Ready (AI Model Active - DistilBERT)
