"""
ai_engine.py  Advanced AI Engine Service
==========================================
Features:
  - Ollama LLM with async streaming (SSE-ready)
  - Smart Notes generation (structured JSON)
  - MCQ Quiz generation with explanations
  - Flashcard generation
  - Arena / Game Config generation (for DynamicSimulation)
  - Document summarisation
  - Health check with latency
  - Retry logic with exponential back-off
"""

import os
import json
import time
import logging
import asyncio
import re
from typing import AsyncGenerator, Optional

import httpx

logger = logging.getLogger(__name__)

#  Constants 

OLLAMA_HOST     = os.getenv("OLLAMA_HOST", "127.0.0.1")
OLLAMA_PORT     = int(os.getenv("OLLAMA_PORT", "11434"))
OLLAMA_BASE     = f"http://{OLLAMA_HOST}:{OLLAMA_PORT}"
DEFAULT_MODEL   = os.getenv("DEFAULT_AI_MODEL", "mistral")
VLM_MODEL       = os.getenv("VLM_MODEL", "llava")
MAX_TOKENS      = int(os.getenv("MAX_TOKENS", "2048"))
TIMEOUT         = float(os.getenv("OLLAMA_TIMEOUT", "60"))
RETRY_COUNT     = int(os.getenv("OLLAMA_RETRY_COUNT", "3"))
STREAM_TIMEOUT  = 120.0   # longer timeout for streaming


#  Helpers 

def _extract_json(text: str) -> str:
    """Strip markdown fences and extract the first JSON block."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```", "", text)
    # Find first { or [
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        idx = text.find(start_char)
        if idx != -1:
            # Find matching close
            depth, end = 0, -1
            for i, c in enumerate(text[idx:], idx):
                if c == start_char:
                    depth += 1
                elif c == end_char:
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            if end != -1:
                return text[idx:end+1]
    return text


async def _retry(coro_fn, retries: int = RETRY_COUNT, delay: float = 1.0):
    """Retry an async callable with exponential back-off."""
    last_err = None
    for attempt in range(retries):
        try:
            return await coro_fn()
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                await asyncio.sleep(delay * (2 ** attempt))
            logger.warning("Attempt %d/%d failed: %s", attempt + 1, retries, e)
    raise last_err  # type: ignore[misc]


#  Main Service 

class AIEngineService:

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self.model       = DEFAULT_MODEL
        self.is_initialized = False

    #  Lifecycle 

    async def initialize(self):
        self._client = httpx.AsyncClient(
            base_url=OLLAMA_BASE,
            timeout=httpx.Timeout(TIMEOUT, read=STREAM_TIMEOUT),
        )
        await _retry(self._verify_connection)
        self.is_initialized = True
        logger.info("AI Engine ready  model: %s @ %s", self.model, OLLAMA_BASE)

    async def _verify_connection(self):
        resp = await self._client.get("/api/tags")  # type: ignore[union-attr]
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        logger.info("Ollama models available: %s", models)
        if self.model not in models and not any(self.model in m for m in models):
            logger.info("Pulling model %s ...", self.model)
            await self._client.post(  # type: ignore[union-attr]
                "/api/pull",
                json={"name": self.model, "stream": False},
                timeout=300,
            )

    async def close(self):
        if self._client:
            await self._client.aclose()

    #  Core chat (buffered) 

    async def chat(self,
                   prompt: str = "",
                   system: str = "",
                   temperature: float = 0.7,
                   max_tokens: int = MAX_TOKENS,
                   **kwargs) -> str:
        """Single-turn completion, returns full string. Handles both 'prompt' and 'message'."""
        final_prompt = prompt or kwargs.get("message", "")
        if not final_prompt:
            return ""

        async def _call():
            payload = {
                "model":   self.model,
                "prompt":  final_prompt,
                "system":  system,
                "stream":  False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            }
            resp = await self._client.post("/api/generate", json=payload)  # type: ignore[union-attr]
            resp.raise_for_status()
            return resp.json().get("response", "")

        return await _retry(_call)

    #  Streaming chat (SSE) 

    async def stream_chat(self,
                          prompt: str,
                          system: str = "",
                          temperature: float = 0.7) -> AsyncGenerator[str, None]:
        """
        Yields text tokens as they arrive from Ollama.
        Usage in FastAPI:
            async for token in ai_engine.stream_chat(prompt):
                yield f"data: {token}\\n\\n"
        """
        payload = {
            "model":   self.model,
            "prompt":  prompt,
            "system":  system,
            "stream":  True,
            "options": {"temperature": temperature},
        }
        async with self._client.stream(  # type: ignore[union-attr]
            "POST", "/api/generate", json=payload,
            timeout=httpx.Timeout(STREAM_TIMEOUT, read=STREAM_TIMEOUT),
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        yield token
                    if data.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

    #  VLM (vision) 

    async def vision_chat(self,
                          prompt: str,
                          image_b64: str,
                          system: str = "") -> str:
        """Send image + text to LLaVA or compatible VLM."""

        async def _call():
            payload = {
                "model":   VLM_MODEL,
                "prompt":  prompt,
                "system":  system,
                "images":  [image_b64],
                "stream":  False,
                "options": {"temperature": 0.3},
            }
            resp = await self._client.post("/api/generate", json=payload)  # type: ignore[union-attr]
            resp.raise_for_status()
            return resp.json().get("response", "")

        try:
            return await _retry(_call)
        except Exception as e:
            logger.error("VLM call failed: %s", e)
            return "[Vision analysis unavailable]"

    #  Smart Notes 

    async def generate_notes(self, document_text: str) -> list[dict]:
        """
        Returns:
            [{"heading": str, "points": [str, ...]}, ...]
        """
        system = (
            "You are a precise academic note-taker. "
            "Always respond with valid JSON only  no prose, no markdown fences."
        )
        prompt = f"""Analyse the following document and create structured smart notes.

Return a JSON array where each item has:
  - "heading": a short section title (string)
  - "points": an array of concise bullet points (3-6 per section)

Include 4-6 sections covering: key concepts, main arguments, important terms, applications/examples, and conclusions.

DOCUMENT:
{document_text[:4000]}

JSON ARRAY:"""

        raw = await self.chat(prompt, system=system, temperature=0.3)
        try:
            data = json.loads(_extract_json(raw))
            if isinstance(data, list):
                return data
        except Exception as e:
            logger.error("Notes parse error: %s | raw: %s", e, raw[:200])
        # Fallback
        return [{"heading": "Summary", "points": [raw[:500]]}]

    #  Flashcards 

    async def generate_flashcards(self,
                                  document_text: str,
                                  count: int = 15) -> list[dict]:
        """
        Returns:
            [{"question": str, "answer": str}, ...]
        """
        system = "You are a spaced-repetition expert. Return valid JSON only."
        prompt = f"""Create {count} high-quality flashcards from this document.

Return a JSON array where each item has:
  - "question": a clear, specific question (string)
  - "answer": a concise, accurate answer (1-3 sentences)

Focus on: key definitions, processes, relationships, formulas, and critical distinctions.

DOCUMENT:
{document_text[:4000]}

JSON ARRAY:"""

        raw = await self.chat(prompt, system=system, temperature=0.4)
        try:
            data = json.loads(_extract_json(raw))
            if isinstance(data, list):
                return data[:count]
        except Exception as e:
            logger.error("Flashcard parse error: %s", e)
        return []

    #  Quiz 

    async def generate_quiz(self,
                            document_text: str,
                            count: int = 10) -> list[dict]:
        """
        Returns:
            [{
                "question": str,
                "options": [str, str, str, str],
                "correct": int,        # 0-indexed
                "explanation": str
            }, ...]
        """
        system = "You are an expert educator. Return valid JSON only, no extra text."
        prompt = f"""Create {count} multiple-choice questions from this document.

Return a JSON array where each item has:
  - "question": the question text (string)
  - "options": exactly 4 answer strings (array)
  - "correct": index of correct answer (0, 1, 2, or 3)
  - "explanation": why the answer is correct (1-2 sentences)

Vary difficulty: mix recall, comprehension, and application questions.

DOCUMENT:
{document_text[:4000]}

JSON ARRAY:"""

        raw = await self.chat(prompt, system=system, temperature=0.4)
        try:
            data = json.loads(_extract_json(raw))
            if isinstance(data, list):
                # Validate structure
                valid = []
                for q in data[:count]:
                    if (isinstance(q.get("options"), list)
                            and len(q["options"]) == 4
                            and isinstance(q.get("correct"), int)):
                        valid.append(q)
                return valid
        except Exception as e:
            logger.error("Quiz parse error: %s", e)
        return []

    #  Arena / Game Config 

    async def generate_arena_config(self, document_text: str, doc_name: str = "") -> dict:
        """
        Analyses the document and produces a game config for DynamicSimulation.tsx.

        Detects topic type and returns the appropriate config:
          - tree / graph    for data structure topics
          - sorting         for algorithm topics
          - concept         for theory / history / science
          - formula         for math / physics
          - timeline        for historical sequences
        """
        system = (
            "You are a game designer specialising in educational simulations. "
            "Return ONLY valid JSON  no markdown, no commentary."
        )
        prompt = f"""Analyse this educational document and generate an interactive game configuration.

Document name: {doc_name}
Content:
{document_text[:3000]}

TASK: Detect the primary topic type and return one of these exact game configs.

 TYPE 1: DATA STRUCTURE (AVL tree, BST, linked list, heap, trie, stack, queue) 
{{
  "type": "tree",
  "title": "<topic> Explorer",
  "description": "Interactive <topic> with insert / delete operations",
  "topic": "<specific_topic>",
  "instructions": ["<step 1>", "<step 2>", "<step 3>"],
  "initialState": {{
    "nodes": [
      {{"id": 1, "value": 50, "x": 400, "y": 70, "left": 2, "right": 3, "height": 3}},
      {{"id": 2, "value": 30, "x": 220, "y": 160, "left": 4, "right": null, "height": 2}},
      {{"id": 3, "value": 70, "x": 580, "y": 160, "left": null, "right": null, "height": 1}},
      {{"id": 4, "value": 20, "x": 130, "y": 250, "left": null, "right": null, "height": 1}}
    ],
    "nextId": 5, "score": 0
  }},
  "rules": {{"maxNodes": 15, "allowDelete": true, "showBalance": true, "showHeight": true}},
  "scoring": {{"correct": 20, "wrong": -5, "bonus": 50}}
}}

 TYPE 2: SORTING ALGORITHM 
{{
  "type": "sorting",
  "title": "<Algorithm> Visualiser",
  "description": "Step through <algorithm> manually or watch it animate",
  "topic": "<algorithm_name>",
  "instructions": ["Click Step to advance one comparison", "Press Auto to animate", "Drag bars to swap manually"],
  "initialState": {{
    "array": [64, 34, 25, 12, 22, 11, 90],
    "comparing": [], "sorted": [], "steps": 0, "score": 0
  }},
  "rules": {{"showComparisons": true, "allowManual": true}},
  "scoring": {{"correct": 10, "wrong": -2, "bonus": 30}}
}}

 TYPE 3: GRAPH / NETWORK 
{{
  "type": "graph",
  "title": "Graph Traversal Game",
  "description": "Navigate using BFS or DFS",
  "topic": "graph_traversal",
  "instructions": ["Click a node to start", "Choose BFS or DFS", "Complete traversal in fewest steps"],
  "initialState": {{
    "nodes": [
      {{"id": 0, "label": "A", "x": 300, "y": 120}},
      {{"id": 1, "label": "B", "x": 150, "y": 260}},
      {{"id": 2, "label": "C", "x": 450, "y": 260}},
      {{"id": 3, "label": "D", "x": 220, "y": 380}},
      {{"id": 4, "label": "E", "x": 380, "y": 380}}
    ],
    "edges": [[0,1],[0,2],[1,3],[2,4],[3,4]],
    "visited": [], "queue": [], "mode": "bfs", "score": 0
  }},
  "rules": {{"modes": ["bfs","dfs"], "showQueue": true}},
  "scoring": {{"correct": 15, "wrong": -5, "bonus": 50}}
}}

 TYPE 4: CONCEPT / THEORY / HISTORY / SCIENCE (default) 
{{
  "type": "concept",
  "title": "<Topic> Challenge",
  "description": "Test your understanding through interactive scenarios",
  "topic": "<topic_slug>",
  "instructions": ["Read each scenario carefully", "Choose the best answer", "Learn from detailed explanations"],
  "initialState": {{
    "scenarios": [
      {{
        "question": "<meaningful question from the document>",
        "options": ["<A>", "<B>", "<C>", "<D>"],
        "correct": <0-3>,
        "explanation": "<why this answer is correct>"
      }},
      {{
        "question": "<second meaningful question>",
        "options": ["<A>", "<B>", "<C>", "<D>"],
        "correct": <0-3>,
        "explanation": "<explanation>"
      }},
      {{
        "question": "<third question>",
        "options": ["<A>", "<B>", "<C>", "<D>"],
        "correct": <0-3>,
        "explanation": "<explanation>"
      }}
    ],
    "current": 0, "score": 0, "streak": 0
  }},
  "rules": {{"showExplanations": true, "allowRetry": false}},
  "scoring": {{"correct": 25, "wrong": 0, "bonus": 100}}
}}

Choose the most appropriate type for the document content and return the COMPLETE JSON config with real values (not placeholders) derived from the actual document content.

JSON CONFIG:"""

        raw = await self.chat(prompt, system=system, temperature=0.2, max_tokens=1500)
        try:
            data = json.loads(_extract_json(raw))
            if "type" in data and "initialState" in data:
                logger.info("Arena config generated  type: %s, topic: %s",
                            data.get("type"), data.get("topic"))
                return data
        except Exception as e:
            logger.error("Arena config parse error: %s | raw: %s", e, raw[:300])

        # Fallback concept game
        return {
            "type": "concept",
            "title": f"{doc_name or 'Document'} Challenge",
            "description": "Test your understanding",
            "topic": "general",
            "instructions": [
                "Read each question carefully",
                "Select the best answer",
                "Review the explanation after each question"
            ],
            "initialState": {
                "scenarios": [
                    {
                        "question": "What is the primary subject of this document?",
                        "options": [
                            "The document covers fundamental concepts",
                            "The document is about advanced techniques",
                            "The document focuses on historical context",
                            "The document discusses practical applications"
                        ],
                        "correct": 0,
                        "explanation": "Review the document introduction for the primary focus."
                    }
                ],
                "current": 0, "score": 0, "streak": 0
            },
            "rules": {"showExplanations": True, "allowRetry": False},
            "scoring": {"correct": 25, "wrong": 0, "bonus": 100}
        }

    #  Summarisation 

    async def summarize(self, text: str, max_words: int = 150) -> str:
        """Return a concise plain-text summary."""
        prompt = (
            f"Summarise the following text in {max_words} words or fewer. "
            "Be concise and factual. Output plain text only.\n\n"
            f"TEXT:\n{text[:3000]}\n\nSUMMARY:"
        )
        return await self.chat(prompt, temperature=0.3)

    #  Category detection 

    async def detect_category(self, text: str) -> str:
        """
        Returns one of: Legal, Technical, Business, Academic, Medical, General
        """
        prompt = (
            "Classify this document into exactly ONE category from this list: "
            "Legal, Technical, Business, Academic, Medical, General.\n\n"
            f"DOCUMENT EXCERPT:\n{text[:1000]}\n\n"
            "Return only the category name, nothing else."
        )
        result = await self.chat(prompt, temperature=0.1)
        for cat in ["Legal", "Technical", "Business", "Academic", "Medical", "General"]:
            if cat.lower() in result.lower():
                return cat
        return "General"

    #  Health 

    async def health_check(self) -> dict:
        start = time.monotonic()
        try:
            resp = await self._client.get("/api/tags")  # type: ignore[union-attr]
            resp.raise_for_status()
            latency = round((time.monotonic() - start) * 1000, 1)
            models = [m["name"] for m in resp.json().get("models", [])]
            return {
                "status":        "healthy",
                "model":         self.model,
                "latency_ms":    latency,
                "models_loaded": models,
            }
        except Exception as e:
            return {"status": "error", "error": str(e), "latency_ms": None}


#  Singleton 

ai_engine = AIEngineService()
