"""
MeetGuide Backend Configuration
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # MongoDB
    mongodb_uri: str = "mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/?appName=Cluster0"
    mongodb_db_name: str = "meetguide"
    
    # JWT
    jwt_secret_key: str = "meetguide_super_secret_key_change_in_production_2026"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:3010,https://localhost:3010"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    # MiroTalk
    mirotalk_url: str = "https://localhost:3010"
    mirotalk_api_key: str = "mirotalksfu_default_secret"
    
    # File Storage
    recordings_base_path: str = "../mirotalk/app/src/recordings"
    mispronunciation_system_path: str = "../meet-guide-components/mispronunciation-detection-system"
    
    # AWS S3
    aws_s3_enabled: bool = False
    aws_s3_bucket: Optional[str] = None
    aws_region: str = "ap-south-1"
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
