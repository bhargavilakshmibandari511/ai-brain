import requests
import json
import time

API = "http://localhost:8000"

def test_web_creator():
    print("Testing Web Creator...")
    res = requests.get(f"{API}/api/web-creator/projects")
    if res.status_code == 200:
        print("OK Web Creator /projects GET - OK")
    else:
        print(f"FAIL Web Creator /projects GET - Failed ({res.status_code}): {res.text}")

def test_web_researcher():
    print("Testing Web Researcher...")
    payload = {
        "agent_name": "Orchestrator Agent",
        "query": "Impact of AI on healthcare",
        "task_type": "research"
    }
    try:
        res = requests.post(f"{API}/api/agents/execute", params=payload, timeout=30)
        if res.status_code == 200:
            print("OK Web Researcher /agents/execute POST - OK")
            data = res.json()
            if data.get("success"):
                print(f"   Success! Confidence: {data.get('confidence')}")
            else:
                print(f"   Agent returned success=False: {data}")
        else:
            print(f"FAIL Web Researcher /agents/execute POST - Failed ({res.status_code}): {res.text}")
    except requests.exceptions.Timeout:
         print("FAIL Web Researcher /agents/execute POST - Timeout")
    except Exception as e:
         print(f"FAIL Web Researcher /agents/execute POST - Exception: {e}")

if __name__ == "__main__":
    test_web_creator()
    test_web_researcher()
