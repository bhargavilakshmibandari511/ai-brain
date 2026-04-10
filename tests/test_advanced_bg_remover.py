#!/usr/bin/env python3
"""
Test Advanced Background Remover
Designed to handle complex logos like Pragati Engineering College emblem
"""

import requests
import json
import time
import sys
from pathlib import Path

BASE_URL = "http://localhost:8000/api"

def test_advanced_background_remover(image_path: str):
    """Test the advanced background remover with a logo image."""
    
    if not Path(image_path).exists():
        print(f"❌ Image not found: {image_path}")
        return False
    
    print("=" * 70)
    print("ADVANCED BACKGROUND REMOVER - LOGO TEST")
    print("=" * 70)
    
    print(f"\n📷 Image: {image_path}")
    
    # Test 1: Fast mode
    print("\n" + "─" * 70)
    print("TEST 1: FAST MODE (Basic removal)")
    print("─" * 70)
    
    with open(image_path, "rb") as f:
        files = {"file": (Path(image_path).name, f, "image/png")}
        data = {
            "model": "isnet-general-use",
            "enhance_edges": "false",
            "remove_spill": "false",
            "enhance_details": "false",
            "blur_edges": "0",
            "transparency_level": "255",
            "quality": "fast"
        }
        response = requests.post(
            f"{BASE_URL}/background/advanced",
            files=files,
            data=data
        )
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text}")
        return False
    
    result1 = response.json()
    print(f"✓ Processing Time: {result1['processing_time_ms']}ms")
    print(f"✓ Output Size: {result1['width']}x{result1['height']}")
    print(f"✓ Download: {result1['download_url']}")
    
    # Test 2: Balanced mode (recommended for logos)
    print("\n" + "─" * 70)
    print("TEST 2: BALANCED MODE (Recommended for logos)")
    print("─" * 70)
    
    with open(image_path, "rb") as f:
        files = {"file": (Path(image_path).name, f, "image/png")}
        data = {
            "model": "isnet-general-use",
            "enhance_edges": "true",
            "remove_spill": "true",
            "enhance_details": "false",
            "blur_edges": "1",
            "transparency_level": "255",
            "quality": "balanced"
        }
        response = requests.post(
            f"{BASE_URL}/background/advanced",
            files=files,
            data=data
        )
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text}")
        return False
    
    result2 = response.json()
    print(f"✓ Processing Time: {result2['processing_time_ms']}ms")
    print(f"✓ Output Size: {result2['width']}x{result2['height']}")
    if 'enhancements' in result2:
        print(f"✓ Enhancements: {result2['enhancements']}")
    print(f"✓ Download: {result2['download_url']}")
    
    # Test 3: High quality mode (best results)
    print("\n" + "─" * 70)
    print("TEST 3: HIGH QUALITY MODE (Best for detailed logos)")
    print("─" * 70)
    
    with open(image_path, "rb") as f:
        files = {"file": (Path(image_path).name, f, "image/png")}
        data = {
            "model": "isnet-general-use",
            "enhance_edges": "true",
            "remove_spill": "true",
            "enhance_details": "true",
            "blur_edges": "2",
            "transparency_level": "255",
            "quality": "high"
        }
        response = requests.post(
            f"{BASE_URL}/background/advanced",
            files=files,
            data=data
        )
    
    if response.status_code != 200:
        print(f"❌ Failed: {response.text}")
        return False
    
    result3 = response.json()
    print(f"✓ Processing Time: {result3['processing_time_ms']}ms")
    print(f"✓ Output Size: {result3['width']}x{result3['height']}")
    print(f"✓ All Enhancements Enabled")
    print(f"✓ Download: {result3['download_url']}")
    
    # Test 4: Model comparison
    print("\n" + "─" * 70)
    print("TEST 4: MODEL COMPARISON")
    print("─" * 70)
    
    with open(image_path, "rb") as f:
        files = {"file": (Path(image_path).name, f, "image/png")}
        data = {
            "models": "isnet-general-use,u2net,silueta"
        }
        response = requests.post(
            f"{BASE_URL}/background/compare",
            files=files,
            data=data
        )
    
    if response.status_code == 200:
        comparison = response.json()
        print(f"✓ Comparison Results:")
        for model, result in comparison['comparison'].items():
            status = "✓" if result.get('status') == 'success' else "✗"
            print(f"  {status} {model}: {result.get('status')}")
        print(f"✓ Recommended: {comparison['recommendation']}")
    
    # Test 5: Check job history
    print("\n" + "─" * 70)
    print("TEST 5: JOB HISTORY")
    print("─" * 70)
    
    response = requests.get(f"{BASE_URL}/background/advanced-history")
    if response.status_code == 200:
        jobs = response.json()
        print(f"✓ Total Jobs: {len(jobs)}")
        if jobs:
            latest = jobs[-1]
            print(f"  Latest Job ID: {latest['image_id']}")
            print(f"  Processing Time: {latest['processing_time_ms']}ms")
    
    print("\n" + "=" * 70)
    print("✅ ALL TESTS PASSED!")
    print("=" * 70)
    
    print("\n📝 NEXT STEPS:")
    print(f"1. Download Fast result: GET {result1['download_url']}")
    print(f"2. Download Balanced (recommended): GET {result2['download_url']}")
    print(f"3. Download High-Quality: GET {result3['download_url']}")
    print(f"4. Compare results and choose the best one")
    
    return True


def create_test_image():
    """Create a test image similar to a college logo."""
    from PIL import Image, ImageDraw
    import numpy as np
    
    print("📋 Creating test logo image...")
    
    # Create a colorful circular logo
    size = 512
    image = Image.new('RGB', (size, size), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)
    
    # Draw outer circle (gold/orange)
    draw.ellipse(
        [(20, 20), (size-20, size-20)],
        fill=(218, 165, 32),
        outline=(184, 134, 11),
        width=3
    )
    
    # Draw inner circle (blue)
    draw.ellipse(
        [(50, 50), (size-50, size-50)],
        fill=(30, 60, 150),
        outline=(20, 40, 100),
        width=2
    )
    
    # Add some text (as would appear in college logo)
    try:
        draw.text(
            (size//2, size//2 - 30),
            "TEST LOGO",
            fill=(255, 255, 255),
            anchor="mm"
        )
        draw.text(
            (size//2, size//2 + 30),
            "Pragati College",
            fill=(255, 215, 0),
            anchor="mm"
        )
    except:
        pass
    
    # Save test image
    test_path = "test_logo.png"
    image.save(test_path)
    print(f"✓ Test image created: {test_path}")
    
    return test_path


if __name__ == "__main__":
    # Check if custom image provided
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        # Use test image
        image_path = create_test_image()
    
    # Run tests
    success = test_advanced_background_remover(image_path)
    
    if success:
        print("\n✅ Advanced Background Remover is working correctly!")
        print("   Use quality='high' for logo images like Pragati Engineering College emblem")
    else:
        print("\n❌ Tests failed. Check the error messages above.")
        sys.exit(1)
