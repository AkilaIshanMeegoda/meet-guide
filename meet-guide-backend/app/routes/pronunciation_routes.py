"""
Pronunciation Feedback Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Optional
from pathlib import Path

from ..models import PronunciationFeedback, PronunciationSummary, APIResponse
from ..services.pronunciation_service import PronunciationService
from ..services.meeting_service import MeetingService
from ..services.user_service import UserService
from ..auth import get_current_user
from ..config import get_settings

router = APIRouter(prefix="/pronunciation", tags=["Pronunciation Feedback"])
settings = get_settings()


@router.get("/my-feedback", response_model=APIResponse)
async def get_my_pronunciation_feedback(
    current_user = Depends(get_current_user),
    meeting_id: Optional[str] = None
):
    """
    Get pronunciation feedback for the current user
    """
    feedback_list = await PronunciationService.get_user_pronunciation_feedback(
        user_id=current_user.user_id,
        meeting_id=meeting_id
    )
    
    return APIResponse(
        success=True,
        message=f"Found {len(feedback_list)} feedback records",
        data=[f.model_dump() for f in feedback_list]
    )


@router.get("/my-summary", response_model=APIResponse)
async def get_my_pronunciation_summary(
    current_user = Depends(get_current_user)
):
    """
    Get pronunciation summary for the current user
    """
    summary = await PronunciationService.get_user_pronunciation_summary(
        user_id=current_user.user_id
    )
    
    return APIResponse(
        success=True,
        message="Summary retrieved",
        data=summary.model_dump()
    )


@router.get("/meeting/{meeting_id}", response_model=APIResponse)
async def get_meeting_pronunciation_feedback(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all pronunciation feedback for a meeting
    """
    feedback_list = await PronunciationService.get_meeting_pronunciation_feedback(meeting_id)
    
    return APIResponse(
        success=True,
        message=f"Found {len(feedback_list)} feedback records",
        data=[f.model_dump() for f in feedback_list]
    )


@router.get("/meeting/{meeting_id}/raw", response_model=APIResponse)
async def get_meeting_raw_pronunciation_data(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get raw pronunciation data from files (for the web visualization)
    """
    data = await PronunciationService.load_pronunciation_data(meeting_id)
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pronunciation data not found for this meeting"
        )
    
    return APIResponse(
        success=True,
        message="Raw data retrieved",
        data=data
    )


@router.get("/meeting/{meeting_id}/participant/{participant_name}", response_model=APIResponse)
async def get_participant_pronunciation_detail(
    meeting_id: str,
    participant_name: str,
    current_user = Depends(get_current_user)
):
    """
    Get detailed pronunciation data for a specific participant
    """
    detail = await PronunciationService.get_participant_pronunciation_detail(
        recording_folder=meeting_id,
        participant_name=participant_name
    )
    
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pronunciation data not found for participant: {participant_name}"
        )
    
    # Also get transcript
    transcript = await PronunciationService.get_participant_transcript(
        recording_folder=meeting_id,
        participant_name=participant_name
    )
    
    return APIResponse(
        success=True,
        message="Participant data retrieved",
        data={
            "pronunciation": detail,
            "transcript": transcript
        }
    )


@router.post("/process/{meeting_id}", response_model=APIResponse)
async def process_meeting_pronunciation(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """
    Trigger pronunciation analysis for a meeting (runs in background)
    """
    meeting = await MeetingService.get_meeting_by_id(meeting_id)
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    recording_folder = meeting.recording_folder or meeting_id
    
    # Run processing in background
    background_tasks.add_task(
        PronunciationService.process_meeting_pronunciation,
        meeting_id,
        recording_folder
    )
    
    return APIResponse(
        success=True,
        message="Pronunciation analysis started. This may take a few minutes.",
        data={"meeting_id": meeting_id, "recording_folder": recording_folder}
    )


@router.post("/import/{recording_folder}", response_model=APIResponse)
async def import_existing_meeting(
    recording_folder: str,
    current_user = Depends(get_current_user)
):
    """
    Import pronunciation data from an existing processed meeting folder
    """
    success = await PronunciationService.import_existing_meeting_data(recording_folder)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to import meeting data"
        )
    
    return APIResponse(
        success=True,
        message=f"Successfully imported data from {recording_folder}",
        data={"recording_folder": recording_folder}
    )


@router.get("/available-meetings", response_model=APIResponse)
async def get_available_meetings_with_pronunciation_data(
    current_user = Depends(get_current_user)
):
    """
    Get list of meeting folders that have pronunciation data
    """
    system_path = PronunciationService.get_mispronunciation_system_path()
    
    meetings = []
    
    for folder in system_path.iterdir():
        if not folder.is_dir():
            continue
        
        if folder.name.startswith('.') or folder.name in ['web', '__pycache__', 'configs', 'finetuned_whisper_nptel']:
            continue
        
        # Check for pronunciation data
        summary_file = folder / "participant_transcripts" / "mispronunciation_summary.json"
        if summary_file.exists():
            meetings.append({
                "folder": folder.name,
                "name": folder.name.replace('_', ' ').title(),
                "has_data": True
            })
    
    return APIResponse(
        success=True,
        message=f"Found {len(meetings)} meetings with pronunciation data",
        data=meetings
    )
