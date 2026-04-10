"""
VLM API Routes — Visual Language Model endpoints
POST /api/vlm/analyze        — single-agent analysis
POST /api/vlm/analyze/stream — SSE streaming response
POST /api/vlm/ingest         — embed image into ChromaDB
POST /api/vlm/rag            — multimodal RAG query
POST /api/vlm/pipeline       — parallel OCR + Chart + General
"""

import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from services.vlm_service import vlm_understand, vlm_stream, check_vlm_available
from services.multimodal_rag import ingest_image, multimodal_rag_query
from agents.vision_agents import VisionOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter()
orchestrator = VisionOrchestrator()


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    question: str = Form("Describe this image in detail."),
    task: str = Form("auto"),
):
    """Analyse an image with automatic or manual task routing."""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    try:
        # Use orchestrator for task routing if 'auto', else service directly
        if task == "auto":
            result = await orchestrator.run(image_bytes, question, task)
        else:
            result = await vlm_understand(image_bytes, question, task)
        return {"analysis": result} if isinstance(result, str) else result
    except Exception as e:
        logger.error("VLM analyze error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/understand")
async def understand_image(
    file: UploadFile = File(...),
    question: str = Form("What is in this image?"),
):
    """Directly expose the VLM understanding service (no orchestration)."""
    image_bytes = await file.read()
    try:
        result = await vlm_understand(image_bytes, question)
        return {"result": result}
    except Exception as e:
        logger.error("VLM understand error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/understand/stream")
async def understand_stream(
    file: UploadFile = File(...),
    question: str = Form("What is in this image?"),
    task: str = Form("general"),
):
    """Stream direct VLM understanding of an uploaded image."""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    async def generate():
        try:
            async for token in vlm_stream(image_bytes, question, task):
                # Escape newlines so SSE stays valid
                safe = token.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {e}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/status")
async def vlm_status():
    """Check if the VLM service and models are available."""
    is_available = await check_vlm_available()
    return {
        "status": "available" if is_available else "unavailable",
        "model": "llava:latest",
        "healthy": is_available
    }


@router.post("/analyze/stream")
async def analyze_stream(
    file: UploadFile = File(...),
    question: str = Form("Describe this image in detail."),
    task: str = Form("general"),
):
    """Stream VLM response as Server-Sent Events."""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    async def generate():
        try:
            async for token in vlm_stream(image_bytes, question, task):
                # Escape newlines so SSE stays valid
                safe = token.replace("\n", "\\n")
                yield f"data: {safe}\n\n"
        except Exception as e:
            yield f"data: [ERROR] {e}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    """Extract text from an image via VLM and store in ChromaDB."""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    doc_id = str(uuid.uuid4())
    try:
        result = await ingest_image(
            image_bytes,
            doc_id=doc_id,
            metadata={"filename": file.filename or "unknown"},
        )
        return result
    except Exception as e:
        logger.error("Ingest error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag")
async def rag_query(
    question: str = Form(...),
    file: UploadFile = File(None),
):
    """Multimodal RAG: optional image + vector search + LLM synthesis."""
    image_bytes = await file.read() if file else None
    try:
        return await multimodal_rag_query(question, image_bytes)
    except Exception as e:
        logger.error("RAG error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pipeline")
async def full_pipeline(file: UploadFile = File(...)):
    """Run OCR + Chart + General analysis in parallel and return all results."""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    try:
        return await orchestrator.run_pipeline(image_bytes)
    except Exception as e:
        logger.error("Pipeline error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_models():
    """Return the current model routing configuration."""
    from services.vlm_service import MODEL_ROUTING, DEFAULT_MODEL
    return {"routing": MODEL_ROUTING, "default": DEFAULT_MODEL}
