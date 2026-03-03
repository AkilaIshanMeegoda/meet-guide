"""
MeetGuide FastAPI Backend - Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.database import Database
from app.config import get_settings
from app.routes import (
    auth_router,
    user_router,
    meeting_router,
    pronunciation_router,
    dashboard_router,
    summarization_router
)
from app.routes.hybrid_detection_routes import router as hybrid_detection_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for startup and shutdown"""
    # Startup
    logger.info("Starting MeetGuide FastAPI Backend...")
    await Database.connect()
    logger.info("✅ Database connected")
    
    yield
    
    # Shutdown
    logger.info("Shutting down MeetGuide FastAPI Backend...")
    await Database.disconnect()
    logger.info("✅ Database disconnected")


# Create FastAPI app
app = FastAPI(
    title="MeetGuide API",
    description="MeetGuide Backend API for meeting management and analysis",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(meeting_router, prefix="/api")
app.include_router(pronunciation_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(hybrid_detection_router, prefix="/api")
app.include_router(summarization_router, prefix="/api")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "MeetGuide API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/auth",
            "users": "/api/users",
            "meetings": "/api/meetings",
            "pronunciation": "/api/pronunciation",
            "dashboard": "/api/dashboard",
            "hybrid_detection": "/api/hybrid-detection",
            "summarization": "/api/summarization"
        }
    }


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected" if Database.db is not None else "disconnected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
