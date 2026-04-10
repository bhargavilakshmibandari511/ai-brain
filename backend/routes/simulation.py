from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any, Dict
import app_state
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class GameGenerationRequest(BaseModel):
    document_text: str
    simulation_data: Optional[Dict[str, Any]] = None

@router.post("/generate-game")
async def generate_simulation_game(body: GameGenerationRequest):
    """
    Generates a gamified learning configuration based on document content.
    Uses local Ollama AI engine instead of external APIs.
    """
    context_info = ""
    if body.simulation_data:
        nodes = (body.simulation_data.get("nodes") or [])[:10]
        goal = body.simulation_data.get("goal") or "Learn the concept"
        context_info = f"Simulation nodes: {json.dumps(nodes)}. Goal: {goal}"

    prompt = f"""You are an expert game designer and educator. Analyze this content and generate a rich, interactive educational game config.

Content: {body.document_text[:3000] if body.document_text else "General computer science content"}
{context_info}

Detect the topic and return ONLY valid JSON (no markdown, no explanation).

DETECTION RULES:
- AVL/BST/Binary tree -> type: "tree", topic: "avl_tree" or "bst"
- Linked list -> type: "linked_list"  
- Stack/Queue -> type: "stack_queue"
- Graph/BFS/DFS/Dijkstra -> type: "graph"
- Sorting algorithms -> type: "sorting"
- Heap/Priority Queue -> type: "heap"
- Dynamic Programming -> type: "dp"
- Hash table/HashMap -> type: "hash_table"
- Pathfinding/A* -> type: "pathfinding"
- Concepts/Theory/History/Science -> type: "concept"

EXAMPLE SCHEMAS:
(Return exactly one of these structures based on the topic)

For TREE: {{"type": "tree", "title": "...", "description": "...", "topic": "bst", "instructions": ["..."], "initialState": {{"nodes": [], "nextId": 1}}, "rules": {{"maxNodes": 15}}, "scoring": {{"correct": 20, "wrong": -5, "bonus": 50}}}}
For LINKED_LIST: {{"type": "linked_list", "title": "...", "description": "...", "topic": "linked_list", "instructions": ["..."], "initialState": {{"nodes": [], "head": null}}, "rules": {{"maxNodes": 10}}, "scoring": {{"correct": 15, "wrong": -3, "bonus": 40}}}}
For STACK_QUEUE: {{"type": "stack_queue", "title": "...", "description": "...", "topic": "stack_queue", "instructions": ["..."], "initialState": {{"stack": [], "queue": []}}, "rules": {{"maxSize": 8}}, "scoring": {{"correct": 10, "wrong": -2, "bonus": 30}}}}
For CONCEPT: {{"type": "concept", "title": "...", "description": "...", "topic": "general", "instructions": ["..."], "initialState": {{"scenarios": [{{"question": "...", "options": [], "correct": 0, "explanation": "..."}}]}}, "rules": {{"showExplanations": true}}, "scoring": {{"correct": 25, "wrong": 0, "bonus": 100}}}}

Return ONLY the JSON object. Do not include '```json' wrapper.
"""

    try:
        response = await app_state.ai_engine.chat(
            message=prompt,
            temperature=0.2,
            max_tokens=2000
        )
        
        # Clean response (remove markdown if LLM includes it)
        clean_json = response.replace("```json", "").replace("```", "").strip()
        
        # Verify JSON validity
        game_config = json.loads(clean_json)
        return game_config

    except Exception as e:
        logger.error(f"Failed to generate game config: {e}")
        # Return a safe fallback (BST Demo)
        return {
            "type": "tree",
            "title": "Topic Explorer",
            "description": "Interactive learning simulation",
            "topic": "generic",
            "instructions": ["Insert nodes to visualize the structure"],
            "initialState": {
                "nodes": [{"id": 1, "value": 50, "x": 400, "y": 70, "left": None, "right": None, "height": 1}],
                "nextId": 2
            },
            "rules": {"maxNodes": 15, "showBalance": True},
            "scoring": {"correct": 20, "wrong": -5, "bonus": 50}
        }
