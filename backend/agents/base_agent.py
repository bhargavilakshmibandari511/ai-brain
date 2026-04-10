"""
Base Agent - Abstract base class for all agents in the Multi-Agent System.
Defines the common interface, task/result models, and status tracking.
"""

import time
import asyncio
import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    """Status of an agent."""
    IDLE = "idle"
    WORKING = "working"
    DONE = "done"
    ERROR = "error"


@dataclass
class AgentTask:
    """A task assigned to an agent by the orchestrator."""
    task_id: str
    task_type: str  # "research", "web_search", "analysis", "review"
    query: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    context: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AgentResult:
    """Result returned by an agent after executing a task."""
    agent_name: str
    task_id: str
    content: str
    sources: List[str] = field(default_factory=list)
    confidence: float = 0.0  # 0.0 to 1.0
    execution_time: float = 0.0  # seconds
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    success: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_name": self.agent_name,
            "task_id": self.task_id,
            "content": self.content,
            "sources": self.sources,
            "confidence": self.confidence,
            "execution_time": round(self.execution_time, 3),
            "metadata": self.metadata,
            "error": self.error,
            "success": self.success,
        }


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the Multi-Agent System.

    Every agent must implement the `execute` method and define its
    name, description, and capabilities.
    """

    def __init__(self):
        self._status: AgentStatus = AgentStatus.IDLE
        self._last_execution_time: float = 0.0
        self._total_tasks_completed: int = 0

    # --- Properties to override ---

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique agent name."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """What this agent does."""
        ...

    @property
    @abstractmethod
    def capabilities(self) -> List[str]:
        """List of capability keywords, e.g. ['document_search', 'summarization']."""
        ...

    # --- Status ---

    @property
    def status(self) -> AgentStatus:
        return self._status

    @property
    def stats(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self._status.value,
            "description": self.description,
            "capabilities": self.capabilities,
            "last_execution_time": round(self._last_execution_time, 3),
            "total_tasks_completed": self._total_tasks_completed,
        }

    # --- Core execution ---

    async def run(self, task: AgentTask) -> AgentResult:
        """
        Wrapper around execute() that handles timing, status, and error handling.
        Subclasses should NOT override this — override execute() instead.
        """
        self._status = AgentStatus.WORKING
        start = time.time()
        logger.info(f"🤖 [{self.name}] Starting task: {task.task_type} — {task.query[:80]}")

        try:
            # Wrap execution in a timeout to prevent indefinite hangs
            result = await asyncio.wait_for(self.execute(task), timeout=60.0)
            result.execution_time = time.time() - start
            self._last_execution_time = result.execution_time
            self._total_tasks_completed += 1
            self._status = AgentStatus.DONE
            logger.info(
                f"✅ [{self.name}] Completed in {result.execution_time:.2f}s "
                f"(confidence: {result.confidence:.0%})"
            )
            return result

        except asyncio.TimeoutError:
            elapsed = time.time() - start
            self._status = AgentStatus.ERROR
            logger.error(f"⌛ [{self.name}] Timed out after {elapsed:.2f}s")
            return AgentResult(
                agent_name=self.name,
                task_id=task.task_id,
                content="",
                error="Task timed out after 60s",
                success=False,
                execution_time=elapsed,
            )
        except Exception as e:
            elapsed = time.time() - start
            self._status = AgentStatus.ERROR
            logger.error(f"❌ [{self.name}] Failed after {elapsed:.2f}s: {e}")
            return AgentResult(
                agent_name=self.name,
                task_id=task.task_id,
                content="",
                error=str(e),
                success=False,
                execution_time=elapsed,
            )

    @abstractmethod
    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Execute the given task — must be implemented by every agent subclass.
        """
        ...
