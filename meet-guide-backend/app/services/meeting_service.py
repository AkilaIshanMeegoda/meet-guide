"""
Meeting Service - Handle meeting operations
"""
from datetime import datetime
from typing import Optional, List
from bson import ObjectId
import uuid
import logging

from ..database import get_meetings_collection, get_meeting_participants_collection
from ..models import MeetingCreate, MeetingResponse, MeetingUpdate, MeetingStatus, MeetingParticipant
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class MeetingService:
    """Service for meeting operations"""
    
    @staticmethod
    def generate_meeting_id() -> str:
        """Generate a unique meeting ID"""
        return str(uuid.uuid4())[:8]
    
    @staticmethod
    async def create_meeting(host_id: str, host_name: str, meeting_data: MeetingCreate) -> MeetingResponse:
        """Create a new meeting"""
        meetings = get_meetings_collection()
        
        meeting_id = MeetingService.generate_meeting_id()
        
        meeting_doc = {
            "meeting_id": meeting_id,
            "title": meeting_data.title,
            "description": meeting_data.description,
            "host_id": host_id,
            "host_name": host_name,
            "participants": [host_id],  # Host is first participant
            "status": MeetingStatus.SCHEDULED.value,
            "scheduled_start": meeting_data.scheduled_start,
            "scheduled_end": meeting_data.scheduled_end,
            "actual_start": None,
            "actual_end": None,
            "recording_folder": None,
            "created_at": datetime.utcnow(),
            "invited_emails": meeting_data.invited_emails or []
        }
        
        result = await meetings.insert_one(meeting_doc)
        meeting_doc["_id"] = result.inserted_id
        
        # Generate MiroTalk URL
        mirotalk_url = f"{settings.mirotalk_url}/join/{meeting_id}"
        
        logger.info(f"Created meeting: {meeting_id} by {host_name}")
        
        return MeetingResponse(
            id=str(meeting_doc["_id"]),
            meeting_id=meeting_id,
            title=meeting_doc["title"],
            description=meeting_doc["description"],
            host_id=meeting_doc["host_id"],
            host_name=meeting_doc["host_name"],
            participants=meeting_doc["participants"],
            status=MeetingStatus(meeting_doc["status"]),
            scheduled_start=meeting_doc["scheduled_start"],
            scheduled_end=meeting_doc["scheduled_end"],
            actual_start=meeting_doc["actual_start"],
            actual_end=meeting_doc["actual_end"],
            recording_folder=meeting_doc["recording_folder"],
            created_at=meeting_doc["created_at"],
            mirotalk_url=mirotalk_url
        )
    
    @staticmethod
    async def get_meeting_by_id(meeting_id: str) -> Optional[MeetingResponse]:
        """Get meeting by meeting_id"""
        meetings = get_meetings_collection()
        
        meeting = await meetings.find_one({"meeting_id": meeting_id})
        if not meeting:
            return None
        
        mirotalk_url = f"{settings.mirotalk_url}/join/{meeting_id}"
        
        return MeetingResponse(
            id=str(meeting["_id"]),
            meeting_id=meeting["meeting_id"],
            title=meeting["title"],
            description=meeting.get("description"),
            host_id=meeting["host_id"],
            host_name=meeting["host_name"],
            participants=meeting.get("participants", []),
            status=MeetingStatus(meeting["status"]),
            scheduled_start=meeting.get("scheduled_start"),
            scheduled_end=meeting.get("scheduled_end"),
            actual_start=meeting.get("actual_start"),
            actual_end=meeting.get("actual_end"),
            recording_folder=meeting.get("recording_folder"),
            created_at=meeting["created_at"],
            mirotalk_url=mirotalk_url
        )
    
    @staticmethod
    async def get_meetings_by_user(user_id: str, limit: int = 50) -> List[MeetingResponse]:
        """Get all meetings for a user (as host or participant)"""
        meetings = get_meetings_collection()
        
        cursor = meetings.find({
            "$or": [
                {"host_id": user_id},
                {"participants": user_id}
            ]
        }).sort("created_at", -1).limit(limit)
        
        result = []
        async for meeting in cursor:
            mirotalk_url = f"{settings.mirotalk_url}/join/{meeting['meeting_id']}"
            
            result.append(MeetingResponse(
                id=str(meeting["_id"]),
                meeting_id=meeting["meeting_id"],
                title=meeting["title"],
                description=meeting.get("description"),
                host_id=meeting["host_id"],
                host_name=meeting["host_name"],
                participants=meeting.get("participants", []),
                status=MeetingStatus(meeting["status"]),
                scheduled_start=meeting.get("scheduled_start"),
                scheduled_end=meeting.get("scheduled_end"),
                actual_start=meeting.get("actual_start"),
                actual_end=meeting.get("actual_end"),
                recording_folder=meeting.get("recording_folder"),
                created_at=meeting["created_at"],
                mirotalk_url=mirotalk_url
            ))
        
        return result
    
    @staticmethod
    async def update_meeting(meeting_id: str, update_data: MeetingUpdate) -> Optional[MeetingResponse]:
        """Update meeting details"""
        meetings = get_meetings_collection()
        
        update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
        
        if not update_dict:
            return await MeetingService.get_meeting_by_id(meeting_id)
        
        result = await meetings.update_one(
            {"meeting_id": meeting_id},
            {"$set": update_dict}
        )
        
        return await MeetingService.get_meeting_by_id(meeting_id)
    
    @staticmethod
    async def start_meeting(meeting_id: str, recording_folder: Optional[str] = None) -> Optional[MeetingResponse]:
        """Mark meeting as started"""
        meetings = get_meetings_collection()
        
        # Generate recording folder name if not provided
        if not recording_folder:
            recording_folder = meeting_id
        
        await meetings.update_one(
            {"meeting_id": meeting_id},
            {
                "$set": {
                    "status": MeetingStatus.ACTIVE.value,
                    "actual_start": datetime.utcnow(),
                    "recording_folder": recording_folder
                }
            }
        )
        
        logger.info(f"Meeting started: {meeting_id}")
        return await MeetingService.get_meeting_by_id(meeting_id)
    
    @staticmethod
    async def end_meeting(meeting_id: str) -> Optional[MeetingResponse]:
        """Mark meeting as ended"""
        meetings = get_meetings_collection()
        
        await meetings.update_one(
            {"meeting_id": meeting_id},
            {
                "$set": {
                    "status": MeetingStatus.ENDED.value,
                    "actual_end": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Meeting ended: {meeting_id}")
        return await MeetingService.get_meeting_by_id(meeting_id)
    
    @staticmethod
    async def add_participant(meeting_id: str, user_id: str, user_name: str, user_email: str) -> bool:
        """Add a participant to a meeting"""
        meetings = get_meetings_collection()
        participants = get_meeting_participants_collection()
        
        # Add user_id to meeting's participants list
        await meetings.update_one(
            {"meeting_id": meeting_id},
            {"$addToSet": {"participants": user_id}}
        )
        
        # Create detailed participant record
        participant_doc = {
            "meeting_id": meeting_id,
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "joined_at": datetime.utcnow(),
            "left_at": None,
            "audio_file": None
        }
        
        # Upsert participant record
        await participants.update_one(
            {"meeting_id": meeting_id, "user_id": user_id},
            {"$set": participant_doc},
            upsert=True
        )
        
        logger.info(f"Participant {user_name} joined meeting {meeting_id}")
        return True
    
    @staticmethod
    async def get_meeting_participants(meeting_id: str) -> List[MeetingParticipant]:
        """Get all participants for a meeting"""
        participants = get_meeting_participants_collection()
        
        cursor = participants.find({"meeting_id": meeting_id})
        
        result = []
        async for p in cursor:
            result.append(MeetingParticipant(
                meeting_id=p["meeting_id"],
                user_id=p["user_id"],
                user_name=p["user_name"],
                user_email=p["user_email"],
                joined_at=p.get("joined_at"),
                left_at=p.get("left_at"),
                audio_file=p.get("audio_file")
            ))
        
        return result
    
    @staticmethod
    async def update_participant_audio(meeting_id: str, user_name: str, audio_file: str):
        """Update participant's audio file reference"""
        participants = get_meeting_participants_collection()
        
        # Try to find by username (case-insensitive)
        await participants.update_one(
            {
                "meeting_id": meeting_id,
                "user_name": {"$regex": f"^{user_name}$", "$options": "i"}
            },
            {"$set": {"audio_file": audio_file}}
        )
        
        logger.info(f"Updated audio file for {user_name} in meeting {meeting_id}")
    
    @staticmethod
    async def link_existing_meeting(meeting_id: str, recording_folder: str, participants_data: List[dict]):
        """Link an existing recording folder to a meeting and map participants"""
        meetings = get_meetings_collection()
        participants = get_meeting_participants_collection()
        
        # Check if meeting exists, create if not
        existing = await meetings.find_one({"meeting_id": meeting_id})
        
        if not existing:
            # Create a new meeting record for existing recordings
            meeting_doc = {
                "meeting_id": meeting_id,
                "title": f"Meeting: {meeting_id}",
                "description": "Auto-created from existing recordings",
                "host_id": None,
                "host_name": "Unknown",
                "participants": [],
                "status": MeetingStatus.ENDED.value,
                "scheduled_start": None,
                "scheduled_end": None,
                "actual_start": None,
                "actual_end": datetime.utcnow(),
                "recording_folder": recording_folder,
                "created_at": datetime.utcnow()
            }
            await meetings.insert_one(meeting_doc)
            logger.info(f"Created meeting record for existing recording: {meeting_id}")
        else:
            # Update existing meeting with recording folder
            await meetings.update_one(
                {"meeting_id": meeting_id},
                {"$set": {"recording_folder": recording_folder}}
            )
        
        # Map participants
        for p_data in participants_data:
            participant_doc = {
                "meeting_id": meeting_id,
                "user_id": p_data.get("user_id"),
                "user_name": p_data["user_name"],
                "user_email": p_data.get("user_email"),
                "audio_file": p_data.get("audio_file"),
                "joined_at": p_data.get("joined_at"),
                "left_at": p_data.get("left_at")
            }
            
            await participants.update_one(
                {"meeting_id": meeting_id, "user_name": p_data["user_name"]},
                {"$set": participant_doc},
                upsert=True
            )
        
        logger.info(f"Linked {len(participants_data)} participants to meeting {meeting_id}")
