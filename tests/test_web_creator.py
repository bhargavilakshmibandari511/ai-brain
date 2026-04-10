import requests
import json

print("Web Creator API Test Suite")
print("=" * 50)

# Step 1: Create a project
print("\n1. Creating a new project...")
project_payload = {
    'name': 'Test Website Project',
    'domain': 'test.local'
}
r = requests.post('http://localhost:8000/api/web-creator/projects', json=project_payload)
print(f'Status: {r.status_code}')
if r.status_code == 200:
    project = r.json()
    project_id = project['id']
    print(f'✅ Project created: {project_id}')
else:
    print(f'❌ Error: {r.text}')
    exit(1)

# Step 2: Test the generation endpoint
print(f"\n2. Generating page with prompt...")
gen_payload = {
    'prompt': 'Create a modern portfolio website for a software developer',
    'project_id': project_id,
    'style': 'modern',
    'color_scheme': 'dark'
}

r = requests.post('http://localhost:8000/api/web-creator/generate', json=gen_payload, timeout=30)
print(f'Status: {r.status_code}')

if r.status_code == 200:
    result = r.json()
    print(f'✅ Generation successful')
    print(f'\nResponse fields: {list(result.keys())}')
    
    # Check for required fields
    required_fields = ['html', 'css', 'js', 'style_tokens', 'thought_process', 'page_id']
    print(f'\nField validation:')
    for field in required_fields:
        if field in result:
            if isinstance(result[field], dict):
                print(f'  ✅ {field}: dict with {len(result[field])} keys')
            elif isinstance(result[field], list):
                print(f'  ✅ {field}: list with {len(result[field])} items')
            else:
                print(f'  ✅ {field}: {len(str(result[field]))} chars')
        else:
            print(f'  ❌ {field}: MISSING')
    
    # Show page ID if created
    if 'id' in result:
        page_id = result['id']
        print(f'\n✅ Page created: {page_id}')
        
        # Let's fetch the page and verify it has js and style_tokens
        print(f"\n3. Fetching page to verify persistence...")
        r_fetch = requests.get(f'http://localhost:8000/api/web-creator/pages/{page_id}')
        if r_fetch.status_code == 200:
            page = r_fetch.json()
            print(f'✅ Page retrieved')
            if 'js' in page and page['js']:
                print(f'  ✅ JS code saved: {len(page["js"])} chars')
            else:
                print(f'  ❌ JS code missing or empty')
            if 'style_tokens' in page and page['style_tokens']:
                print(f'  ✅ Style tokens saved: {page["style_tokens"]}')
            else:
                print(f'  ❌ Style tokens missing or empty')
        else:
            print(f'GetPage Error: {r_fetch.text}')
else:
    print(f'❌ Error: {r.text}')

