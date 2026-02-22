"""
User Service - Handle user operations
"""
from datetime import datetime
from typing import Optional, List
from bson import ObjectId
import logging

from ..database import get_users_collection
from ..models import UserCreate, UserResponse, UserInDB, UserUpdate
from ..auth import get_password_hash, verify_password

logger = logging.getLogger(__name__)


class UserService:
    """Service for user operations"""
    
    @staticmethod
    async def create_user(user_data: UserCreate) -> Optional[UserResponse]:
        """Create a new user"""
        users = get_users_collection()
        
        # Check if email already exists
        existing_email = await users.find_one({"email": user_data.email})
        if existing_email:
            raise ValueError("Email already registered")
        
        # Check if username already exists
        existing_username = await users.find_one({"username": user_data.username})
        if existing_username:
            raise ValueError("Username already taken")
        
        # Create user document
        user_doc = {
            "email": user_data.email,
            "username": user_data.username,
            "full_name": user_data.full_name,
            "hashed_password": get_password_hash(user_data.password),
            "created_at": datetime.utcnow(),
            "updated_at": None,
            "is_active": True,
            "is_management": False,
            "profile_image": None
        }
        
        result = await users.insert_one(user_doc)
        user_doc["id"] = str(result.inserted_id)
        
        logger.info(f"Created user: {user_data.email}")
        
        return UserResponse(
            id=user_doc["id"],
            email=user_doc["email"],
            username=user_doc["username"],
            full_name=user_doc["full_name"],
            created_at=user_doc["created_at"],
            is_active=user_doc["is_active"],
            is_management=user_doc["is_management"],
            profile_image=user_doc["profile_image"]
        )
    
    @staticmethod
    async def authenticate_user(email: str, password: str) -> Optional[UserInDB]:
        """Authenticate a user by email and password"""
        users = get_users_collection()
        
        user = await users.find_one({"email": email})
        if not user:
            return None
        
        if not verify_password(password, user["hashed_password"]):
            return None
        
        if not user.get("is_active", True):
            return None
        
        return UserInDB(
            id=str(user["_id"]),
            email=user["email"],
            username=user["username"],
            full_name=user.get("full_name"),
            hashed_password=user["hashed_password"],
            created_at=user["created_at"],
            updated_at=user.get("updated_at"),
            is_active=user.get("is_active", True),
            is_management=user.get("is_management", False),
            profile_image=user.get("profile_image")
        )
    
    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[UserResponse]:
        """Get user by ID"""
        users = get_users_collection()
        
        try:
            user = await users.find_one({"_id": ObjectId(user_id)})
        except:
            return None
        
        if not user:
            return None
        
        return UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            username=user["username"],
            full_name=user.get("full_name"),
            created_at=user["created_at"],
            is_active=user.get("is_active", True),
            is_management=user.get("is_management", False),
            profile_image=user.get("profile_image")
        )
    
    @staticmethod
    async def get_user_by_email(email: str) -> Optional[UserResponse]:
        """Get user by email"""
        users = get_users_collection()
        
        user = await users.find_one({"email": email})
        if not user:
            return None
        
        return UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            username=user["username"],
            full_name=user.get("full_name"),
            created_at=user["created_at"],
            is_active=user.get("is_active", True),
            is_management=user.get("is_management", False),
            profile_image=user.get("profile_image")
        )
    
    @staticmethod
    async def get_user_by_username(username: str) -> Optional[UserResponse]:
        """Get user by username"""
        users = get_users_collection()
        
        user = await users.find_one({"username": username.lower()})
        if not user:
            # Also try case-insensitive search
            user = await users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
        
        if not user:
            return None
        
        return UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            username=user["username"],
            full_name=user.get("full_name"),
            created_at=user["created_at"],
            is_active=user.get("is_active", True),
            is_management=user.get("is_management", False),
            profile_image=user.get("profile_image")
        )
    
    @staticmethod
    async def update_user(user_id: str, update_data: UserUpdate) -> Optional[UserResponse]:
        """Update user profile"""
        users = get_users_collection()
        
        update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
        update_dict["updated_at"] = datetime.utcnow()
        
        result = await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            return None
        
        return await UserService.get_user_by_id(user_id)
    
    @staticmethod
    async def get_all_users() -> List[UserResponse]:
        """Get all users"""
        users = get_users_collection()
        cursor = users.find({})
        
        result = []
        async for user in cursor:
            result.append(UserResponse(
                id=str(user["_id"]),
                email=user["email"],
                username=user["username"],
                full_name=user.get("full_name"),
                created_at=user["created_at"],
                is_active=user.get("is_active", True),
                is_management=user.get("is_management", False),
                profile_image=user.get("profile_image")
            ))
        
        return result
    
    @staticmethod
    async def create_initial_users():
        """Create initial test users for projectmeeting1"""
        users = get_users_collection()
        
        initial_users = [
            {
                "email": "akila@gmail.com",
                "username": "akila",
                "full_name": "Akila",
                "hashed_password": get_password_hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True,
                "is_management": True
            },
            {
                "email": "dinithi@gmail.com",
                "username": "dinithi",
                "full_name": "Dinithi",
                "hashed_password": get_password_hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True,
                "is_management": False
            },
            {
                "email": "savishka@gmail.com",
                "username": "savishka",
                "full_name": "Savishka",
                "hashed_password": get_password_hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True,
                "is_management": False
            },
            {
                "email": "chalana@gmail.com",
                "username": "chalana",
                "full_name": "Chalana",
                "hashed_password": get_password_hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True,
                "is_management": False
            }
        ]
        
        created_count = 0
        for user_data in initial_users:
            existing = await users.find_one({"email": user_data["email"]})
            if not existing:
                await users.insert_one(user_data)
                created_count += 1
                logger.info(f"Created initial user: {user_data['email']}")
        
        logger.info(f"Created {created_count} initial users")
        return created_count
