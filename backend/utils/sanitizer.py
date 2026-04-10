import re
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Common prompt injection patterns (V2.0.0 Roadmap Recommendation)
INJECTION_PATTERNS = [
    r"(?i)ignore\s+(?:previous|prev|all)\s+instructions",
    r"(?i)system\s+prompt",
    r"(?i)you\s+are\s+now",
    r"(?i)new\s+role",
    r"(?i)disregard\s+all",
    r"(?i)stop\s+being",
    r"(?i)become\s+a",
    r"(?i)u200b", # Zero-width space tricks
    r"(?i)\[system\s+message\]",
]

def sanitize_prompt(text: str) -> str:
    """
    Detect and block potential prompt injection attempts.
    Raises HTTPException 400 if a pattern is matched.
    """
    if not text:
        return ""
        
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text):
            logger.warning(f"🚨 Potential prompt injection detected: {pattern}")
            raise HTTPException(
                status_code=400, 
                detail="Security Alert: Potential prompt injection detected. Your request has been blocked for safety reasons."
            )
    
    return text
