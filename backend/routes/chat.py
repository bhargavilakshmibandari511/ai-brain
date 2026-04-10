from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Dict, Optional
import json
import time
import uuid
from datetime import datetime
from pydantic import BaseModel

from models.request_models import (
    ChatRequest, ChatResponse, ChatMessage,
    MultiAgentChatResponse, AgentTraceStep,
)
from agents.base_agent import AgentTask

router = APIRouter()
import app_state
import base64
from services.vlm_service import vlm_stream

# In-memory conversation storage
conversations: Dict[str, List[ChatMessage]] = {}


# ═══ RAG Document Chat Request Model ═══
class DocumentChatRequest(BaseModel):
    """Request model for RAG-based document chat"""
    user_id: str = "anonymous"
    document_id: Optional[str] = None       # single doc (from frontend)
    document_ids: Optional[List[str]] = None # multiple docs
    message: str
    conversation_id: Optional[str] = None
    temperature: float = 0.3
    max_tokens: int = 2048
    max_context_chunks: int = 8


@router.post("/document")
async def chat_with_document(request: DocumentChatRequest):
    """
    RAG-enabled endpoint for chatting with uploaded documents.
    Retrieves relevant context from vector DB and sends to LLM.
    """
    try:
        start_time = time.time()
        conversation_id = request.conversation_id or str(uuid.uuid4())

        # Support both document_id (single) and document_ids (list)
        doc_ids = request.document_ids or ([request.document_id] if request.document_id else [])

        # 1. Get conversation history for this document
        doc_conv_key = f"doc_{doc_ids[0] if doc_ids else 'none'}_{conversation_id}"
        history = conversations.get(doc_conv_key, [])
        history_for_ai = [{"role": m.role, "content": m.content} for m in history[-5:]]

        # 2. Retrieve relevant chunks from vector database
        search_results = await app_state.get_vector_db().search_knowledge(
            query=request.message,
            limit=request.max_context_chunks,
            similarity_threshold=0.2  # Low threshold - ChromaDB default embeddings need this
        )

        # Filter results to only include chunks from the requested documents
        doc_chunks = [
            r for r in search_results 
            if r.get('metadata', {}).get('doc_id') in doc_ids
        ]

        if not doc_chunks:
            # Try with lower threshold if no results — search across all docs
            fallback_results = await app_state.get_vector_db().search_knowledge(
                query=request.message,
                limit=request.max_context_chunks,
                similarity_threshold=0.2
            )
            doc_chunks = [
                r for r in fallback_results 
                if r.get('metadata', {}).get('doc_id') in doc_ids
            ]

        # 3. Build context from retrieved chunks
        context_parts = []
        sources = []
        for chunk in doc_chunks:
            content = chunk.get('content', '')
            source = chunk.get('source', 'Unknown')
            if content:
                context_parts.append(f"[{source}]: {content}")
                sources.append(source)

        context = "\n\n".join(context_parts) if context_parts else ""

        # 4. Build STRONG system prompt — forces LLM to answer from document
        if context:
            system_prompt = (
                "You are a document analysis assistant. You MUST answer the user's question "
                "using ONLY the document context provided below. "
                "Do NOT use your general knowledge. Do NOT say 'I don't have access to the document'. "
                "The document content IS provided below — read it carefully and answer.\n\n"
                "═══ DOCUMENT CONTEXT ═══\n"
                f"{context}\n"
                "═══ END CONTEXT ═══\n\n"
                "INSTRUCTIONS:\n"
                "- Answer ONLY from the context above\n"
                "- Be detailed and specific\n"
                "- Quote relevant parts when appropriate\n"
                "- If the context truly doesn't address the question, say 'This topic is not covered in the uploaded document.'"
            )
        else:
            system_prompt = (
                "No relevant document context was found for this question. "
                "The document may still be processing. "
                "Tell the user to wait a moment and try again, or rephrase their question."
            )

        # 5. Get AI response with document context
        response = await app_state.get_ai_engine().chat(
            message=request.message,
            conversation_history=history_for_ai,
            system_prompt=system_prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        # 6. Save to conversation history
        app_state.get_user_service().save_chat_message(request.user_id, "user", request.message, conversation_id)
        app_state.get_user_service().save_chat_message(request.user_id, "assistant", response, conversation_id)
        
        if doc_conv_key not in conversations:
            conversations[doc_conv_key] = []
        conversations[doc_conv_key].extend([
            ChatMessage(role="user", content=request.message, timestamp=datetime.now()),
            ChatMessage(role="assistant", content=response, timestamp=datetime.now()),
        ])

        return {
            "response": response,
            "conversation_id": conversation_id,
            "sources": list(set(sources)),
            "chunks_used": len(doc_chunks),
            "processing_time": round(time.time() - start_time, 2),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def chat(request: ChatRequest):
    """Direct LLM chat (non-streaming). agent_mode=True routes through MAS."""
    try:
        start_time = time.time()
        conversation_id = request.conversation_id or str(uuid.uuid4())

        history = conversations.get(conversation_id, [])
        history_for_ai = [{"role": m.role, "content": m.content} for m in history[-10:]]

        # ═══ Multi-Agent Mode ═══
        if request.agent_mode and app_state.orchestrator:
            task = AgentTask(
                task_id=str(uuid.uuid4()),
                task_type="chat",
                query=request.message,
                parameters={
                    "conversation_history": history_for_ai,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                },
            )
            result = await app_state.orchestrator.run(task)

            if conversation_id not in conversations:
                conversations[conversation_id] = []
            conversations[conversation_id].extend([
                ChatMessage(role="user", content=request.message, timestamp=datetime.now()),
                ChatMessage(role="assistant", content=result.content, timestamp=datetime.now()),
            ])

            trace_steps = [
                AgentTraceStep(
                    step=s.get("step", ""),
                    agent=s.get("agent", ""),
                    detail=s.get("detail", ""),
                    reasoning=s.get("reasoning"),
                    status=s.get("status"),
                )
                for s in result.metadata.get("trace", [])
            ]

            return MultiAgentChatResponse(
                response=result.content,
                conversation_id=conversation_id,
                sources=result.sources,
                processing_time=round(time.time() - start_time, 2),
                agent_mode=True,
                agents_used=result.metadata.get("agents_used", []),
                confidence=result.confidence,
                trace=trace_steps,
            )

        # ═══ Direct LLM Mode ═══
        # Prepare history — optionally prepend system context
        final_history = history_for_ai
        if request.context:
            # Insert context as system message at the start
            final_history = [{"role": "system", "content": request.context}] + final_history
        
        response = await app_state.get_ai_engine().chat(
            message=request.message,
            conversation_history=final_history,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

        if conversation_id not in conversations:
            conversations[conversation_id] = []
        conversations[conversation_id].extend([
            ChatMessage(role="user", content=request.message, timestamp=datetime.now()),
            ChatMessage(role="assistant", content=response, timestamp=datetime.now()),
        ])

        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
            sources=[],
            processing_time=round(time.time() - start_time, 2),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """True streaming SSE chat — tokens appear word-by-word."""
    conversation_id = request.conversation_id or str(uuid.uuid4())
    history = conversations.get(conversation_id, [])
    history_for_ai = [{"role": m.role, "content": m.content} for m in history[-10:]]

    async def event_generator():
        full_response = ""
        try:
            if request.image_b64:
                image_bytes = base64.b64decode(request.image_b64)
                async for token in vlm_stream(image_bytes, request.message, "general"):
                    full_response += token
                    payload = json.dumps({"token": token, "conversation_id": conversation_id})
                    yield f"data: {payload}\n\n"
            else:
                async for token in app_state.get_ai_engine().chat_stream(
                    message=request.message,
                    conversation_history=history_for_ai,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens,
                ):
                    full_response += token
                    payload = json.dumps({"token": token, "conversation_id": conversation_id})
                    yield f"data: {payload}\n\n"

            # Save to history
            if conversation_id not in conversations:
                conversations[conversation_id] = []
            conversations[conversation_id].extend([
                ChatMessage(role="user", content=request.message, timestamp=datetime.now()),
                ChatMessage(role="assistant", content=full_response, timestamp=datetime.now()),
            ])
            yield f"data: {json.dumps({'done': True, 'conversation_id': conversation_id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/conversations")
async def get_conversations():
    summaries = []
    for conv_id, msgs in conversations.items():
        if msgs:
            preview = msgs[0].content[:80] + ("..." if len(msgs[0].content) > 80 else "")
            summaries.append({
                "id": conv_id,
                "title": preview,
                "message_count": len(msgs),
                "last_updated": msgs[-1].timestamp,
            })
    return {"conversations": summaries}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation_id": conversation_id, "messages": conversations[conversation_id]}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"message": "Deleted"}
    raise HTTPException(status_code=404, detail="Not found")


@router.post("/clear-all")
async def clear_all():
    conversations.clear()
    return {"message": "All conversations cleared"}