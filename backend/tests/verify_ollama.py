import ollama
import json

try:
    print("Attempting to list Ollama models...")
    result = ollama.list()
    print("Success!")
    print(f"Models found: {[m['name'] for m in result.get('models', [])] if isinstance(result, dict) else [m.model for m in result.models]}")
except Exception as e:
    print(f"Failed to connect to Ollama: {e}")

try:
    print("\nAttempting to chat with tinyllama...")
    response = ollama.chat(model='tinyllama', messages=[{'role': 'user', 'content': 'hi'}])
    print("Success!")
    print(f"Response: {response['message']['content']}")
except Exception as e:
    print(f"Failed to chat with Ollama: {e}")
