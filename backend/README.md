# Offline AI Digital Brain - Backend

A powerful FastAPI backend for the Offline AI Digital Brain project, featuring local AI processing, document analysis, and semantic search capabilities.

## 🚀 Features

- **Local AI Processing**: Uses Ollama for completely offline AI inference
- **Document Processing**: Upload and analyze PDFs with automatic summarization
- **Semantic Search**: ChromaDB-powered vector database for intelligent knowledge retrieval
- **Real-time Chat**: Streaming responses with conversation history
- **Privacy-First**: All data processing happens locally on your machine

## 🛠️ Technology Stack

- **Backend Framework**: FastAPI
- **AI Engine**: Ollama (Mistral, LLaMA models)
- **AI Framework**: LangChain
- **Vector Database**: ChromaDB
- **Document Processing**: PyPDF2
- **Language**: Python 3.10+

## 📋 Prerequisites

1. **Python 3.10+** installed
2. **Ollama** installed and running
   ```bash
   # Install Ollama (macOS/Linux)
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Pull a model
   ollama pull mistral
   ```

## 🔧 Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env file with your preferences
   ```

## 🚀 Running the Backend

### Method 1: Using the run script (Development)
```bash
python run.py
```

### Method 2: Recommended Startup (Production/High Performance)
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Method 2: Direct uvicorn command
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📡 API Endpoints

### Chat Endpoints
- `POST /api/chat/` - Send chat message
- `POST /api/chat/stream` - Stream chat response
- `GET /api/chat/conversations` - Get conversation list
- `GET /api/chat/conversations/{id}` - Get specific conversation

### Document Endpoints
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/` - List all documents
- `GET /api/documents/{id}` - Get document details
- `DELETE /api/documents/{id}` - Delete document

### Knowledge Base Endpoints
- `POST /api/knowledge/search` - Search knowledge base
- `GET /api/knowledge/stats` - Get knowledge statistics

### Dashboard Endpoints
- `GET /api/dashboard/stats` - System statistics
- `GET /api/dashboard/health` - Health check
- `GET /api/dashboard/models` - Available AI models

## 🗂️ Project Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── run.py                  # Server startup script
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── routes/                # API route handlers
│   ├── chat.py           # Chat endpoints
│   ├── documents.py      # Document management
│   ├── knowledge.py      # Knowledge base search
│   └── dashboard.py      # System monitoring
├── services/              # Core business logic
│   ├── ai_engine.py      # Ollama AI integration
│   └── vector_db.py      # ChromaDB operations
├── models/                # Pydantic data models
│   └── request_models.py # API request/response models
├── utils/                 # Utility functions
│   └── pdf_reader.py     # PDF processing utilities
└── data/                  # Data storage (created at runtime)
    ├── uploads/          # Uploaded documents
    └── chromadb/         # Vector database files
```

## 🔧 Configuration

Key configuration options in `.env`:

```env
# AI Model Settings
DEFAULT_AI_MODEL=mistral
AI_TEMPERATURE=0.7
MAX_TOKENS=2048
CONTEXT_WINDOW=4096
MAX_CONTEXT_CHUNKS=5

# Document Processing
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# Server Settings
API_PORT=8000
DEBUG=True
```

## 🧠 AI Models

Supported models (via Ollama):
- **Mistral**: General purpose, good balance of speed and quality
- **LLaMA**: High quality responses, slower inference
- **CodeLlama**: Optimized for code-related tasks

To add a new model:
```bash
ollama pull <model-name>
```

## 📊 Monitoring

The backend provides comprehensive monitoring:
- System health checks
- Performance metrics
- Resource usage tracking
- Error logging

Access monitoring at: http://localhost:8000/api/dashboard/health

## 🔒 Security & Privacy

- **Local Processing**: All AI inference happens on your machine
- **No External Calls**: No data sent to external APIs
- **File Security**: Uploaded documents stored locally
- **CORS Protection**: Configured for frontend integration

## 🐛 Troubleshooting

### Common Issues

1. **Ollama not found**
   ```bash
   # Make sure Ollama is installed and running
   ollama serve
   ```

2. **Model not available**
   ```bash
   # Pull the required model
   ollama pull mistral
   ```

3. **Port already in use**
   ```bash
   # Change port in .env or kill existing process
   lsof -ti:8000 | xargs kill -9
   ```

4. **Permission errors**
   ```bash
   # Ensure data directories are writable
   chmod -R 755 ./data/
   ```

## 📈 Performance Tips

1. **Use SSD storage** for better vector database performance
2. **Allocate sufficient RAM** (minimum 8GB recommended)
3. **Use GPU acceleration** if available (configure Ollama accordingly)
4. **Adjust chunk sizes** based on your document types

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation at `/docs`
3. Create an issue on GitHub
4. Check Ollama documentation for model-specific issues