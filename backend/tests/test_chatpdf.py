import requests
import time
import json
import uuid
import sys
import os

BASE_URL = "http://127.0.0.1:8000/api"
PDF_PATH = r"C:\Users\Amrutha\Downloads\ADSA_Unit_1.pdf"

if not os.path.exists(PDF_PATH):
    print(f"Could not find the PDF file at {PDF_PATH}")
    sys.exit(1)

def test_chatpdf():
    print(f"Uploading {PDF_PATH}...")
    with open(PDF_PATH, "rb") as f:
        files = {"file": ("ADSA_Unit_1.pdf", f, "application/pdf")}
        response = requests.post(f"{BASE_URL}/documents/upload", files=files)
    
    if response.status_code != 200:
        print(f"Upload failed: {response.text}")
        sys.exit(1)
        
    doc_data = response.json()
    doc_id = doc_data["id"]
    print(f"Uploaded! Document ID: {doc_id}")
    
    # Wait for processing
    print("Waiting for processing to complete...")
    max_retries = 30
    for i in range(max_retries):
        status_resp = requests.get(f"{BASE_URL}/documents/{doc_id}")
        if status_resp.status_code == 200:
            status_data = status_resp.json()
            status = status_data["status"]
            print(f"Status: {status}...")
            if status == "completed":
                print(f"Processing complete! Chunks: {status_data.get('chunks_count')}")
                break
            elif status == "error":
                print("Processing failed!")
                sys.exit(1)
        time.sleep(2)
    else:
        print("Timed out waiting for processing.")
        sys.exit(1)
        
    # Test Chat
    print("\nTesting chat endpoint...")
    chat_payload = {
        "user_id": "test_user",
        "document_id": doc_id,
        "message": "What is the main topic of this document?",
        "temperature": 0.3,
        "max_tokens": 1024,
        "max_context_chunks": 5
    }
    
    chat_resp = requests.post(f"{BASE_URL}/chat/document", json=chat_payload)
    if chat_resp.status_code == 200:
        result = chat_resp.json()
        print("\n--- AI Response ---")
        print(result["response"])
        print("\n--- Sources ---")
        for src in result.get("sources", []):
            print(f"- {src}")
        print("\nTest passed successfully!")
    else:
        print(f"Chat failed: {chat_resp.text}")
        sys.exit(1)

if __name__ == "__main__":
    test_chatpdf()
