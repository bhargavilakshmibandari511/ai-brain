#!/usr/bin/env python
import sys
sys.path.insert(0, '.')

print("Testing YouTube extractor...")
try:
    from utils.youtube import extractor
    print("✓ YouTube module loaded")
    
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    print(f"Testing URL: {url}")
    
    print("\nFetching metadata...")
    meta = extractor.get_video_metadata(url)
    print(f"Title: {meta.get('title', 'N/A')}")
    print(f"Channel: {meta.get('channel', 'N/A')}")
    print(f"Duration: {meta.get('duration', 'N/A')} seconds")
    
    print("\nFetching transcript...")
    transcript = extractor.get_transcript(url)
    if transcript:
        print(f"✓ Transcript fetched ({len(transcript)} chars)")
        print(f"First 200 chars:\n{transcript[:200]}")
    else:
        print("✗ No transcript found")
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
