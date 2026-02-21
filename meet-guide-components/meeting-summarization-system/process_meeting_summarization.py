"""
Process Meeting Summarization - Auto-processing script for NLP analysis
Called by Node.js backend after meeting recording completes

Usage:
    python process_meeting_summarization.py <meeting_id>
"""

import sys
import os
import time
from datetime import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId

# Add current directory to path to import local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import NLP pipeline components
from pipeline import run_full_pipeline
from action_item_extraction import prioritize_action_items_by_deadline

from dotenv import load_dotenv

# Load .env from backend directory (fallback if env vars not passed)
env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'meet-guide-backend', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

print("Loaded: Meeting Summarization Pipeline (Intent Detection + Topic Modeling)")


def get_mongodb_connection(max_retries=3, retry_delay=2):
    """Connect to MongoDB using environment variables with retry logic"""
    # Use MongoDB Atlas connection (same as Node.js backend)
    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError("MONGODB_URI environment variable not set. Ensure it's passed from Node.js or set in .env file")

    for attempt in range(max_retries):
        try:
            print(f"Connecting to MongoDB (attempt {attempt + 1}/{max_retries})...")
            client = MongoClient(
                mongo_uri, 
                serverSelectionTimeoutMS=10000,  # 10 second timeout
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
                retryWrites=True
            )
            # Test connection
            client.server_info()
            print("✅ Connected to MongoDB")
            
            # Extract database name from URI or use default
            db_name = os.getenv('MONGODB_DB_NAME', 'meetguide')
            return client[db_name]
            
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⚠️ MongoDB connection attempt {attempt + 1} failed: {e}")
                print(f"   Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print(f"❌ Could not connect to MongoDB after {max_retries} attempts: {e}")
                raise


def fetch_meeting_transcript(db, meeting_id):
    """
    Fetch meeting transcript from meetings collection
    Returns: dict with meeting info and formatted transcript
    """
    print(f"\nFetching meeting data: {meeting_id}")
    
    meeting = db.meetings.find_one({'meeting_id': meeting_id})
    
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
    
    utterances = transcript_data['utterances']
    
    print(f"Found {len(utterances)} utterances")
    
    # Format for pipeline: list of {speaker, sentence}
    formatted_transcript = []
    for utterance in utterances:
        speaker = utterance.get('speaker', 'Unknown')
        text = utterance.get('text', '')
        
        if text.strip():
            formatted_transcript.append({
                'speaker': speaker,
                'sentence': text
            })
    
    # Get speaker mapping for email resolution
    speaker_mapping = transcript_data.get('speaker_mapping', {})
    
    # Create participant email map (case-insensitive)
    participant_emails = {}
    participant_emails_lower = {}  # Lowercase key mapping
    
    if 'participants' in meeting:
        for participant in meeting['participants']:
            username = participant.get('username', '')
            full_name = participant.get('full_name', '')
            email = participant.get('email', '')
            
            if email:
                # Add username mappings (case-sensitive and case-insensitive)
                if username:
                    participant_emails[username] = email
                    participant_emails_lower[username.lower()] = email
                    # Also add first name only
                    first_name = username.split()[0] if ' ' in username else username
                    participant_emails[first_name] = email
                    participant_emails_lower[first_name.lower()] = email
                
                # Add full_name mappings (case-sensitive and case-insensitive)
                if full_name:
                    participant_emails[full_name] = email
                    participant_emails_lower[full_name.lower()] = email
                    # Also add first name only
                    first_name = full_name.split()[0] if ' ' in full_name else full_name
                    participant_emails[first_name] = email
                    participant_emails_lower[first_name.lower()] = email
    
    # Add speaker_mapping entries
    if speaker_mapping:
        for speaker_name, user_info in speaker_mapping.items():
            if isinstance(user_info, dict):
                email = user_info.get('email', '')
                if email:
                    participant_emails[speaker_name] = email
                    participant_emails_lower[speaker_name.lower()] = email
    
    return {
        'meeting': meeting,
        'transcript': formatted_transcript,
        'participant_emails': participant_emails,
        'participant_emails_lower': participant_emails_lower
    }


def save_meeting_summarization(db, meeting, analysis, processing_time):
    """
    Save complete meeting summarization to MongoDB
    
    Args:
        meeting: Meeting document from MongoDB
        analysis: Analysis results from NLP pipeline
        processing_time: Processing time in milliseconds
    """
    meeting_id = meeting['meeting_id']
    
    results = analysis['results']
    topics = analysis['topics']
    intent_counts = {}
    
    # Calculate intent counts
    for result in results:
        intent = result.get('intent')
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
    
    # Create topic lookup map
    topic_label_map = {}
    for topic in topics:
        topic_label_map[topic['topic_id']] = topic['topic_label']
    
    # Transform results to MongoDB format
    transformed_results = []
    for result in results:
        details = result.get('details') or {}
        topic_label = topic_label_map.get(result.get('topic_id'))
        
        transformed_results.append({
            'speaker': result['speaker'],
            'sentence': result['sentence'],
            'intent': result['intent'],
            'text': result['sentence'],
            'task': details.get('what'),
            'assignee': details.get('who'),
            'deadline': details.get('when'),
            'priority': result.get('priority'),
            'topic': topic_label,
            'start_time': result.get('start_time', 0)
        })
    
    # Transform topics to MongoDB format
    transformed_topics = []
    for topic in topics:
        topic_items = topic.get('items', [])
        utterances = []
        
        for item in topic_items:
            utterances.append({
                'speaker': item['speaker'],
                'sentence': item['sentence'],
                'intent': item['intent']
            })
        
        transformed_topics.append({
            'topic_id': topic['topic_id'],
            'label': topic['topic_label'],
            'utterances': utterances,
            'start_index': topic.get('start_index', 0),
            'end_index': topic.get('end_index', 0)
        })
    
    # Prepare summarization document
    summarization_doc = {
        'meeting_id': meeting_id,
        'meeting_title': meeting.get('title', meeting_id),
        'meeting_date': meeting.get('actual_start', meeting.get('created_at')),
        'results': transformed_results,
        'topics': transformed_topics,
        'intent_counts': intent_counts,
        'total_utterances': len(transformed_results),
        'action_item_count': intent_counts.get('action-item', 0),
        'question_count': intent_counts.get('question', 0),
        'decision_count': intent_counts.get('decision', 0),
        'analyzed_at': datetime.now(),
        'processing_time_ms': processing_time,
        'model_version': '1.0.0'
    }
    
    # Upsert to database
    db.meetingsummarizations.update_one(
        {'meeting_id': meeting_id},
        {'$set': summarization_doc},
        upsert=True
    )
    
    print(f"   Saved complete summarization")
    print(f"      Total utterances: {len(transformed_results)}")
    print(f"      Topics: {len(transformed_topics)}")
    print(f"      Action items: {intent_counts.get('action-item', 0)}")
    print(f"      Questions: {intent_counts.get('question', 0)}")
    print(f"      Decisions: {intent_counts.get('decision', 0)}")
    
    return summarization_doc


def save_action_items(db, meeting, action_items, participant_emails, participant_emails_lower, topic_label_map):
    """
    Save individual action items to MongoDB actionitems collection
    
    Args:
        meeting: Meeting document
        action_items: List of action item results
        participant_emails: Map of speaker names to emails (case-sensitive)
        participant_emails_lower: Map of lowercase speaker names to emails
        topic_label_map: Map of topic IDs to labels
    """
    meeting_id = meeting['meeting_id']
    saved_count = 0
    
    for item in action_items:
        details = item.get('details') or {}
        
        # Extract assignee and email with case-insensitive fallback
        assignee_name = details.get('who', 'Unassigned')
        # Try exact match first, then case-insensitive
        assignee_email = participant_emails.get(assignee_name) or \
                        participant_emails_lower.get(assignee_name.lower(), assignee_name)
        
        # Handle team/all assignees - assign to all participants
        assignee_emails = []
        assignee_lower = assignee_name.lower()
        if assignee_lower in ["team", "all", "team / all", "team/all", "everyone"]:
            # Assign to all participants (get unique emails)
            assignee_emails = list(set(participant_emails.values()))
            assignee_name = "Team/All"
        elif assignee_email and '@' in assignee_email:
            # Single assignee with valid email
            assignee_emails = [assignee_email]
        else:
            # No valid email found - skip this action item or log warning
            print(f"   WARNING: No email found for assignee '{assignee_name}', skipping action item")
            continue
        
        # Get topic label
        topic_label = topic_label_map.get(item.get('topic_id'))
        
        # Prepare action item document
        action_item_doc = {
            'meeting_id': meeting_id,
            'meeting_title': meeting.get('title', meeting_id),
            'meeting_date': meeting.get('actual_start', meeting.get('created_at')),
            'speaker': item['speaker'],
            'sentence': item['sentence'],
            'task': details.get('what', item['sentence']),
            'assignee': assignee_name,
            'assignee_email': assignee_email,
            'assignee_emails': assignee_emails,  # New field for multiple assignees
            'deadline': details.get('when'),
            'deadline_date': None,  # Could parse deadline to date if needed
            'priority': item.get('priority', 'medium'),
            'status': item.get('status', 'pending'),
            'topic': topic_label,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        # Upsert - use meeting_id + sentence as unique identifier
        db.actionitems.update_one(
            {'meeting_id': meeting_id, 'sentence': item['sentence']},
            {'$set': action_item_doc},
            upsert=True
        )
        
        saved_count += 1
    
    print(f"   Saved {saved_count} action items to database")
    return saved_count


def save_empty_summarization(db, meeting_id):
    """
    Save empty summarization results when meeting has no transcript.
    Creates default records so the frontend knows processing was attempted.
    """
    # Find the meeting
    meeting = db.meetings.find_one({'meeting_id': meeting_id})
    if not meeting:
        meeting = db.meetings.find_one({'recording_folder': meeting_id})
    
    meeting_title = meeting.get('title', meeting_id) if meeting else meeting_id
    meeting_date = None
    if meeting:
        meeting_date = meeting.get('actual_start', meeting.get('created_at'))
    
    summarization_doc = {
        'meeting_id': meeting_id,
        'meeting_title': meeting_title,
        'meeting_date': meeting_date,
        'results': [],
        'topics': [],
        'intent_counts': {},
        'total_utterances': 0,
        'action_item_count': 0,
        'question_count': 0,
        'decision_count': 0,
        'analyzed_at': datetime.now(),
        'processing_time_ms': 0,
        'model_version': '1.0.0',
        'empty_transcript': True
    }
    
    db.meetingsummarizations.update_one(
        {'meeting_id': meeting_id},
        {'$set': summarization_doc},
        upsert=True
    )
    
    print(f"   Saved empty summarization for meeting: {meeting_id}")
    print(f"      Total utterances: 0")
    print(f"      Topics: 0")
    print(f"      Action items: 0")


def process_meeting(meeting_id):
    """
    Main processing function for a meeting
    """
    print("=" * 70)
    print("MEETING SUMMARIZATION - AUTO PROCESSING")
    print("=" * 70)
    print(f"Meeting ID: {meeting_id}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    start_time = datetime.now()
    
    try:
        # Connect to MongoDB
        db = get_mongodb_connection()
        print("Connected to MongoDB\n")
        
        # Fetch meeting transcript
        meeting_data = fetch_meeting_transcript(db, meeting_id)
        
        if not meeting_data or not meeting_data.get('transcript'):
            print("WARNING: No transcript data found. Saving empty results...")
            save_empty_summarization(db, meeting_id)
            print("\n" + "=" * 70)
            print(f"PROCESSING COMPLETE (empty transcript)")
            print(f"   Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70)
            return True
        
        meeting = meeting_data['meeting']
        transcript = meeting_data['transcript']
        participant_emails = meeting_data['participant_emails']
        participant_emails_lower = meeting_data['participant_emails_lower']
        
        print(f"Processing {len(transcript)} utterances...\n")
        
        # Run NLP pipeline
        results, topics = run_full_pipeline(transcript)
        
        # Extract action items
        action_items = [r for r in results if r.get('intent') == 'action-item']
        action_items = prioritize_action_items_by_deadline(action_items)
        
        # Calculate processing time
        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Prepare analysis data
        analysis = {
            'results': results,
            'topics': topics,
            'action_items': action_items
        }
        
        # Save complete summarization
        print("Saving results to database...")
        summarization = save_meeting_summarization(db, meeting, analysis, processing_time)
        
        # Create topic label map
        topic_label_map = {}
        for topic in topics:
            topic_label_map[topic['topic_id']] = topic['topic_label']
        
        # Save individual action items
        if action_items:
            save_action_items(db, meeting, action_items, participant_emails, participant_emails_lower, topic_label_map)
        
        print("\n" + "=" * 70)
        print(f"PROCESSING COMPLETE")
        print(f"   Processing time: {processing_time}ms")
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
        print("Usage: python process_meeting_summarization.py <meeting_id>")
        sys.exit(1)
    
    meeting_id = sys.argv[1]
    
    # Models will load automatically on first use
    success = process_meeting(meeting_id)
    
    sys.exit(0 if success else 1)
