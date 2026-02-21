import json
import re
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv

from pipeline import run_full_pipeline
from action_item_extraction import prioritize_action_items_by_deadline

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '..', 'meet-guide-backend', '.env')
env_example_path = os.path.join(os.path.dirname(__file__), '..', '..', 'meet-guide-backend', '.env.example')

if os.path.exists(env_path):
    load_dotenv(env_path)
    print("Loaded environment from .env")
elif os.path.exists(env_example_path):
    load_dotenv(env_example_path)
    print("Loaded environment from .env.example")
else:
    print("WARNING: No environment file found")

BASE_DIR = Path(__file__).parent
SAMPLE_PATH = BASE_DIR / "sample_transcript.json"


def serialize_datetime(obj):
    """
    Recursively convert datetime objects to ISO format strings in dictionaries and lists.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: serialize_datetime(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    else:
        return obj

# MongoDB connection (lazy initialization)
_db = None

def get_db():
    """Get MongoDB database connection (singleton with retry logic)"""
    global _db
    if _db is None:
        mongo_uri = os.getenv('MONGODB_URI')
        if not mongo_uri:
            raise RuntimeError("MONGODB_URI environment variable not set")
        
        # Retry logic for MongoDB Atlas DNS resolution
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            try:
                print(f"Connecting to MongoDB... (attempt {attempt}/{max_retries})")
                client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000, socketTimeoutMS=45000)
                # Test connection
                client.admin.command('ping')
                db_name = os.getenv('MONGODB_DB_NAME', 'meetguide')
                _db = client[db_name]
                print(f"✅ Connected to MongoDB database: {db_name}")
                break
            except Exception as e:
                print(f"MongoDB connection attempt {attempt}/{max_retries} failed: {e}")
                if attempt < max_retries:
                    import time
                    delay = 2 ** attempt  # Exponential backoff: 2s, 4s
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    print("❌ Failed to connect to MongoDB after all retries")
                    raise
    return _db

app = FastAPI(title="Intent Demo", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5000",
        "http://localhost:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptRequest(BaseModel):
    transcript: str


def _parse_transcript(raw: str) -> List[Dict[str, str]]:
    """Expect lines in the form "Speaker: sentence"; fallback speaker if missing."""
    turns = []
    for idx, line in enumerate(raw.splitlines()):
        clean = line.strip()
        if not clean:
            continue
        if ":" in clean:
            speaker, text = clean.split(":", 1)
        else:
            speaker, text = f"Speaker {idx+1}", clean
        turns.append({"speaker": speaker.strip(), "sentence": text.strip()})
    if not turns:
        raise ValueError("No transcript content found")
    return turns


def _sample_text() -> str:
    if not SAMPLE_PATH.exists():
        return "Host: Welcome to the meeting\nAlex: Let's finalize the launch plan\nSam: Can you prepare the metrics dashboard by Friday?"
    data = json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))
    return "\n".join(
        f"{item.get('speaker', 'Speaker')}: {item.get('sentence', item.get('text', ''))}" for item in data
    )


@app.get("/api/sample")
async def sample():
    return {"transcript": _sample_text()}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "meeting-summarization"}


@app.post("/api/analyze")
async def analyze(body: TranscriptRequest):
    try:
        turns = _parse_transcript(body.transcript)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Run the full pipeline (models load automatically on first use)
    results, final_topics = run_full_pipeline(turns)
    
    action_items = [r for r in results if r.get("intent") == "action-item"]
    
    # Sort action items by deadline (nearest first) using business logic function
    action_items = prioritize_action_items_by_deadline(action_items)
    
    counts: Dict[str, int] = {}
    for r in results:
        intent = r.get("intent")
        counts[intent] = counts.get(intent, 0) + 1

    # Serialize response data to handle any datetime objects
    response_data = {
        "results": serialize_datetime(results),
        "actionItems": serialize_datetime(action_items),
        "intentCounts": counts,
        "topics": serialize_datetime(final_topics),
    }

    return JSONResponse(response_data)


class MeetingProcessRequest(BaseModel):
    meeting_id: str


@app.post("/api/process-meeting")
async def process_meeting(body: MeetingProcessRequest):
    """Process a meeting by ID from MongoDB - models stay loaded in memory"""
    meeting_id = body.meeting_id
    
    try:
        db = get_db()
        meetings_col = db['meetings']
        
        # Try to fetch by MongoDB _id first, then fall back to meeting_id field
        meeting = None
        try:
            meeting = meetings_col.find_one({"_id": ObjectId(meeting_id)})
        except:
            # Not a valid ObjectId, try meeting_id field
            meeting = meetings_col.find_one({"meeting_id": meeting_id})
        
        if not meeting:
            raise HTTPException(status_code=404, detail=f"Meeting not found: {meeting_id}")
        
        # Get transcript - MongoDB stores it as an object with utterances array
        transcript_obj = meeting.get('transcript')
        utterances = []
        if transcript_obj:
            utterances = transcript_obj.get('utterances', [])
        
        # If no transcript or no utterances, save empty results and return success
        actual_meeting_id = meeting.get("meeting_id", str(meeting.get("_id")))
        if not utterances or len(utterances) == 0:
            print(f"⚠️ Meeting {meeting_id} has no transcript/utterances. Saving empty results...")
            empty_data = {
                "summarization": {
                    "results": [],
                    "actionItems": [],
                    "intentCounts": {},
                    "topics": [],
                    "processedAt": datetime.utcnow(),
                    "empty_transcript": True
                }
            }
            meetings_col.update_one(
                {"meeting_id": actual_meeting_id},
                {"$set": empty_data}
            )
            # Also save to meetingsummarizations collection
            db['meetingsummarizations'].update_one(
                {"meeting_id": actual_meeting_id},
                {"$set": {
                    "meeting_id": actual_meeting_id,
                    "meeting_title": meeting.get('title', actual_meeting_id),
                    "meeting_date": meeting.get('actual_start', meeting.get('created_at')),
                    "results": [],
                    "topics": [],
                    "intent_counts": {},
                    "total_utterances": 0,
                    "action_item_count": 0,
                    "question_count": 0,
                    "decision_count": 0,
                    "analyzed_at": datetime.now(),
                    "processing_time_ms": 0,
                    "model_version": "1.0.0",
                    "empty_transcript": True
                }},
                upsert=True
            )
            return JSONResponse({
                "success": True,
                "meetingId": actual_meeting_id,
                "processingTime": 0,
                "analysis": {
                    "results": [],
                    "actionItems": [],
                    "topics": [],
                    "intentCounts": {}
                },
                "summary": {
                    "totalResults": 0,
                    "topics": 0,
                    "actionItems": 0,
                    "empty_transcript": True
                }
            })
        
        # Format: "Speaker: text\nSpeaker: text\n..."
        transcript = '\n'.join([f"{u['speaker']}: {u['text']}" for u in utterances])
        
        print(f"⏳ Processing meeting {meeting_id} with {len(utterances)} utterances...")
        start_time = datetime.now()
        
        # Parse and process
        try:
            turns = _parse_transcript(transcript)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid transcript format: {str(exc)}") from exc
        
        # Run pipeline with already-loaded models
        results, final_topics = run_full_pipeline(turns)
        
        action_items = [r for r in results if r.get("intent") == "action-item"]
        action_items = prioritize_action_items_by_deadline(action_items)
        
        # Get meeting participants for assignee_emails enhancement
        participants = meeting.get("participants", [])
        participant_emails_map = {}  # name -> email mapping
        participant_emails_list = []  # list of all emails
        
        # Extract participant emails and build name->email mapping
        users_col = db['users']
        for participant in participants:
            user = None
            if isinstance(participant, str):
                # participant is a user ID
                from bson.objectid import ObjectId as BsonObjectId
                try:
                    user = users_col.find_one({"_id": BsonObjectId(participant)})
                except:
                    pass
            elif isinstance(participant, dict):
                # participant is an object with email
                if "email" in participant:
                    user = participant
            
            if user:
                email = user.get("email", "")
                username = user.get("username", "")
                full_name = user.get("full_name", "")
                
                if email:
                    participant_emails_list.append(email)
                    
                    # Map various forms of name to email (case-insensitive)
                    if username:
                        participant_emails_map[username.lower()] = email
                        # Also map first name
                        first_name = username.split()[0] if ' ' in username else username
                        participant_emails_map[first_name.lower()] = email
                    
                    if full_name:
                        participant_emails_map[full_name.lower()] = email
                        # Also map first name
                        first_name = full_name.split()[0] if ' ' in full_name else full_name
                        participant_emails_map[first_name.lower()] = email
                    
                    # Map email prefix (before @) to email
                    email_prefix = email.split('@')[0]
                    participant_emails_map[email_prefix.lower()] = email
        
        print(f"   Participant mapping: {participant_emails_map}")
        
        # Enhance action items with assignee_email and assignee_emails
        enhanced_action_items = []
        for item in action_items:
            details = item.get("details", {})
            assignee = details.get("who", "Unassigned")
            assignee_email = ""
            assignee_emails = []
            
            # Handle team/all assignees
            assignee_lower = assignee.lower()
            if assignee_lower in ["team", "all", "team / all", "team/all", "everyone"]:
                assignee_emails = participant_emails_list
                assignee = "Team/All"
                assignee_email = "team@all"  # Placeholder
            else:
                # Try to find assignee email from mapping (case-insensitive)
                assignee_email = participant_emails_map.get(assignee_lower, "")
                
                if assignee_email:
                    assignee_emails = [assignee_email]
                elif assignee and assignee != "Unassigned":
                    # No match found - log warning and skip
                    print(f"   WARNING: No email found for assignee '{assignee}', skipping action item")
                    continue
            
            # Create enhanced item
            meeting_date = meeting.get("actual_start", meeting.get("created_at"))
            # Convert datetime to ISO string if it's a datetime object
            if hasattr(meeting_date, 'isoformat'):
                meeting_date = meeting_date.isoformat()
            
            enhanced_item = {
                **item,
                "assignee": assignee,
                "assignee_email": assignee_email,
                "assignee_emails": assignee_emails,
                "task": details.get("what", item.get("sentence", "")),
                "deadline": details.get("when"),
                "meeting_title": meeting.get("title", ""),
                "meeting_date": meeting_date,
            }
            enhanced_action_items.append(enhanced_item)
        
        counts: Dict[str, int] = {}
        for r in results:
            intent = r.get("intent")
            counts[intent] = counts.get(intent, 0) + 1
        
        # Save results to database using meeting_id field
        update_data = {
            "summarization": {
                "results": results,
                "actionItems": enhanced_action_items,
                "intentCounts": counts,
                "topics": final_topics,
                "processedAt": datetime.utcnow()
            }
        }
        
        # Update using meeting_id field (not _id)
        actual_meeting_id = meeting.get("meeting_id", str(meeting.get("_id")))
        meetings_col.update_one(
            {"meeting_id": actual_meeting_id},
            {"$set": update_data}
        )
        
        elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        print(f"✅ Meeting {meeting_id} processed in {elapsed_ms}ms")
        
        # Serialize all datetime objects before returning
        response_data = {
            "success": True,
            "meetingId": actual_meeting_id,
            "processingTime": elapsed_ms,
            "analysis": {
                "results": serialize_datetime(results),
                "actionItems": serialize_datetime(enhanced_action_items),
                "topics": serialize_datetime(final_topics),
                "intentCounts": counts
            },
            "summary": {
                "actionItems": len(enhanced_action_items),
                "totalResults": len(results),
                "topics": len(final_topics),
                "intentCounts": counts
            }
        }
        
        return JSONResponse(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error processing meeting {meeting_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}") from e


if __name__ == "__main__":
    import os
    import argparse
    import uvicorn

    # CLI flags to override topic segmentation thresholds at runtime.
    # These map to environment variables consumed by topic_modeling.assign_topics().
    parser = argparse.ArgumentParser(description="Run Intent Demo API server")
    parser.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (dev)")

    # Topic segmentation overrides (env-driven in topic_modeling)
    parser.add_argument("--topic-window-k", type=int, help="Sliding window size for local continuity")
    parser.add_argument("--topic-local-threshold", type=float, help="Local similarity threshold (0-1)")
    parser.add_argument("--topic-global-threshold", type=float, help="Global centroid similarity threshold (0-1)")

    args = parser.parse_args()

    # Set env vars if flags provided (read by topic_modeling at runtime)
    if args.topic_window_k is not None:
        os.environ["TOPIC_WINDOW_K"] = str(args.topic_window_k)
    if args.topic_local_threshold is not None:
        os.environ["TOPIC_LOCAL_THRESHOLD"] = str(args.topic_local_threshold)
    if args.topic_global_threshold is not None:
        os.environ["TOPIC_GLOBAL_THRESHOLD"] = str(args.topic_global_threshold)

    uvicorn.run("web_server:app", host=args.host, port=args.port, reload=args.reload)
