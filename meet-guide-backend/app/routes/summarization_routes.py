"""
Summarization and Action Items Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.auth import get_current_user
from app.database import Database
from app.models import APIResponse

router = APIRouter(prefix="/summarization", tags=["summarization"])


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


@router.get("/meeting/{meeting_id}", response_model=APIResponse)
async def get_meeting_summarization(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Get full summarization results for a meeting"""
    try:
        meetings_col = Database.get_collection("meetings")
        
        meeting = meetings_col.find_one({"meeting_id": meeting_id})
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        summarization = meeting.get("summarization", {})
        
        return APIResponse(
            success=True,
            message="Summarization retrieved successfully",
            data={
                "meeting_id": meeting_id,
                "summarization": serialize_datetime(summarization)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summarization: {str(e)}")


@router.get("/meeting/{meeting_id}/topics", response_model=APIResponse)
async def get_meeting_topics(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Get topics for a meeting"""
    try:
        meetings_col = Database.get_collection("meetings")
        
        meeting = meetings_col.find_one({"meeting_id": meeting_id})
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        summarization = meeting.get("summarization", {})
        topics = summarization.get("topics", [])
        
        return APIResponse(
            success=True,
            message="Topics retrieved successfully",
            data={
                "meeting_id": meeting_id,
                "topic_count": len(topics),
                "topics": serialize_datetime(topics)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get topics: {str(e)}")


@router.get("/meeting/{meeting_id}/intents/{intent_type}", response_model=APIResponse)
async def get_meeting_intents(
    meeting_id: str,
    intent_type: str,
    current_user = Depends(get_current_user)
):
    """Get specific intent results for a meeting"""
    try:
        meetings_col = Database.get_collection("meetings")
        
        meeting = meetings_col.find_one({"meeting_id": meeting_id})
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        summarization = meeting.get("summarization", {})
        results = summarization.get("results", [])
        
        filtered_results = [r for r in results if r.get("intent") == intent_type]
        
        return APIResponse(
            success=True,
            message=f"{intent_type} results retrieved successfully",
            data={
                "meeting_id": meeting_id,
                "intent_type": intent_type,
                "count": len(filtered_results),
                "results": serialize_datetime(filtered_results)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get intent results: {str(e)}")


@router.get("/action-items/meeting/{meeting_id}", response_model=APIResponse)
async def get_action_items_for_meeting(
    meeting_id: str,
    current_user = Depends(get_current_user)
):
    """Get all action items for a meeting"""
    try:
        meetings_col = Database.get_collection("meetings")
        summarizations_col = Database.get_collection("meetingsummarizations")
        
        meeting = meetings_col.find_one({"meeting_id": meeting_id})
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        # Get summarization from separate collection
        summarization = summarizations_col.find_one({"meeting_id": meeting_id})
        
        if not summarization:
            raise HTTPException(status_code=404, detail="No summarization found for this meeting")
        
        # Get meeting participants
        participants = meeting.get("participants", [])
        participant_emails = []
        
        # Extract participant emails from the participants array
        users_col = Database.get_collection("users")
        for participant in participants:
            if isinstance(participant, str):
                # participant is a user ID
                user = users_col.find_one({"_id": ObjectId(participant)})
                if user:
                    participant_emails.append(user.get("email"))
            elif isinstance(participant, dict):
                # participant is an object with email
                participant_emails.append(participant.get("email"))
        
        results = summarization.get("results", [])
        
        # Filter action items
        action_items = [r for r in results if r.get("intent") == "action-item"]
        
        # Enhance each action item with additional info and handle team/all assignees
        enhanced_items = []
        for item in action_items:
            # Get meeting date and convert to ISO string if it's a datetime
            meeting_date = meeting.get("actual_start", meeting.get("created_at"))
            if hasattr(meeting_date, 'isoformat'):
                meeting_date = meeting_date.isoformat()
            
            # Convert _id to string if it's an ObjectId
            item_id = item.get("_id")
            if item_id:
                item_id = str(item_id)
            else:
                item_id = str(ObjectId())
            
            enhanced_item = {
                "_id": item_id,
                "task": item.get("task", ""),
                "sentence": item.get("sentence", ""),
                "assignee": item.get("assignee", "Unassigned"),
                "assignee_email": item.get("assignee_email", ""),
                "assignee_emails": item.get("assignee_emails", []),
                "deadline": item.get("deadline"),
                "priority": item.get("priority", "medium"),
                "status": item.get("status", "pending"),
                "meeting_title": meeting.get("title", ""),
                "meeting_date": meeting_date,
                "topic_label": item.get("topic_label", ""),
                "meeting_id": meeting_id
            }
            
            # Handle team/all assignees - assign to all participants
            assignee = enhanced_item["assignee"].lower()
            if assignee in ["team", "all", "team/all", "everyone"]:
                enhanced_item["assignee_emails"] = participant_emails
                enhanced_item["assignee"] = "Team/All"
            elif enhanced_item["assignee_email"]:
                # Single assignee
                enhanced_item["assignee_emails"] = [enhanced_item["assignee_email"]]
            else:
                enhanced_item["assignee_emails"] = []
            
            enhanced_items.append(enhanced_item)
        
        return APIResponse(
            success=True,
            message="Action items retrieved successfully",
            data={
                "meeting_id": meeting_id,
                "count": len(enhanced_items),
                "action_items": enhanced_items
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get action items: {str(e)}")


@router.get("/action-items/user/{email}", response_model=APIResponse)
async def get_action_items_for_user(
    email: str,
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Get action items assigned to a specific user"""
    try:
        # Security: Users can only view their own action items unless they're management
        if current_user.email != email and current_user.role != "management":
            raise HTTPException(
                status_code=403,
                detail="You can only view your own action items"
            )
        
        meetings_col = Database.get_collection("meetings")
        
        # Find all meetings with action items
        meetings = list(meetings_col.find({
            "summarization.results": {"$exists": True}
        }))
        
        user_action_items = []
        
        for meeting in meetings:
            summarization = meeting.get("summarization", {})
            results = summarization.get("results", [])
            
            # Filter action items
            action_items = [r for r in results if r.get("intent") == "action-item"]
            
            for item in action_items:
                # Check if user is assigned
                assignee_emails = item.get("assignee_emails", [item.get("assignee_email")])
                
                if email in assignee_emails or item.get("assignee_email") == email:
                    # Filter by status if provided
                    if status and item.get("status") != status:
                        continue
                    
                    # Get meeting date and convert to ISO string if it's a datetime
                    meeting_date = meeting.get("actual_start", meeting.get("created_at"))
                    if hasattr(meeting_date, 'isoformat'):
                        meeting_date = meeting_date.isoformat()
                    
                    enhanced_item = {
                        "_id": item.get("_id", str(ObjectId())),
                        "task": item.get("task", ""),
                        "sentence": item.get("sentence", ""),
                        "assignee": item.get("assignee", "Unassigned"),
                        "assignee_email": item.get("assignee_email", ""),
                        "assignee_emails": assignee_emails,
                        "deadline": item.get("deadline"),
                        "priority": item.get("priority", "medium"),
                        "status": item.get("status", "pending"),
                        "meeting_title": meeting.get("title", ""),
                        "meeting_date": meeting_date,
                        "topic_label": item.get("topic_label", ""),
                        "meeting_id": meeting.get("meeting_id")
                    }
                    
                    user_action_items.append(enhanced_item)
        
        return APIResponse(
            success=True,
            message="User action items retrieved successfully",
            data={
                "user_email": email,
                "status": status or "all",
                "count": len(user_action_items),
                "action_items": user_action_items
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user action items: {str(e)}")


@router.patch("/action-items/{item_id}", response_model=APIResponse)
async def update_action_item(
    item_id: str,
    updates: dict,
    current_user = Depends(get_current_user)
):
    """Update an action item (status, priority, etc.)"""
    try:
        from bson import ObjectId
        summarizations_col = Database.get_collection("meetingsummarizations")
        
        # Convert item_id to ObjectId if needed
        try:
            object_item_id = ObjectId(item_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid item ID format")
        
        # Find the summarization containing this action item
        summarization = summarizations_col.find_one({
            "results._id": object_item_id
        })
        
        if not summarization:
            raise HTTPException(status_code=404, detail="Action item not found")
        
        # Find the specific action item to check authorization
        action_item = None
        for item in summarization.get("results", []):
            if item.get("_id") == object_item_id:
                action_item = item
                break
        
        if not action_item:
            raise HTTPException(status_code=404, detail="Action item not found in results")
        
        # Security: Users can only update their own action items unless they're management
        assignee_emails = action_item.get("assignee_emails", [action_item.get("assignee_email")])
        if current_user.email not in assignee_emails and current_user.role != "management":
            raise HTTPException(
                status_code=403,
                detail="You can only update action items assigned to you"
            )
        
        # Build the update operations
        update_fields = {}
        for key, value in updates.items():
            update_fields[f"results.$.{key}"] = value
        update_fields["results.$.updated_at"] = datetime.utcnow()
        
        # Update the specific action item in the results array
        result = summarizations_col.update_one(
            {
                "_id": summarization["_id"],
                "results._id": object_item_id
            },
            {
                "$set": update_fields
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Failed to update action item")
        
        # Get updated item
        updated_summarization = summarizations_col.find_one({"_id": summarization["_id"]})
        updated_item = None
        for item in updated_summarization.get("results", []):
            if item.get("_id") == object_item_id:
                updated_item = item
                break
        
        return APIResponse(
            success=True,
            message="Action item updated successfully",
            data=serialize_datetime(updated_item)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update action item: {str(e)}")


@router.get("/health", response_model=APIResponse)
async def health_check():
    """Health check endpoint"""
    return APIResponse(
        success=True,
        message="Summarization service is healthy",
        data={
            "status": "healthy",
            "service": "summarization",
            "timestamp": datetime.utcnow().isoformat()
        }
    )
