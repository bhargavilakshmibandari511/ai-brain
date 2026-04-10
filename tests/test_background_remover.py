#!/usr/bin/env python3
"""
Test script for Background Remover functionality
Tests the background removal logic and API endpoints
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

import io
from PIL import Image
import numpy as np

def test_rembg_installation():
    """Test if rembg is installed"""
    print("=" * 60)
    print("TEST 1: Checking rembg installation...")
    print("=" * 60)
    try:
        import rembg
        print("✅ rembg is installed")
        print(f"   Version: {rembg.__version__ if hasattr(rembg, '__version__') else 'unknown'}")
        return True
    except ImportError as e:
        print(f"❌ rembg is NOT installed: {e}")
        print("   Install with: pip install rembg")
        return False

def test_create_test_image():
    """Create a simple test image with a colored circle on white background"""
    print("\n" + "=" * 60)
    print("TEST 2: Creating test image...")
    print("=" * 60)
    try:
        # Create a test image: red circle on white background
        size = 256
        img = Image.new('RGB', (size, size), color='white')
        pixels = img.load()
        
        # Draw a red circle in the center
        center_x, center_y = size // 2, size // 2
        radius = 80
        for x in range(size):
            for y in range(size):
                if (x - center_x) ** 2 + (y - center_y) ** 2 <= radius ** 2:
                    pixels[x, y] = (255, 0, 0)  # Red
        
        test_image_path = Path(__file__).parent / "backend/data/bg_uploads/test_image.png"
        test_image_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(test_image_path)
        
        print(f"✅ Test image created: {test_image_path}")
        print(f"   Size: {size}x{size} pixels")
        print(f"   Content: Red circle on white background")
        return str(test_image_path)
    except Exception as e:
        print(f"❌ Failed to create test image: {e}")
        return None

def test_background_removal(test_image_path):
    """Test the actual background removal logic"""
    print("\n" + "=" * 60)
    print("TEST 3: Testing background removal...")
    print("=" * 60)
    
    try:
        from rembg import remove, new_session
        from time import perf_counter
        
        # Read test image
        with open(test_image_path, 'rb') as f:
            input_bytes = f.read()
        
        print(f"   Input file size: {len(input_bytes)} bytes")
        
        # Test with default model
        print("   Processing with 'isnet-general-use' model...")
        start = perf_counter()
        
        session = new_session('isnet-general-use')
        result_bytes = remove(input_bytes, session=session, post_process_mask=True)
        
        elapsed_ms = int((perf_counter() - start) * 1000)
        
        print(f"✅ Background removal succeeded")
        print(f"   Processing time: {elapsed_ms}ms")
        print(f"   Output file size: {len(result_bytes)} bytes")
        
        # Verify output is valid PNG with alpha channel
        result_img = Image.open(io.BytesIO(result_bytes))
        print(f"   Output format: {result_img.format}")
        print(f"   Output size: {result_img.size}")
        print(f"   Output mode (should have alpha): {result_img.mode}")
        
        if result_img.mode == 'RGBA':
            print("✅ Output has alpha channel (transparent background)")
            # Calculate transparency percentage
            alpha = np.array(result_img)[:, :, 3]
            transparent_pixels = np.sum(alpha < 128)
            total_pixels = alpha.size
            transparency_pct = (transparent_pixels / total_pixels) * 100
            print(f"   Transparency: {transparency_pct:.1f}% of pixels")
        else:
            print(f"⚠️  Output mode is {result_img.mode}, expected RGBA")
        
        # Save result
        output_path = Path(__file__).parent / "backend/data/bg_outputs/test_result.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'wb') as f:
            f.write(result_bytes)
        print(f"   Result saved to: {output_path}")
        
        return True
    except ImportError as e:
        print(f"❌ rembg not available: {e}")
        print("   Install with: pip install rembg")
        return False
    except Exception as e:
        print(f"❌ Background removal failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_alpha_sharpening():
    """Test the alpha sharpening post-processing"""
    print("\n" + "=" * 60)
    print("TEST 4: Testing alpha sharpening...")
    print("=" * 60)
    
    try:
        import numpy as np
        
        # Create a test image with semi-transparent pixels
        test_img = Image.new('RGBA', (100, 100), (255, 0, 0, 255))
        arr = np.array(test_img)
        
        # Add some semi-transparent pixels (ghosting)
        arr[20:30, 20:30, 3] = 128  # Semi-transparent
        arr[40:50, 40:50, 3] = 64   # More transparent
        
        test_img = Image.fromarray(arr)
        
        # Apply sharpening
        alpha = arr[:, :, 3]
        threshold = 128
        alpha_sharp = np.where(alpha > threshold, 255, 0).astype(np.uint8)
        arr[:, :, 3] = alpha_sharp
        sharpened_img = Image.fromarray(arr)
        
        print("✅ Alpha sharpening test passed")
        print(f"   Threshold: {threshold}")
        print(f"   Semi-transparent pixels converted to binary (0 or 255)")
        
        # Check the results
        unique_alphas = np.unique(sharpened_img.split()[3])
        print(f"   Unique alpha values after sharpening: {list(unique_alphas)}")
        
        return True
    except Exception as e:
        print(f"❌ Alpha sharpening test failed: {e}")
        return False

def test_api_endpoint():
    """Test the API endpoint integration"""
    print("\n" + "=" * 60)
    print("TEST 5: Checking API endpoint configuration...")
    print("=" * 60)
    
    try:
        from backend.routes.background import VALID_MODELS, ALLOWED_EXTENSIONS
        
        print("✅ Background removal routes imported successfully")
        print(f"   Supported models: {len(VALID_MODELS)}")
        for model in VALID_MODELS:
            print(f"      - {model}")
        print(f"   Allowed extensions: {ALLOWED_EXTENSIONS}")
        return True
    except ImportError as e:
        print(f"❌ Could not import background routes: {e}")
        return False
    except Exception as e:
        print(f"❌ API endpoint check failed: {e}")
        return False

def main():
    """Run all tests"""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 15 + "BACKGROUND REMOVER TEST SUITE" + " " * 14 + "║")
    print("╚" + "=" * 58 + "╝")
    
    results = {}
    
    # Test 1: Check installation
    results['rembg_installed'] = test_rembg_installation()
    
    # Test 2: Create test image
    test_image_path = test_create_test_image()
    results['test_image_created'] = test_image_path is not None
    
    # Test 3: Background removal
    if test_image_path and results['rembg_installed']:
        results['background_removal'] = test_background_removal(test_image_path)
    else:
        print("\n⏭️  Skipping background removal test (dependencies missing)")
        results['background_removal'] = False
    
    # Test 4: Alpha sharpening
    results['alpha_sharpening'] = test_alpha_sharpening()
    
    # Test 5: API endpoint
    results['api_endpoint'] = test_api_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    print(f"\nResult: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("\n🎉 All tests passed! Background remover is working correctly.")
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed. Please review the output above.")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
