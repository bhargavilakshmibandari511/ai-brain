import requests
import time
import os

# Use the specific image provided by the user in the artifacts directory
logo_path = r"C:\Users\Amrutha\.gemini\antigravity\brain\7f33d1e9-a912-4bce-ac70-0bffb043fa59\media__1773547965502.jpg"

url = "http://localhost:8000/api/background/advanced"

# Using the settings the user recommended, specifically for high transparency cutout
data = {
    'model': 'isnet-general-use',
    'quality': 'high', # Ensuring best extraction for logos
    'enhance_edges': 'true',
    'remove_spill': 'true',
    'enhance_details': 'true',
    'blur_edges': '0', # Sharp edges for a cutout
    'transparency_level': '255'
}

print(f"Testing background removal on: {logo_path}")
if not os.path.exists(logo_path):
    print("Error: Logo file not found at", logo_path)
    exit(1)

start = time.time()
with open(logo_path, "rb") as f:
    files = {'file': ('logo.jpg', f, 'image/jpeg')}
    response = requests.post(url, data=data, files=files)

print("Status:", response.status_code)
if response.status_code == 200:
    res_json = response.json()
    print("Success:", res_json)
    
    # Download the result
    result_url = "http://localhost:8000" + res_json['download_url']
    r2 = requests.get(result_url)
    if r2.status_code == 200:
        with open("pragati_cutout_result.png", "wb") as f2:
            f2.write(r2.content)
        print("Result saved as pragati_cutout_result.png")
else:
    print("Error:", response.text)
print(f"Time taken: {time.time() - start:.2f}s")

