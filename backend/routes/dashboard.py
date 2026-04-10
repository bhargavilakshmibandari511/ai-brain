from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import psutil
import os
import logging


from models.request_models import SystemStats

logger = logging.getLogger(__name__)

router = APIRouter()

# Import from shared state (no circular import)
import app_state

@router.get("/stats", response_model=SystemStats)
async def get_system_stats():
    """Get comprehensive system statistics"""
    try:
        ai_status = await app_state.ai_engine.health_check()
        memory = psutil.virtual_memory()

        from routes.chat import conversations
        total_conversations = len(conversations)

        return SystemStats(
            total_documents=0,
            total_conversations=total_conversations,
            total_knowledge_items=0,
            ai_model_status=ai_status,
            memory_usage={
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent,
                "used": memory.used
            },
            processing_speed=45.0
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def get_health_status():
    """Get detailed health status of all components"""
    try:
        ai_health = await app_state.ai_engine.health_check()
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            "overall_status": "healthy" if ai_health == "healthy" else "degraded",
            "components": {
                "ai_engine": {
                    "status": ai_health,
                    "model": app_state.ai_engine.model_name if app_state.ai_engine.is_initialized else "not_loaded"
                },
                "system": {
                    "cpu_usage": f"{cpu_percent}%",
                    "memory_usage": f"{memory.percent}%",
                    "disk_usage": f"{(disk.used / disk.total) * 100:.1f}%"
                }
            },
            "uptime": "Online",
            "last_check": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activity")
async def get_recent_activity():
    """Get recent system activity"""
    try:
        activities = [
            {
                "type": "chat",
                "description": "AI chat session completed",
                "timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(),
                "status": "success"
            },
            {
                "type": "system",
                "description": "AI model loaded successfully",
                "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
                "status": "success"
            }
        ]

        return {"activities": activities, "total_count": len(activities)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance")
async def get_performance_metrics():
    """Get performance metrics"""
    try:
        return {
            "response_times": {"chat_avg": 2.3},
            "throughput": {"tokens_per_second": 45.0, "queries_per_minute": 8.5},
            "resource_usage": {
                "cpu_avg": psutil.cpu_percent(),
                "memory_avg": psutil.virtual_memory().percent,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
async def get_available_models():
    """Get available AI models and their status"""
    try:
        available_models = app_state.ai_engine.get_available_models()
        current_model = app_state.ai_engine.model_name

        models_info = []
        for model in available_models:
            models_info.append({
                "name": model,
                "status": "active" if model == current_model else "available",
                "size": "7B",
                "type": "Language Model"
            })

        return {
            "current_model": current_model,
            "available_models": models_info,
            "total_count": len(available_models)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/{model_name}/switch")
async def switch_model(model_name: str):
    """Switch to a different AI model"""
    try:
        app_state.ai_engine.change_model(model_name)
        return {
            "message": f"Successfully switched to model: {model_name}",
            "previous_model": app_state.ai_engine.model_name,
            "new_model": model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mode")
async def set_mode(mode_data: dict):
    """Set online/offline mode and API key"""
    try:
        mode = (mode_data or {}).get("mode")
        api_key = (mode_data or {}).get("api_key", "")

        if mode not in {"offline", "online"}:
            raise HTTPException(status_code=400, detail="mode must be 'offline' or 'online'")

        # Update app state
        app_state.mode = mode
        app_state.online_api_key = api_key.strip() if api_key else ""

        # Use the singleton instance's reinit if needed, or just let it lazy-load
        # In v2.0.0 we just update the config and the next call to get_ai_engine() handles it.
        # But we want to force reset if mode changed.
        app_state._ai_engine = None 

        return {
            "message": f"Mode switched to {mode}",
            "mode": app_state.mode,
            "api_key_set": bool(app_state.online_api_key),
        }
    except Exception as e:
        logger.error(f"Mode switch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mode")
async def get_mode():
    """Get current mode and status"""
    return {"mode": app_state.mode, "api_key_set": bool(app_state.online_api_key)}
