import os
import time
import uuid
import logging
import cv2
import numpy as np
import pytesseract
from pathlib import Path
from typing import List, Optional
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Config ---
UPLOAD_DIR = Path("data/ocr_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Important: Set Tesseract path for Windows users
# You can override this via environment variable TESSERACT_PATH
TESS_PATH = os.getenv("TESSERACT_PATH", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if os.path.exists(TESS_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESS_PATH

# --- Preprocessing Functions ---

def preprocess_image(image_path: str, mode: str = "auto") -> str:
    """
    Apply OpenCV preprocessing to improve OCR accuracy.
    Modes: auto, document, photo, handwriting
    """
    img = cv2.imread(image_path)
    if img is None:
        return image_path

    # 1. Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    if mode == "document":
        # Deskew, denoise, and threshold
        coords = np.column_stack(np.where(gray > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45: angle = -(90 + angle)
        else: angle = -angle
        (h, w) = gray.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        # Adaptive thresholding for documents
        gray = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)

    elif mode == "photo":
        # Upscale and sharpen
        gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        gray = cv2.filter2D(gray, -1, kernel)

    # Save processed image
    processed_path = str(UPLOAD_DIR / f"proc_{os.path.basename(image_path)}")
    cv2.imwrite(processed_path, gray)
    return processed_path

# --- OCR Implementation ---

def run_ocr(image_path: str, lang: str = "eng", psm: int = 3) -> dict:
    """
    Execute Tesseract OCR on the given image.
    PSM 3 = Fully automatic page segmentation, but no OSD. (Default)
    PSM 6 = Assume a single uniform block of text.
    """
    try:
        config = f"--psm {psm}"
        
        # Get data including confidence scores
        data = pytesseract.image_to_data(Image.open(image_path), lang=lang, config=config, output_type=pytesseract.Output.DICT)
        
        # Get full text
        text = pytesseract.image_to_string(Image.open(image_path), lang=lang, config=config)
        
        # Calculate average confidence (filtering out empty/low conf results)
        confidences = [int(c) for c in data['conf'] if int(c) != -1]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        return {
            "text": text.strip(),
            "confidence": round(avg_confidence, 2),
            "languages": lang,
            "char_count": len(text),
            "word_count": len(text.split())
        }
    except Exception as e:
        logger.error(f"OCR execution error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

# --- Endpoints ---

@router.post("/extract")
async def extract_text(
    file: UploadFile = File(...),
    lang: str = Form("eng"),
    mode: str = Form("auto"),
    psm: int = Form(3)
):
    """
    Upload an image and extract text from it.
    """
    file_id = str(uuid.uuid4())
    suffix = Path(file.filename).suffix
    save_path = UPLOAD_DIR / f"{file_id}{suffix}"

    # Save uploaded file
    with open(save_path, "wb") as buffer:
        buffer.write(await file.read())

    # Preprocess
    proc_path = preprocess_image(str(save_path), mode)

    # Run OCR
    result = run_ocr(proc_path, lang, psm)
    
    # Metadata
    result["job_id"] = file_id
    result["filename"] = file.filename
    result["timestamp"] = time.time()

    return JSONResponse(result)

@router.get("/languages")
async def get_languages():
    """Get list of installed Tesseract languages."""
    try:
        langs = pytesseract.get_languages(config='')
        return {"languages": langs}
    except:
        return {"languages": ["eng"]}

@router.get("/status")
async def get_status():
    """Verify Tesseract installation."""
    try:
        version = pytesseract.get_tesseract_version()
        return {"status": "ready", "version": str(version), "path": pytesseract.pytesseract.tesseract_cmd}
    except Exception as e:
        return {"status": "error", "error": str(e)}
