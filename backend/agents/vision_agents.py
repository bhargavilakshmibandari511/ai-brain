"""
Vision Agents — Multi-agent VLM architecture
Each agent specialises in a task (OCR, UI, Chart, Reasoning).
The VisionOrchestrator auto-routes or runs a full parallel pipeline.
"""

import asyncio
from abc import ABC, abstractmethod
from services.vlm_service import vlm_understand, select_model


class BaseVisionAgent(ABC):
    name: str
    task: str

    async def run(self, image_bytes: bytes, query: str) -> dict:
        result = await vlm_understand(image_bytes, self.prompt(query), self.task)
        return {
            "agent": self.name,
            "task": self.task,
            "result": result,
            "model": select_model(self.task),
        }

    @abstractmethod
    def prompt(self, query: str) -> str: ...


# ── Specialist agents ───────────────────────────────────────

class OCRAgent(BaseVisionAgent):
    name = "OCR Agent"
    task = "ocr"

    def prompt(self, query: str) -> str:
        return (
            "Extract ALL text visible in this image. "
            "Preserve tables, columns, bullet points, headings and layout. "
            "Return structured plain text only, no commentary."
        )


class UIAgent(BaseVisionAgent):
    name = "UI Agent"
    task = "ui"

    def prompt(self, query: str) -> str:
        return (
            f"Analyse this UI screenshot. {query}\n"
            "Identify: layout structure, UI components, colour scheme, "
            "navigation patterns, and any usability or accessibility issues."
        )


class ChartAgent(BaseVisionAgent):
    name = "Chart Agent"
    task = "chart"

    def prompt(self, query: str) -> str:
        return (
            "Analyse this chart or graph thoroughly. Provide:\n"
            "1. Chart type\n"
            "2. Title and axis labels\n"
            "3. Key data points and values\n"
            "4. Main trend or insight\n"
            "5. Any notable anomalies or outliers"
        )


class ReasoningAgent(BaseVisionAgent):
    name = "Reasoning Agent"
    task = "general"

    def prompt(self, query: str) -> str:
        return query if query.strip() else "Describe this image in detail."


# ── Orchestrator ────────────────────────────────────────────

class VisionOrchestrator:
    def __init__(self):
        self.agents: dict[str, BaseVisionAgent] = {
            "ocr":       OCRAgent(),
            "ui":        UIAgent(),
            "chart":     ChartAgent(),
            "reasoning": ReasoningAgent(),
        }

    def detect_task(self, query: str) -> str:
        """Heuristic task detection from the user query."""
        q = query.lower()
        if any(w in q for w in ["text", "read", "extract", "transcribe", "ocr", "words"]):
            return "ocr"
        if any(w in q for w in ["chart", "graph", "plot", "data", "trend", "bars", "pie"]):
            return "chart"
        if any(w in q for w in ["ui", "design", "screenshot", "interface", "button", "website", "app"]):
            return "ui"
        return "reasoning"

    async def run(self, image_bytes: bytes, query: str, task: str = "auto") -> dict:
        """Run a single agent (auto-detect or manually specified)."""
        if task == "auto":
            task = self.detect_task(query)
        agent = self.agents.get(task, self.agents["reasoning"])
        return await agent.run(image_bytes, query)

    async def run_pipeline(self, image_bytes: bytes) -> dict:
        """Run OCR + Chart + General in parallel and return all results."""
        ocr_task = self.agents["ocr"].run(image_bytes, "")
        chart_task = self.agents["chart"].run(image_bytes, "")
        general_task = self.agents["reasoning"].run(image_bytes, "Describe this image in detail.")
        ocr, chart, general = await asyncio.gather(ocr_task, chart_task, general_task)
        return {"ocr": ocr, "chart": chart, "general": general}
