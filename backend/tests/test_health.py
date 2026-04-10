import requests
import sys

print("Testing health...")
try:
    r = requests.get("http://localhost:8000/health", timeout=5)
    print("Status:", r.status_code)
    print("Body:", r.text[:100])
except Exception as e:
    print("Error:", str(e))

print("Testing projects...")
try:
    r = requests.get("http://localhost:8000/api/web-creator/projects", timeout=5)
    print("Status:", r.status_code)
    print("Body:", r.text[:100])
except Exception as e:
    print("Error:", str(e))
