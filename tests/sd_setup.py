#!/usr/bin/env python3
"""
sd_setup.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run this ONCE to set up Stable Diffusion for AI Brain.

Usage:
    python sd_setup.py

What it does:
  1. Installs required Python packages (diffusers, transformers, torch, etc.)
  2. Verifies GPU availability
  3. Downloads the base Stable Diffusion model (first run only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import subprocess, sys

print("\n--- 1. Installing Python dependencies ---")
packages = [
    "torch", "torchvision", "torchaudio",
    "diffusers", "transformers", "accelerate",
    "safetensors", "Pillow", "scipy"
]
subprocess.check_call([sys.executable, "-m", "pip", "install"] + packages)
print("Done.")

print("\n--- 2. Checking GPU availability ---")
import torch
if torch.cuda.is_available():
    print(f"✅ GPU found: {torch.cuda.get_device_name(0)}")
else:
    print("⚠️  No GPU found. Image generation will be slow on CPU.")

print("\n--- 3. Testing model import ---")
try:
    from diffusers import StableDiffusionPipeline
    print("✅ diffusers imported successfully")
    print("ℹ️  Model will be downloaded on first image generation request.")
except ImportError as e:
    print(f"❌ Import failed: {e}")

print("\nSetup process finished.")
print("Start the backend and use the Image Generator feature to trigger model download.")
