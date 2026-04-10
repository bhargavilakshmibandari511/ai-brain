"""
Summarize API routes — web pages, YouTube videos, and pasted text.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import socket

import app_state

logger = logging.getLogger(__name__)
router = APIRouter()


class SummarizeRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    mode: str = "general"     # "url" | "youtube" | "file" | "general"
    language: Optional[str] = None
    force_mode: Optional[str] = None  # "online" | "offline" | None (auto)


class TranslateRequest(BaseModel):
    text: str
    target_language: str = "Spanish"
    length: Optional[str] = "Standard"
    tone: Optional[str] = "Neutral"
    style: Optional[str] = "Dynamic Equivalence"
    complexity: Optional[str] = "Standard"
    force_mode: Optional[str] = None  # "online" | "offline" | None (auto)


class WriteRequest(BaseModel):
    text: str
    style: str = "professional"   # professional | casual | concise | formal
    force_mode: Optional[str] = None  # "online" | "offline" | None (auto)
    api_key: Optional[str] = None


# ── helpers ──────────────────────────────────────────────────────────────────

def _scrape_url(url: str) -> str:
    """Scrape plain text from a URL using requests + BeautifulSoup"""
    try:
        import requests
        from bs4 import BeautifulSoup
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, timeout=10, headers=headers)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove scripts/styles
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)[:8000]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}")


def _extract_youtube_info(url: str) -> str:
    """Extract YouTube video description and title using yt-dlp"""
    try:
        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get("title", "")
            description = info.get("description", "")[:4000]
            uploader = info.get("uploader", "")
            duration = info.get("duration_string", "")
            return (
                f"Title: {title}\n"
                f"Channel: {uploader}\n"
                f"Duration: {duration}\n\n"
                f"Description:\n{description}"
            )
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="yt-dlp not installed. Run: pip install yt-dlp"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch YouTube info: {e}")


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/url")
async def summarize_url(req: SummarizeRequest):
    """Scrape and summarize a web page URL.
    
    For YouTube URLs, returns structured data:
    {
        "title": "...",
        "channel": "...",
        "duration": "...",
        "briefSummary": "2-3 sentence summary",
        "fullSummary": "detailed summary",
        "highlights": [
            {"time": "00:15", "seconds": 15, "text": "..."},
            ...
        ],
        "suggestedQuestions": [...]
    }
    """
    if not req.url:
        raise HTTPException(status_code=400, detail="url is required")

    # Auto-detect YouTube
    is_youtube = "youtube.com" in req.url or "youtu.be" in req.url
    
    if is_youtube:
        try:
            from utils.youtube import extractor
            
            # Extract metadata and transcript
            metadata = extractor.get_video_metadata(req.url)
            transcript = extractor.get_transcript(req.url)
            
            # If no transcript, use description
            content_to_summarize = transcript if transcript else metadata.get('description', '')
            
            if not content_to_summarize:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract transcript or description from video"
                )
            
            # Generate summaries
            full_summary = await app_state.ai_engine.summarize(content_to_summarize, mode="youtube")
            
            # Extract brief summary (first 2-3 sentences)
            sentences = full_summary.split('. ')
            brief_summary = '. '.join(sentences[:2]) + '.' if len(sentences) > 1 else full_summary
            
            # Parse highlights with timestamps
            highlights = []
            if transcript:
                formatted = extractor.format_transcript_with_highlights(transcript)
                highlights = formatted.get('timestamps', [])[:5]  # Top 5 highlights
            
            # Generate suggested questions
            questions_prompt = f"""Based on this video summary, generate 4 thought-provoking questions that viewers might want to ask:

Video: {metadata.get('title', 'Untitled')}
Summary: {brief_summary}

Generate questions in JSON format: {{"questions": ["Q1?", "Q2?", "Q3?", "Q4?"]}}
"""
            try:
                questions_response = await app_state.ai_engine.chat(questions_prompt)
                # Parse JSON response
                import json
                import re
                json_match = re.search(r'\{.*"questions".*\}', questions_response, re.DOTALL)
                if json_match:
                    questions_data = json.loads(json_match.group())
                    questions = questions_data.get('questions', [])[:4]
                else:
                    questions = [
                        "What are the key takeaways from this video?",
                        "How does this topic relate to current trends?",
                        "What questions remain unanswered?",
                        "How can this knowledge be applied?"
                    ]
            except:
                questions = [
                    "What are the key takeaways from this video?",
                    "How does this topic relate to current trends?",
                    "What questions remain unanswered?",
                    "How can this knowledge be applied?"
                ]
            
            # Format duration
            duration_seconds = metadata.get('duration', 0)
            if duration_seconds:
                mins = duration_seconds // 60
                secs = duration_seconds % 60
                duration_str = f"{mins}:{secs:02d}"
            else:
                duration_str = "Unknown"
            
            return {
                "title": metadata.get('title', 'YouTube Video'),
                "channel": metadata.get('channel', 'Unknown'),
                "duration": duration_str,
                "briefSummary": brief_summary,
                "fullSummary": full_summary,
                "highlights": highlights,
                "suggestedQuestions": questions,
                "videoUrl": req.url,
                "mode": "youtube",
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"YouTube summarization failed: {e}")
            raise HTTPException(status_code=400, detail=f"YouTube summarization failed: {str(e)}")
    
    else:
        # Regular URL scraping
        content = _scrape_url(req.url)
        summary = await app_state.ai_engine.summarize(content, mode="url")
        return {
            "summary": summary,
            "mode": "url",
            "url": req.url
        }


@router.post("/text")
async def summarize_text(req: SummarizeRequest):
    """Summarize pasted text or extracted file content"""
    if not req.text:
        raise HTTPException(status_code=400, detail="text is required")

    summary = await app_state.ai_engine.summarize(req.text, mode=req.mode)
    return {"summary": summary, "mode": req.mode}


@router.post("/translate")
async def translate_text(req: TranslateRequest):
    """Translate text. force_mode='online' uses only online engines, 'offline' skips online."""
    
    # Map language names to ISO codes
    lang_code_map = {
        "english": "en", "hindi": "hi", "bengali": "bn", "spanish": "es",
        "french": "fr", "german": "de", "chinese": "zh", "japanese": "ja",
        "korean": "ko", "arabic": "ar", "russian": "ru", "portuguese": "pt",
        "italian": "it", "dutch": "nl", "turkish": "tr", "thai": "th",
        "vietnamese": "vi", "indonesian": "id", "malay": "ms", "polish": "pl",
        "urdu": "ur", "telugu": "te", "tamil": "ta", "kannada": "kn",
        "malayalam": "ml", "marathi": "mr",
    }
    
    target_code = lang_code_map.get(req.target_language.lower())
    
    # Decide whether to try online engines
    use_online = False
    if req.force_mode == "online":
        use_online = True
    elif req.force_mode == "offline":
        use_online = False
    else:
        # Auto mode: check internet
        use_online = _check_internet()
    
    is_online = _check_internet() if req.force_mode != "offline" else False
    
    # ── Strategy 1: Online → Google Translate (free, accurate) ──
    if use_online and target_code:
        try:
            from deep_translator import GoogleTranslator
            translated = GoogleTranslator(source='auto', target=target_code).translate(req.text)
            if translated:
                return {
                    "translation": translated,
                    "target_language": req.target_language,
                    "engine": "google",
                    "connectivity": "online",
                    "mode": req.force_mode or "auto",
                }
        except Exception as e:
            logger.warning(f"Google Translate failed: {e}, falling back to offline")
            # If user explicitly chose online, report the error
            if req.force_mode == "online":
                raise HTTPException(status_code=502, detail=f"Online translation failed: {e}")
    
    # ── Strategy 2: Offline → Argos NMT (accurate offline model) ──
    if target_code:
        try:
            import argostranslate.translate
            installed = argostranslate.translate.get_installed_languages()
            
            source_lang = None
            target_lang = None
            for lang in installed:
                if lang.code == "en":
                    source_lang = lang
                if lang.code == target_code:
                    target_lang = lang
            
            if source_lang and target_lang:
                translation_obj = source_lang.get_translation(target_lang)
                if translation_obj:
                    result = translation_obj.translate(req.text)
                    return {
                        "translation": result,
                        "target_language": req.target_language,
                        "engine": "argos",
                        "connectivity": "online" if is_online else "offline",
                        "mode": req.force_mode or "auto",
                    }
        except Exception as e:
            logger.warning(f"Argos translate error: {e}, falling back to LLM")
    
    # ── Strategy 3: Offline → Local LLM via Ollama ──
    preferences = {
        "length": req.length,
        "tone": req.tone,
        "style": req.style,
        "complexity": req.complexity,
    }
    result = await app_state.ai_engine.translate(req.text, req.target_language, preferences)
    return {
        "translation": result,
        "target_language": req.target_language,
        "engine": "llm",
        "connectivity": "online" if is_online else "offline",
        "mode": req.force_mode or "auto",
    }


@router.get("/connectivity")
async def check_connectivity():
    """Check if the server has internet access"""
    online = _check_internet()
    return {"online": online}


def _check_internet(host: str = "8.8.8.8", port: int = 53, timeout: float = 3) -> bool:
    """Quick connectivity check via DNS"""
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        return True
    except OSError:
        return False


@router.post("/write")
async def improve_writing(req: WriteRequest):
    """Improve or rewrite text in a given style"""
    result = await app_state.ai_engine.improve_writing(req.text, req.style)
    return {"result": result, "style": req.style}
