#!/usr/bin/env python
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health", timeout=5)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")
    return response.status_code == 200

def test_chat():
    """Test basic chat"""
    print("Testing basic chat...")
    payload = {"message": "Hello, how are you?"}
    response = requests.post(f"{BASE_URL}/api/chat/", json=payload, timeout=30)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response (first 200 chars): {str(data)[:200]}\n")
    return response.status_code == 200

def test_agent_mode():
    """Test chat with agent_mode"""
    print("Testing chat with agent mode (this may take 1-2 minutes)...")
    payload = {"message": "What is GitHub?", "agent_mode": True}
    response = requests.post(f"{BASE_URL}/api/chat/", json=payload, timeout=120)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response type: {type(data)}")
    if isinstance(data, dict):
        print(f"Keys: {data.keys()}")
        if 'response' in data:
            print(f"Response (first 300 chars): {str(data['response'])[:300]}")
        print(f"Full data (first 500 chars): {str(data)[:500]}\n")
    return response.status_code == 200

if __name__ == "__main__":
    try:
        health_ok = test_health()
        if health_ok:
            chat_ok = test_chat()
            agent_ok = test_agent_mode()
            
            print("\n" + "="*50)
            print("TEST RESULTS:")
            print(f"Health: {'OK' if health_ok else 'FAILED'}")
            print(f"Basic Chat: {'OK' if chat_ok else 'FAILED'}")
            print(f"Agent Mode: {'OK' if agent_ok else 'FAILED'}")
            print("="*50)
    except Exception as e:
        print(f"Error: {e}")
