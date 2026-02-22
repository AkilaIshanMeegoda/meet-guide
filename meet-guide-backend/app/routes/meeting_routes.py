"""
Meeting Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional

from ..models import (
    MeetingCreate, MeetingResponse, MeetingUpdate, 
    MeetingParticipant, APIResponse
)
from ..services.meeting_service import MeetingService
from ..services.user_service import UserService
from ..auth import get_current_user

router = APIRouter(prefix="/meetings", tags=["Meetings"])


@router.post("/", response_model=APIResponse)
async def create_meeting(
    meeting_data: MeetingCreate,
    current_user = Depends(get_current_user)
):
    """
    Create a new meeting
    """
    # Get user info
    user = await UserService.get_user_by_id(current_user.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    meeting = await MeetingService.create_meeting(
        host_id=current_user.user_id,
        host_name=user.username,
        meeting_data=meeting_data
    )
    
    return APIResponse(
        success=True,
        message="Meeting created successfully",
        data=meeting.model_dump()
    )


@router.get("/", response_model=APIResponse)
async def get_user_meetings(
    current_user = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all meetings for the current user
    """
    meetings = await MeetingService.get_meetings_by_user(
        current_user.user_id, 
        limit=limit
    )
    
    return APIResponse(
        success=True,
        message=f"Found {len(meetings)} meetings",
        data=[m.model_dump() for m in meetings]
    )


@router.get("/{meeting_id}", response_model=APIResponse)
async def get_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get meeting by ID
    """
    meeting = await MeetingService.get_meeting_by_id(meeting_id)
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    return APIResponse(
        success=True,
        message="Meeting found",
        data=meeting.model_dump()
    )


@router.put("/{meeting_id}", response_model=APIResponse)
async def update_meeting(
    meeting_id: str,
    update_data: MeetingUpdate,
    current_user = Depends(get_current_user)
):
    """
    Update meeting details
    """
    meeting = await MeetingService.get_meeting_by_id(meeting_id)
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # Check if user is the host
    if meeting.host_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can update meeting details"
        )
    
    updated_meeting = await MeetingService.update_meeting(meeting_id, update_data)
    
    return APIResponse(
        success=True,
        message="Meeting updated successfully",
        data=updated_meeting.model_dump()
    )


@router.post("/{meeting_id}/start", response_model=APIResponse)
async def start_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Start a meeting
    """
    meeting = await MeetingService.get_meeting_by_id(meeting_id)
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    updated_meeting = await MeetingService.start_meeting(meeting_id)
    
    return APIResponse(
        success=True,
        message="Meeting started",
        data=updated_meeting.model_dump()
    )


@router.post("/{meeting_id}/end", response_model=APIResponse)
async def end_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    End a meeting
    """
    meeting = await MeetingService.get_meeting_by_id(meeting_id)
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    updated_meeting = await MeetingService.end_meeting(meeting_id)
    
    return APIResponse(
        success=True,
        message="Meeting ended",
        data=updated_meeting.model_dump()
    )


@router.post("/{meeting_id}/join", response_model=APIResponse)
async def join_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Join a meeting as a participant
    """
    meeting = await MeetingService.get_meeting_by_id(meeting_id)
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # Get user info
    user = await UserService.get_user_by_id(current_user.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await MeetingService.add_participant(
        meeting_id=meeting_id,
        user_id=current_user.user_id,
        user_name=user.username,
        user_email=user.email
    )
    
    return APIResponse(
        success=True,
        message="Joined meeting successfully",
        data=meeting.model_dump()
    )


@router.get("/{meeting_id}/participants", response_model=APIResponse)
async def get_meeting_participants(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all participants in a meeting
    """
    participants = await MeetingService.get_meeting_participants(meeting_id)
    
    return APIResponse(
        success=True,
        message=f"Found {len(participants)} participants",
        data=[p.model_dump() for p in participants]
    )
