#!/usr/bin/env python3
"""
Advanced Background Remover for Complex Images & Logos
Specialized for handling detailed graphics like college emblems, logos, etc.
"""

import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from uuid import uuid4
from time import perf_counter
from PIL import Image
import numpy as np
import cv2
import io
import os
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = Path("./data/bg_uploads_advanced")
OUTPUT_DIR = Path("./data/bg_outputs_advanced")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

jobs: dict = {}

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
MAX_FILE_SIZE = 20 * 1024 * 1024

# Lazy-load models
_sessions = {}

def _get_session(model_name: str):
    """Get or create a rembg session."""
    if model_name not in _sessions:
        from rembg import new_session
        _sessions[model_name] = new_session(model_name)
    return _sessions[model_name]

def _get_remove():
    from rembg import remove
    return remove


class AdvancedBackgroundRemover:
    """Advanced background removal with preprocessing and post-processing."""
    
    @staticmethod
    def preprocess_image(image: Image.Image) -> np.ndarray:
        """Preprocess image for better segmentation."""
        arr = np.array(image)
        
        # Convert to HSV for better color handling
        if len(arr.shape) == 3:
            if arr.shape[2] == 4:  # RGBA
                arr = arr[:, :, :3]
            
            # Enhance contrast
            hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV).astype(np.float32)
            # Normalize S and V channels
            hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.2, 0, 255)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.1, 0, 255)
            arr = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
        return arr
    
    @staticmethod
    def refine_mask(mask: np.ndarray, iterations: int = 2) -> np.ndarray:
        """Refine mask using morphological operations."""
        # Clean small noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=iterations)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        
        # Dilate slightly to recover edges
        mask = cv2.dilate(mask, kernel, iterations=1)
        
        return mask
    
    @staticmethod
    def apply_gaussian_blur_to_edges(alpha: np.ndarray, blur_size: int = 3) -> np.ndarray:
        """Apply Gaussian blur only to edge regions for smooth transitions."""
        # Find edges
        edges = cv2.Canny(alpha, 50, 150)
        
        # Dilate edges to create a region
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        edge_region = cv2.dilate(edges, kernel, iterations=2)
        
        # Blur alpha in edge regions
        blurred_alpha = cv2.GaussianBlur(alpha, (blur_size, blur_size), 0)
        alpha = np.where(edge_region > 0, blurred_alpha, alpha)
        
        return alpha
    
    @staticmethod
    def remove_color_spill(image: np.ndarray, mask: np.ndarray, tolerance: int = 20) -> np.ndarray:
        """Remove color spill (background colors bleeding into foreground)."""
        if len(image.shape) != 3 or image.shape[2] != 3:
            return image
        
        # Find foreground pixels
        fg_pixels = image[mask > 128]
        
        if len(fg_pixels) == 0:
            return image
        
        # Get dominant foreground colors
        fg_mean = np.mean(fg_pixels, axis=0)
        
        # Adjust colors near edges to reduce spill
        result = image.copy().astype(np.float32)
        mask_f = mask.astype(np.float32) / 255.0
        
        for c in range(3):
            result[:, :, c] = result[:, :, c] * (1 + mask_f * 0.1)
        
        return np.clip(result, 0, 255).astype(np.uint8)
    
    @staticmethod
    def enhance_details(image: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Enhance fine details in the foreground."""
        if len(image.shape) != 3 or image.shape[2] != 3:
            return image
        
        # Apply unsharp masking on foreground only
        blurred = cv2.GaussianBlur(image, (0, 0), 2)
        sharpened = cv2.addWeighted(image, 1.5, blurred, -0.5, 0)
        
        # Apply sharpening only where mask is strong
        mask_f = mask.astype(np.float32) / 255.0
        result = np.zeros_like(image, dtype=np.float32)
        
        for c in range(3):
            result[:, :, c] = (
                image[:, :, c] * (1 - mask_f * 0.3) +
                sharpened[:, :, c] * (mask_f * 0.3)
            )
        
        return np.clip(result, 0, 255).astype(np.uint8)
    
    @staticmethod
    def upsample_mask(mask: np.ndarray, scale: float = 1.2) -> np.ndarray:
        """Upsample mask for better edge quality."""
        h, w = mask.shape
        new_h, new_w = int(h * scale), int(w * scale)
        
        upsampled = cv2.resize(mask, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        
        # Crop back to original size
        start_h = (new_h - h) // 2
        start_w = (new_w - w) // 2
        
        return upsampled[start_h:start_h+h, start_w:start_w+w]
    
    @classmethod
    def process_advanced(
        cls,
        image_bytes: bytes,
        model: str = "isnet-general-use",
        enhance_edges: bool = True,
        remove_spill: bool = False,
        enhance_details: bool = False,
        blur_edges: int = 1,
        transparency_level: int = 255,
        use_alpha_matting: bool = False,
        logo_mode: bool = True
    ) -> bytes:
        """
        Advanced background removal optimized for logos/graphics.
        logo_mode=True enables preprocessing for detail preservation.
        """
        # Step 0: Preprocess for logos (to preserve fine text/details)
        if logo_mode or enhance_edges or use_alpha_matting:
            img_temp = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            prepped_arr = cls.preprocess_image(img_temp)
            prepped_img = Image.fromarray(prepped_arr)
            
            buf_pre = io.BytesIO()
            prepped_img.save(buf_pre, format='PNG')
            prepped_bytes = buf_pre.getvalue()
        else:
            prepped_bytes = image_bytes

        # Step 1: Background removal with smart matting
        remove_fn = _get_remove()
        session = _get_session(model)
        
        # For logos: use alpha matting to preserve text
        result_bytes = remove_fn(
            prepped_bytes,
            session=session,
            alpha_matting=use_alpha_matting,
            alpha_matting_foreground_threshold=200,
            alpha_matting_background_threshold=50,
            alpha_matting_erode_size=5,
            post_process_mask=False
        )
        
        # Load result
        base_rgba = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
        base_arr = np.array(base_rgba)
        
        image_rgb = base_arr[:, :, :3]
        mask = base_arr[:, :, 3]
        
        # Step 2: Refine mask (only if requested)
        if enhance_edges:
            mask = cls.refine_mask(mask, iterations=1)
        
        # Step 3: Remove color spill
        if remove_spill:
            image_rgb = cls.remove_color_spill(image_rgb, mask)
        
        # Step 4: Enhance details
        if enhance_details:
            image_rgb = cls.enhance_details(image_rgb, mask)
        
        # Step 5: Smooth edges with Gaussian blur
        if blur_edges > 0:
            mask = cls.apply_gaussian_blur_to_edges(mask, blur_size=blur_edges * 2 + 1)
        
        # Step 6: Apply transparency level
        mask = (mask.astype(np.float32) * transparency_level / 255.0).astype(np.uint8)
        
        # Step 7: Combine
        result_rgba = np.dstack([image_rgb, mask])
        result_image = Image.fromarray(result_rgba, 'RGBA')
        
        # Save
        buf = io.BytesIO()
        result_image.save(buf, format='PNG')
        return buf.getvalue()


@router.post("/advanced")
async def remove_background_advanced(
    file: UploadFile = File(...),
    model: str = Form("isnet-general-use"),
    enhance_edges: bool = Form(True),
    remove_spill: bool = Form(False),
    enhance_details: bool = Form(False),
    blur_edges: int = Form(1),
    transparency_level: int = Form(255),
    quality: str = Form("balanced"),
    use_alpha_matting: bool = Form(False),
    logo_mode: bool = Form(True),
):
    """
    Advanced background removal optimized for logos & graphics.
    
    Parameters:
    - model: isnet-general-use (best for logos/graphics/text)
    - quality: "fast" (skip enhancements), "balanced" (default), "high" (all enhancements)
    - logo_mode: true (default - preserves fine details in logos/graphics)
    - use_alpha_matting: true (for ultra-sharp edges on thin text)
    - enhance_edges: Apply edge enhancement (morphological ops)
    - remove_spill: Remove color spill from background
    - enhance_details: Enhance fine details
    - blur_edges: Edge blur (0-5)
    - transparency_level: 0-255 (255 = fully transparent)
    - quality: "fast" (basic), "balanced" (medium), "high" (all enhancements)
    """
    
    # Validate
    suffix = Path(file.filename or "image.png").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
    
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")
    
    # Apply quality preset
    if quality == "fast":
        enhance_edges = False
        remove_spill = False
        enhance_details = False
        blur_edges = 0
        logo_mode = False
    elif quality == "balanced":
        enhance_details = False
    # "high" uses all settings with logo_mode
    
    image_id = f"ad_{uuid4().hex[:12]}"
    input_path = UPLOAD_DIR / f"{image_id}{suffix}"
    output_path = OUTPUT_DIR / f"{image_id}.png"
    
    # Save original
    with open(input_path, "wb") as f:
        f.write(contents)
    
    # Process
    start = perf_counter()
    try:
        result_bytes = AdvancedBackgroundRemover.process_advanced(
            contents,
            model=model,
            enhance_edges=enhance_edges,
            remove_spill=remove_spill,
            enhance_details=enhance_details,
            blur_edges=blur_edges,
            transparency_level=transparency_level,
            use_alpha_matting=use_alpha_matting,
            logo_mode=logo_mode
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")
    
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
        "quality": quality,
        "enhancements": {
            "edges": enhance_edges,
            "spill_removal": remove_spill,
            "details": enhance_details,
            "edge_blur": blur_edges
        }
    }
    
    return {
        "image_id": image_id,
        "status": "done",
        "width": width,
        "height": height,
        "processing_time_ms": elapsed_ms,
        "model": model,
        "quality": quality,
        "download_url": f"/api/background/advanced-download/{image_id}",
        "preview_url": f"/api/background/preview/{image_id}",
    }


@router.get("/advanced-download/{image_id}")
async def download_advanced_result(image_id: str):
    """Download advanced background-removed PNG."""
    output_path = OUTPUT_DIR / f"{image_id}.png"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    return FileResponse(
        str(output_path),
        media_type="image/png",
        filename=f"{image_id}_advanced_no_bg.png",
    )


@router.get("/preview/{image_id}")
async def get_preview(image_id: str, size: int = Form(300)):
    """Get thumbnail preview of result."""
    output_path = OUTPUT_DIR / f"{image_id}.png"
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Create thumbnail
    img = Image.open(output_path)
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    return FileResponse(
        buf,
        media_type="image/png",
        filename=f"{image_id}_preview.png"
    )


@router.get("/advanced-history")
async def get_advanced_history():
    """Return list of advanced processing jobs."""
    return list(jobs.values())


@router.post("/compare")
async def compare_models(
    file: UploadFile = File(...),
    models: str = Form("isnet-general-use,isnet-anime,u2net")
):
    """
    Compare background removal across multiple models (logo-optimized).
    Returns results from each model for comparison.
    """
    
    suffix = Path(file.filename or "image.png").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
    
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")
    
    model_list = [m.strip() for m in models.split(",")]
    results = {}
    remove_fn = _get_remove()
    
    for model in model_list:
        try:
            session = _get_session(model)
            result_bytes = remove_fn(
                contents,
                session=session,
                post_process_mask=True
            )
            
            image_id = f"cmp_{uuid4().hex[:8]}_{model.replace('-', '_')}"
            output_path = OUTPUT_DIR / f"{image_id}.png"
            
            with open(output_path, "wb") as f:
                f.write(result_bytes)
            
            img = Image.open(io.BytesIO(result_bytes))
            results[model] = {
                "status": "success",
                "download_url": f"/api/background/advanced-download/{image_id}",
                "size": (img.width, img.height)
            }
        except Exception as e:
            results[model] = {
                "status": "error",
                "error": str(e)
            }
    
    return {
        "comparison": results,
        "recommendation": "isnet-general-use" if "isnet-general-use" in results else None
    }
