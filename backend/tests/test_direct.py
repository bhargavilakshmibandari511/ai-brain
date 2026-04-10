import asyncio
import os
import sys

# Setup paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from utils.pdf_reader import PDFReader
import app_state
from services.vector_db import VectorDB
from services.ai_engine import AIEngine

async def test_direct():
    pdf_path = r"C:\Users\Amrutha\Downloads\ADSA_Unit_1.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"Error: PDF not found at {pdf_path}")
        return
        
    print(f"1. Testing PDF Reader on {pdf_path}")
    reader = PDFReader()
    try:
        text = await reader.extract_text(pdf_path)
        print(f"   Success! Extracted {len(text)} characters.")
        with open("test_output.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("   Wrote text to test_output.txt")
    except Exception as e:
        print(f"   Failed to extract text: {e}")
        import traceback
        traceback.print_exc()
        return

    print("2. Testing Chunking")
    chunks = reader.split_into_chunks(text)
    print(f"   Success! Created {len(chunks)} chunks.")

    print("3. Testing Vector DB Initialization")
    app_state.vector_db = VectorDB()
    app_state.ai_engine = AIEngine()
    try:
        await app_state.vector_db.initialize()
        print("   Success! Vector DB Initialized.")
    except Exception as e:
        print(f"   Failed to initialize Vector DB: {e}")
        import traceback
        traceback.print_exc()
        return
        
    print("4. Testing Document Addition to Vector DB")
    try:
        await app_state.vector_db.add_document(
            document_id="test-id-12345",
            chunks=chunks,
            metadata={"filename": "ADSA_Unit_1.pdf", "content_type": "application/pdf"},
            filename="ADSA_Unit_1.pdf"
        )
        print("   Success! Document added to vector db.")
    except Exception as e:
        print(f"   Failed to add document to vector db: {e}")
        import traceback
        traceback.print_exc()
        return

if __name__ == "__main__":
    asyncio.run(test_direct())
