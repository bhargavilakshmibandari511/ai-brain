import os
import httpx
import logging
from typing import List

logger = logging.getLogger(__name__)

async def validate_environment():
    """
    Validate environment - Non-blocking, continues on failures.
    """
    print("\n[V] Validating Environment...")
    
    # 1. Create required directories
    required_dirs = [
        "./data/uploads",
        "./data/chromadb",
        "./data/sqlite",
        "./data/web_projects",
        "./data/bg_uploads",
        "./data/bg_outputs"
    ]
    for d in required_dirs:
        try:
            os.makedirs(d, exist_ok=True)
            print(f"✓ {d}")
        except Exception as e:
            print(f"⚠ {d}: {e}")

    # 2. Check Ollama (optional - warn but continue)
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ollama_url}/api/tags", timeout=2.0)
            if resp.status_code == 200:
                print(f"✓ Ollama connected ({ollama_url})")
            else:
                print(f"⚠ Ollama status {resp.status_code} - may not be fully ready")
    except Exception as e:
        print(f"⚠ Ollama unavailable at {ollama_url}")
        print("   (Backend will still work with fallback responses)")

    print("[DONE] Environment validation complete!\n")
