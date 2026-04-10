"""
vector_db.py  Advanced Vector Database Service
================================================
Features:
  - Lazy-loaded all-MiniLM-L6-v2 embeddings (384D)
  - ChromaDB persistent local storage
  - Hybrid search: BM25 (keyword) + Semantic (cosine) via Reciprocal Rank Fusion
  - 5-minute TTL query cache
  - Per-document filtering to prevent cross-talk
  - Overlapping chunking (20% overlap) for better context continuity
  - Health check with latency reporting
"""

import os
import time
import logging
import hashlib
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

import chromadb
from chromadb.config import Settings as ChromaSettings

logger = logging.getLogger(__name__)

#  Constants 

CHROMA_PATH       = os.getenv("VECTOR_DB_PATH", "./data/chromadb")
COLLECTION_NAME   = "advanced_rag_v2"
EMBED_MODEL       = "all-MiniLM-L6-v2"
CHUNK_SIZE        = 512          # words per chunk
CHUNK_OVERLAP     = 102          # ~20% overlap
TOP_K             = 5            # default similarity results
SIMILARITY_THRESH = 0.15         # minimum cosine similarity for retrieval
CACHE_TTL         = 300          # seconds (5 min)
CACHE_MAX         = 256          # max cached queries
RRF_K             = 60           # Reciprocal Rank Fusion constant


#  TTL Cache 

class TTLCache:
    """Thread-safe LRU cache with per-entry TTL expiry."""

    def __init__(self, maxsize: int = CACHE_MAX, ttl: int = CACHE_TTL):
        self._store: OrderedDict[str, tuple[any, float]] = OrderedDict()
        self.maxsize = maxsize
        self.ttl = ttl

    def _key(self, query: str, doc_id: Optional[str], limit: int) -> str:
        raw = f"{query}|{doc_id}|{limit}"
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, query: str, doc_id: Optional[str], limit: int):
        k = self._key(query, doc_id, limit)
        if k not in self._store:
            return None
        value, ts = self._store[k]
        if time.time() - ts > self.ttl:
            del self._store[k]
            return None
        self._store.move_to_end(k)
        return value

    def set(self, query: str, doc_id: Optional[str], limit: int, value):
        k = self._key(query, doc_id, limit)
        if k in self._store:
            self._store.move_to_end(k)
        self._store[k] = (value, time.time())
        while len(self._store) > self.maxsize:
            self._store.popitem(last=False)

    def invalidate_doc(self, doc_id: str):
        """Remove all cached entries for a given document."""
        to_del = [k for k, (v, _) in self._store.items()
                  if isinstance(v, list) and any(
                      r.get("metadata", {}).get("doc_id") == doc_id for r in v
                  )]
        for k in to_del:
            del self._store[k]

    def clear(self):
        self._store.clear()


#  BM25 Index 

class BM25Index:
    """
    Lightweight BM25 keyword index maintained in-memory,
    keyed by ChromaDB chunk IDs.
    """

    def __init__(self):
        self._corpus: list[list[str]] = []   # tokenised docs
        self._ids: list[str]           = []   # matching chunk IDs
        self._model = None                    # rank_bm25.BM25Okapi instance
        self._dirty = True

    def _tokenize(self, text: str) -> list[str]:
        return text.lower().split()

    def add(self, chunk_id: str, text: str):
        self._ids.append(chunk_id)
        self._corpus.append(self._tokenize(text))
        self._dirty = True

    def remove_doc(self, doc_id: str, all_ids: list[str]):
        """Remove all chunks belonging to a document."""
        remove = set(all_ids)
        keep = [(i, c) for i, (i_id, c) in enumerate(zip(self._ids, self._corpus))
                if i_id not in remove]
        if keep:
            indices, corpora = zip(*keep)
            self._ids = list(indices)      # type: ignore[assignment]
            self._corpus = list(corpora)   # type: ignore[assignment]
        else:
            self._ids, self._corpus = [], []
        self._dirty = True

    def _rebuild(self):
        if not self._corpus:
            self._model = None
            self._dirty = False
            return
        try:
            from rank_bm25 import BM25Okapi
            self._model = BM25Okapi(self._corpus)
        except ImportError:
            logger.warning("rank_bm25 not installed  BM25 disabled. pip install rank-bm25")
            self._model = None
        self._dirty = False

    def search(self, query: str, top_k: int = TOP_K) -> list[str]:
        """Return ordered list of chunk IDs by BM25 score."""
        if self._dirty:
            self._rebuild()
        if self._model is None or not self._ids:
            return []
        tokens = self._tokenize(query)
        scores = self._model.get_scores(tokens)
        ranked = sorted(zip(self._ids, scores), key=lambda x: x[1], reverse=True)
        return [chunk_id for chunk_id, score in ranked[:top_k] if score > 0]


#  Chunker 

def chunk_text(text: str,
               chunk_size: int = CHUNK_SIZE,
               overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split text into overlapping word-level chunks.
    20% overlap prevents context loss at boundaries.
    """
    words = text.split()
    if not words:
        return []
    chunks, start = [], 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


#  Result dataclass 

@dataclass
class SearchResult:
    chunk_id:   str
    text:       str
    doc_id:     str
    doc_name:   str
    page:       int
    score:      float
    source:     str = "hybrid"   # "semantic" | "bm25" | "hybrid"

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "text":     self.text,
            "doc_id":   self.doc_id,
            "doc_name": self.doc_name,
            "page":     self.page,
            "score":    round(self.score, 4),
            "source":   self.source,
        }


#  Main Service 

class VectorDBService:

    def __init__(self):
        self.client: Optional[chromadb.ClientAPI] = None
        self.collection = None
        self._embed_fn  = None          # lazy-loaded
        self._bm25      = BM25Index()
        self._cache     = TTLCache()
        self._executor  = ThreadPoolExecutor(max_workers=2)
        self.is_initialized = False

    #  Initialisation 

    async def initialize(self):
        """Connect to ChromaDB and warm the embedding model in background."""
        os.makedirs(CHROMA_PATH, exist_ok=True)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, self._init_chroma)
        # Rebuild BM25 index from persistent storage
        await self._rebuild_bm25()
        # Warm embeddings in background
        asyncio.create_task(self._warm_embeddings())
        self.is_initialized = True
        logger.info("VectorDB initialised  collection: %s", COLLECTION_NAME)

    def _init_chroma(self):
        self.client = chromadb.PersistentClient(
            path=CHROMA_PATH,
            settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
        )
        # Collection created without embedding function so we inject manually
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("ChromaDB ready — %d chunks on disk", self.collection.count())

    async def _rebuild_bm25(self):
        """Recover the keyword index from ChromaDB documents."""
        if not self.collection: return
        count = self.collection.count()
        if count == 0: return
        
        logger.info("Rebuilding BM25 index from %d chunks...", count)
        # Fetch all documents in batches
        batch_size = 500
        for i in range(0, count, batch_size):
            # ChromaDB doesn't have easy 'offset', so we just get all if small or use paging if supported
            # For simplicity in this scale, we fetch all
            results = self.collection.get(include=["documents"], limit=batch_size, offset=i)
            if results["ids"]:
                for cid, doc in zip(results["ids"], results["documents"]):
                    self._bm25.add(cid, doc)
        logger.info("BM25 index rebuild complete.")

    async def _warm_embeddings(self):
        """Load SentenceTransformer model off the main thread."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, self._load_embed_model)

    def _load_embed_model(self):
        if self._embed_fn is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(EMBED_MODEL)
            self._embed_fn = model
            logger.info("Embedding model loaded: %s (384D)", EMBED_MODEL)
        except ImportError:
            logger.error("sentence-transformers not installed. pip install sentence-transformers")
            raise

    def _embed(self, texts: list[str]) -> list[list[float]]:
        """Synchronous embedding  always called from executor."""
        if self._embed_fn is None:
            self._load_embed_model()
        return self._embed_fn.encode(texts, show_progress_bar=False).tolist()  # type: ignore[union-attr]

    #  Ingest 

    async def add_document(self,
                           doc_id:   str,
                           text:     str,
                           doc_name: str,
                           page_map: Optional[dict[int, str]] = None) -> int:
        """
        Chunk, embed, and store a document.
        page_map: optional {chunk_index: page_number} for accurate citations.
        Returns number of chunks stored.
        """
        chunks = chunk_text(text)
        if not chunks:
            logger.warning("Document %s produced no chunks", doc_id)
            return 0

        ids, documents, metadatas = [], [], []
        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_chunk_{i}"
            page = (page_map or {}).get(i, 0)
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append({
                "doc_id":   doc_id,
                "doc_name": doc_name,
                "chunk_idx": i,
                "page":     page,
            })
            # Register in BM25 index
            self._bm25.add(chunk_id, chunk)

        # Embed in executor to avoid blocking
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            self._executor, self._embed, documents
        )

        # Upsert into ChromaDB in batches of 100
        batch = 100
        for b in range(0, len(ids), batch):
            self.collection.upsert(
                ids=ids[b:b+batch],
                documents=documents[b:b+batch],
                metadatas=metadatas[b:b+batch],
                embeddings=embeddings[b:b+batch],
            )

        # Invalidate stale cache entries
        self._cache.invalidate_doc(doc_id)
        logger.info("Stored %d chunks for doc %s", len(chunks), doc_id)
        return len(chunks)

    #  Search 

    async def search(self,
                     query:  str,
                     doc_id: Optional[str] = None,
                     limit:  int = TOP_K) -> list[SearchResult]:
        """
        Hybrid search combining semantic (ChromaDB) + BM25 keyword results
        merged via Reciprocal Rank Fusion (RRF).
        """
        # Cache hit?
        cached = self._cache.get(query, doc_id, limit)
        if cached is not None:
            logger.debug("Cache hit for query: %s", query[:40])
            return cached

        loop = asyncio.get_event_loop()

        #  Semantic search 
        query_embed = await loop.run_in_executor(
            self._executor, self._embed, [query]
        )
        where = {"doc_id": {"$eq": doc_id}} if doc_id else None
        sem_results = self.collection.query(
            query_embeddings=query_embed,
            n_results=min(limit * 2, max(1, self.collection.count())),
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        # Build lookup: chunk_id  (text, metadata, cosine_score)
        sem_map: dict[str, tuple[str, dict, float]] = {}
        if sem_results["ids"] and sem_results["ids"][0]:
            for cid, doc, meta, dist in zip(
                sem_results["ids"][0],
                sem_results["documents"][0],
                sem_results["metadatas"][0],
                sem_results["distances"][0],
            ):
                score = 1.0 - dist
                logger.debug("Chunk %s score: %.4f", cid, score)
                if score >= SIMILARITY_THRESH:
                    sem_map[cid] = (doc, meta, score)

        #  BM25 search 
        bm25_ids = self._bm25.search(query, top_k=limit * 2)
        # Filter to doc_id if specified
        if doc_id:
            bm25_ids = [cid for cid in bm25_ids if cid.startswith(doc_id)]

        #  RRF merge 
        rrf_scores: dict[str, float] = {}
        all_ids = set(sem_map.keys()) | set(bm25_ids)

        sem_ranked = list(sem_map.keys())          # already ordered by score
        for rank, cid in enumerate(sem_ranked):
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
        for rank, cid in enumerate(bm25_ids):
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)

        top_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)[:limit]  # type: ignore[arg-type]

        #  Fetch missing chunks from ChromaDB 
        need_fetch = [cid for cid in top_ids if cid not in sem_map]
        fetched_map: dict[str, tuple[str, dict]] = {}
        if need_fetch:
            fetched = self.collection.get(
                ids=need_fetch,
                include=["documents", "metadatas"],
            )
            for cid, doc, meta in zip(
                fetched["ids"], fetched["documents"], fetched["metadatas"]
            ):
                fetched_map[cid] = (doc, meta)

        #  Build results 
        results: list[SearchResult] = []
        for cid in top_ids:
            if cid in sem_map:
                text, meta, sem_score = sem_map[cid]
                source = "hybrid" if cid in bm25_ids else "semantic"
            elif cid in fetched_map:
                text, meta = fetched_map[cid]
                sem_score = 0.0
                source = "bm25"
            else:
                continue

            results.append(SearchResult(
                chunk_id = cid,
                text     = text,
                doc_id   = meta.get("doc_id", ""),
                doc_name = meta.get("doc_name", ""),
                page     = meta.get("page", 0),
                score    = rrf_scores.get(cid, sem_score),
                source   = source,
            ))

        self._cache.set(query, doc_id, limit, results)
        return results

    async def search_knowledge(self, query: str, limit: int = 5,
                               document_id: Optional[str] = None,
                               similarity_threshold: float = 0.2) -> list[dict]:
        """Backward compatibility alias for the Multi-Agent System."""
        results = await self.search(query, doc_id=document_id, limit=limit)
        # Convert SearchResult objects to dicts matching the old ResearchAgent expectations
        knowledge_items = []
        for r in results:
            if r.score >= similarity_threshold:
                knowledge_items.append({
                    "id": r.chunk_id,
                    "content": r.text,
                    "source": r.doc_name,
                    "relevance_score": r.score,
                    "metadata": {"doc_id": r.doc_id, "page": r.page}
                })
        return knowledge_items

    #  Management 

    async def delete_document(self, doc_id: str):
        """Remove all chunks for a document from ChromaDB and BM25 index."""
        results = self.collection.get(where={"doc_id": {"$eq": doc_id}})
        if results["ids"]:
            self.collection.delete(ids=results["ids"])
            self._bm25.remove_doc(doc_id, results["ids"])
            self._cache.invalidate_doc(doc_id)
            logger.info("Deleted %d chunks for doc %s", len(results["ids"]), doc_id)

    async def get_doc_chunk_count(self, doc_id: str) -> int:
        results = self.collection.get(where={"doc_id": {"$eq": doc_id}})
        return len(results["ids"])

    async def get_document_text(self, doc_id: str) -> str:
        """Retrieve full document text by joining chunks from vector storage."""
        results = self.collection.get(
            where={"doc_id": {"$eq": doc_id}},
            include=["documents", "metadatas"]
        )
        if not results["ids"]:
            return ""
        
        # Sort chunks by index to reconstruct original flow accurately
        indexed_chunks = []
        for doc, meta in zip(results["documents"], results["metadatas"]):
            idx = meta.get("chunk_idx", 0)
            indexed_chunks.append((idx, doc))
        
        indexed_chunks.sort(key=lambda x: x[0])
        return "\n\n".join([c[1] for c in indexed_chunks])

    async def health_check(self) -> dict:
        start = time.monotonic()
        try:
            count = self.collection.count()
            latency = round((time.monotonic() - start) * 1000, 1)
            return {
                "status":        "healthy",
                "total_chunks":  count,
                "latency_ms":    latency,
                "embed_loaded":  self._embed_fn is not None,
                "cache_entries": len(self._cache._store),
                "bm25_entries":  len(self._bm25._ids),
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def reset(self):
        """Full wipe  use with caution."""
        self.client.reset()  # type: ignore[union-attr]
        self._bm25 = BM25Index()
        self._cache.clear()
        self._init_chroma()
        logger.warning("VectorDB reset  all data wiped")


#  Singleton 

vector_db = VectorDBService()
