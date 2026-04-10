import requests
import sys
import codecs

# Override stdout encoding
sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

url = "http://localhost:8000/api/summarize/translate"
payload = {
    "text": "Artificial Intelligence is transforming the future of work.",
    "target_language": "Spanish",
    "length": "Standard",
    "tone": "Neutral",
    "style": "Literal",
    "complexity": "Standard"
}

try:
    resp = requests.post(url, json=payload)
    print("STATUS:", resp.status_code)
    print("RESPONSE:", resp.json()["translation"])
except Exception as e:
    print("ERROR:", e)
