"""
User Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List

from ..models import UserResponse, UserUpdate, APIResponse
from ..services.user_service import UserService
from ..auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=APIResponse)
async def get_all_users(current_user = Depends(get_current_user)):
    """
    Get all users (for admin/development purposes)
    """
    users = await UserService.get_all_users()
    
    return APIResponse(
        success=True,
        message=f"Found {len(users)} users",
        data=[u.model_dump() for u in users]
    )


@router.get("/{user_id}", response_model=APIResponse)
async def get_user(user_id: str, current_user = Depends(get_current_user)):
    """
    Get user by ID
    """
    user = await UserService.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return APIResponse(
        success=True,
        message="User found",
        data=user.model_dump()
    )


@router.put("/me", response_model=APIResponse)
async def update_current_user(
    update_data: UserUpdate,
    current_user = Depends(get_current_user)
):
    """
    Update current user's profile
    """
    user = await UserService.update_user(current_user.user_id, update_data)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return APIResponse(
        success=True,
        message="Profile updated successfully",
        data=user.model_dump()
    )


@router.get("/by-email/{email}", response_model=APIResponse)
async def get_user_by_email(email: str, current_user = Depends(get_current_user)):
    """
    Get user by email
    """
    user = await UserService.get_user_by_email(email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return APIResponse(
        success=True,
        message="User found",
        data=user.model_dump()
    )


@router.get("/by-username/{username}", response_model=APIResponse)
async def get_user_by_username(username: str, current_user = Depends(get_current_user)):
    """
    Get user by username
    """
    user = await UserService.get_user_by_username(username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return APIResponse(
        success=True,
        message="User found",
        data=user.model_dump()
    )
