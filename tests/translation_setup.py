import requests
import json

def test_translation():
    url = "http://localhost:8000/api/translate/"
    
    print("Testing Translation...")
    
    # 1. English to Hindi
    payload = {
        "text": "Hello, how are you?",
        "src": "en",
        "tgt": "hi"
    }
    print("Sending EN -> HI request (this may trigger a download on first run)...")
    try:
        r = requests.post(url, json=payload, timeout=60)
        r.raise_for_status()
        res = r.json()
        print(f"[OK] EN -> HI: {res['text']}")
    except Exception as e:
        print(f"[FAIL] EN -> HI: {e}")

    # 2. Hindi to English
    payload = {
        "text": "नमस्ते, आप कैसे हैं?",
        "src": "hi",
        "tgt": "en"
    }
    try:
        r = requests.post(url, json=payload, timeout=60)
        r.raise_for_status()
        res = r.json()
        print(f"[OK] HI -> EN: {res['text']}")
    except Exception as e:
        print(f"[FAIL] HI -> EN: {e}")

if __name__ == "__main__":
    test_translation()
