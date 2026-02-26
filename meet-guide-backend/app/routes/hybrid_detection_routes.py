"""
Hybrid Detection Routes - Gen-Z Slang Detection and Professional Scoring
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional

from ..models import (
    HybridDetectionResult, 
    HybridDetectionSummary,
    APIResponse
)
from ..services.hybrid_detection_service import HybridDetectionService
from ..services.meeting_service import MeetingService
from ..auth import get_current_user

router = APIRouter(prefix="/hybrid-detection", tags=["Hybrid Detection"])


@router.post("/process-meeting/{meeting_id}", response_model=APIResponse)
async def process_meeting_hybrid_detection(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Process hybrid detection analysis for all participants in a meeting.
    Fetches transcripts and analyzes them for Gen-Z slang usage.
    """
    try:
        # Get meeting details
        meeting = await MeetingService.get_meeting_by_id(meeting_id)
        
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        if not meeting.recording_folder:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meeting does not have a recording folder"
            )
        
        # Get participant information
        participants_data = await MeetingService.get_meeting_participants(meeting_id)
        
        if not participants_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No participants found for this meeting"
            )
        
        # Prepare participants list
        participants = [
            {
                "user_id": p.user_id,
                "user_name": p.user_name
            }
            for p in participants_data
        ]
        
        # Process hybrid detection
        results = await HybridDetectionService.process_meeting_hybrid_detection(
            meeting_id=meeting_id,
            recording_folder=meeting.recording_folder,
            participants=participants
        )
        
        if not results:
            return APIResponse(
                success=False,
                message="No results generated. Check if transcripts are available.",
                data=[]
            )
        
        return APIResponse(
            success=True,
            message=f"Processed hybrid detection for {len(results)} participants",
            data=[r.model_dump() for r in results]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing hybrid detection: {str(e)}"
        )


@router.get("/meeting/{meeting_id}", response_model=APIResponse)
async def get_meeting_hybrid_detection_results(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get hybrid detection results for all participants in a meeting
    """
    try:
        results = await HybridDetectionService.get_results_by_meeting(meeting_id)
        
        if not results:
            return APIResponse(
                success=True,
                message="No hybrid detection results found for this meeting",
                data=[]
            )
        
        return APIResponse(
            success=True,
            message=f"Found {len(results)} results",
            data=[r.model_dump() for r in results]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving results: {str(e)}"
        )


@router.get("/meeting/{meeting_id}/user/{user_id}", response_model=APIResponse)
async def get_user_meeting_hybrid_detection(
    meeting_id: str,
    user_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get hybrid detection result for a specific user in a meeting
    """
    try:
        result = await HybridDetectionService.get_result_by_meeting_and_user(
            meeting_id, 
            user_id
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No hybrid detection result found for this user in this meeting"
            )
        
        return APIResponse(
            success=True,
            message="Result found",
            data=result.model_dump()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving result: {str(e)}"
        )


@router.get("/user/{user_id}/results", response_model=APIResponse)
async def get_user_hybrid_detection_results(
    user_id: str,
    current_user = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all hybrid detection results for a user across all meetings
    """
    try:
        # Verify user has permission (only access their own data or admin)
        if current_user.user_id != user_id:
            # TODO: Add admin check here if needed
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own results"
            )
        
        results = await HybridDetectionService.get_results_by_user(user_id, limit=limit)
        
        if not results:
            return APIResponse(
                success=True,
                message="No hybrid detection results found for this user",
                data=[]
            )
        
        return APIResponse(
            success=True,
            message=f"Found {len(results)} results",
            data=[r.model_dump() for r in results]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving results: {str(e)}"
        )


@router.get("/user/{user_id}/summary", response_model=APIResponse)
async def get_user_hybrid_detection_summary(
    user_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get summary statistics for a user's hybrid detection results
    """
    try:
        # Verify user has permission
        if current_user.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own summary"
            )
        
        summary = await HybridDetectionService.get_user_summary(user_id)
        
        if not summary:
            return APIResponse(
                success=True,
                message="No hybrid detection data found for this user",
                data=None
            )
        
        return APIResponse(
            success=True,
            message="Summary generated successfully",
            data=summary.model_dump()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating summary: {str(e)}"
        )


@router.get("/user/me/results", response_model=APIResponse)
async def get_my_hybrid_detection_results(
    current_user = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get hybrid detection results for the current user
    """
    return await get_user_hybrid_detection_results(
        current_user.user_id, 
        current_user, 
        limit
    )


@router.get("/user/me/summary", response_model=APIResponse)
async def get_my_hybrid_detection_summary(
    current_user = Depends(get_current_user)
):
    """
    Get summary statistics for the current user
    """
    return await get_user_hybrid_detection_summary(
        current_user.user_id, 
        current_user
    )
