import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from services.vector_db import EMBED_FN

def test_embeddings():
    print("Testing Embedding Function...")
    test_text = ["This is a test document for dimension verification."]
    embeddings = EMBED_FN(test_text)
    
    # SentenceTransformerEmbeddingFunction returns a list of embeddings
    dim = len(embeddings[0])
    print(f"Detected Dimensions: {dim}")
    
    if dim == 384:
        print("✅ SUCCESS: Embedding dimensions are 384 (all-MiniLM-L6-v2)")
    else:
        print(f"❌ FAILURE: Expected 384 dimensions, got {dim}")

if __name__ == "__main__":
    try:
        test_embeddings()
    except Exception as e:
        print(f"❌ ERROR: {e}")
