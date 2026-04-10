#!/usr/bin/env python3
"""Comprehensive test of YouTube extraction pipeline."""

import sys
sys.path.insert(0, '/root/backend')

from utils.youtube import extractor

print("=" * 70)
print("COMPREHENSIVE YOUTUBE EXTRACTION TEST")
print("=" * 70)

test_cases = [
    ("https://www.youtube.com/watch?v=9eyFDBPk4Yw", "Admiral Grace Hopper (captions)"),
    ("https://www.youtube.com/watch?v=CYlO62ACQ5w", "TED Talk (auto-generated captions)"),
]

for video_url, description in test_cases:
    print(f"\n{'='*70}")
    print(f"Test: {description}")
    print(f"URL: {video_url}")
    print(f"{'='*70}")
    
    try:
        # Get metadata
        print("\n📋 Extracting metadata...")
        metadata = extractor.get_video_metadata(video_url)
        print(f"   ✅ Title: {metadata['title']}")
        print(f"   ✅ Channel: {metadata['channel']}")
        print(f"   ✅ Duration: {metadata['duration']}s")
        print(f"   ✅ Views: {metadata['view_count']:,}")
        
        # Get transcript
        print("\n📝 Extracting transcript...")
        transcript = extractor.get_transcript(video_url)
        
        if transcript:
            print(f"   ✅ Success! Got {len(transcript)} characters")
            print(f"\n   First 300 chars:")
            print(f"   {transcript[:300]}")
            
            # Format with highlights
            print(f"\n   Formatting highlights...")
            formatted = extractor.format_transcript_with_highlights(transcript)
            print(f"   ✅ Found {len(formatted['timestamps'])} timestamped segments")
            if formatted['timestamps']:
                print(f"      First highlight: {formatted['timestamps'][0]}")
        else:
            print(f"   ❌ No transcript found (video may not have captions)")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

print(f"\n{'='*70}")
print("TEST COMPLETE")
print(f"{'='*70}")
