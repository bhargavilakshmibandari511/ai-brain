import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000"

endpoints_to_test = [
    ("GET", "/health", None),
    ("GET", "/api/web-creator/projects", None),
    ("GET", "/api/documents", None),
    ("GET", "/api/dashboard/stats", None),
    ("GET", "/api/agents/status", None),
    ("GET", "/api/chat/history", None),
    ("GET", "/api/simulation/worlds", None),
]

def run_tests():
    print("=" * 50)
    print("STARTING E2E API AUDIT")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for method, path, data in endpoints_to_test:
        url = BASE_URL + path
        try:
            print(f"Testing {method} {path}...")
            start_time = time.time()
            if method == "GET":
                response = requests.get(url, timeout=5)
            elif method == "POST":
                response = requests.post(url, json=data, timeout=5)
                
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                print(f"  [PASS] ({response.status_code}) - {elapsed:.2f}s")
                passed += 1
            else:
                print(f"  [FAIL] ({response.status_code}) - {elapsed:.2f}s")
                try:
                    print(f"     Error output: {response.json()}")
                except:
                    print(f"     Error output: {response.text[:200]}")
                failed += 1
                
        except Exception as e:
            print(f"  [FAIL] (Exception) - {str(e)}")
            failed += 1
            
    print("=" * 50)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 50)
    
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
