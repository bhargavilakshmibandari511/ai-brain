"""
Multi-Agent System (MAS) for AI Digital Brain
Specialized agents collaborate to handle complex queries.
"""

from agents.base_agent import BaseAgent, AgentTask, AgentResult, AgentStatus
from agents.orchestrator import OrchestratorAgent
from agents.research_agent import ResearchAgent
from agents.web_agent import WebAgent
from agents.analyst_agent import AnalystAgent
from agents.reviewer_agent import ReviewerAgent

__all__ = [
    "BaseAgent",
    "AgentTask",
    "AgentResult",
    "AgentStatus",
    "OrchestratorAgent",
    "ResearchAgent",
    "WebAgent",
    "AnalystAgent",
    "ReviewerAgent",
]
