"""
Routes Package
"""
from .auth_routes import router as auth_router
from .user_routes import router as user_router
from .meeting_routes import router as meeting_router
from .pronunciation_routes import router as pronunciation_router
from .dashboard_routes import router as dashboard_router
from .hybrid_detection_routes import router as hybrid_detection_router
from .summarization_routes import router as summarization_router

__all__ = [
    "auth_router",
    "user_router",
    "meeting_router",
    "pronunciation_router",
    "dashboard_router",
    "hybrid_detection_router",
    "summarization_router"
]
