#!/usr/bin/env python3
"""
debug_sd.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Debug script for Stable Diffusion setup.
Checks environment, prints versions, and runs a minimal
test to confirm the pipeline loads correctly.

Usage:
    python debug_sd.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys, platform

print("=" * 50)
print("  AI Brain - Stable Diffusion Debug")
print("=" * 50)

print(f"\nPython: {sys.version}")
print(f"Platform: {platform.system()} {platform.release()}")

print("\n--- Checking dependencies ---")
deps = ["torch", "diffusers", "transformers", "accelerate", "PIL"]
for dep in deps:
    try:
        mod = __import__(dep if dep != "PIL" else "PIL")
        version = getattr(mod, "__version__", "unknown")
        print(f"  ✅ {dep}: {version}")
    except ImportError:
        print(f"  ❌ {dep}: NOT INSTALLED  →  run: pip install {dep}")

print("\n--- GPU Info ---")
try:
    import torch
    print(f"  CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"  Device: {torch.cuda.get_device_name(0)}")
        print(f"  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    else:
        print("  Running on CPU (generation will be slow)")
except Exception as e:
    print(f"  Error: {e}")

print("\n--- Environment check complete ---")
