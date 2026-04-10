#!/usr/bin/env python
import yt_dlp

url = "https://www.youtube.com/watch?v=ZXsQAXx_ao0"
print(f"Testing {url}")

ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'writesubtitles': True,
    'writeautomaticsub': True,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
    print(f"\nKeys in info dict: {list(info.keys())}")
    print(f"\nsubtitles: {info.get('subtitles', 'NOT FOUND')}")
    print(f"\nautomatic_captions: {info.get('automatic_captions', 'NOT FOUND')}")
    print(f"\nFormats: {len(info.get('formats', []))} available")
