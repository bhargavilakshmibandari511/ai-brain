"""
Agent API Routes — Endpoints to inspect and interact with the Multi-Agent System.
"""

from fastapi import APIRouter, HTTPException
import uuid

from agents.base_agent import AgentTask
import app_state

router = APIRouter()


@router.get("/")
async def list_agents():
    """List all registered agents and their current status."""
    if not app_state.orchestrator:
        return {"total_agents": 0, "agents": []}

    agents_info = []
    for name, agent in app_state.orchestrator.agents.items():
        agents_info.append(agent.stats)

    # Include the orchestrator itself
    agents_info.insert(0, app_state.orchestrator.stats)

    return {
        "total_agents": len(agents_info),
        "agents": agents_info,
    }


@router.get("/{agent_name}/status")
async def get_agent_status(agent_name: str):
    """Get the status of a specific agent."""
    if not app_state.orchestrator:
        raise HTTPException(status_code=503, detail="Multi-agent system not initialized")

    if agent_name.lower() == "orchestrator agent":
        return app_state.orchestrator.stats

    for name, agent in app_state.orchestrator.agents.items():
        if name.lower() == agent_name.lower():
            return agent.stats

    raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")


from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class AgentExecuteRequest(BaseModel):
    agent_name: str
    query: str
    task_type: str = "general"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    context: Optional[str] = None

@router.post("/execute")
@router.post("/invoke")
async def execute_agent(body: AgentExecuteRequest):
    """Directly execute a specific agent (for testing/debugging)."""
    if not app_state.orchestrator:
        raise HTTPException(status_code=503, detail="Multi-agent system not initialized")

    agent_name = body.agent_name
    target_agent = None
    if agent_name.lower() in ("orchestrator", "orchestrator agent"):
        target_agent = app_state.orchestrator
    else:
        for name, agent in app_state.orchestrator.agents.items():
            if name.lower() == agent_name.lower():
                target_agent = agent
                break

    if not target_agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_name}' not found")

    task = AgentTask(
        task_id=str(uuid.uuid4()),
        task_type=body.task_type,
        query=body.query,
        parameters=body.parameters,
        context=body.context,
    )

    result = await target_agent.run(task)
    return result.to_dict()
