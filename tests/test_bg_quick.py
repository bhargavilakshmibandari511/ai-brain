#!/usr/bin/env python3
"""Quick test for Background Remover"""

import sys

print("Testing Background Remover Setup...")
print("=" * 60)

# Test 1: Check rembg
try:
    from rembg import remove, new_session
    print("✅ rembg: INSTALLED")
except ImportError as e:
    print(f"❌ rembg: NOT INSTALLED - {e}")
    sys.exit(1)

# Test 2: Check PIL
try:
    from PIL import Image
    import numpy as np
    print("✅ Pillow + NumPy: INSTALLED")
except ImportError as e:
    print(f"❌ Pillow/NumPy: NOT INSTALLED - {e}")
    sys.exit(1)

# Test 3: Check routes
try:
    sys.path.insert(0, './backend')
    from routes.background import VALID_MODELS, ALLOWED_EXTENSIONS
    print("✅ Background routes: IMPORTABLE")
    print(f"   Supported models: {len(VALID_MODELS)}")
    print(f"   Allowed extensions: {ALLOWED_EXTENSIONS}")
except Exception as e:
    print(f"❌ Background routes: ERROR - {e}")
    sys.exit(1)

# Test 4: Create and process a test image
try:
    import io
    from time import perf_counter
    from pathlib import Path
    
    # Create test image
    test_img = Image.new('RGB', (100, 100), color='white')
    arr = np.array(test_img)
    # Draw a red circle
    center_x, center_y = 50, 50
    for x in range(100):
        for y in range(100):
            if (x - center_x) ** 2 + (y - center_y) ** 2 <= 30 ** 2:
                arr[x, y] = [255, 0, 0]
    test_img = Image.fromarray(arr)
    
    # Convert to bytes
    buf = io.BytesIO()
    test_img.save(buf, format='PNG')
    input_bytes = buf.getvalue()
    
    print(f"\n✅ Test image created: {len(input_bytes)} bytes")
    
    # Process
    print("Processing with 'isnet-general-use' model...")
    start = perf_counter()
    session = new_session('isnet-general-use')
    result_bytes = remove(input_bytes, session=session, post_process_mask=True)
    elapsed = int((perf_counter() - start) * 1000)
    
    print(f"✅ Background removal succeeded: {elapsed}ms")
    print(f"   Output size: {len(result_bytes)} bytes")
    
    # Verify output
    result_img = Image.open(io.BytesIO(result_bytes))
    print(f"   Output format: {result_img.format} ({result_img.mode})")
    
    if result_img.mode == 'RGBA':
        print("✅ Output has transparency (RGBA mode)")
        # Calculate transparency
        alpha = np.array(result_img)[:, :, 3]
        transparent = np.sum(alpha < 128)
        total = alpha.size
        pct = (transparent / total) * 100
        print(f"   Transparency: {pct:.1f}% of pixels")
    
except Exception as e:
    print(f"❌ Image processing failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED - Background Remover is working!")
print("=" * 60)
