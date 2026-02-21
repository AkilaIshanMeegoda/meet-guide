"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import timedelta

from ..models import UserCreate, UserLogin, UserResponse, Token, APIResponse
from ..services.user_service import UserService
from ..auth import create_access_token, get_current_user
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/signup", response_model=APIResponse)
async def signup(user_data: UserCreate):
    """
    Register a new user
    """
    try:
        user = await UserService.create_user(user_data)
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "is_management": user.is_management}
        )
        
        return APIResponse(
            success=True,
            message="User registered successfully",
            data={
                "user": user.model_dump(),
                "access_token": access_token,
                "token_type": "bearer"
            }
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=APIResponse)
async def login(login_data: UserLogin):
    """
    Authenticate user and return JWT token
    """
    user = await UserService.authenticate_user(login_data.email, login_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "is_management": user.is_management}
    )
    
    return APIResponse(
        success=True,
        message="Login successful",
        data={
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_management": user.is_management,
                "profile_image": user.profile_image
            },
            "access_token": access_token,
            "token_type": "bearer"
        }
    )


@router.get("/me", response_model=APIResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    """
    Get current authenticated user's information
    """
    user = await UserService.get_user_by_id(current_user.user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return APIResponse(
        success=True,
        message="User info retrieved",
        data=user.model_dump()
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user = Depends(get_current_user)):
    """
    Refresh access token
    """
    access_token = create_access_token(
        data={"sub": current_user.user_id, "email": current_user.email, "is_management": current_user.is_management}
    )
    
    return Token(access_token=access_token, token_type="bearer")


@router.post("/logout", response_model=APIResponse)
async def logout(current_user = Depends(get_current_user)):
    """
    Logout user (client should discard the token)
    """
    return APIResponse(
        success=True,
        message="Logged out successfully",
        data=None
    )
