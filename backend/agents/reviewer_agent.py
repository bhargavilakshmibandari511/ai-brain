"""
Reviewer Agent — Verifies the quality and accuracy of combined AI answers.
Checks for relevance, hallucinations, and coherence.
"""

import logging
from typing import List

from agents.base_agent import BaseAgent, AgentTask, AgentResult

logger = logging.getLogger(__name__)


class ReviewerAgent(BaseAgent):
    """
    Quality control agent that validates generated answers.
    Checks relevance, detects hallucinations, and assigns confidence scores.
    """

    def __init__(self, ai_engine):
        super().__init__()
        self.ai_engine = ai_engine

    @property
    def name(self) -> str:
        return "Reviewer Agent"

    @property
    def description(self) -> str:
        return "Verifies AI answers for accuracy, relevance, and hallucination detection"

    @property
    def capabilities(self) -> List[str]:
        return ["quality_check", "hallucination_detection", "relevance_scoring", "fact_checking"]

    async def execute(self, task: AgentTask) -> AgentResult:
        """Review the combined answer for quality and accuracy."""
        original_query = task.query
        answer_to_review = task.context or ""
        agent_sources = task.parameters.get("sources", [])
        contributing_agents = task.parameters.get("contributing_agents", [])

        # Build a review prompt
        prompt = (
            f"You are a quality reviewer for an AI system. Your job is to evaluate "
            f"the following answer for accuracy and relevance.\n\n"
            f"ORIGINAL USER QUERY: {original_query}\n\n"
            f"GENERATED ANSWER:\n{answer_to_review}\n\n"
            f"SOURCES USED: {', '.join(agent_sources) if agent_sources else 'None'}\n"
            f"CONTRIBUTING AGENTS: {', '.join(contributing_agents) if contributing_agents else 'None'}\n\n"
            f"Evaluate the answer on these criteria:\n"
            f"1. **Relevance**: Does the answer directly address the user's query? (1-10)\n"
            f"2. **Accuracy**: Is the information factually correct and well-supported? (1-10)\n"
            f"3. **Completeness**: Does it cover all aspects of the query? (1-10)\n"
            f"4. **Coherence**: Is the answer well-structured and clear? (1-10)\n\n"
            f"Provide:\n"
            f"- A score for each criterion (1-10)\n"
            f"- An overall confidence score (0.0 to 1.0)\n"
            f"- Any issues found (hallucinations, missing info, etc.)\n"
            f"- Suggested improvements if any\n\n"
            f"Format your response as:\n"
            f"RELEVANCE: [score]/10\n"
            f"ACCURACY: [score]/10\n"
            f"COMPLETENESS: [score]/10\n"
            f"COHERENCE: [score]/10\n"
            f"CONFIDENCE: [0.0-1.0]\n"
            f"ISSUES: [list any problems or 'None']\n"
            f"VERDICT: [APPROVED / NEEDS_REVISION]\n"
            f"SUGGESTIONS: [improvement suggestions or 'None']"
        )

        try:
            review = await self.ai_engine.chat(
                message=prompt,
                temperature=0.2,
                max_tokens=1024,
            )
        except Exception as e:
            logger.error(f"Review failed: {e}")
            return AgentResult(
                agent_name=self.name,
                task_id=task.task_id,
                content=answer_to_review,  # Pass through original if review fails
                confidence=0.5,
                error=str(e),
                success=False,
            )

        # Parse confidence from the review
        confidence = self._extract_confidence(review)
        verdict = "APPROVED" if confidence >= 0.6 else "NEEDS_REVISION"

        return AgentResult(
            agent_name=self.name,
            task_id=task.task_id,
            content=answer_to_review,  # Pass through the reviewed answer
            confidence=confidence,
            metadata={
                "review": review,
                "verdict": verdict,
                "contributing_agents": contributing_agents,
            },
        )

    def _extract_confidence(self, review_text: str) -> float:
        """Extract the confidence score from the review text."""
        try:
            for line in review_text.split("\n"):
                line_upper = line.strip().upper()
                if line_upper.startswith("CONFIDENCE:"):
                    score_str = line.split(":")[-1].strip()
                    # Handle formats like "0.8", "0.8/1.0", "80%"
                    score_str = score_str.replace("/1.0", "").replace("%", "").strip()
                    score = float(score_str)
                    if score > 1.0:
                        score = score / 100.0  # Convert percentage
                    return max(0.0, min(1.0, score))
        except (ValueError, IndexError):
            pass

        # Default confidence if parsing fails
        return 0.6
