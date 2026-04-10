"""
Image Prompt Generator routes — Generate high-quality AI image prompts using the local LLM.
No image generation, no downloads. Pure prompt engineering via Ollama.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging
import app_state
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

# Global semaphore to prevent concurrent heavy inference (Ollama RAM spikes)
generation_lock = asyncio.Semaphore(1)


def _parse_prompts(raw_response: str, expected_count: int) -> List[str]:
    """
    Robustly parse numbered prompts from LLM response.
    Handles various formatting styles:
    - "1. prompt text"
    - "1) prompt text"
    - "1: prompt text"
    - Lines without numbering (fallback)
    """
    prompts = []
    lines = [l.strip() for l in raw_response.strip().split("\n") if l.strip()]
    
    for line in lines:
        if not line:
            continue
        
        cleaned = line
        
        # Try to remove leading numbering if present
        if len(line) > 0 and line[0].isdigit():
            # Find the separator (. ) : or -)
            for i, char in enumerate(line[1:], 1):
                if char in '.);:-':
                    cleaned = line[i+1:].strip()
                    break
        
        # Only include non-empty, reasonably long prompts (min 10 chars)
        if cleaned and len(cleaned) >= 10:
            prompts.append(cleaned)
    
    return prompts


class PromptRequest(BaseModel):
    idea: str
    style: Optional[str] = "realistic"  # realistic, anime, digital-art, oil-painting, watercolor, cinematic
    count: int = 4


class PromptResponse(BaseModel):
    prompts: List[str]
    negative_prompt: str
    style: str


STYLE_GUIDANCE = {
    "realistic": "photorealistic, 8k uhd, DSLR, sharp focus, high detail",
    "anime": "anime style, vibrant colors, studio quality, cel shading",
    "digital-art": "digital painting, concept art, artstation trending, matte painting",
    "oil-painting": "oil on canvas, classical painting, thick brushstrokes, fine art",
    "watercolor": "watercolor painting, soft edges, delicate washes, artistic",
    "cinematic": "cinematic photography, film grain, anamorphic lens, dramatic lighting",
}

NEGATIVE_PROMPTS = {
    "realistic": "blurry, low quality, watermark, deformed, ugly, extra limbs, bad anatomy",
    "anime": "realistic, 3d render, bad anatomy, extra fingers, low quality, watermark",
    "digital-art": "photo, realistic, blurry, watermark, low quality, bad composition",
    "oil-painting": "photo, digital, blurry, low quality, watermark, neon, modern",
    "watercolor": "sharp edges, digital, 3d, low quality, watermark, dark background",
    "cinematic": "cartoon, anime, blurry, overexposed, low quality, watermark",
}


@router.post("/generate", response_model=PromptResponse)
async def generate_prompts(req: PromptRequest):
    """Use local LLM to expand a simple idea into detailed image prompts."""
    # Validate required fields
    if not req.idea.strip():
        raise HTTPException(status_code=400, detail="idea is required and must not be empty")
    
    # Validate style parameter
    if req.style not in STYLE_GUIDANCE:
        valid_styles = list(STYLE_GUIDANCE.keys())
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid style '{req.style}'. Valid styles: {', '.join(valid_styles)}"
        )
    
    # Check AI engine is initialized
    if not hasattr(app_state, 'ai_engine') or app_state.ai_engine is None:
        raise HTTPException(
            status_code=503,
            detail="Ollama LLM not running. Please start Ollama and try again."
        )

    style_hint = STYLE_GUIDANCE.get(req.style, STYLE_GUIDANCE["realistic"])
    count = max(1, min(req.count, 6))

    system_prompt = f"""You are an expert AI image prompt engineer. 
Generate {count} distinct, highly detailed image prompts based on the user's idea.
Style: {req.style} ({style_hint})

Rules:
- Each prompt must be on its own line, starting with a number and period (e.g. "1.")
- Include vivid descriptions of subject, lighting, composition, atmosphere
- Include technical quality tags: {style_hint}
- Vary the composition/angle/mood between prompts
- Keep each prompt under 200 characters

Respond ONLY with the numbered prompts. No explanations, no headers."""

    user_message = f"Generate {count} image prompts for: {req.idea}"

    # Use semaphore to prevent multiple concurrent requests
    async with generation_lock:
        try:
            response = await app_state.ai_engine.chat(user_message, system_prompt=system_prompt)
            
            # Robustly parse the LLM response
            prompts = _parse_prompts(response, count)
            
            if not prompts:
                logger.warning(f"No prompts extracted from LLM response: {response[:100]}...")
                raise HTTPException(status_code=500, detail="Failed to generate valid prompts from LLM")

            # Ensure we have exactly count prompts
            prompts = prompts[:count]

            return PromptResponse(
                prompts=prompts,
                negative_prompt=NEGATIVE_PROMPTS.get(req.style, NEGATIVE_PROMPTS["realistic"]),
                style=req.style,
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Prompt generation failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Prompt generation failed: {str(e)}")


@router.get("/styles")
async def get_styles():
    """List available styles."""
    return {
        "styles": [
            {"id": k, "label": k.replace("-", " ").title(), "hint": v}
            for k, v in STYLE_GUIDANCE.items()
        ]
    }
