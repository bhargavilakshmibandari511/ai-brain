"""
Research Agent — Searches the local document knowledge base (ChromaDB)
for relevant information using semantic vector search.
"""

import logging
from typing import List

from agents.base_agent import BaseAgent, AgentTask, AgentResult

logger = logging.getLogger(__name__)


class ResearchAgent(BaseAgent):
    """
    Works with the uploaded document knowledge base.
    Uses VectorDB (ChromaDB) for embedding-based semantic retrieval.
    """

    def __init__(self, vector_db, ai_engine):
        super().__init__()
        self.vector_db = vector_db
        self.ai_engine = ai_engine

    @property
    def name(self) -> str:
        return "Research Agent"

    @property
    def description(self) -> str:
        return "Searches uploaded documents and knowledge base using semantic vector search"

    @property
    def capabilities(self) -> List[str]:
        return ["document_search", "semantic_retrieval", "knowledge_base", "citation"]

    async def execute(self, task: AgentTask) -> AgentResult:
        """Search the vector database for relevant document chunks."""
        query = task.query
        doc_id = task.parameters.get("doc_id") or task.parameters.get("document_id")
        max_results = task.parameters.get("max_results", 5)
        similarity_threshold = task.parameters.get("similarity_threshold", 0.2)

        # Step 1: Search vector database for relevant chunks
        knowledge_items = await self.vector_db.search_knowledge(
            query=query,
            document_id=doc_id,
            limit=max_results,
            similarity_threshold=similarity_threshold,
        )

        if not knowledge_items:
            return AgentResult(
                agent_name=self.name,
                task_id=task.task_id,
                content="No relevant documents found in the knowledge base.",
                confidence=0.2,
                metadata={"chunks_found": 0},
            )

        # Step 2: Format context from retrieved chunks
        sources = []
        context_parts = []
        for i, item in enumerate(knowledge_items, 1):
            source = item.get("source", "Unknown")
            content = item.get("content", "")
            score = item.get("relevance_score", 0.0)
            context_parts.append(f"[Source {i}: {source} (relevance: {score:.0%})]\n{content}")
            if source not in sources:
                sources.append(source)

        combined_context = "\n\n---\n\n".join(context_parts)

        # Step 3: Use LLM to synthesize a research summary from the retrieved context
        prompt = (
            f"Based on the following document excerpts from the knowledge base, "
            f"provide a clear and relevant answer to the query.\n\n"
            f"Query: {query}\n\n"
            f"Document excerpts:\n{combined_context}\n\n"
            f"Provide a well-structured answer based ONLY on the document excerpts above. "
            f"Cite the source numbers in your answer."
        )

        try:
            summary = await self.ai_engine.chat(
                message=prompt,
                temperature=0.3,
                max_tokens=1024,
            )
        except Exception as e:
            logger.warning(f"LLM summarization failed in research agent, using raw context: {e}")
            summary = combined_context

        avg_score = sum(
            item.get("relevance_score", 0.0) for item in knowledge_items
        ) / len(knowledge_items)

        return AgentResult(
            agent_name=self.name,
            task_id=task.task_id,
            content=summary,
            sources=sources,
            confidence=min(avg_score + 0.1, 1.0),
            metadata={
                "chunks_found": len(knowledge_items),
                "avg_relevance": round(avg_score, 3),
            },
        )
