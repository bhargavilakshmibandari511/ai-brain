from fastapi import APIRouter, HTTPException
from typing import List

from models.request_models import KnowledgeSearchRequest, KnowledgeItem
from services.vector_db import VectorDB

router = APIRouter()

# Import from shared state (no circular import)
import app_state

@router.post("/search", response_model=List[KnowledgeItem])
async def search_knowledge(request: KnowledgeSearchRequest):
    """Search knowledge base"""
    try:
        results = await app_state.vector_db.search_knowledge(
            query=request.query,
            limit=request.limit,
            similarity_threshold=request.similarity_threshold
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[KnowledgeItem])
async def get_all_knowledge(limit: int = 50):
    """Get all knowledge items"""
    try:
        # Get recent knowledge items
        results = await app_state.vector_db.search_knowledge(
            query="",  # Empty query to get all
            limit=limit,
            similarity_threshold=0.0  # Include all results
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_knowledge_stats():
    """Get knowledge base statistics"""
    try:
        stats = await app_state.vector_db.get_stats()
        
        # Get document breakdown
        documents = await app_state.vector_db.get_all_documents()
        
        return {
            "total_knowledge_items": stats.get("total_chunks", 0),
            "total_documents": stats.get("total_documents", 0),
            "database_status": stats.get("status", "unknown"),
            "documents": documents
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/similar/{query}")
async def get_similar_knowledge(query: str, limit: int = 10):
    """Get knowledge items similar to query"""
    try:
        results = await app_state.vector_db.search_knowledge(
            query=query,
            limit=limit,
            similarity_threshold=0.5
        )
        
        return {
            "query": query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/clear")
async def clear_knowledge_base():
    """Clear all knowledge base data"""
    try:
        # This would require implementing a clear method in VectorDB
        # For now, return a message
        return {
            "message": "Knowledge base clearing not implemented yet",
            "status": "pending"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export")
async def export_knowledge():
    """Export knowledge base data"""
    try:
        # Get all knowledge items
        all_knowledge = await app_state.vector_db.search_knowledge(
            query="",
            limit=1000,
            similarity_threshold=0.0
        )
        
        from datetime import datetime
        return {
            "export_date": datetime.now().isoformat(),
            "total_items": len(all_knowledge),
            "knowledge_items": all_knowledge
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))