"""
MongoDB Database Connection and Collections
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi
from typing import Optional
import logging

from .config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class Database:
    """MongoDB Database Manager"""
    
    client: Optional[AsyncIOMotorClient] = None
    db = None
    
    @classmethod
    async def connect(cls):
        """Connect to MongoDB"""
        try:
            cls.client = AsyncIOMotorClient(
                settings.mongodb_uri,
                server_api=ServerApi('1')
            )
            # Verify connection
            await cls.client.admin.command('ping')
            cls.db = cls.client[settings.mongodb_db_name]
            logger.info(f"Connected to MongoDB database: {settings.mongodb_db_name}")
            
            # Create indexes
            await cls.create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
    
    @classmethod
    async def disconnect(cls):
        """Disconnect from MongoDB"""
        if cls.client:
            cls.client.close()
            logger.info("Disconnected from MongoDB")
    
    @classmethod
    async def create_indexes(cls):
        """Create necessary indexes for collections"""
        try:
            # Users collection indexes
            try:
                await cls.db.users.create_index("email", unique=True)
            except Exception:
                pass  # Index might already exist
            
            try:
                await cls.db.users.create_index("username", unique=True, sparse=True)
            except Exception:
                pass
            
            # Meetings collection indexes
            try:
                await cls.db.meetings.create_index("meeting_id", unique=True)
            except Exception:
                pass
            
            await cls.db.meetings.create_index("host_id")
            await cls.db.meetings.create_index("participants")
            await cls.db.meetings.create_index("created_at")
            await cls.db.meetings.create_index("status")
            
            # Meeting participants index
            try:
                await cls.db.meeting_participants.create_index([
                    ("meeting_id", 1),
                    ("user_id", 1)
                ], unique=True)
            except Exception:
                pass
            
            # Pronunciation feedback indexes
            await cls.db.pronunciation_feedback.create_index([
                ("meeting_id", 1),
                ("user_id", 1)
            ])
            await cls.db.pronunciation_feedback.create_index("user_id")
            
            # Hybrid detection indexes
            try:
                await cls.db.hybrid_detection.create_index([
                    ("meeting_id", 1),
                    ("user_id", 1)
                ], unique=True)
            except Exception:
                pass
            
            await cls.db.hybrid_detection.create_index("user_id")
            await cls.db.hybrid_detection.create_index("meeting_id")
            await cls.db.hybrid_detection.create_index("processed_at")
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.warning(f"Error creating indexes: {e}")
    
    @classmethod
    def get_collection(cls, name: str):
        """Get a collection by name"""
        if cls.db is None:
            raise RuntimeError("Database not connected")
        return cls.db[name]


# Collection accessors
def get_users_collection():
    return Database.get_collection("users")


def get_meetings_collection():
    return Database.get_collection("meetings")


def get_meeting_participants_collection():
    return Database.get_collection("meeting_participants")


def get_pronunciation_feedback_collection():
    return Database.get_collection("pronunciation_feedback")


def get_hybrid_detection_collection():
    return Database.get_collection("hybrid_detection")
