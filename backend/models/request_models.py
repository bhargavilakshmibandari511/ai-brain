from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[datetime] = None

class ChatRequest(BaseModel):
    message: str
    context: str = ""  # Optional system context (for Paper Chat, RAG, etc)
    conversation_id: Optional[str] = None
    agent_mode: bool = False  # Multi-agent mode (off = direct LLM)
    image_b64: Optional[str] = None  # Base64 encoded image for VLM support
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = True  # New default for V2.0.0

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    sources: List[str] = []
    processing_time: float

# --- Multi-Agent System Models ---

class AgentTraceStep(BaseModel):
    """One step in the agent execution trace."""
    step: str
    agent: str
    detail: str
    reasoning: Optional[str] = None
    status: Optional[str] = None

class MultiAgentChatResponse(BaseModel):
    """Extended chat response with agent trace information."""
    response: str
    conversation_id: str
    sources: List[str] = []
    processing_time: float
    agent_mode: bool = True
    agents_used: List[str] = []
    confidence: float = 0.0
    trace: List[AgentTraceStep] = []

# --- Existing Models ---

class DocumentUpload(BaseModel):
    filename: str
    content_type: str
    size: int

class DocumentProcessRequest(BaseModel):
    document_id: str
    chunk_size: int = 1000
    chunk_overlap: int = 200

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: str  # "processing", "completed", "error"
    summary: Optional[str] = None
    chunks_count: Optional[int] = None
    page_count: Optional[int] = None
    category: Optional[str] = None
    confidence: Optional[float] = None
    upload_date: datetime

class KnowledgeSearchRequest(BaseModel):
    query: str
    limit: int = 10
    similarity_threshold: float = 0.7

class KnowledgeItem(BaseModel):
    id: str
    title: str
    content: str
    source: str
    relevance_score: float
    created_date: datetime

class SystemStats(BaseModel):
    total_documents: int
    total_conversations: int
    total_knowledge_items: int
    ai_model_status: str
    memory_usage: Dict[str, Any]
    processing_speed: float

class SettingsUpdate(BaseModel):
    ai_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None