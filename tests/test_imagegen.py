#!/usr/bin/env python3
"""
Test script for AI Image Prompt Generator
Tests all endpoints and checks for bugs
"""

import asyncio
import json
import subprocess
import sys

async def test_image_prompt_generator():
    """Test the image prompt generator endpoints"""
    
    print("=" * 70)
    print("🎨 AI IMAGE PROMPT GENERATOR - TEST SUITE")
    print("=" * 70)
    
    base_url = "http://localhost:8000"
    
    # Test 1: Check if service is running
    print("\n[TEST 1] Checking if backend API is running...")
    try:
        result = subprocess.run(
            ["curl", "-s", f"{base_url}/docs"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if "swagger" in result.stdout.lower() or result.returncode == 0:
            print("✅ Backend API is running")
        else:
            print("❌ Backend API is not responding properly")
            return False
    except Exception as e:
        print(f"❌ Backend API error: {e}")
        return False
    
    # Test 2: Get available styles
    print("\n[TEST 2] Testing /api/imagegen/styles endpoint...")
    try:
        result = subprocess.run(
            ["curl", "-s", f"{base_url}/api/imagegen/styles"],
            capture_output=True,
            text=True,
            timeout=5
        )
        try:
            data = json.loads(result.stdout)
            if "styles" in data:
                print(f"✅ Styles endpoint works. Available styles: {len(data['styles'])}")
                for style in data['styles']:
                    print(f"   - {style['id']}: {style['hint'][:50]}...")
            else:
                print("❌ Unexpected response format from styles endpoint")
                return False
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"   Response: {result.stdout[:200]}")
            return False
    except Exception as e:
        print(f"❌ Styles endpoint error: {e}")
        return False
    
    # Test 3: Generate prompts with default settings
    print("\n[TEST 3] Testing prompt generation (realistic style, 2 prompts)...")
    try:
        payload = json.dumps({
            "idea": "a majestic dragon flying over mountains at sunset",
            "style": "realistic",
            "count": 2
        })
        
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", f"{base_url}/api/imagegen/generate",
             "-H", "Content-Type: application/json",
             "-d", payload],
            capture_output=True,
            text=True,
            timeout=15
        )
        
        try:
            data = json.loads(result.stdout)
            if "prompts" in data and "negative_prompt" in data:
                print(f"✅ Prompt generation works!")
                print(f"   Generated {len(data['prompts'])} prompts:")
                for i, prompt in enumerate(data['prompts'], 1):
                    print(f"   {i}. {prompt[:80]}...")
                print(f"   Negative prompt: {data['negative_prompt'][:60]}...")
            else:
                print(f"❌ Unexpected response: {data}")
                return False
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"   Response: {result.stdout[:300]}")
            return False
    except Exception as e:
        print(f"❌ Prompt generation error: {e}")
        return False
    
    # Test 4: Test different styles
    print("\n[TEST 4] Testing different styles...")
    styles_to_test = ["anime", "oil-painting", "digital-art"]
    for style in styles_to_test:
        try:
            payload = json.dumps({
                "idea": "a futuristic city",
                "style": style,
                "count": 1
            })
            
            result = subprocess.run(
                ["curl", "-s", "-X", "POST", f"{base_url}/api/imagegen/generate",
                 "-H", "Content-Type: application/json",
                 "-d", payload],
                capture_output=True,
                text=True,
                timeout=15
            )
            
            data = json.loads(result.stdout)
            if "prompts" in data and len(data['prompts']) > 0:
                print(f"   ✅ {style}: {data['prompts'][0][:60]}...")
            else:
                print(f"   ❌ {style}: Failed to generate")
        except Exception as e:
            print(f"   ❌ {style}: {e}")
    
    # Test 5: Test edge cases
    print("\n[TEST 5] Testing edge cases...")
    
    # Empty idea
    print("   Testing empty idea...")
    try:
        payload = json.dumps({
            "idea": "",
            "style": "realistic",
            "count": 1
        })
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", f"{base_url}/api/imagegen/generate",
             "-H", "Content-Type: application/json",
             "-d", payload],
            capture_output=True,
            text=True,
            timeout=10
        )
        data = json.loads(result.stdout)
        if result.returncode != 0 or "detail" in data:
            print("   ✅ Correctly rejects empty idea")
        else:
            print("   ❌ Should reject empty idea")
    except Exception as e:
        print(f"   ⚠️  Error: {e}")
    
    # Large count
    print("   Testing large count (should be clamped to 6)...")
    try:
        payload = json.dumps({
            "idea": "a test idea",
            "style": "realistic",
            "count": 20
        })
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", f"{base_url}/api/imagegen/generate",
             "-H", "Content-Type: application/json",
             "-d", payload],
            capture_output=True,
            text=True,
            timeout=15
        )
        data = json.loads(result.stdout)
        if len(data.get('prompts', [])) <= 6:
            print(f"   ✅ Count correctly clamped to {len(data['prompts'])}")
        else:
            print(f"   ❌ Count not clamped (got {len(data['prompts'])})")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Invalid style
    print("   Testing invalid style...")
    try:
        payload = json.dumps({
            "idea": "a test idea",
            "style": "invalid-style",
            "count": 1
        })
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", f"{base_url}/api/imagegen/generate",
             "-H", "Content-Type: application/json",
             "-d", payload],
            capture_output=True,
            text=True,
            timeout=15
        )
        data = json.loads(result.stdout)
        # Should default to realistic if invalid style given
        if "prompts" in data:
            print("   ✅ Handles invalid style gracefully (uses default)")
        else:
            print(f"   ⚠️  Unexpected response")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 70)
    print("✅ TEST SUITE COMPLETED SUCCESSFULLY")
    print("=" * 70)
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(test_image_prompt_generator())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Test interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
