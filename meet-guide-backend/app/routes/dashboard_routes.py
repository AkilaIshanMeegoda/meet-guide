"""
Dashboard Routes - Statistics and Overview
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime, timedelta

from ..models import DashboardStats, APIResponse
from ..services.meeting_service import MeetingService
from ..services.pronunciation_service import PronunciationService
from ..services.user_service import UserService
from ..auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=APIResponse)
async def get_dashboard_stats(
    current_user = Depends(get_current_user)
):
    """
    Get dashboard statistics for the current user
    """
    # Get user's meetings
    meetings = await MeetingService.get_meetings_by_user(current_user.user_id, limit=10)
    
    # Get pronunciation feedback
    feedback_list = await PronunciationService.get_user_pronunciation_feedback(
        user_id=current_user.user_id
    )
    
    # Calculate stats
    total_meetings = len(meetings)
    total_words = sum(f.total_words for f in feedback_list)
    total_errors = sum(f.mispronounced_count for f in feedback_list)
    avg_error_rate = (total_errors / total_words * 100) if total_words > 0 else 0
    
    # Calculate trend over time
    trend = []
    for feedback in sorted(feedback_list, key=lambda f: f.processed_at)[-10:]:
        trend.append({
            "date": feedback.processed_at.isoformat(),
            "meeting_id": feedback.meeting_id,
            "error_rate": feedback.error_rate,
            "words": feedback.total_words,
            "errors": feedback.mispronounced_count
        })
    
    stats = DashboardStats(
        total_meetings=total_meetings,
        total_words_spoken=total_words,
        total_mispronunciations=total_errors,
        average_error_rate=avg_error_rate,
        recent_meetings=meetings[:5],
        pronunciation_trend=trend
    )
    
    return APIResponse(
        success=True,
        message="Dashboard stats retrieved",
        data=stats.model_dump()
    )


@router.get("/recent-activity", response_model=APIResponse)
async def get_recent_activity(
    current_user = Depends(get_current_user)
):
    """
    Get recent activity for the current user
    """
    # Get recent meetings
    meetings = await MeetingService.get_meetings_by_user(current_user.user_id, limit=5)
    
    # Get recent pronunciation feedback
    feedback = await PronunciationService.get_user_pronunciation_feedback(
        user_id=current_user.user_id
    )
    
    activities = []
    
    # Add meeting activities
    for meeting in meetings:
        activities.append({
            "type": "meeting",
            "title": meeting.title,
            "meeting_id": meeting.meeting_id,
            "status": meeting.status.value,
            "date": meeting.created_at.isoformat(),
            "timestamp": meeting.created_at.timestamp()
        })
    
    # Add feedback activities
    for f in feedback[:5]:
        activities.append({
            "type": "pronunciation_feedback",
            "meeting_id": f.meeting_id,
            "error_count": f.mispronounced_count,
            "error_rate": f.error_rate,
            "date": f.processed_at.isoformat(),
            "timestamp": f.processed_at.timestamp()
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    
    return APIResponse(
        success=True,
        message=f"Found {len(activities)} activities",
        data=activities[:10]
    )


@router.get("/pronunciation-overview", response_model=APIResponse)
async def get_pronunciation_overview(
    current_user = Depends(get_current_user)
):
    """
    Get pronunciation improvement overview
    """
    summary = await PronunciationService.get_user_pronunciation_summary(
        user_id=current_user.user_id
    )
    
    return APIResponse(
        success=True,
        message="Pronunciation overview retrieved",
        data=summary.model_dump()
    )
