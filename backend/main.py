import os
os.environ["USE_TF"] = "0"
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
import asyncio
from arq import create_pool
from arq.connections import RedisSettings
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import shared state (breaks circular imports)
import app_state
from utils.logging_config import setup_logging, get_logger
from utils.env_validator import validate_environment
import time

# Initialize structured logging first
setup_logging()
logger = get_logger(__name__)

# Import agents
from agents.orchestrator import OrchestratorAgent
from agents.web_agent import WebAgent
from agents.analyst_agent import AnalystAgent
from agents.reviewer_agent import ReviewerAgent
from agents.research_agent import ResearchAgent
from services.document_classifier import classifier as doc_classifier
from services.database import init_db
from services.auth_service import validate_jwt_secret

# Initialize Multi-Agent System using shared state instances
orchestrator = OrchestratorAgent(app_state.get_ai_engine())
web_agent = WebAgent(app_state.get_ai_engine())
analyst_agent = AnalystAgent(app_state.get_ai_engine())
reviewer_agent = ReviewerAgent(app_state.get_ai_engine())
research_agent = ResearchAgent(app_state.get_vector_db(), app_state.get_ai_engine())

# Register agents with orchestrator
orchestrator.register_agent(research_agent)
orchestrator.register_agent(web_agent)
orchestrator.register_agent(analyst_agent)
orchestrator.register_agent(reviewer_agent)

# Store orchestrator in shared state
app_state.orchestrator = orchestrator

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management for V2.0.0 - Resilient startup"""
    print("\n" + "="*60)
    print(" AI Digital Brain Backend - Startup Sequence")
    print("="*60)
    
    # 0. Validate environment (non-blocking)
    try:
        await validate_environment()
    except Exception as e:
        print(f" Environment validation: {e}")
    
    # 1. Validate JWT Secret (required)
    try:
        validate_jwt_secret()
        print(" JWT Secret validated")
    except Exception as e:
        print(f" JWT validation: {e}. Using fallback.")
    
    # 2. Initialize database (optional - continue if fails)
    try:
        init_db()
        print(" Database initialized")
    except Exception as e:
        print(f" Database init skipped: {e}")
    
    # 3. Initialize services (non-blocking - continue on error)
    try:
        print(" Initializing AI services...")
        await asyncio.gather(
            app_state.get_vector_db().initialize(),
            app_state.get_ai_engine().initialize(),
            return_exceptions=True
        )
        print(" AI services initialized")
    except Exception as e:
        print(f" AI services init: {e} (continuing...)")
    
    # 4. Train classifier (non-critical - background task)
    try:
        import asyncio as aio
        await aio.to_thread(doc_classifier.train)
        print(" Document classifier trained")
    except Exception as e:
        print(f" Classifier training skipped: {e}")
    
    print(f" Multi-Agent System ready: {len(orchestrator.agents)} agents")
    for name in orchestrator.agents:
        print(f"    {name}")
    
    # 5. Initialize arq pool (optional - continues without Redis)
    try:
        app_state.arq_pool = await create_pool(RedisSettings())
        print(" Background task pool (Redis) enabled")
    except Exception as e:
        print(f" Redis not available: {e}")
        print("    Using standard BackgroundTasks")
        app_state.arq_pool = None
    
    print("="*60)
    print(" Backend Ready - API: http://localhost:8000")
    print("="*60 + "\n")
    
    yield
    
    # Shutdown logic
    if app_state.arq_pool:
        try:
            await app_state.arq_pool.close()
        except Exception as e:
            logger.warning(f"Error closing arq pool: {e}")

# Initialize FastAPI app
app = FastAPI(
    title="Offline AI Digital Brain",
    description="Privacy-first local AI chatbot powered by Ollama LLM with multi-agent system",
    version="2.0.0",
    lifespan=lifespan
)

# Initialize Rate Limiter from app_state
from app_state import limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZIP compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_observability_middleware(request: Request, call_next):
    """Track request latency (Phase 3.3 Milestone)"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Add header for frontend visibility
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    
    # Structured logging of the request
    logger.info(
        "api_request",
        method=request.method,
        path=request.url.path,
        duration_ms=round(process_time * 1000, 2),
        status_code=response.status_code
    )
    
    return response

# Serve uploaded assets as static files
import os
os.makedirs('static/assets', exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount('/static', StaticFiles(directory='static'), name='static')

# Import and include API routes
from routes import chat, documents, web_creator, imagegen, vlm, auth, simulation, dashboard, scholar, agents as agents_route, summarize as summarize_route, ocr as ocr_route, translate as translate_route, background as background_route

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(web_creator.router, prefix="/api/web-creator", tags=["Web Creator"])
app.include_router(imagegen.router, prefix="/api/imagegen", tags=["Image Generation"])
app.include_router(vlm.router, prefix="/api/vlm", tags=["Vision"])
app.include_router(scholar.router, prefix="/api/scholar", tags=["Scholar"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(agents_route.router, prefix="/api/agents", tags=["agents"])
app.include_router(summarize_route.router, prefix="/api/summarize", tags=["summarize"])
app.include_router(ocr_route.router, prefix="/api/ocr", tags=["ocr"])
app.include_router(translate_route.router, prefix="/api/translate", tags=["translate"])
app.include_router(background_route.router, prefix="/api/background", tags=["background"])


# Optional advanced background remover
try:
    from routes import background_advanced as background_advanced_route
    app.include_router(background_advanced_route.router, prefix="/api/background", tags=["background"])
except ImportError:
    print("Warning: Advanced background remover routes not available")


@app.get("/")
async def root():
    return {
        "message": "Offline AI Digital Brain API",
        "status": "running",
        "mode": "local",
        "version": "2.0.0",
        "multi_agent_system": True,
        "agents_count": len(orchestrator.agents) + 1,
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "ai_engine": await app_state.get_ai_engine().health_check(),
        "multi_agent_system": {
            "orchestrator": orchestrator.status.value,
            "agents": {name: agent.status.value for name, agent in orchestrator.agents.items()},
        },
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8001,
        reload=False,
        log_level="info"
    )
