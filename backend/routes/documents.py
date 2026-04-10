"""
documents.py — Document Upload & Management Routes
===================================================
Features:
  - Non-blocking upload via FastAPI BackgroundTasks
  - PyMuPDF text extraction with page-level tracking
  - Auto-enrichment: summary + category detection on ingest
  - Hybrid chunking fed into VectorDB
  - XP award (50 XP) on successful indexing stored in SQLite
  - Document versioning (re-upload increments version)
  - Download endpoint
  - Flashcard / Quiz / Notes / Arena generation endpoints
  - Per-endpoint latency in responses
"""

import os
import uuid
import time
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app_state import get_ai_engine, get_vector_db
from services.vlm_service import vlm_understand, check_vlm_available
from services.database import (
    db_create_document,
    db_update_document,
    db_get_document,
    db_list_documents,
    db_delete_document,
    db_award_xp,
    db_get_doc_versions,
)

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR     = os.getenv("UPLOAD_DIRECTORY", "./data/uploads")
MAX_FILE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE", str(100 * 1024 * 1024)))  # 100 MB
ALLOWED_EXTS   = {".pdf", ".docx", ".txt", ".json", ".csv", ".md"}

os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_filename(original: str, doc_id: str) -> str:
    """Prefix filename with doc_id to prevent collisions."""
    ext = os.path.splitext(original)[-1].lower()
    return f"{doc_id}{ext}"


async def _extract_text_vlm_full(path: str) -> tuple[str, dict[int, int]]:
    """
    Render EVERY page of a PDF and use VLM (llava) to extract text.
    Ensures handwritten and scanned notes are fully captured.
    """
    import fitz
    page_map: dict[int, int] = {}
    pages_text: list[str] = []
    
    try:
        doc = fitz.open(path)
        for i, page in enumerate(doc):
            logger.info("VLM OCR: Processing page %d/%d", i+1, len(doc))
            # Render page to high-res image
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_bytes = pix.tobytes("png")
            
            # Use VLM to extract text
            page_text = await vlm_understand(
                image_bytes=img_bytes,
                question="Please transcribe all text from this page exactly as it appears. If it is handwritten, do your best to read it carefully.",
                task="ocr"
            )
            pages_text.append(page_text)
            page_map[i] = i + 1
            
        doc.close()
        return "\n\n".join(pages_text), page_map
    except Exception as e:
        logger.error("VLM OCR failed for %s: %s", path, e)
        return "", {}


async def _extract_text_pymupdf(path: str) -> tuple[str, dict[int, int]]:
    """
    Extract text from PDF using PyMuPDF (fitz).
    Returns (full_text, {chunk_index_hint: page_number}).
    Falls back to plain read for non-PDF files.
    """
    ext = os.path.splitext(path)[-1].lower()
    page_map: dict[int, int] = {}

    if ext == ".pdf":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(path)
            pages: list[str] = []
            for i, page in enumerate(doc):
                text = page.get_text("text")
                pages.append(text)
                page_map[i] = i + 1   # 1-indexed page number
            doc.close()
            full_text = "\n\n".join(pages)
            return full_text, page_map
        except ImportError:
            logger.warning("PyMuPDF not installed, falling back to pypdf")
        except Exception as e:
            logger.error("PyMuPDF error for %s: %s", path, e)

        # pypdf fallback
        try:
            from pypdf import PdfReader
            reader = PdfReader(path)
            pages = []
            for i, page in enumerate(reader.pages):
                t = page.extract_text() or ""
                pages.append(t)
                page_map[i] = i + 1
            return "\n\n".join(pages), page_map
        except Exception as e:
            logger.error("pypdf also failed: %s", e)
            return "", {}

    elif ext == ".docx":
        try:
            import docx
            doc = docx.Document(path)
            text = "\n".join(p.text for p in doc.paragraphs)
            return text, {0: 1}
        except Exception as e:
            logger.error("docx extraction failed: %s", e)
            return "", {}

    else:
        # Plain text / JSON / CSV
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
            return text, {0: 1}
        except Exception as e:
            logger.error("Text extraction failed: %s", e)
            return "", {}


def _build_page_map_for_chunks(text: str, page_map: dict[int, int],
                                chunk_size: int = 512) -> dict[int, int]:
    """
    Map each chunk index to its approximate page number.
    page_map from _extract_text_pymupdf is {page_idx: page_number}.
    """
    words = text.split()
    chunk_to_page: dict[int, int] = {}
    if not page_map:
        return chunk_to_page

    # Rough word count per page
    pages = list(page_map.keys())
    words_per_page = max(1, len(words) // max(len(pages), 1))

    chunk_idx = 0
    pos = 0
    overlap = int(chunk_size * 0.20)
    while pos < len(words):
        word_pos_mid = pos + chunk_size // 2
        page_idx = min(word_pos_mid // max(words_per_page, 1), len(pages) - 1)
        actual_page = page_map.get(pages[page_idx], 1)
        chunk_to_page[chunk_idx] = actual_page
        chunk_idx += 1
        pos += chunk_size - overlap

    return chunk_to_page


# ─── Background processing ────────────────────────────────────────────────────

async def _process_document(doc_id: str, file_path: str, filename: str, user_id: str):
    """
    Full ingestion pipeline run in background:
      1. Extract text (PyMuPDF)
      2. Chunk + embed → VectorDB
      3. Summarise + categorise (AI Engine)
      4. Update DB status → 'ready'
      5. Award 50 XP to user
    """
    start = time.monotonic()
    try:
        logger.info("Processing doc %s (%s)", doc_id, filename)
        db_update_document(doc_id, status="processing")

        # 1. Extract text (Prefer VLM for PDFs if available)
        ext = os.path.splitext(file_path)[-1].lower()
        vlm_ready = await check_vlm_available()
        logger.info("VLM Status: %s. File: %s", vlm_ready, filename)
        
        if ext == ".pdf" and vlm_ready:
            logger.info("Using VLM OCR for PDF: %s", filename)
            full_text, page_map = await _extract_text_vlm_full(file_path)
            logger.info("VLM OCR extracted %d chars", len(full_text))
            # If VLM failed completely, fallback to PyMuPDF
            if not full_text.strip():
                logger.info("VLM OCR failed, falling back to PyMuPDF")
                full_text, page_map = await _extract_text_pymupdf(file_path)
        else:
            logger.info("Skipping VLM OCR (Not PDF or VLM not ready). Status: %s", vlm_ready)
            full_text, page_map = await _extract_text_pymupdf(file_path)

        if not full_text.strip():
            db_update_document(doc_id, status="error", error="No text could be extracted")
            return

        # 2. Chunk + embed
        chunk_page_map = _build_page_map_for_chunks(full_text, page_map)
        chunk_count = await get_vector_db().add_document(
            doc_id=doc_id,
            text=full_text,
            doc_name=filename,
            page_map=chunk_page_map,
        )

        # 3. Enrich: summary + category (run concurrently with safety)
        summary, category = "Summary unavailable", "General"
        try:
            summary_task  = asyncio.create_task(get_ai_engine().summarize(full_text, max_words=120))
            category_task = asyncio.create_task(get_ai_engine().detect_category(full_text))
            summary, category = await asyncio.gather(summary_task, category_task)
        except Exception as ai_err:
            logger.warning("AI enrichment failed for doc %s: %s", doc_id, ai_err)
            # We continue so the document is still 'ready' for search/chat


        # 4. Update DB
        elapsed = round(time.monotonic() - start, 2)
        db_update_document(
            doc_id,
            status="ready",
            chunk_count=chunk_count,
            summary=summary,
            category=category,
            processing_time=elapsed,
        )

        # 5. Award XP
        db_award_xp(user_id=user_id, xp=50, reason="document_upload", doc_id=doc_id)

        logger.info(
            "Doc %s ready — %d chunks, category=%s, %.2fs",
            doc_id, chunk_count, category, elapsed,
        )

    except Exception as e:
        logger.exception("Failed processing doc %s: %s", doc_id, e)
        db_update_document(doc_id, status="error", error=str(e))


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/upload",
             summary="Upload a document",
             tags=["documents"])
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = "default_user",
):
    # Validate extension
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTS}")

    # Read & size check
    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, f"File too large (max {MAX_FILE_BYTES // 1024 // 1024}MB)")

    # Check for re-upload (versioning)
    existing_versions = db_get_doc_versions(file.filename or "")
    version = len(existing_versions) + 1

    doc_id   = str(uuid.uuid4())
    safe_fn  = _safe_filename(file.filename or "upload", doc_id)
    file_path = os.path.join(UPLOAD_DIR, safe_fn)

    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB record
    db_create_document(
        doc_id=doc_id,
        user_id=user_id,
        filename=file.filename or "upload",
        file_path=file_path,
        status="processing",
        version=version,
    )

    # Kick off background ingestion
    background_tasks.add_task(
        _process_document, doc_id, file_path, file.filename or "upload", user_id
    )

    return {
        "id":       doc_id,
        "filename": file.filename,
        "status":   "processing",
        "version":  version,
        "message":  "Document uploaded — processing started",
    }


@router.get("/",
            summary="List all documents",
            tags=["documents"])
async def list_documents(
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    docs = db_list_documents(status=status, category=category, limit=limit, offset=offset)
    return {"documents": docs, "total": len(docs)}


@router.get("/{doc_id}",
            summary="Get document details",
            tags=["documents"])
async def get_document(doc_id: str):
    doc = db_get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    chunk_count = await get_vector_db().get_doc_chunk_count(doc_id)
    return {**doc, "chunks_in_vector_db": chunk_count}


@router.delete("/{doc_id}",
               summary="Delete a document",
               tags=["documents"])
async def delete_document(doc_id: str):
    doc = db_get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    # Remove file
    if os.path.exists(doc.get("file_path", "")):
        os.remove(doc["file_path"])

    # Remove from vector DB
    await get_vector_db().delete_document(doc_id)

    # Remove from SQLite
    db_delete_document(doc_id)

    return {"deleted": doc_id}


@router.get("/{doc_id}/file",
            summary="Download document file",
            tags=["documents"])
async def download_document(doc_id: str, inline: bool = False):
    doc = db_get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    path = doc.get("file_path", "")
    if not os.path.exists(path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path, 
        filename=doc["filename"],
        content_disposition_type="inline" if inline else "attachment"
    )



@router.get("/{doc_id}/versions",
            summary="List document versions",
            tags=["documents"])
async def get_versions(doc_id: str):
    doc = db_get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    versions = db_get_doc_versions(doc["filename"])
    return {"filename": doc["filename"], "versions": versions}


# ─── Learning material generation ────────────────────────────────────────────

async def _get_doc_text(doc_id: str) -> tuple[str, str]:
    """Helper: retrieve doc from DB and extract its text from vector store for AI calls."""
    doc = db_get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.get("status") != "ready":
        # Allow processing status if some chunks exist (for long VLM tasks)
        chunk_count = await get_vector_db().get_doc_chunk_count(doc_id)
        if chunk_count == 0:
            raise HTTPException(400, f"Document is not ready and has no indexed text (status: {doc.get('status')})")
    
    # Retrieve text from Vector DB (works for both native PDF and VLM OCR)
    text = await get_vector_db().get_document_text(doc_id)
    if not text:
        # Fallback to PyMuPDF if nothing in vector DB yet
        text, _ = await _extract_text_pymupdf(doc["file_path"])
        
    return text, doc.get("filename", "document")


@router.post("/{doc_id}/summarize",
             summary="Generate smart notes",
             tags=["documents", "learning"])
async def generate_notes(doc_id: str, user_id: str = "default_user"):
    start = time.monotonic()
    text, _ = await _get_doc_text(doc_id)

    notes   = await get_ai_engine().generate_notes(text)
    summary = await get_ai_engine().summarize(text)

    db_award_xp(user_id=user_id, xp=30, reason="notes_generated", doc_id=doc_id)

    return {
        "notes":           notes,
        "summary":         summary,
        "processing_time": round(time.monotonic() - start, 2),
    }


@router.post("/{doc_id}/flashcards",
             summary="Generate flashcards",
             tags=["documents", "learning"])
async def generate_flashcards(doc_id: str, count: int = 15, user_id: str = "default_user"):
    start = time.monotonic()
    text, _ = await _get_doc_text(doc_id)

    cards = await get_ai_engine().generate_flashcards(text, count=count)
    db_award_xp(user_id=user_id, xp=30, reason="flashcards_generated", doc_id=doc_id)

    return {
        "flashcards":      cards,
        "count":           len(cards),
        "processing_time": round(time.monotonic() - start, 2),
    }


@router.post("/{doc_id}/quiz",
             summary="Generate MCQ quiz",
             tags=["documents", "learning"])
async def generate_quiz(doc_id: str, count: int = 10, user_id: str = "default_user"):
    start = time.monotonic()
    text, _ = await _get_doc_text(doc_id)

    questions = await get_ai_engine().generate_quiz(text, count=count)
    db_award_xp(user_id=user_id, xp=30, reason="quiz_generated", doc_id=doc_id)

    return {
        "quiz":            questions,
        "count":           len(questions),
        "processing_time": round(time.monotonic() - start, 2),
    }


@router.post("/{doc_id}/simulation",
             summary="Generate arena game config",
             tags=["documents", "learning"])
async def generate_simulation(doc_id: str, user_id: str = "default_user"):
    start = time.monotonic()
    text, filename = await _get_doc_text(doc_id)

    config = await get_ai_engine().generate_arena_config(text, doc_name=filename)
    db_award_xp(user_id=user_id, xp=50, reason="arena_generated", doc_id=doc_id)

    return {
        "simulation":      config,
        "processing_time": round(time.monotonic() - start, 2),
    }
