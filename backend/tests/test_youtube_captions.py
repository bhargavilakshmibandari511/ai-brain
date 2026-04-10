#!/usr/bin/env python
import sys
sys.path.insert(0, '.')

print("Testing YouTube extractor with captions...")
try:
    from utils.youtube import extractor
    print("✓ YouTube module loaded")
    
    # Use a TED Talk which has captions
    url = "https://www.youtube.com/watch?v=ZXsQAXx_ao0"
    print(f"Testing URL: {url} (TED Talk)")
    
    print("\nFetching metadata...")
    meta = extractor.get_video_metadata(url)
    print(f"Title: {meta.get('title', 'N/A')}")
    print(f"Channel: {meta.get('channel', 'N/A')}")
    print(f"Duration: {meta.get('duration', 'N/A')} seconds")
    
    print("\nFetching transcript...")
    transcript = extractor.get_transcript(url)
    if transcript:
        print(f"✓ Transcript fetched successfully!")
        lines = transcript.split('\n')
        print(f"Total lines: {len(lines)}")
        print(f"\nFirst few lines:\n{chr(10).join(lines[:5])}")
    else:
        print("✗ No transcript found")
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
