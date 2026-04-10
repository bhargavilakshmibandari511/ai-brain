"""
VLM Service — Visual Language Model via Ollama
Supports: image compression, model routing, in-memory TTL caching, async execution, streaming
Default model: llava:latest (pull with: ollama pull llava:7b)
"""

import ollama
import base64
import hashlib
import asyncio
import io
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

logger = logging.getLogger(__name__)

# ── In-memory TTL cache ─────────────────────────────────────
_cache: dict[str, tuple[str, float]] = {}
CACHE_TTL = 3600  # seconds
_executor = ThreadPoolExecutor(max_workers=2)

# ── Model routing ───────────────────────────────────────────
MODEL_ROUTING: dict[str, str] = {
    "ocr":         "llava:7b",
    "ui":          "llava:7b",
    "screenshot":  "llava:7b",
    "chart":       "llava:7b",
    "handwriting": "llava:7b",
    "general":     "llava:7b",
    "code":        "llava:7b",
}
DEFAULT_MODEL = "llava:7b"


def select_model(task: str) -> str:
    """Return the best model for the given task. Falls back to DEFAULT_MODEL."""
    return MODEL_ROUTING.get(task, DEFAULT_MODEL)


# ── Image compression ───────────────────────────────────────
def compress_image(image_bytes: bytes, max_size: int = 768) -> str:
    """Resize + compress to JPEG, returning a base64 string."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


# ── Cache helpers ───────────────────────────────────────────
def make_cache_key(img_b64: str, question: str, model: str) -> str:
    raw = f"{img_b64[:128]}{question}{model}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached(key: str) -> str | None:
    if key in _cache:
        result, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return result
        del _cache[key]
    return None


def set_cache(key: str, value: str) -> None:
    _cache[key] = (value, time.time())


# ── Sync Ollama call (runs in thread pool) ──────────────────
def _vlm_call_sync(model: str, question: str, img_b64: str) -> str:
    response = ollama.chat(
        model=model,
        messages=[{
            "role": "user",
            "content": question,
            "images": [img_b64],
        }],
        options={"num_predict": 1024},
    )
    return response["message"]["content"]


# ── Async wrapper ───────────────────────────────────────────
async def vlm_understand(
    image_bytes: bytes,
    question: str,
    task: str = "general",
) -> str:
    """Async VLM call with caching. Uses threadpool so FastAPI stays non-blocking."""
    model = select_model(task)
    img_b64 = compress_image(image_bytes)

    cache_key = make_cache_key(img_b64, question, model)
    cached = get_cached(cache_key)
    if cached:
        logger.debug("VLM cache hit for task=%s", task)
        return cached

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _vlm_call_sync, model, question, img_b64)
    set_cache(cache_key, result)
    return result


# ── Streaming version ───────────────────────────────────────
async def vlm_stream(image_bytes: bytes, question: str, task: str = "general"):
    """Async generator that yields streamed tokens from the VLM."""
    model = select_model(task)
    img_b64 = compress_image(image_bytes)

    def _stream():
        return ollama.chat(
            model=model,
            messages=[{"role": "user", "content": question, "images": [img_b64]}],
            stream=True,
            options={"num_predict": 1024},
        )

    loop = asyncio.get_event_loop()
    stream_iter = await loop.run_in_executor(_executor, _stream)
    for chunk in stream_iter:
        content = chunk.get("message", {}).get("content", "")
        if content:
            yield content

async def check_vlm_available() -> bool:
    """Check if the VLM model (llava) is installed and available in Ollama."""
    try:
        # The ollama-python library returns a list of Model objects
        result = ollama.list()
        models = getattr(result, 'models', [])
        for m in models:
            model_id = getattr(m, 'model', '').lower()
            if "llava" in model_id:
                return True
        return False
    except Exception as e:
        logger.error(f"Error checking VLM availability: {e}")
        return False
