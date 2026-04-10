#!/usr/bin/env python3
"""Test the backend API endpoint."""

import requests
import json

print("Testing Backend API Endpoint")
print("=" * 60)

# Test the /api/summarize/url endpoint
api_url = 'http://localhost:8000/api/summarize/url'
video_url = 'https://www.youtube.com/watch?v=9eyFDBPk4Yw'

print(f"📡 Calling: POST {api_url}")
print(f"🎬 Video: {video_url}")

try:
    response = requests.post(api_url, json={'url': video_url}, timeout=60)
    print(f"📊 Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ API Response Received!")
        print(f"\n🎬 Title: {data.get('title', 'N/A')}")
        print(f"👤 Channel: {data.get('channel', 'N/A')}")
        print(f"⏱️  Duration: {data.get('duration', 'N/A')}")
        print(f"\n📝 Brief Summary:")
        print(f"   {data.get('briefSummary', 'N/A')[:150]}...")
        
        if 'highlights' in data and data['highlights']:
            print(f"\n⭐ Highlights (first 3):")
            for h in data['highlights'][:3]:
                print(f"   {h.get('time')} - {h.get('text')[:80]}...")
    else:
        print(f"❌ Error: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
except requests.exceptions.ConnectionError:
    print("❌ Connection Error: Backend server not running")
    print("   Start the backend with: python main.py")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 60)
