"""
Hybrid Detection Service - Handle Gen-Z slang detection and professional scoring
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
import json
import os
from pathlib import Path
import sys
import logging

from ..database import get_hybrid_detection_collection, get_users_collection
from ..models import HybridDetectionResult, SlangDetection, HybridDetectionSummary
from ..config import get_settings
from .user_service import UserService

logger = logging.getLogger(__name__)
settings = get_settings()


class HybridDetectionService:
    """Service for hybrid detection operations"""
    
    _hybrid_detector = None
    _score_calculator = None
    
    @staticmethod
    def get_hybrid_system_path() -> Path:
        """Get the path to the hybrid detection system"""
        # Path to hybrid-detection-system in meet-guide-components
        base_path = Path(__file__).resolve().parent.parent.parent.parent
        return base_path / "meet-guide-components" / "hybrid-detection-system"
    
    @staticmethod
    def get_mispronunciation_system_path() -> Path:
        """Get the path to the mispronunciation detection system (where transcripts are stored)"""
        return Path(settings.mispronunciation_system_path).resolve()
    
    @staticmethod
    def initialize_hybrid_detector():
        """Initialize the hybrid detector and score calculator"""
        if HybridDetectionService._hybrid_detector is not None:
            return
        
        try:
            system_path = HybridDetectionService.get_hybrid_system_path()
            
            # Add hybrid detection system to Python path
            if str(system_path) not in sys.path:
                sys.path.insert(0, str(system_path))
            
            # Import the modules
            from hybrid_detector import hybrid_detector
            from score_calculator import calculate_professional_score
            
            HybridDetectionService._hybrid_detector = hybrid_detector
            HybridDetectionService._score_calculator = calculate_professional_score
            
            logger.info("Hybrid detector initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing hybrid detector: {e}")
            raise
    
    @staticmethod
    async def get_participant_transcript(
        recording_folder: str, 
        participant_name: str
    ) -> Optional[str]:
        """Get transcript for a specific participant from mispronunciation system"""
        try:
            system_path = HybridDetectionService.get_mispronunciation_system_path()
            
            transcript_file = system_path / recording_folder / "participant_transcripts" / f"{participant_name}.txt"
            
            if not transcript_file.exists():
                transcript_file = system_path / recording_folder / "participant_transcripts" / f"{participant_name.capitalize()}.txt"
            
            if not transcript_file.exists():
                logger.warning(f"Transcript not found for participant: {participant_name}")
                return None
            
            with open(transcript_file, 'r', encoding='utf-8') as f:
                return f.read()
                
        except Exception as e:
            logger.error(f"Error loading transcript: {e}")
            return None
    
    @staticmethod
    async def analyze_transcript(
        transcript: str,
        participant_info: Optional[Dict[str, Any]] = None,
        meeting_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze transcript using hybrid detection system
        Returns professional score and detailed analysis
        """
        try:
            # Initialize detector if needed
            HybridDetectionService.initialize_hybrid_detector()
            
            if not transcript or not transcript.strip():
                raise ValueError("Transcript is empty")
            
            # Split transcript into sentences
            sentences = [s.strip() for s in transcript.split('\n') if s.strip()]
            
            # If no newlines, try splitting by periods
            if len(sentences) == 1:
                sentences = [s.strip() + '.' for s in transcript.split('.') if s.strip()]
            
            # Analyze each sentence
            detection_results = []
            for sentence in sentences:
                if sentence.strip():
                    result = HybridDetectionService._hybrid_detector.analyze(sentence.strip())
                    detection_results.append(result)
            
            if len(detection_results) == 0:
                raise ValueError("No valid sentences to analyze")
            
            # Calculate professional score using WMFSA algorithm
            report = HybridDetectionService._score_calculator(
                detection_results=detection_results,
                participant_info=participant_info,
                meeting_info=meeting_info,
                avg_utterances_per_participant=None
            )
            
            return report
            
        except Exception as e:
            logger.error(f"Error analyzing transcript: {e}")
            raise
    
    @staticmethod
    async def process_meeting_hybrid_detection(
        meeting_id: str,
        recording_folder: str,
        participants: List[Dict[str, str]]
    ) -> List[HybridDetectionResult]:
        """
        Process hybrid detection for all participants in a meeting
        
        Args:
            meeting_id: Meeting ID
            recording_folder: Recording folder name
            participants: List of participant dicts with 'user_id' and 'user_name'
        
        Returns:
            List of HybridDetectionResult objects
        """
        results = []
        
        for participant in participants:
            try:
                user_id = participant.get("user_id")
                user_name = participant.get("user_name")
                
                if not user_id or not user_name:
                    logger.warning(f"Invalid participant data: {participant}")
                    continue
                
                # Get transcript
                transcript = await HybridDetectionService.get_participant_transcript(
                    recording_folder, 
                    user_name
                )
                
                if not transcript:
                    logger.warning(f"No transcript found for {user_name}")
                    continue
                
                # Analyze transcript
                participant_info = {
                    "id": user_id,
                    "name": user_name
                }
                
                meeting_info = {
                    "id": meeting_id
                }
                
                analysis_result = await HybridDetectionService.analyze_transcript(
                    transcript=transcript,
                    participant_info=participant_info,
                    meeting_info=meeting_info
                )
                
                # Save result
                detection_result = await HybridDetectionService.save_hybrid_detection_result(
                    meeting_id=meeting_id,
                    user_id=user_id,
                    user_name=user_name,
                    analysis_result=analysis_result,
                    transcript=transcript
                )
                
                results.append(detection_result)
                logger.info(f"Processed hybrid detection for {user_name}: Score {detection_result.professional_score}")
                
            except Exception as e:
                logger.error(f"Error processing participant {participant.get('user_name')}: {e}")
                continue
        
        return results
    
    @staticmethod
    async def save_hybrid_detection_result(
        meeting_id: str,
        user_id: str,
        user_name: str,
        analysis_result: Dict[str, Any],
        transcript: Optional[str] = None
    ) -> HybridDetectionResult:
        """Save hybrid detection result to database"""
        collection = get_hybrid_detection_collection()
        
        # Extract data from nested structure returned by score_calculator
        professionalism = analysis_result.get("professionalism", {})
        slang_usage = analysis_result.get("slangUsage", {})
        engagement = analysis_result.get("engagement", {})
        breakdown = professionalism.get("breakdown", {})
        flagged_instances = analysis_result.get("flaggedInstances", [])
        
        # Map flagged instances to detections
        detections = []
        for flagged in flagged_instances:
            detections.append(SlangDetection(
                sentence=flagged.get("sentence", ""),
                is_slang=True,
                term=flagged.get("slangTerm"),
                confidence=flagged.get("confidence", 0.0),
                method=flagged.get("detectionMethod", "Unknown"),
                slang_type=flagged.get("type", "").lower()
            ))
        
        result = HybridDetectionResult(
            meeting_id=meeting_id,
            user_id=user_id,
            user_name=user_name,
            total_sentences=engagement.get("totalUtterances", 0),
            slang_detected_count=slang_usage.get("total", 0),
            slang_frequency_ratio=slang_usage.get("slangFrequencyPercent", 0.0) / 100,
            professional_score=float(professionalism.get("score", 0)),
            score_label=professionalism.get("label", "Unknown"),
            detections=detections,
            transcript=transcript,
            processed_at=datetime.utcnow(),
            frequency_penalty=abs(breakdown.get("slangFrequencyPenalty", 0)),
            severity_penalty=abs(breakdown.get("slangSeverityPenalty", 0)),
            repetition_penalty=abs(breakdown.get("repetitionPenalty", 0)),
            confidence_penalty=abs(breakdown.get("confidencePenalty", 0)),
            engagement_bonus=breakdown.get("engagementBonus", 0)
        )
        
        # Convert to dict for MongoDB
        result_doc = result.model_dump()
        result_doc["detections"] = [d.model_dump() for d in detections]
        
        # Upsert result
        await collection.update_one(
            {"meeting_id": meeting_id, "user_id": user_id},
            {"$set": result_doc},
            upsert=True
        )
        
        logger.info(f"Saved hybrid detection result for user {user_name} in meeting {meeting_id}")
        
        return result
    
    @staticmethod
    async def get_result_by_meeting_and_user(
        meeting_id: str, 
        user_id: str
    ) -> Optional[HybridDetectionResult]:
        """Get hybrid detection result for a specific user in a meeting"""
        collection = get_hybrid_detection_collection()
        
        doc = await collection.find_one({
            "meeting_id": meeting_id,
            "user_id": user_id
        })
        
        if not doc:
            return None
        
        doc["id"] = str(doc.pop("_id"))
        return HybridDetectionResult(**doc)
    
    @staticmethod
    async def get_results_by_meeting(meeting_id: str) -> List[HybridDetectionResult]:
        """Get all hybrid detection results for a meeting"""
        collection = get_hybrid_detection_collection()
        
        cursor = collection.find({"meeting_id": meeting_id}).sort("professional_score", -1)
        results = []
        
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            results.append(HybridDetectionResult(**doc))
        
        return results
    
    @staticmethod
    async def get_results_by_user(user_id: str, limit: int = 50) -> List[HybridDetectionResult]:
        """Get all hybrid detection results for a user across meetings"""
        collection = get_hybrid_detection_collection()
        
        cursor = collection.find({"user_id": user_id}).sort("processed_at", -1).limit(limit)
        results = []
        
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            results.append(HybridDetectionResult(**doc))
        
        return results
    
    @staticmethod
    async def get_user_summary(user_id: str) -> Optional[HybridDetectionSummary]:
        """Get summary of hybrid detection results for a user"""
        collection = get_hybrid_detection_collection()
        
        # Get all results for user
        results = await HybridDetectionService.get_results_by_user(user_id, limit=1000)
        
        if not results:
            return None
        
        # Calculate summary statistics
        total_meetings = len(results)
        total_sentences = sum(r.total_sentences for r in results)
        total_slang = sum(r.slang_detected_count for r in results)
        avg_score = sum(r.professional_score for r in results) / total_meetings
        avg_frequency = sum(r.slang_frequency_ratio for r in results) / total_meetings
        
        # Score trend over time
        score_trend = [
            {
                "meeting_id": r.meeting_id,
                "processed_at": r.processed_at.isoformat(),
                "score": r.professional_score,
                "label": r.score_label
            }
            for r in sorted(results, key=lambda x: x.processed_at)
        ]
        
        # Most common slang terms
        slang_counter = {}
        for result in results:
            for detection in result.detections:
                if detection.is_slang and detection.term:
                    slang_counter[detection.term] = slang_counter.get(detection.term, 0) + 1
        
        most_common_slang = [
            {"term": term, "count": count}
            for term, count in sorted(slang_counter.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        user_name = results[0].user_name if results else "Unknown"
        
        return HybridDetectionSummary(
            user_id=user_id,
            user_name=user_name,
            total_meetings_analyzed=total_meetings,
            average_professional_score=round(avg_score, 2),
            total_sentences_analyzed=total_sentences,
            total_slang_detected=total_slang,
            average_slang_frequency=round(avg_frequency, 4),
            score_trend=score_trend,
            most_common_slang=most_common_slang
        )
