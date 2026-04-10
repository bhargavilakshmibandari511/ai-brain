"""
Shared application state — breaks circular imports between main.py and route modules.
All global service instances live here so routes and agents can import them.
Uses dynamic properties to lazy-load services at first access.
"""

import logging
import sys
from typing import Literal, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

ModeType = Literal["offline", "online"]

# Configuration
mode: ModeType = "offline"
online_api_key: str = ""

# Global instances (private)
_ai_engine = None
_vector_db = None
_user_service = None

def get_ai_engine():
    global _ai_engine
    if _ai_engine is None:
        try:
            from services.ai_engine import ai_engine as instance
            _ai_engine = instance
        except ImportError as e:
            logger.error("Failed to import ai_engine from services: %s", e)
            raise
    return _ai_engine

def get_vector_db():
    global _vector_db
    if _vector_db is None:
        try:
            from services.vector_db import vector_db as instance
            _vector_db = instance
        except ImportError as e:
            logger.error("Failed to import vector_db from services: %s", e)
            raise
    return _vector_db

def get_user_service():
    global _user_service
    if _user_service is None:
        from services.user_service import UserService
        _user_service = UserService()
    return _user_service

# Global Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Background Task Pool
arq_pool = None

# Multi-Agent System
orchestrator = None

# ─── Dynamic attribute access for backward compatibility ───
class StateProxy:
    def __getattr__(self, name):
        if name == "ai_engine": return get_ai_engine()
        if name == "vector_db": return get_vector_db()
        if name == "user_service": return get_user_service()
        return globals().get(name)

# Replace the module instance in sys.modules with a proxy? 
# Too risky. Let's just define them as properties in this module's scope if possible?
# Actually, the easiest is just having the variables be accessed via main.py or similar.
# But for routes, let's just use the Proxy pattern.

proxy = StateProxy()
# We will manually export ai_engine and vector_db as 'lazy' placeholders if possible.
# Actually, the simplest fix for circular imports is to import INSIDE functions.
# I will update chat.py and documents.py to do that.
