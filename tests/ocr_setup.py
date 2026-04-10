#!/usr/bin/env python3
"""
ocr_setup.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run this ONCE to set up OCR for AI Brain.

Usage:
    python ocr_setup.py

What it does:
  1. Installs pytesseract, pillow, opencv, numpy
  2. Verifies Tesseract installation
  3. Gives OS-specific instructions for missing engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import subprocess, sys, os, platform

def run(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

print("\n--- 1. Installing Python dependencies ---")
packages = ["pytesseract", "pillow", "opencv-python-headless", "numpy"]
subprocess.check_call([sys.executable, "-m", "pip", "install"] + packages)
print("Done.")

print("\n--- 2. Verifying Tesseract Engine ---")
import pytesseract

# Default Windows path
win_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.path.exists(win_path):
    pytesseract.pytesseract.tesseract_cmd = win_path

try:
    v = pytesseract.get_tesseract_version()
    print(f"✅ Tesseract found! Version: {v}")
    print(f"✅ Path: {pytesseract.pytesseract.tesseract_cmd}")
except Exception:
    print("❌ Tesseract engine NOT found on your system PATH.")
    
    syst = platform.system()
    if syst == "Windows":
        print("\nWINDOWS SETUP:")
        print("1. Download installer from: https://github.com/UB-Mannheim/tesseract/wiki")
        print(f"2. Install to default folder: {win_path}")
        print("3. Restart your terminal and run this script again.")
    elif syst == "Darwin": # macOS
        print("\nMACOS SETUP:")
        print("1. Run: brew install tesseract")
    else: # Linux
        print("\nLINUX SETUP:")
        print("1. Run: sudo apt install tesseract-ocr")

print("\n--- 3. Testing OCR (Smoke Test) ---")
# Create a dummy image with text to test
from PIL import Image, ImageDraw
img = Image.new('RGB', (200, 60), color = (255, 255, 255))
d = ImageDraw.Draw(img)
d.text((10,10), "AI BRAIN OCR TEST", fill=(0,0,0))
img.save('ocr_test.png')

try:
    text = pytesseract.image_to_string(Image.open('ocr_test.png'))
    if "AI BRAIN" in text:
        print("✅ OCR Smoke Test: SUCCESS")
    else:
        print(f"⚠️  OCR Smoke Test: Text detected but maybe inaccurate: '{text.strip()}'")
except Exception as e:
    print(f"❌ OCR Smoke Test: FAILED ({e})")

print("\nSetup process finished.")
