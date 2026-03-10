"""
Pronunciation Service - Handle pronunciation feedback operations
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
import json
import os
from pathlib import Path
import subprocess
import logging

from ..database import get_pronunciation_feedback_collection, get_users_collection
from ..models import PronunciationFeedback, MispronunciationError, PronunciationSummary
from ..config import get_settings
from .user_service import UserService

logger = logging.getLogger(__name__)
settings = get_settings()


class PronunciationService:
    """Service for pronunciation feedback operations"""
    
    @staticmethod
    def get_mispronunciation_system_path() -> Path:
        """Get the path to the mispronunciation detection system"""
        return Path(settings.mispronunciation_system_path).resolve()
    
    @staticmethod
    def get_recordings_path() -> Path:
        """Get the path to recordings"""
        return Path(settings.recordings_base_path).resolve()
    
    @staticmethod
    async def process_meeting_pronunciation(meeting_id: str, recording_folder: str) -> bool:
        """
        Process pronunciation analysis for a meeting.
        This runs the mispronunciation detection pipeline.
        """
        try:
            system_path = PronunciationService.get_mispronunciation_system_path()
            recording_path = PronunciationService.get_recordings_path() / recording_folder
            
            # Check if recording folder exists in mispronunciation system
            target_path = system_path / recording_folder
            
            if not target_path.exists():
                # Copy or link recording folder to mispronunciation system
                logger.info(f"Recording folder not found in mispronunciation system: {target_path}")
                # For now, we'll assume the recordings are already in place or symlinked
            
            # Run the process_meeting.py script
            process_script = system_path / "process_meeting.py"
            
            if not process_script.exists():
                logger.error(f"Process script not found: {process_script}")
                return False
            
            logger.info(f"Processing pronunciation for meeting: {recording_folder}")
            
            result = subprocess.run(
                ["python", str(process_script), recording_folder],
                cwd=str(system_path),
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"Pronunciation processing failed: {result.stderr}")
                return False
            
            logger.info(f"Pronunciation processing completed for: {recording_folder}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing pronunciation: {e}")
            return False
    
    @staticmethod
    async def load_pronunciation_data(recording_folder: str) -> Optional[Dict[str, Any]]:
        """Load pronunciation data from the mispronunciation system output"""
        try:
            system_path = PronunciationService.get_mispronunciation_system_path()
            
            # Try new structure first
            summary_file = system_path / recording_folder / "participant_transcripts" / "mispronunciation_summary.json"
            
            if not summary_file.exists():
                # Try old structure
                summary_file = system_path / recording_folder / "output" / "participant_transcripts" / "mispronunciation_summary.json"
            
            if not summary_file.exists():
                logger.warning(f"Summary file not found for: {recording_folder}")
                return None
            
            with open(summary_file, 'r') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"Error loading pronunciation data: {e}")
            return None
    
    @staticmethod
    async def get_participant_pronunciation_detail(
        recording_folder: str, 
        participant_name: str
    ) -> Optional[Dict[str, Any]]:
        """Get detailed pronunciation data for a specific participant"""
        try:
            system_path = PronunciationService.get_mispronunciation_system_path()
            
            # Try new structure first
            detail_file = system_path / recording_folder / "participant_transcripts" / f"{participant_name}_mispronunciation.json"
            
            if not detail_file.exists():
                # Try with capitalized name
                detail_file = system_path / recording_folder / "participant_transcripts" / f"{participant_name.capitalize()}_mispronunciation.json"
            
            if not detail_file.exists():
                logger.warning(f"Detail file not found for: {participant_name}")
                return None
            
            with open(detail_file, 'r') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"Error loading participant detail: {e}")
            return None
    
    @staticmethod
    async def get_participant_transcript(
        recording_folder: str, 
        participant_name: str
    ) -> Optional[str]:
        """Get transcript for a specific participant"""
        try:
            system_path = PronunciationService.get_mispronunciation_system_path()
            
            transcript_file = system_path / recording_folder / "participant_transcripts" / f"{participant_name}.txt"
            
            if not transcript_file.exists():
                transcript_file = system_path / recording_folder / "participant_transcripts" / f"{participant_name.capitalize()}.txt"
            
            if not transcript_file.exists():
                return None
            
            with open(transcript_file, 'r') as f:
                return f.read()
                
        except Exception as e:
            logger.error(f"Error loading transcript: {e}")
            return None
    
    @staticmethod
    async def save_pronunciation_feedback(
        meeting_id: str,
        user_id: str,
        user_name: str,
        pronunciation_data: Dict[str, Any],
        transcript: Optional[str] = None
    ) -> PronunciationFeedback:
        """Save pronunciation feedback to database"""
        feedback_collection = get_pronunciation_feedback_collection()
        
        # Parse errors from pronunciation data
        errors = []
        for error in pronunciation_data.get("mispronunciations", []):
            errors.append(MispronunciationError(
                word=error.get("word", ""),
                expected_phonemes=error.get("expected_phonemes", ""),
                actual_phonemes=error.get("actual_phonemes"),
                error_type=error.get("error_type", "unknown"),
                severity=error.get("severity", "medium"),
                confidence=error.get("confidence", 0.0),
                timestamp=error.get("timestamp"),
                suggestion=error.get("suggestion")
            ))
        
        feedback = PronunciationFeedback(
            meeting_id=meeting_id,
            user_id=user_id,
            user_name=user_name,
            total_words=pronunciation_data.get("total_words", 0),
            mispronounced_count=pronunciation_data.get("mispronounced", len(errors)),
            error_rate=pronunciation_data.get("error_rate", 0.0),
            errors=errors,
            transcript=transcript,
            processed_at=datetime.utcnow()
        )
        
        # Upsert feedback
        feedback_doc = feedback.model_dump()
        feedback_doc["errors"] = [e.model_dump() for e in errors]
        
        result = await feedback_collection.update_one(
            {"meeting_id": meeting_id, "user_id": user_id},
            {"$set": feedback_doc},
            upsert=True
        )
        
        if result.upserted_id:
            feedback.id = str(result.upserted_id)
        
        logger.info(f"Saved pronunciation feedback for {user_name} in meeting {meeting_id}")
        return feedback
    
    @staticmethod
    async def get_user_pronunciation_feedback(
        user_id: str,
        meeting_id: Optional[str] = None
    ) -> List[PronunciationFeedback]:
        """Get pronunciation feedback for a user"""
        feedback_collection = get_pronunciation_feedback_collection()
        
        query = {"user_id": user_id}
        if meeting_id:
            query["meeting_id"] = meeting_id
        
        cursor = feedback_collection.find(query).sort("processed_at", -1)
        
        result = []
        async for doc in cursor:
            errors = [MispronunciationError(**e) for e in doc.get("errors", [])]
            result.append(PronunciationFeedback(
                id=str(doc["_id"]),
                meeting_id=doc["meeting_id"],
                user_id=doc["user_id"],
                user_name=doc["user_name"],
                total_words=doc.get("total_words", 0),
                mispronounced_count=doc.get("mispronounced_count", 0),
                error_rate=doc.get("error_rate", 0.0),
                errors=errors,
                transcript=doc.get("transcript"),
                processed_at=doc["processed_at"]
            ))
        
        return result
    
    @staticmethod
    async def get_meeting_pronunciation_feedback(meeting_id: str) -> List[PronunciationFeedback]:
        """Get all pronunciation feedback for a meeting"""
        feedback_collection = get_pronunciation_feedback_collection()
        
        cursor = feedback_collection.find({"meeting_id": meeting_id})
        
        result = []
        async for doc in cursor:
            errors = [MispronunciationError(**e) for e in doc.get("errors", [])]
            result.append(PronunciationFeedback(
                id=str(doc["_id"]),
                meeting_id=doc["meeting_id"],
                user_id=doc["user_id"],
                user_name=doc["user_name"],
                total_words=doc.get("total_words", 0),
                mispronounced_count=doc.get("mispronounced_count", 0),
                error_rate=doc.get("error_rate", 0.0),
                errors=errors,
                transcript=doc.get("transcript"),
                processed_at=doc["processed_at"]
            ))
        
        return result
    
    @staticmethod
    async def get_user_pronunciation_summary(user_id: str) -> PronunciationSummary:
        """Get summary of all pronunciation feedback for a user"""
        feedback_list = await PronunciationService.get_user_pronunciation_feedback(user_id)
        
        # Get user info
        user = await UserService.get_user_by_id(user_id)
        user_name = user.username if user else "Unknown"
        
        total_words = sum(f.total_words for f in feedback_list)
        total_errors = sum(f.mispronounced_count for f in feedback_list)
        avg_error_rate = (total_errors / total_words * 100) if total_words > 0 else 0
        
        # Calculate most common errors
        error_counts: Dict[str, int] = {}
        for feedback in feedback_list:
            for error in feedback.errors:
                word = error.word.lower()
                error_counts[word] = error_counts.get(word, 0) + 1
        
        most_common = sorted(
            [{"word": k, "count": v} for k, v in error_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]
        
        # Calculate improvement over time
        improvement = []
        for feedback in sorted(feedback_list, key=lambda f: f.processed_at):
            improvement.append({
                "date": feedback.processed_at.isoformat(),
                "meeting_id": feedback.meeting_id,
                "error_rate": feedback.error_rate
            })
        
        return PronunciationSummary(
            user_id=user_id,
            user_name=user_name,
            total_meetings=len(feedback_list),
            total_words_spoken=total_words,
            total_mispronunciations=total_errors,
            average_error_rate=avg_error_rate,
            most_common_errors=most_common,
            improvement_over_time=improvement
        )
    
    @staticmethod
    async def import_existing_meeting_data(recording_folder: str) -> bool:
        """
        Import pronunciation data from an existing processed meeting.
        Maps participants to users in the database.
        """
        try:
            # Load pronunciation summary
            summary_data = await PronunciationService.load_pronunciation_data(recording_folder)
            if not summary_data:
                logger.error(f"No pronunciation data found for: {recording_folder}")
                return False
            
            participants = summary_data.get("participants", {})
            
            for participant_name, p_data in participants.items():
                if p_data.get("status") != "success":
                    continue
                
                # Try to find user by username (case-insensitive)
                user = await UserService.get_user_by_username(participant_name)
                
                if not user:
                    logger.warning(f"No user found for participant: {participant_name}")
                    continue
                
                # Load detailed pronunciation data
                detail_data = await PronunciationService.get_participant_pronunciation_detail(
                    recording_folder, participant_name
                )
                
                if not detail_data:
                    # Use summary data instead
                    detail_data = {
                        "total_words": p_data.get("total_words", 0),
                        "mispronounced": p_data.get("errors_detected", 0),
                        "error_rate": p_data.get("error_rate", 0.0),
                        "mispronunciations": []
                    }
                
                # Load transcript
                transcript = await PronunciationService.get_participant_transcript(
                    recording_folder, participant_name
                )
                
                # Save feedback
                await PronunciationService.save_pronunciation_feedback(
                    meeting_id=recording_folder,
                    user_id=user.id,
                    user_name=participant_name,
                    pronunciation_data=detail_data,
                    transcript=transcript
                )
            
            logger.info(f"Imported pronunciation data for: {recording_folder}")
            return True
            
        except Exception as e:
            logger.error(f"Error importing meeting data: {e}")
            return False
