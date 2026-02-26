"""
Process Hybrid Detection - Auto-processing script for Gen-Z slang detection
Called by Node.js backend after pronunciation processing completes

Usage:
    python process_hybrid_detection.py <meeting_id>
"""

import sys
import os
from datetime import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId

# Add current directory to path to import local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import hybrid detector with AI model
from hybrid_detector import hybrid_detector
from score_calculator import calculate_professional_score

print("Loaded: Hybrid Detector with AI Model (DistilBERT)")


def get_mongodb_connection():
    """Connect to MongoDB using environment variables or defaults"""
    # Use MongoDB Atlas connection (same as Node.js backend)
    mongo_uri = os.getenv('MONGODB_URI', 'mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide?retryWrites=true&w=majority')
    
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        # Test connection
        client.server_info()
    except Exception as e:
        print(f"ERROR: Could not connect to MongoDB: {e}")
        raise
    
    # Extract database name from URI or use default
    db_name = os.getenv('MONGODB_DB_NAME', 'meetguide')
    
    return client[db_name]


def fetch_meeting_transcript(db, meeting_id):
    """
    Fetch meeting transcript from meetings collection
    Returns: dict with meeting info and speaker transcripts
    """
    print(f"\nFetching meeting data: {meeting_id}")
    
    meeting = db.meetings.find_one({'recording_folder': meeting_id})
    
    if not meeting:
        print(f"ERROR: Meeting '{meeting_id}' not found in database")
        return None
    
    # Check if transcript exists
    if 'transcript' not in meeting or not meeting['transcript']:
        print(f"WARNING: Meeting '{meeting_id}' has no transcript")
        return None
    
    transcript_data = meeting['transcript']
    
    # Check for utterances (speaker-wise breakdown)
    if 'utterances' not in transcript_data or not transcript_data['utterances']:
        print(f"WARNING: Meeting '{meeting_id}' has no utterances")
        return None
    
    # Get speaker mapping
    speaker_mapping = transcript_data.get('speaker_mapping', {})
    utterances = transcript_data['utterances']
    
    print(f"Found {len(utterances)} utterances from {len(speaker_mapping)} speakers")
    
    # Aggregate text by speaker
    speaker_texts = {}
    for utterance in utterances:
        speaker_name = utterance.get('speaker', '')
        text = utterance.get('text', '')
        
        if speaker_name not in speaker_texts:
            speaker_texts[speaker_name] = []
        
        speaker_texts[speaker_name].append(text)
    
    # Prepare result with speaker info
    participants = []
    for speaker_name, texts in speaker_texts.items():
        combined_text = ' '.join(texts)
        
        # Try to find user_id from participants list
        user_id = None
        user_email = None
        
        if 'participants' in meeting:
            for participant in meeting['participants']:
                if participant.get('username') == speaker_name or participant.get('full_name') == speaker_name:
                    # Try to find user in users collection
                    email = participant.get('email', '')
                    user = db.users.find_one({'email': email})
                    if user:
                        user_id = str(user['_id'])
                        user_email = email
                    break
        
        participants.append({
            'user_name': speaker_name,
            'user_id': user_id,
            'user_email': user_email or speaker_name,
            'transcript': combined_text
        })
        
        print(f"   Speaker: {speaker_name} - {len(texts)} utterances")
    
    return {
        'meeting_id': meeting_id,
        'participants': participants
    }


def analyze_transcript(transcript_text):
    """
    Analyze a single transcript for Gen-Z slang
    Returns: List of detection results (one per sentence) for score calculation
    """
    if not transcript_text or not transcript_text.strip():
        return []
    
    # Split transcript into sentences
    sentences = [s.strip() for s in transcript_text.split('.') if s.strip()]
    
    # Collect all results for score calculator
    all_results = []
    for sentence in sentences:
        if len(sentence.split()) < 2:  # Skip very short sentences
            continue
            
        # Analyze using hybrid detector - returns {text, term, is_slang, confidence, method}
        result = hybrid_detector.analyze(sentence)
        all_results.append(result)
    
    return all_results


def save_hybrid_detection_result(db, meeting_id, participant_data, detection_results, score_data):
    """
    Save hybrid detection results to MongoDB
    
    Args:
        detection_results: Raw results from hybrid_detector (list of {text, term, is_slang, ...})
        score_data: Processed report from score_calculator
    """
    user_name = participant_data['user_name']
    user_id = participant_data.get('user_id')
    user_email = participant_data.get('user_email', user_name)
    transcript = participant_data['transcript']
    
    # Extract from nested score_data structure
    professionalism = score_data.get('professionalism', {})
    breakdown = professionalism.get('breakdown', {})
    flagged_instances = score_data.get('flaggedInstances', [])
    slang_usage = score_data.get('slangUsage', {})
    
    # Build slang detections for MongoDB from flagged instances
    slang_detections = []
    all_slang_terms = []
    
    for flagged in flagged_instances:
        slang_term = flagged.get('slangTerm', '')
        slang_detections.append({
            'sentence': flagged.get('sentence', ''),
            'detected_slang': [slang_term] if slang_term else [],
            'detection_method': flagged.get('detectionMethod', 'Unknown'),
            'confidence': flagged.get('confidence', 0),
            'severity_weight': flagged.get('severityWeight', 0),
            'type': flagged.get('type', 'Unknown')
        })
        if slang_term:
            all_slang_terms.append(slang_term)
    
    unique_slang = list(set(all_slang_terms))
    
    # Prepare document
    result_doc = {
        'meeting_id': meeting_id,
        'user_name': user_name,
        
        # Professional Score (from nested structure)
        'professional_score': professionalism.get('score', 100),
        'score_label': professionalism.get('label', 'Unknown'),
        
        # Score Components (from breakdown)
        'frequency_penalty': abs(breakdown.get('slangFrequencyPenalty', 0)),
        'severity_penalty': abs(breakdown.get('slangSeverityPenalty', 0)),
        'repetition_penalty': abs(breakdown.get('repetitionPenalty', 0)),
        'confidence_penalty': abs(breakdown.get('confidencePenalty', 0)),
        'engagement_bonus': breakdown.get('engagementBonus', 0),
        
        # Detection Results
        'total_sentences': len(detection_results),
        'slang_detections': slang_detections,
        'total_slang_count': slang_usage.get('total', 0),
        'unique_slang_terms': unique_slang,
        
        # Transcript
        'transcript': transcript,
        
        # Metadata
        'processed_at': datetime.now()
    }
    
    # Add user_id ONLY if available (don't add null to avoid unique index conflicts)
    if user_id:
        result_doc['user_id'] = ObjectId(user_id)
        # Upsert with user_id
        db.hybriddetections.update_one(
            {'meeting_id': meeting_id, 'user_id': ObjectId(user_id)},
            {'$set': result_doc},
            upsert=True
        )
    else:
        # Upsert without user_id field (use user_name as identifier)
        # IMPORTANT: Don't include user_id field at all when None to avoid unique index violations
        db.hybriddetections.update_one(
            {'meeting_id': meeting_id, 'user_name': user_name},
            {'$set': result_doc},
            upsert=True
        )
    
    print(f"   Saved: {user_name}")
    print(f"      Score: {professionalism.get('score', 100):.1f} ({professionalism.get('label', 'Unknown')})")
    print(f"      Slang Count: {slang_usage.get('total', 0)} | Unique: {len(unique_slang)}")


def save_empty_hybrid_detection(db, meeting_id):
    """
    Save empty hybrid detection results when meeting has no transcript.
    Creates a default record so the frontend knows processing was attempted.
    """
    # Find the meeting to get participant info
    meeting = db.meetings.find_one({'recording_folder': meeting_id})
    if not meeting:
        meeting = db.meetings.find_one({'meeting_id': meeting_id})
    
    participants = []
    if meeting and 'participants' in meeting:
        participants = meeting['participants']
    
    if not participants:
        # Save a single empty record for the meeting itself
        participants = [{'username': 'Unknown', 'email': '', 'full_name': 'Unknown'}]
    
    for participant in participants:
        user_name = participant.get('username', participant.get('full_name', 'Unknown'))
        user_email = participant.get('email', '')
        
        # Try to find user_id
        user_id = None
        if user_email:
            user = db.users.find_one({'email': user_email})
            if user:
                user_id = user['_id']
        
        result_doc = {
            'meeting_id': meeting_id,
            'user_name': user_name,
            'professional_score': 100,
            'score_label': 'Excellent',
            'frequency_penalty': 0,
            'severity_penalty': 0,
            'repetition_penalty': 0,
            'confidence_penalty': 0,
            'engagement_bonus': 0,
            'total_sentences': 0,
            'slang_detections': [],
            'total_slang_count': 0,
            'unique_slang_terms': [],
            'transcript': '',
            'processed_at': datetime.now(),
            'empty_transcript': True
        }
        
        if user_id:
            result_doc['user_id'] = user_id
            db.hybriddetections.update_one(
                {'meeting_id': meeting_id, 'user_id': user_id},
                {'$set': result_doc},
                upsert=True
            )
        else:
            db.hybriddetections.update_one(
                {'meeting_id': meeting_id, 'user_name': user_name},
                {'$set': result_doc},
                upsert=True
            )
        
        print(f"   Saved empty result for: {user_name} (no speech detected)")
    
    print(f"   Total empty records saved: {len(participants)}")


def process_meeting(meeting_id):
    """
    Main processing function for a meeting
    """
    print("=" * 70)
    print("HYBRID DETECTION - AUTO PROCESSING")
    print("=" * 70)
    print(f"Meeting ID: {meeting_id}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    try:
        # Connect to MongoDB
        db = get_mongodb_connection()
        print("Connected to MongoDB\n")
        
        # Fetch meeting transcript from meetings collection
        meeting_data = fetch_meeting_transcript(db, meeting_id)
        
        if not meeting_data or not meeting_data.get('participants'):
            print("WARNING: No transcript data found. Saving empty results...")
            save_empty_hybrid_detection(db, meeting_id)
            print("\n" + "=" * 70)
            print(f"PROCESSING COMPLETE (empty transcript)")
            print(f"   Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70)
            return True
        
        participants = meeting_data['participants']
        print("Starting hybrid detection analysis...\n")
        
        # Process each participant
        processed_count = 0
        for participant in participants:
            user_name = participant['user_name']
            user_id = participant.get('user_id')
            transcript = participant['transcript']
            
            print(f"Processing: {user_name}")
            
            # Analyze transcript for slang - returns list of {text, term, is_slang, confidence, method}
            detection_results = analyze_transcript(transcript)
            print(f"   Analyzed {len(detection_results)} sentences")
            
            # Calculate professional score using WMFSA algorithm
            participant_info = {
                'id': user_id or user_name,
                'name': user_name
            }
            
            score_data = calculate_professional_score(
                detection_results=detection_results,
                participant_info=participant_info
            )
            
            # Count slang instances
            slang_count = sum(1 for r in detection_results if r.get('is_slang', False))
            print(f"   Found {slang_count} sentences with slang")
            
            # Save to database
            save_hybrid_detection_result(
                db, meeting_id, participant, detection_results, score_data
            )
            
            processed_count += 1
            print()
        
        print("=" * 70)
        print(f"PROCESSING COMPLETE")
        print(f"   Participants processed: {processed_count}")
        print(f"   Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process_hybrid_detection.py <meeting_id>")
        sys.exit(1)
    
    meeting_id = sys.argv[1]
    
    # Detector is already initialized when imported (with auto-fallback)
    success = process_meeting(meeting_id)
    
    sys.exit(0 if success else 1)
