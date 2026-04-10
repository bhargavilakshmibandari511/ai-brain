#!/usr/bin/env python3
"""Test fixed YouTube transcript extraction."""

import sys
sys.path.insert(0, '/root/backend')

from utils.youtube import YouTubeExtractor

# Test with TED Talk (guaranteed captions)
test_url = "https://www.youtube.com/watch?v=9eyFDBPk4Yw"  # TED: How great leaders inspire action

extractor = YouTubeExtractor()

print("=" * 60)
print("Testing YouTube Transcript Extraction")
print("=" * 60)

print(f"\n🎬 Video: {test_url}")

# Get metadata
print("\n📋 Fetching metadata...")
meta = extractor.get_video_metadata(test_url)
print(f"   Title: {meta['title']}")
print(f"   Channel: {meta['channel']}")
print(f"   Duration: {meta['duration']}s ({meta['duration']//60}m)")
print(f"   Views: {meta['view_count']:,}")

# Get transcript
print("\n📝 Fetching transcript...")
transcript = extractor.get_transcript(test_url)

if transcript:
    print("✅ Transcript Downloaded Successfully!")
    print("\n--- First 500 characters of transcript ---")
    print(transcript[:500])
    print(f"\n... ({len(transcript)} total characters)")
else:
    print("❌ Failed to download transcript")

print("\n" + "=" * 60)
