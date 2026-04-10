"""
Analyst Agent — Handles computation, data analysis, and code execution tasks.
Uses sandboxed Python execution for data processing.
"""

import logging
import asyncio
import io
import contextlib
from typing import List

from agents.base_agent import BaseAgent, AgentTask, AgentResult

logger = logging.getLogger(__name__)


class AnalystAgent(BaseAgent):
    """
    Handles computation tasks including Python code execution,
    data analysis, comparisons, and structured analysis.
    """

    def __init__(self, ai_engine):
        super().__init__()
        self.ai_engine = ai_engine

    @property
    def name(self) -> str:
        return "Analyst Agent"

    @property
    def description(self) -> str:
        return "Handles computation, data analysis, and code execution tasks"

    @property
    def capabilities(self) -> List[str]:
        return ["code_execution", "data_analysis", "comparison", "computation"]

    def _safe_execute_code(self, code: str) -> str:
        """Execute Python code in a sandboxed environment."""
        # Restricted builtins for safety
        safe_builtins = {
            "print": print, "len": len, "range": range, "int": int,
            "float": float, "str": str, "list": list, "dict": dict,
            "tuple": tuple, "set": set, "bool": bool, "abs": abs,
            "max": max, "min": min, "sum": sum, "round": round,
            "sorted": sorted, "enumerate": enumerate, "zip": zip,
            "map": map, "filter": filter, "type": type,
            "isinstance": isinstance, "True": True, "False": False,
            "None": None,
        }

        output_buffer = io.StringIO()
        try:
            with contextlib.redirect_stdout(output_buffer):
                exec(code, {"__builtins__": safe_builtins}, {})
            result = output_buffer.getvalue()
            return result if result.strip() else "Code executed successfully (no output)."
        except Exception as e:
            return f"Execution error: {type(e).__name__}: {e}"
        finally:
            output_buffer.close()

    async def execute(self, task: AgentTask) -> AgentResult:
        """Analyze data, run code, or perform comparisons."""
        query = task.query
        context = task.context or ""
        analysis_type = task.parameters.get("analysis_type", "general")

        # Step 1: If code execution is requested
        if analysis_type == "code_execution":
            code = task.parameters.get("code", "")
            if code:
                result = await asyncio.to_thread(self._safe_execute_code, code)
                return AgentResult(
                    agent_name=self.name,
                    task_id=task.task_id,
                    content=f"**Code Execution Result:**\n```\n{result}\n```",
                    confidence=0.9,
                    metadata={"analysis_type": "code_execution"},
                )

        # Step 2: Use LLM for analytical reasoning
        prompt = self._build_analysis_prompt(query, context, analysis_type)

        try:
            analysis = await self.ai_engine.chat(
                message=prompt,
                temperature=0.4,
                max_tokens=2048,
            )
        except Exception as e:
            return AgentResult(
                agent_name=self.name,
                task_id=task.task_id,
                content=f"Analysis failed: {e}",
                confidence=0.1,
                success=False,
                error=str(e),
            )

        return AgentResult(
            agent_name=self.name,
            task_id=task.task_id,
            content=analysis,
            confidence=0.8,
            metadata={"analysis_type": analysis_type},
        )

    def _build_analysis_prompt(
        self, query: str, context: str, analysis_type: str
    ) -> str:
        """Build analysis prompt based on the type of analysis requested."""
        if analysis_type == "comparison":
            return (
                f"Perform a detailed comparison analysis for the following query.\n\n"
                f"Query: {query}\n\n"
                f"{'Context: ' + context if context else ''}\n\n"
                f"Provide a structured comparison with:\n"
                f"1. Key similarities\n"
                f"2. Key differences\n"
                f"3. Summary table\n"
                f"4. Conclusion"
            )
        elif analysis_type == "data_analysis":
            return (
                f"Perform a data analysis for the following query.\n\n"
                f"Query: {query}\n\n"
                f"{'Data context: ' + context if context else ''}\n\n"
                f"Provide:\n"
                f"1. Key findings\n"
                f"2. Patterns and trends\n"
                f"3. Statistical insights\n"
                f"4. Recommendations"
            )
        else:
            return (
                f"Provide a thorough analytical response to the following query.\n\n"
                f"Query: {query}\n\n"
                f"{'Additional context: ' + context if context else ''}\n\n"
                f"Structure your response with clear sections and actionable insights."
            )
