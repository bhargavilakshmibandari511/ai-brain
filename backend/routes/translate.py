from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from services.translation import (
    translate,
    translate_batch,
    get_supported_languages,
    get_loaded_models,
    can_translate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request models ───────────────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text:       str = Field(..., min_length=1, max_length=10_000)
    src:        str = Field("en", min_length=2, max_length=6)
    tgt:        str = Field("hi", min_length=2, max_length=6)
    num_beams:  int = Field(4, ge=1, le=8,
                            description="Beam search width — higher = better quality, slower")
    max_length: int = Field(512, ge=32, le=1024)

    @field_validator("src", "tgt")
    @classmethod
    def lowercase_lang(cls, v: str) -> str:
        return v.lower().strip()


class BatchTranslateRequest(BaseModel):
    texts:      list[str] = Field(..., min_length=1, max_length=50)
    src:        str       = Field("en")
    tgt:        str       = Field("hi")
    max_length: int       = Field(512, ge=32, le=1024)

    @field_validator("src", "tgt")
    @classmethod
    def lowercase_lang(cls, v: str) -> str:
        return v.lower().strip()

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, v: list[str]) -> list[str]:
        if any(len(t) > 10_000 for t in v):
            raise ValueError("Each text must be under 10,000 characters")
        return v


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/")
async def translate_text(req: TranslateRequest):
    """
    Translate a single piece of text offline using Helsinki-NLP Opus-MT.

    Example:
        POST /api/translate/
        { "text": "Hello, how are you?", "src": "en", "tgt": "hi" }

    Response:
        {
            "text": "नमस्ते, आप कैसे हैं?",
            "src": "en", "tgt": "hi",
            "model": "Helsinki-NLP/opus-mt-en-hi",
            "pivot": false,
            "duration_ms": 340
        }
    """
    # Check pair is supported before loading model
    pair_info = can_translate(req.src, req.tgt)
    if not pair_info["supported"]:
        raise HTTPException(
            status_code=400,
            detail=f"Language pair {req.src}→{req.tgt} is not supported. "
                   f"Try routing through English."
        )

    try:
        result = await translate(
            text       = req.text,
            src        = req.src,
            tgt        = req.tgt,
            max_length = req.max_length,
            num_beams  = req.num_beams,
        )
        return JSONResponse(content=result)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Translation endpoint error")
        raise HTTPException(status_code=500,
                            detail=f"Translation failed: {e}")


@router.post("/batch")
async def translate_batch_texts(req: BatchTranslateRequest):
    """
    Translate multiple texts in one call — more efficient than looping.

    Example:
        POST /api/translate/batch
        { "texts": ["Hello", "Goodbye", "Thank you"], "src": "en", "tgt": "te" }
    """
    try:
        results = await translate_batch(
            texts      = req.texts,
            src        = req.src,
            tgt        = req.tgt,
            max_length = req.max_length,
        )
        return JSONResponse(content={"results": results, "count": len(results)})
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/languages")
async def list_languages():
    """Return all supported languages with ISO codes and display names."""
    langs = get_supported_languages()
    return JSONResponse(content={"languages": langs, "count": len(langs)})


@router.get("/check/{src}/{tgt}")
async def check_pair(src: str, tgt: str):
    """
    Check if a language pair is supported without loading any model.

    Example: GET /api/translate/check/en/te
    Response: { "supported": true, "pivot": false, "model": "...", ... }
    """
    return JSONResponse(content=can_translate(src.lower(), tgt.lower()))


@router.get("/models/loaded")
async def loaded_models():
    """Return which models are currently loaded in memory."""
    models = get_loaded_models()
    return JSONResponse(content={"loaded_models": models, "count": len(models)})


@router.get("/models/size")
async def model_sizes():
    """
    Return approximate download sizes for common models.
    Useful to show users what will be downloaded on first use.
    """
    return JSONResponse(content={
        "note": "Sizes are approximate. Models are downloaded once and cached.",
        "models": [
            {"pair": "en↔hi", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-hi"},
            {"pair": "en↔te", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-te"},
            {"pair": "en↔ta", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-ta"},
            {"pair": "en↔fr", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-fr"},
            {"pair": "en↔de", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-de"},
            {"pair": "en↔es", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-es"},
            {"pair": "en↔zh", "size_mb": 310, "model": "Helsinki-NLP/opus-mt-en-zh"},
            {"pair": "en↔ar", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-ar"},
            {"pair": "en↔ru", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-ru"},
            {"pair": "en↔ja", "size_mb": 300, "model": "Helsinki-NLP/opus-mt-en-jap"},
        ],
        "cache_location": "~/.cache/huggingface/hub/"
    })
