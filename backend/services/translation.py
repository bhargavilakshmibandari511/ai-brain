from __future__ import annotations

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# ── Thread pool for CPU-bound model inference ─────────────────────────────────
# MarianMT inference is synchronous — run in executor to avoid blocking FastAPI
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="translation")


# ─────────────────────────────────────────────────────────────────────────────
# LANGUAGE REGISTRY
# Maps ISO 639-1 codes → Helsinki-NLP model suffix codes
# (Helsinki uses different codes for some languages)
# ─────────────────────────────────────────────────────────────────────────────

# Language display names
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "it": "Italian",
    "nl": "Dutch",
    "pl": "Polish",
    "ru": "Russian",
    "ar": "Arabic",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "ms": "Malay",
    "sw": "Swahili",
    "fi": "Finnish",
    "sv": "Swedish",
    "no": "Norwegian",
    "da": "Danish",
    "cs": "Czech",
    "hu": "Hungarian",
    "ro": "Romanian",
    "bg": "Bulgarian",
    "hr": "Croatian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "uk": "Ukrainian",
    "el": "Greek",
    "he": "Hebrew",
    "fa": "Persian",
}

# Direct model pairs known to exist on Helsinki-NLP HuggingFace
# Format: "src-tgt" → HuggingFace model name
# Full list: https://huggingface.co/Helsinki-NLP
DIRECT_MODEL_MAP: dict[str, str] = {
    # English ↔ Indian languages
    "en-hi": "Helsinki-NLP/opus-mt-en-hi",
    "hi-en": "Helsinki-NLP/opus-mt-hi-en",
    "en-te": "Helsinki-NLP/opus-mt-en-te",
    "te-en": "Helsinki-NLP/opus-mt-te-en",
    "en-ta": "Helsinki-NLP/opus-mt-en-ta",
    "ta-en": "Helsinki-NLP/opus-mt-ta-en",
    "en-kn": "Helsinki-NLP/opus-mt-en-mul",   # multilingual fallback
    "en-ml": "Helsinki-NLP/opus-mt-en-mul",
    "en-mr": "Helsinki-NLP/opus-mt-en-mul",
    "en-bn": "Helsinki-NLP/opus-mt-en-bn",
    "bn-en": "Helsinki-NLP/opus-mt-bn-en",
    "en-ur": "Helsinki-NLP/opus-mt-en-ur",
    "ur-en": "Helsinki-NLP/opus-mt-ur-en",
    # English ↔ European
    "en-fr": "Helsinki-NLP/opus-mt-en-fr",
    "fr-en": "Helsinki-NLP/opus-mt-fr-en",
    "en-de": "Helsinki-NLP/opus-mt-en-de",
    "de-en": "Helsinki-NLP/opus-mt-de-en",
    "en-es": "Helsinki-NLP/opus-mt-en-es",
    "es-en": "Helsinki-NLP/opus-mt-es-en",
    "en-pt": "Helsinki-NLP/opus-mt-en-ROMANCE",
    "pt-en": "Helsinki-NLP/opus-mt-ROMANCE-en",
    "en-it": "Helsinki-NLP/opus-mt-en-it",
    "it-en": "Helsinki-NLP/opus-mt-it-en",
    "en-nl": "Helsinki-NLP/opus-mt-en-nl",
    "nl-en": "Helsinki-NLP/opus-mt-nl-en",
    "en-pl": "Helsinki-NLP/opus-mt-en-pl",
    "pl-en": "Helsinki-NLP/opus-mt-pl-en",
    "en-ru": "Helsinki-NLP/opus-mt-en-ru",
    "ru-en": "Helsinki-NLP/opus-mt-ru-en",
    "en-sv": "Helsinki-NLP/opus-mt-en-sv",
    "sv-en": "Helsinki-NLP/opus-mt-sv-en",
    "en-fi": "Helsinki-NLP/opus-mt-en-fi",
    "fi-en": "Helsinki-NLP/opus-mt-fi-en",
    "en-cs": "Helsinki-NLP/opus-mt-en-cs",
    "cs-en": "Helsinki-NLP/opus-mt-cs-en",
    "en-ro": "Helsinki-NLP/opus-mt-en-ro",
    "ro-en": "Helsinki-NLP/opus-mt-ro-en",
    "en-bg": "Helsinki-NLP/opus-mt-en-bg",
    "bg-en": "Helsinki-NLP/opus-mt-bg-en",
    "en-uk": "Helsinki-NLP/opus-mt-en-uk",
    "uk-en": "Helsinki-NLP/opus-mt-uk-en",
    "en-el": "Helsinki-NLP/opus-mt-en-el",
    "el-en": "Helsinki-NLP/opus-mt-el-en",
    "en-hu": "Helsinki-NLP/opus-mt-en-hu",
    "hu-en": "Helsinki-NLP/opus-mt-hu-en",
    # English ↔ Middle East / Asian
    "en-ar": "Helsinki-NLP/opus-mt-en-ar",
    "ar-en": "Helsinki-NLP/opus-mt-ar-en",
    "en-he": "Helsinki-NLP/opus-mt-en-he",
    "he-en": "Helsinki-NLP/opus-mt-he-en",
    "en-fa": "Helsinki-NLP/opus-mt-en-fa",
    "fa-en": "Helsinki-NLP/opus-mt-fa-en",
    "en-tr": "Helsinki-NLP/opus-mt-en-tr",
    "tr-en": "Helsinki-NLP/opus-mt-tr-en",
    "en-zh": "Helsinki-NLP/opus-mt-en-zh",
    "zh-en": "Helsinki-NLP/opus-mt-zh-en",
    "en-ja": "Helsinki-NLP/opus-mt-en-jap",
    "ja-en": "Helsinki-NLP/opus-mt-jap-en",
    "en-ko": "Helsinki-NLP/opus-mt-en-ko",
    "ko-en": "Helsinki-NLP/opus-mt-ko-en",
    "en-vi": "Helsinki-NLP/opus-mt-en-vi",
    "vi-en": "Helsinki-NLP/opus-mt-vi-en",
    "en-id": "Helsinki-NLP/opus-mt-en-id",
    "id-en": "Helsinki-NLP/opus-mt-id-en",
    "en-th": "Helsinki-NLP/opus-mt-en-th",
    "th-en": "Helsinki-NLP/opus-mt-th-en",
    # English ↔ African
    "en-sw": "Helsinki-NLP/opus-mt-en-sw",
    "sw-en": "Helsinki-NLP/opus-mt-sw-en",
    # Some direct non-English pairs
    "fr-de": "Helsinki-NLP/opus-mt-fr-de",
    "de-fr": "Helsinki-NLP/opus-mt-de-fr",
    "fr-es": "Helsinki-NLP/opus-mt-fr-es",
    "es-fr": "Helsinki-NLP/opus-mt-es-fr",
    "de-es": "Helsinki-NLP/opus-mt-de-es",
    "ru-fr": "Helsinki-NLP/opus-mt-ru-fr",
    "fr-ru": "Helsinki-NLP/opus-mt-fr-ru",
}


def _get_model_id(src: str, tgt: str) -> tuple[str, bool]:
    """
    Returns (model_id, is_pivot).
    is_pivot=True means we'll translate src→en→tgt (two hops).
    """
    key = f"{src}-{tgt}"
    if key in DIRECT_MODEL_MAP:
        return DIRECT_MODEL_MAP[key], False

    # Try pivot through English
    src_en = f"{src}-en"
    en_tgt = f"en-{tgt}"
    if src_en in DIRECT_MODEL_MAP and en_tgt in DIRECT_MODEL_MAP:
        return f"{src_en}+{en_tgt}", True

    # Last resort: multilingual model
    return "Helsinki-NLP/opus-mt-en-mul", False


# ─────────────────────────────────────────────────────────────────────────────
# MODEL CACHE
# Loaded models are kept in memory — never re-loaded for the same pair
# ─────────────────────────────────────────────────────────────────────────────

_model_cache: dict[str, tuple] = {}   # model_id → (tokenizer, model)
_cache_loading: set[str] = set()


def _load_model_sync(model_id: str) -> tuple:
    """Load tokenizer + model synchronously. Called from thread pool."""
    if model_id in _model_cache:
        return _model_cache[model_id]

    if model_id in _cache_loading:
        # Wait for concurrent load
        for _ in range(60):
            time.sleep(0.5)
            if model_id in _model_cache:
                return _model_cache[model_id]
        raise RuntimeError(f"Timed out waiting for model {model_id} to load")

    _cache_loading.add(model_id)
    try:
        from transformers import MarianMTModel, MarianTokenizer

        logger.info(f"Loading translation model: {model_id}")
        t0 = time.time()

        tokenizer = MarianTokenizer.from_pretrained(model_id)
        model     = MarianMTModel.from_pretrained(model_id)
        model.eval()   # inference mode — no gradient tracking

        _model_cache[model_id] = (tokenizer, model)
        logger.info(f"Model {model_id} loaded in {time.time()-t0:.1f}s")
        return tokenizer, model
    finally:
        _cache_loading.discard(model_id)


def _translate_sync(
    text: str,
    src: str,
    tgt: str,
    max_length: int = 512,
    num_beams: int = 4,
) -> dict:
    """
    Synchronous translation. Run this via executor, not directly in async code.
    Returns dict with translated text and metadata.
    """
    import torch

    if src == tgt:
        return {
            "text":         text,
            "src":          src,
            "tgt":          tgt,
            "model":        "passthrough",
            "pivot":        False,
            "duration_ms":  0,
        }

    model_key, is_pivot = _get_model_id(src, tgt)
    t0 = time.time()

    try:
        if is_pivot:
            # Two-hop: src → en → tgt
            src_en_key, en_tgt_key = model_key.split("+")
            src_en_model = DIRECT_MODEL_MAP[src_en_key]
            en_tgt_model = DIRECT_MODEL_MAP[en_tgt_key]

            # Step 1: src → English
            tok1, mdl1     = _load_model_sync(src_en_model)
            inputs1        = tok1(text, return_tensors="pt",
                                  padding=True, truncation=True,
                                  max_length=max_length)
            with torch.no_grad():
                translated1 = mdl1.generate(**inputs1, num_beams=num_beams,
                                            max_length=max_length)
            english_text = tok1.decode(translated1[0], skip_special_tokens=True)

            # Step 2: English → tgt
            tok2, mdl2  = _load_model_sync(en_tgt_model)
            inputs2     = tok2(english_text, return_tensors="pt",
                               padding=True, truncation=True,
                               max_length=max_length)
            with torch.no_grad():
                translated2 = mdl2.generate(**inputs2, num_beams=num_beams,
                                            max_length=max_length)
            final_text = tok2.decode(translated2[0], skip_special_tokens=True)

            model_used = f"{src_en_model} → {en_tgt_model}"

        else:
            # Direct translation
            tokenizer, model = _load_model_sync(model_key)
            inputs = tokenizer(text, return_tensors="pt",
                               padding=True, truncation=True,
                               max_length=max_length)
            with torch.no_grad():
                translated = model.generate(**inputs, num_beams=num_beams,
                                            max_length=max_length)
            final_text = tokenizer.decode(translated[0], skip_special_tokens=True)
            model_used = model_key

        return {
            "text":        final_text,
            "src":         src,
            "tgt":         tgt,
            "model":       model_used,
            "pivot":       is_pivot,
            "duration_ms": round((time.time() - t0) * 1000),
        }

    except Exception as e:
        logger.exception(f"Translation failed {src}→{tgt}")
        raise RuntimeError(f"Translation failed: {e}") from e


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ASYNC API
# ─────────────────────────────────────────────────────────────────────────────

async def translate(
    text:        str,
    src:         str = "en",
    tgt:         str = "hi",
    max_length:  int = 512,
    num_beams:   int = 4,
) -> dict:
    """
    Translate text from src language to tgt language.
    Runs model inference in a thread pool to avoid blocking the event loop.

    Args:
        text:       Text to translate
        src:        Source language ISO code (e.g. "en", "hi", "te")
        tgt:        Target language ISO code
        max_length: Max token length (longer texts are truncated)
        num_beams:  Beam search width (higher = better quality, slower)

    Returns:
        {
            text: str,          translated text
            src:  str,          source language code
            tgt:  str,          target language code
            model: str,         model(s) used
            pivot: bool,        True if routed through English
            duration_ms: int,
        }
    """
    src = src.lower().strip()
    tgt = tgt.lower().strip()

    if not text.strip():
        return {"text": "", "src": src, "tgt": tgt,
                "model": "none", "pivot": False, "duration_ms": 0}

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        _executor,
        lambda: _translate_sync(text, src, tgt, max_length, num_beams)
    )
    return result


async def translate_batch(
    texts:       list[str],
    src:         str = "en",
    tgt:         str = "hi",
    max_length:  int = 512,
) -> list[dict]:
    """
    Translate multiple texts with a single model load.
    More efficient than calling translate() in a loop.
    """
    if not texts:
        return []

    src = src.lower().strip()
    tgt = tgt.lower().strip()

    def _batch_sync():
        import torch
        model_key, is_pivot = _get_model_id(src, tgt)
        results = []
        t0 = time.time()

        if is_pivot:
            # For batch pivot, process each text individually
            for text in texts:
                results.append(_translate_sync(text, src, tgt, max_length))
            return results

        tokenizer, model = _load_model_sync(model_key)
        # Tokenize all at once
        inputs = tokenizer(texts, return_tensors="pt",
                           padding=True, truncation=True,
                           max_length=max_length)
        with torch.no_grad():
            translated = model.generate(**inputs, num_beams=2,
                                        max_length=max_length)

        duration_ms = round((time.time() - t0) * 1000)
        for i, output in enumerate(translated):
            results.append({
                "text":        tokenizer.decode(output, skip_special_tokens=True),
                "src":         src,
                "tgt":         tgt,
                "model":       model_key,
                "pivot":       False,
                "duration_ms": duration_ms,
            })
        return results

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, _batch_sync)


def get_supported_languages() -> list[dict]:
    """Return all languages with display names and available pair info."""
    return [
        {"code": code, "name": name}
        for code, name in sorted(LANGUAGE_NAMES.items(), key=lambda x: x[1])
    ]


def get_loaded_models() -> list[str]:
    """Return names of models currently in memory."""
    return list(_model_cache.keys())


def can_translate(src: str, tgt: str) -> dict:
    """Check if a language pair is supported and whether it needs a pivot."""
    model_key, is_pivot = _get_model_id(src, tgt)
    return {
        "supported": True,
        "pivot":     is_pivot,
        "model":     model_key,
        "src_name":  LANGUAGE_NAMES.get(src, src),
        "tgt_name":  LANGUAGE_NAMES.get(tgt, tgt),
    }


def preload_model(src: str, tgt: str) -> bool:
    """
    Pre-load a translation model into memory.
    Call this at startup for frequently used language pairs
    so the first user request isn't slow.
    """
    model_key, is_pivot = _get_model_id(src, tgt)
    try:
        if is_pivot:
            src_en, en_tgt = model_key.split("+")
            _load_model_sync(DIRECT_MODEL_MAP[src_en])
            _load_model_sync(DIRECT_MODEL_MAP[en_tgt])
        else:
            _load_model_sync(model_key)
        return True
    except Exception as e:
        logger.warning(f"Preload failed for {src}→{tgt}: {e}")
        return False
