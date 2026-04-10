import requests
import time

API_BASE = "http://localhost:8000/api"

def test_ocr():
    print("Testing OCR API...")
    url = f"{API_BASE}/ocr/extract"
    files = {'file': open('ocr_test.png', 'rb')}
    data = {'lang': 'eng', 'mode': 'auto', 'psm': '3'}
    try:
        res = requests.post(url, files=files, data=data)
        print(f"OCR Status: {res.status_code}")
        print(f"OCR Result: {res.json()}")
    except Exception as e:
        print(f"OCR Test Failed: {e}")

def test_imagegen():
    print("\nTesting Image Generation API...")
    url = f"{API_BASE}/imagegen/generate"
    payload = {
        "prompt": "futuristic city, neon lights, high resolution",
        "steps": 10,
        "num_images": 1
    }
    try:
        res = requests.post(url, json=payload)
        print(f"ImageGen Start Status: {res.status_code}")
        job = res.json()
        job_id = job.get("job_id")
        print(f"Job ID: {job_id}")
        
        # Poll for status
        for _ in range(30):
            status_res = requests.get(f"{API_BASE}/imagegen/status/{job_id}")
            status_data = status_res.json()
            status = status_data.get("status")
            print(f"Current Status: {status} ({status_data.get('progress')}%)")
            
            if status == "done":
                print("Image Generation SUCCESS!")
                print(f"Images: {status_data.get('images')}")
                return
            if status == "error":
                print(f"Image Generation FAILED: {status_data.get('error')}")
                return
            time.sleep(2)
        print("Image Generation timed out.")
    except Exception as e:
        print(f"ImageGen Test Failed: {e}")

if __name__ == "__main__":
    # Ensure backend is running!
    test_ocr()
    test_imagegen()
