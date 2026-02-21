"""
Batch process all meetings that need summarization
Run this script to process multiple meetings at once
"""

import sys
import os
import time
from pymongo import MongoClient
from dotenv import load_dotenv

# Load .env from backend directory
env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'meet-guide-backend', '.env')
load_dotenv(env_path)

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from process_meeting_summarization import process_meeting


def get_mongodb_connection():
    """Connect to MongoDB with retry logic"""
    mongo_uri = os.getenv('MONGODB_URI')
    if not mongo_uri:
        mongo_uri = 'mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide?retryWrites=true&w=majority'
        print("⚠️ MONGODB_URI not found in environment, using default")
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"Attempting MongoDB connection (attempt {attempt + 1}/{max_retries})...")
            client = MongoClient(
                mongo_uri, 
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
                retryWrites=True,
                retryReads=True
            )
            client.server_info()
            print("✓ Connected to MongoDB")
            break
        except Exception as e:
            print(f"✗ Connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                print("\n✗ Could not connect to MongoDB after multiple attempts")
                print("   Please check:")
                print("   1. Network connectivity")
                print("   2. MongoDB Atlas cluster status")
                print("   3. Firewall settings")
                sys.exit(1)
    
    db_name = os.getenv('MONGODB_DB_NAME', 'meetguide')
    return client[db_name]


def main():
    """Process all meetings that need summarization"""
    db = get_mongodb_connection()
    
    # Get all meetings with transcripts
    meetings = list(db.meetings.find({
        'transcript.utterances': {'$exists': True, '$ne': []}
    }).limit(20))  # Limit to 20 for safety
    
    if not meetings:
        print("No meetings with transcripts found")
        return
    
    print(f"\nFound {len(meetings)} meetings with transcripts\n")
    
    # Check which ones need summarization
    to_process = []
    for meeting in meetings:
        meeting_id = meeting.get('meeting_id')
        if not meeting_id:
            continue
        
        # Check if summarization exists
        existing = db.meetingsummarizations.find_one({'meeting_id': meeting_id})
        if not existing:
            to_process.append(meeting_id)
    
    if not to_process:
        print("✓ All meetings already have summarizations!")
        return
    
    print(f"Found {len(to_process)} meetings needing summarization:\n")
    for mid in to_process:
        print(f"  - {mid}")
    
    print("\nProcessing...\n")
    
    success_count = 0
    failed_count = 0
    
    for meeting_id in to_process:
        print(f"\n{'='*60}")
        print(f"Processing: {meeting_id}")
        print('='*60)
        
        try:
            if process_meeting(meeting_id):
                success_count += 1
                print(f"✓ Success: {meeting_id}")
            else:
                failed_count += 1
                print(f"✗ Failed: {meeting_id}")
        except Exception as e:
            failed_count += 1
            print(f"✗ Error: {meeting_id} - {str(e)}")
    
    print(f"\n{'='*60}")
    print("BATCH PROCESSING COMPLETE")
    print('='*60)
    print(f"✓ Successful: {success_count}")
    print(f"✗ Failed: {failed_count}")
    print(f"Total: {len(to_process)}")


if __name__ == "__main__":
    main()
