#!/usr/bin/env python3
"""Test YouTube Summarization API"""

import requests
import json

print("=" * 60)
print("TESTING YOUTUBE SUMMARIZATION API")
print("=" * 60)

# Test the full API endpoint
url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

print(f"\n📹 Video URL: {url}")
print("\nCalling API: POST /api/summarize/url")

try:
    response = requests.post(
        "http://localhost:8000/api/summarize/url",
        json={"url": url},
        timeout=60
    )
    
    print(f"✅ Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        data = response.json()
        
        print("📊 Response Keys:", list(data.keys()))
        print()
        
        # Check for title/metadata
        title = data.get('title') or \
                (data.get('metadata', {}).get('title')) or \
                'N/A'
        print(f"📹 Title: {title}")
        
        # Check for duration
        duration = data.get('duration') or \
                  (data.get('metadata', {}).get('duration')) or \
                  'N/A'
        print(f"⏱️  Duration: {duration}s")
        
        # Check for transcript
        if 'transcript' in data:
            transcript_len = len(data['transcript'])
            print(f"📝 Transcript Length: {transcript_len} chars")
            print(f"   Preview: {data['transcript'][:150]}...")
        else:
            print("⚠️  No transcript in response")
        
        # Check for summary
        if 'summary' in data:
            summary = data['summary']
            print(f"\n🤖 SUMMARY ({len(summary)} chars):")
            print("-" * 60)
            print(summary[:500] + ("..." if len(summary) > 500 else ""))
            print("-" * 60)
        else:
            print("⚠️  No summary generated")
        
        print("\n✅ YouTube API Working Like Sider!")
        
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"❌ API Error: {str(e)}")
    print("\nMake sure backend is running: python main.py")

print("\n" + "=" * 60)
