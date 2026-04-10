"""
Multimodal RAG — Combines VLM visual understanding with ChromaDB vector search.
Images are described by the VLM, embedded, and stored. Queries can include an image.
"""

import uuid
import logging
import chromadb
import app_state
from services.vlm_service import vlm_understand

logger = logging.getLogger(__name__)

# Reuse the existing ChromaDB client from app_state if available,
# otherwise create a local persistent client.
try:
    chroma = chromadb.PersistentClient(path="data/chromadb")
except Exception as e:
    logger.warning("ChromaDB init warning: %s", e)
    chroma = None

COLLECTION_NAME = "multimodal_docs"


def _get_collection():
    if chroma is None:
        raise RuntimeError("ChromaDB is not available")
    return chroma.get_or_create_collection(COLLECTION_NAME)


async def ingest_image(image_bytes: bytes, doc_id: str | None = None, metadata: dict = {}) -> dict:
    """
    Describe an image via VLM, then embed and store in ChromaDB.
    Returns the doc_id and the extracted description.
    """
    if doc_id is None:
        doc_id = str(uuid.uuid4())

    description = await vlm_understand(
        image_bytes,
        "Describe this image in detail. Extract any visible text. "
        "Identify objects, charts, diagrams, tables, or UI components. "
        "Be thorough and precise.",
        task="general",
    )

    collection = _get_collection()
    collection.add(
        documents=[description],
        ids=[doc_id],
        metadatas=[{**metadata, "type": "image", "has_visual": True}],
    )
    logger.info("Ingested image doc_id=%s (%d chars extracted)", doc_id, len(description))
    return {"doc_id": doc_id, "extracted_text": description}


async def multimodal_rag_query(
    query: str,
    image_bytes: bytes | None = None,
    n_results: int = 5,
) -> dict:
    """
    Answer a question by combining:
    1. Visual understanding of an optional uploaded image
    2. Vector search over previously ingested docs
    3. LLM synthesis of both contexts
    """
    # Step 1: understand the image if provided
    image_context = ""
    if image_bytes:
        image_context = await vlm_understand(image_bytes, query, task="general")

    # Step 2: vector search
    text_context = ""
    doc_sources = []
    try:
        collection = _get_collection()
        search_query = f"{query} {image_context}"[:500]
        results = collection.query(query_texts=[search_query], n_results=n_results)
        if results.get("documents"):
            text_context = "\n\n".join(results["documents"][0])
            doc_sources = results.get("metadatas", [[]])[0]
    except Exception as e:
        logger.warning("ChromaDB query failed: %s", e)

    # Step 3: synthesise with the LLM
    final_prompt = (
        "You are answering a question using both visual and document context.\n\n"
        f"Visual context (from uploaded image):\n{image_context or 'No image provided.'}\n\n"
        f"Relevant documents:\n{text_context or 'No matching documents found.'}\n\n"
        f"Question: {query}\n\n"
        "Answer thoroughly based on all available context."
    )

    answer = await app_state.ai_engine.chat(final_prompt)
    return {
        "answer": answer,
        "image_context": image_context,
        "doc_sources": doc_sources,
    }
