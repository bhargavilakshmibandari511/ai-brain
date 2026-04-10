import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from uuid import uuid4
from time import perf_counter
from PIL import Image
import numpy as np
import io
import os

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = Path("./data/bg_uploads")
OUTPUT_DIR = Path("./data/bg_outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory tracking
jobs: dict = {}

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# Lazy-load rembg to avoid slow numba JIT at server startup
_sessions = {}

def _get_session(model_name: str):
    """Get or create a rembg session for the given model."""
    if model_name not in _sessions:
        from rembg import new_session
        _sessions[model_name] = new_session(model_name)
    return _sessions[model_name]

def _get_remove():
    from rembg import remove
    return remove


def _sharpen_alpha(img_rgba: Image.Image, threshold: int = 128) -> Image.Image:
    """Post-process: sharpen the alpha channel to remove ghosting/fading.
    Pixels with alpha > threshold become fully opaque, others fully transparent."""
    arr = np.array(img_rgba)
    alpha = arr[:, :, 3]
    # Make alpha binary — clean cutout, no semi-transparent ghosting
    alpha = np.where(alpha > threshold, 255, 0).astype(np.uint8)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr)


VALID_MODELS = [
    "u2net",              # General purpose (default)
    "isnet-general-use",  # Better for objects/logos
    "isnet-anime",        # Anime/cartoon images
    "u2netp",             # Lightweight/fast
    "silueta",            # Silhouette focused
    "u2net_human_seg",    # Human segmentation
    "u2net_cloth_seg",    # Clothing segmentation
]


@router.post("/remove")
async def remove_background(
    file: UploadFile = File(...),
    model: str = Form("isnet-general-use"),
    sharpen: bool = Form(True),
    threshold: int = Form(128),
):
    """Upload an image and remove its background.
    
    - model: AI model to use (isnet-general-use recommended for logos/graphics)
    - sharpen: apply alpha sharpening for clean cutout (no ghosting)
    - threshold: alpha threshold 0-255 (lower = keep more detail, higher = stricter)
    """
    # Validate model choice
    if model not in VALID_MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid model. Choose from: {VALID_MODELS}")

    # Validate extension
    suffix = Path(file.filename or "image.png").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    image_id = f"bg_{uuid4().hex[:12]}"
    input_path = UPLOAD_DIR / f"{image_id}{suffix}"
    output_path = OUTPUT_DIR / f"{image_id}.png"

    # Save original
    with open(input_path, "wb") as f:
        f.write(contents)

    # Run background removal
    start = perf_counter()
    try:
        remove_fn = _get_remove()
        session = _get_session(model)
        result_bytes = remove_fn(
            contents,
            session=session,
            post_process_mask=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {e}")

    # Post-process: sharpen alpha to eliminate ghosting
    if sharpen:
        try:
            img_rgba = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
            img_rgba = _sharpen_alpha(img_rgba, threshold=threshold)
            buf = io.BytesIO()
            img_rgba.save(buf, format="PNG")
            result_bytes = buf.getvalue()
        except Exception as e:
            logger.warning(f"Post-processing failed, using raw result: {e}")

    elapsed_ms = int((perf_counter() - start) * 1000)

    # Save result
    with open(output_path, "wb") as f:
        f.write(result_bytes)

    # Get dimensions
    img = Image.open(io.BytesIO(result_bytes))
    width, height = img.size

    jobs[image_id] = {
        "image_id": image_id,
        "original": str(input_path),
        "result": str(output_path),
        "width": width,
        "height": height,
        "processing_time_ms": elapsed_ms,
        "model": model,
    }

    return {
        "image_id": image_id,
        "status": "done",
        "width": width,
        "height": height,
        "processing_time_ms": elapsed_ms,
        "model": model,
        "download_url": f"/api/background/download/{image_id}",
    }


@router.get("/download/{image_id}")
async def download_result(image_id: str):
    """Download the background-removed PNG."""
    output_path = OUTPUT_DIR / f"{image_id}.png"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    return FileResponse(
        str(output_path),
        media_type="image/png",
        filename=f"{image_id}_no_bg.png",
    )


@router.get("/history")
async def get_history():
    """Return list of processed images."""
    return list(jobs.values())
