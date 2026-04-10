import requests
import sys

def test_translation(text, target, *prefs):
    url = "http://localhost:8000/api/summarize/translate"
    payload = {
        "text": text,
        "target_language": target,
        "length": prefs[0] if len(prefs) > 0 else "Standard",
        "tone": prefs[1] if len(prefs) > 1 else "Neutral",
        "style": prefs[2] if len(prefs) > 2 else "Dynamic Equivalence",
        "complexity": prefs[3] if len(prefs) > 3 else "Standard"
    }
    print(f"\n--- Testing translation to {target} ---")
    print(f"INPUT:  {text}")
    try:
        resp = requests.post(url, json=payload)
        data = resp.json()
        print(f"OUTPUT: {data['translation']}")
    except Exception as e:
        print(f"ERROR:  {e}")

test_translation("Hello, how are you today?", "Spanish")
test_translation("Programming is a fun activity that requires logical thinking.", "French")
test_translation("What is the weather like in New York? I need to know if I should bring a jacket.", "German")
