"""
Pydantic Models for MeetGuide Backend
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId


# Custom ObjectId type for Pydantic
class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v, info=None):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return v
        raise ValueError("Invalid ObjectId")


# ==================== User Models ====================

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=2, max_length=50)
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)
    
    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: str
    created_at: datetime
    is_active: bool = True
    is_management: bool = False
    profile_image: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserInDB(UserBase):
    id: str
    hashed_password: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True
    is_management: bool = False
    profile_image: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_image: Optional[str] = None


# ==================== Token Models ====================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    is_management: bool = False


# ==================== Meeting Models ====================

class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    ENDED = "ended"
    CANCELLED = "cancelled"


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    invited_emails: Optional[List[EmailStr]] = []


class MeetingResponse(BaseModel):
    id: str
    meeting_id: str  # Unique meeting room ID
    title: str
    description: Optional[str] = None
    host_id: str
    host_name: str
    participants: List[str] = []
    status: MeetingStatus
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    recording_folder: Optional[str] = None
    created_at: datetime
    mirotalk_url: str
    
    class Config:
        from_attributes = True


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None


# ==================== Meeting Participant Models ====================

class MeetingParticipant(BaseModel):
    meeting_id: str
    user_id: str
    user_name: str
    user_email: str
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None
    audio_file: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== Pronunciation Feedback Models ====================

class MispronunciationError(BaseModel):
    word: str
    expected_phonemes: str
    actual_phonemes: Optional[str] = None
    error_type: str
    severity: str  # low, medium, high
    confidence: float
    timestamp: Optional[float] = None
    suggestion: Optional[str] = None


class PronunciationFeedback(BaseModel):
    id: Optional[str] = None
    meeting_id: str
    user_id: str
    user_name: str
    total_words: int
    mispronounced_count: int
    error_rate: float
    errors: List[MispronunciationError]
    transcript: Optional[str] = None
    processed_at: datetime
    
    class Config:
        from_attributes = True


class PronunciationSummary(BaseModel):
    user_id: str
    user_name: str
    total_meetings: int
    total_words_spoken: int
    total_mispronunciations: int
    average_error_rate: float
    most_common_errors: List[Dict[str, Any]]
    improvement_over_time: List[Dict[str, Any]]


# ==================== Hybrid Detection Models ====================

class SlangDetection(BaseModel):
    """Individual slang detection result from a sentence"""
    sentence: str
    is_slang: bool
    term: Optional[str] = None
    confidence: float
    method: str  # "Rule-Based (Unambiguous)", "Rule-Based (Ambiguous)", "AI", "Hybrid"
    slang_type: Optional[str] = None  # "unambiguous", "ambiguous_high", "ambiguous_moderate"


class HybridDetectionResult(BaseModel):
    """Hybrid detection analysis result for a participant"""
    id: Optional[str] = None
    meeting_id: str
    user_id: str
    user_name: str
    total_sentences: int
    slang_detected_count: int
    slang_frequency_ratio: float
    professional_score: float
    score_label: str
    detections: List[SlangDetection]
    transcript: Optional[str] = None
    processed_at: datetime
    
    # Score breakdown details
    frequency_penalty: Optional[float] = None
    severity_penalty: Optional[float] = None
    repetition_penalty: Optional[float] = None
    confidence_penalty: Optional[float] = None
    engagement_bonus: Optional[float] = None
    
    class Config:
        from_attributes = True


class HybridDetectionSummary(BaseModel):
    """Summary of hybrid detection results for a user across meetings"""
    user_id: str
    user_name: str
    total_meetings_analyzed: int
    average_professional_score: float
    total_sentences_analyzed: int
    total_slang_detected: int
    average_slang_frequency: float
    score_trend: List[Dict[str, Any]]  # Historical scores over time
    most_common_slang: List[Dict[str, Any]]  # Most frequent slang terms


# ==================== Dashboard Models ====================

class DashboardStats(BaseModel):
    total_meetings: int
    total_words_spoken: int
    total_mispronunciations: int
    average_error_rate: float
    recent_meetings: List[MeetingResponse]
    pronunciation_trend: List[Dict[str, Any]]


# ==================== API Response Models ====================

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
