"""
Orchestrator Agent — The main controller that coordinates all other agents.
Analyzes user queries, decomposes tasks, assigns them to specialized agents,
and synthesizes the final response.
"""

import uuid
import asyncio
import logging
from typing import List, Dict, Any, Optional

from agents.base_agent import BaseAgent, AgentTask, AgentResult

logger = logging.getLogger(__name__)


class OrchestratorAgent(BaseAgent):
    """
    Manager agent that understands user intent, breaks complex queries
    into sub-tasks, delegates to specialized agents, and combines results.
    """

    def __init__(self, ai_engine):
        super().__init__()
        self.ai_engine = ai_engine
        self.agents: Dict[str, BaseAgent] = {}

    def register_agent(self, agent: BaseAgent):
        """Register a specialized agent with the orchestrator."""
        self.agents[agent.name] = agent
        logger.info(f"Orchestrator registered agent: {agent.name}")

    @property
    def name(self) -> str:
        return "Orchestrator Agent"

    @property
    def description(self) -> str:
        return "Coordinates all agents: analyzes queries, decomposes tasks, and synthesizes responses"

    @property
    def capabilities(self) -> List[str]:
        return ["task_decomposition", "agent_coordination", "response_synthesis"]

    async def analyze_intent(self, query: str, task_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Use LLM to understand the user's intent and determine which agents
        to involve. Returns a plan dict.
        """
        agent_descriptions = "\n".join(
            f"- {name}: {agent.description} (capabilities: {', '.join(agent.capabilities)})"
            for name, agent in self.agents.items()
        )

        prompt = (
            f"You are a task planner for a multi-agent AI system. "
            f"Analyze the user's query and decide which agents to use.\n\n"
            f"Available agents:\n{agent_descriptions}\n\n"
            f"User query: {query}\n\n"
            f"Respond in this EXACT format (one agent per line, no extra text):\n"
            f"AGENTS: agent1, agent2\n"
            f"REASONING: brief explanation\n"
            f"ANALYSIS_TYPE: general|comparison|data_analysis|code_execution\n\n"
            f"Rules:\n"
            f"- Use 'Research Agent' if the query relates to uploaded documents or knowledge base\n"
            f"- Use 'Web Agent' if the query needs current/real-time internet information\n"
            f"- Use 'Analyst Agent' if the query requires computation, comparison, or data analysis\n"
            f"- You can select multiple agents if the query is complex\n"
            f"- Always select at least one agent"
        )

        try:
            response = await self.ai_engine.chat(
                message=prompt, temperature=0.1, max_tokens=256
            )
            return self._parse_plan(response)
        except Exception as e:
            logger.error(f"Intent analysis failed: {e}")
            # Default: use Research Agent
            return {
                "agents": ["Research Agent"],
                "reasoning": "Defaulting to Research Agent due to analysis error.",
                "analysis_type": "general",
            }

    def _parse_plan(self, response: str) -> Dict[str, Any]:
        """Parse the LLM's planning response into a structured plan."""
        plan = {
            "agents": [],
            "reasoning": "",
            "analysis_type": "general",
        }

        for line in response.strip().split("\n"):
            line = line.strip()
            if line.upper().startswith("AGENTS:"):
                agent_names = [a.strip() for a in line.split(":", 1)[1].split(",")]
                # Validate agent names
                plan["agents"] = [
                    name for name in agent_names if name in self.agents
                ]
            elif line.upper().startswith("REASONING:"):
                plan["reasoning"] = line.split(":", 1)[1].strip()
            elif line.upper().startswith("ANALYSIS_TYPE:"):
                plan["analysis_type"] = line.split(":", 1)[1].strip().lower()

        # Fallback: if no valid agents, default to Research Agent
        if not plan["agents"]:
            default = "Research Agent" if "Research Agent" in self.agents else None
            if default:
                plan["agents"] = [default]
            elif self.agents:
                plan["agents"] = [next(iter(self.agents))]

        return plan

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Full orchestration pipeline:
        1. Analyze intent
        2. Dispatch to selected agents in parallel
        3. Combine results
        4. Send to Reviewer for quality check
        5. Return final answer with trace
        """
        query = task.query
        conversation_history = task.parameters.get("conversation_history", [])
        trace: List[Dict[str, Any]] = []

        # ── Step 1: Analyze intent ──────────────────────────────────────
        plan = await self.analyze_intent(query)
        trace.append({
            "step": "Task Decomposition",
            "agent": self.name,
            "detail": f"Selected agents: {', '.join(plan['agents'])}",
            "reasoning": plan["reasoning"],
        })

        # ── Step 2: Dispatch to selected agents in parallel ──────────
        sub_tasks = []
        for agent_name in plan["agents"]:
            sub_task = AgentTask(
                task_id=str(uuid.uuid4()),
                task_type=agent_name.lower().replace(" ", "_"),
                query=query,
                context=task.context,
                parameters={
                    "analysis_type": plan.get("analysis_type", "general"),
                    "max_results": 5,
                },
            )
            sub_tasks.append((agent_name, sub_task))

        # Run agents in parallel with a timeout
        async def run_agent(agent_name: str, sub_task: AgentTask) -> AgentResult:
            agent = self.agents[agent_name]
            return await agent.run(sub_task)

        try:
            results = await asyncio.wait_for(
                asyncio.gather(
                    *[run_agent(name, st) for name, st in sub_tasks],
                    return_exceptions=True,
                ),
                timeout=60.0  # 60 second overall timeout for multi-agent execution
            )
        except asyncio.TimeoutError:
            logger.error(f"Orchestration timed out after 60s for query: {query}")
            trace.append({
                "step": "Orchestration Timeout",
                "agent": self.name,
                "detail": "Execution exceeded 60s limit",
                "status": "error",
            })
            results = [Exception("Task timed out")] * len(sub_tasks)

        # Collect results
        agent_results: List[AgentResult] = []
        all_sources: List[str] = []
        for i, result in enumerate(results):
            agent_name = sub_tasks[i][0]
            if isinstance(result, Exception):
                trace.append({
                    "step": f"{agent_name} Execution",
                    "agent": agent_name,
                    "detail": f"Error: {result}",
                    "status": "error",
                })
            elif isinstance(result, AgentResult):
                agent_results.append(result)
                all_sources.extend(result.sources)
                trace.append({
                    "step": f"{agent_name} Execution",
                    "agent": agent_name,
                    "detail": f"Completed in {result.execution_time:.2f}s "
                              f"(confidence: {result.confidence:.0%})",
                    "status": "success" if result.success else "error",
                })

        # ── Step 3: Synthesize combined answer ──────────────────────────
        combined_content = self._synthesize_results(query, agent_results)
        trace.append({
            "step": "Response Synthesis",
            "agent": self.name,
            "detail": f"Combined {len(agent_results)} agent results",
        })

        # ── Step 4: Review (if Reviewer Agent is available) ──────────
        final_content = combined_content
        review_confidence = 0.7

        if "Reviewer Agent" in self.agents:
            review_task = AgentTask(
                task_id=str(uuid.uuid4()),
                task_type="review",
                query=query,
                context=combined_content,
                parameters={
                    "sources": all_sources,
                    "contributing_agents": plan["agents"],
                },
            )
            review_result = await self.agents["Reviewer Agent"].run(review_task)
            review_confidence = review_result.confidence
            trace.append({
                "step": "Quality Review",
                "agent": "Reviewer Agent",
                "detail": f"Confidence: {review_result.confidence:.0%} — "
                          f"{review_result.metadata.get('verdict', 'N/A')}",
                "status": "success",
            })

        # ── Step 5: Build final result ──────────────────────────────────
        return AgentResult(
            agent_name=self.name,
            task_id=task.task_id,
            content=final_content,
            sources=list(set(all_sources)),
            confidence=review_confidence,
            metadata={
                "trace": trace,
                "agents_used": plan["agents"],
                "analysis_type": plan.get("analysis_type", "general"),
                "total_sub_results": len(agent_results),
            },
        )

    def _synthesize_results(
        self, query: str, results: List[AgentResult]
    ) -> str:
        """Combine results from multiple agents into a coherent answer."""
        if not results:
            return "I wasn't able to find relevant information for your query."

        if len(results) == 1:
            return results[0].content

        # Multiple agent results — combine them
        parts = []
        for result in results:
            if result.success and result.content:
                parts.append(
                    f"### {result.agent_name} Findings\n\n{result.content}"
                )

        if not parts:
            return "The agents were unable to produce a useful response."

        combined = "\n\n---\n\n".join(parts)
        return combined
