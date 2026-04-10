"""
YouTube utilities for transcript extraction and metadata.
Requires: yt-dlp, pytesseract, pdf2image, ffmpeg
"""

import json
import logging
from typing import Optional
import yt_dlp
import urllib.request
from xml.etree import ElementTree

logger = logging.getLogger(__name__)


class YouTubeExtractor:
    """Extract transcript, metadata, and subtitles from YouTube videos."""

    def __init__(self):
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'postprocessors': [],  # Don't convert subtitles
        }

    def get_video_metadata(self, url: str) -> dict:
        """
        Extract video metadata (title, duration, channel, etc.)
        Returns: {'title', 'duration', 'channel', 'uploader_date', 'view_count'}
        """
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'title': info.get('title', 'Untitled'),
                    'duration': info.get('duration', 0),  # seconds
                    'channel': info.get('uploader', 'Unknown'),
                    'uploader_date': info.get('upload_date', ''),
                    'view_count': info.get('view_count', 0),
                    'description': info.get('description', '')[:500],  # First 500 chars
                    'thumbnail': info.get('thumbnail', ''),
                }
        except Exception as e:
            logger.error(f"Error extracting metadata from {url}: {e}")
            return {
                'title': 'YouTube Video',
                'duration': 0,
                'channel': 'Unknown',
                'uploader_date': '',
                'view_count': 0,
                'description': '',
                'thumbnail': '',
            }

    def get_transcript(self, url: str) -> Optional[str]:
        """
        Extract transcript from YouTube video.
        Returns transcript text with timestamps or None if unavailable.
        """
        try:
            from yt_dlp.extractor.youtube import YoutubeBaseInfoExtractor
            
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Try to get captions/subtitles
                if 'subtitles' in info and info['subtitles']:
                    # Prefer English subtitles
                    for lang in ['en', 'en-US', 'en-GB']:
                        if lang in info['subtitles']:
                            subs = info['subtitles'][lang]
                            transcript = self._parse_subtitles(subs)
                            if transcript:
                                return transcript
                    
                    # Fall back to first available language
                    first_lang = next(iter(info['subtitles']))
                    subs = info['subtitles'][first_lang]
                    transcript = self._parse_subtitles(subs)
                    if transcript:
                        return transcript
                
                # Try automatic captions if manual subtitles not available
                if 'automatic_captions' in info and info['automatic_captions']:
                    for lang in ['en', 'en-US', 'en-GB']:
                        if lang in info['automatic_captions']:
                            subs = info['automatic_captions'][lang]
                            transcript = self._parse_subtitles(subs)
                            if transcript:
                                return transcript
                    
                    # Fall back to first available language
                    first_lang = next(iter(info['automatic_captions']))
                    subs = info['automatic_captions'][first_lang]
                    transcript = self._parse_subtitles(subs)
                    if transcript:
                        return transcript
                
                logger.warning(f"No captions found for {url}")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting transcript from {url}: {e}")
            return None

    def _parse_subtitles(self, subs: list) -> Optional[str]:
        """
        Parse subtitles from yt-dlp format (list of dicts with 'url' and 'ext').
        Downloads and parses the subtitle file (json3, vtt, srt formats).
        Returns formatted transcript: "00:15 - text\n00:30 - text\n..."
        """
        if not subs or not isinstance(subs, list):
            return None
            
        try:
            # Find best format: json3 > vtt > srt
            best_sub = None
            format_priority = {'json3': 0, 'vtt': 1, 'srt': 2}
            
            for sub in subs:
                if isinstance(sub, dict) and 'url' in sub and 'ext' in sub:
                    fmt = sub.get('ext', '')
                    if fmt in format_priority:
                        if best_sub is None or format_priority[fmt] < format_priority.get(best_sub.get('ext'), 999):
                            best_sub = sub
            
            if not best_sub:
                logger.warning("No suitable subtitle format found")
                return None
            
            url = best_sub.get('url', '')
            ext = best_sub.get('ext', '')
            
            # Download subtitle content
            caption_content = self._download_subtitle(url)
            if not caption_content:
                return None
            
            # Parse based on format
            if ext == 'json3':
                return self._parse_json3_captions(caption_content)
            elif ext in ['vtt', 'srt']:
                return self._parse_vtt_srt_captions(caption_content)
            else:
                logger.warning(f"Unknown subtitle format: {ext}")
                return None
                
        except Exception as e:
            logger.error(f"Error parsing subtitles: {e}")
            return None
    
    def _download_subtitle(self, url: str) -> Optional[str]:
        """Download subtitle file from URL."""
        try:
            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read().decode('utf-8')
        except Exception as e:
            logger.error(f"Error downloading subtitle from {url}: {e}")
            return None
    
    def _parse_json3_captions(self, content: str) -> Optional[str]:
        """Parse JSON3 format captions (YouTube's internal format)."""
        try:
            data = json.loads(content)
            transcript_lines = []
            
            events = data.get('events', [])
            for event in events:
                start = event.get('tStartMs', 0) / 1000.0  # Convert ms to seconds
                text_parts = event.get('segs', [])
                text = ''.join(seg.get('utf8', '') for seg in text_parts).strip()
                
                if text:
                    timestamp = self._seconds_to_timestamp(start)
                    transcript_lines.append(f"{timestamp} - {text}")
            
            return '\n'.join(transcript_lines) if transcript_lines else None
        except Exception as e:
            logger.error(f"Error parsing JSON3 captions: {e}")
            return None
    
    def _parse_vtt_srt_captions(self, content: str) -> Optional[str]:
        """Parse VTT or SRT format captions."""
        try:
            lines = content.strip().split('\n')
            transcript_lines = []
            current_time = None
            
            for line in lines:
                line = line.strip()
                # VTT/SRT timestamp format: 00:15:30.500 --> 00:15:35.000 or 00:15:30,500 --> 00:15:35,000
                if '-->' in line:
                    # Extract start time
                    time_part = line.split('-->')[0].strip()
                    # Convert HH:MM:SS.mmm or HH:MM:SS,mmm to seconds
                    time_part = time_part.replace(',', '.')
                    parts = time_part.split(':')
                    if len(parts) >= 3:
                        try:
                            hours = int(parts[0])
                            minutes = int(parts[1])
                            seconds = float(parts[2])
                            total_seconds = hours * 3600 + minutes * 60 + seconds
                            current_time = self._seconds_to_timestamp(total_seconds)
                        except (ValueError, IndexError):
                            pass
                elif line and current_time and not line.isdigit() and line != 'WEBVTT':
                    # This is caption text
                    transcript_lines.append(f"{current_time} - {line}")
            
            return '\n'.join(transcript_lines) if transcript_lines else None
        except Exception as e:
            logger.error(f"Error parsing VTT/SRT captions: {e}")
            return None

    @staticmethod
    def _seconds_to_timestamp(seconds: float) -> str:
        """Convert seconds to MM:SS or HH:MM:SS format."""
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            return f"{minutes:02d}:{secs:02d}"

    def format_transcript_with_highlights(self, transcript: str) -> dict:
        """
        Parse transcript and extract highlight timestamps.
        Returns:
            {
                'full_text': entire transcript,
                'timestamps': [
                    {'time': '00:15', 'seconds': 15, 'text': 'Opening statement...'},
                    ...
                ],
                'text_chunks': [text chunks for embedding]
            }
        """
        lines = transcript.split('\n')
        timestamps = []
        text_chunks = []
        
        for line in lines:
            if ' - ' in line:
                try:
                    time_part, text_part = line.split(' - ', 1)
                    time_part = time_part.strip()
                    text_part = text_part.strip()
                    
                    # Convert to seconds
                    parts = time_part.split(':')
                    if len(parts) == 3:
                        seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                    else:
                        seconds = int(parts[0]) * 60 + int(parts[1])
                    
                    timestamps.append({
                        'time': time_part,
                        'seconds': seconds,
                        'text': text_part
                    })
                    text_chunks.append(text_part)
                except ValueError:
                    continue
        
        return {
            'full_text': transcript,
            'timestamps': timestamps,
            'text_chunks': text_chunks,
        }


# Global instance
extractor = YouTubeExtractor()


def get_youtube_transcript(url: str) -> Optional[str]:
    """Convenience function to extract transcript."""
    return extractor.get_transcript(url)


def get_youtube_metadata(url: str) -> dict:
    """Convenience function to extract metadata."""
    return extractor.get_video_metadata(url)


def format_youtube_data(url: str) -> dict:
    """Extract all YouTube data (metadata + transcript)."""
    metadata = extractor.get_video_metadata(url)
    transcript = extractor.get_transcript(url)
    
    formatted = None
    if transcript:
        formatted = extractor.format_transcript_with_highlights(transcript)
    
    return {
        'metadata': metadata,
        'transcript': transcript,
        'formatted_transcript': formatted,
    }
