#!/usr/bin/env python3
"""
Simplified Backend Startup - Bypasses problematic initialization
Best used while debugging connection issues
"""

import uvicorn
import os
import sys
from pathlib import Path
import logging

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Setup basic logging before imports
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main entry point for the backend server"""
    
    logger.info("Starting Offline AI Digital Brain Backend (SIMPLE MODE)...")
    logger.info("=" * 60)
    
    # Create necessary directories
    data_dir = backend_dir / "data"
    os.makedirs(data_dir / "uploads", exist_ok=True)
    os.makedirs(data_dir / "chromadb", exist_ok=True)
    os.makedirs(data_dir / "bg_uploads", exist_ok=True)
    os.makedirs(data_dir / "bg_outputs", exist_ok=True)
    os.makedirs(data_dir / "ocr_uploads", exist_ok=True)
    
    logger.info("✓ Data directories ready")
    logger.info("=" * 60)
    logger.info("Starting FastAPI server...")
    logger.info("API will be available at: http://localhost:8000")
    logger.info("API docs at: http://localhost:8000/docs")
    logger.info("=" * 60)
    
    # Start the server with minimal config
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=False,  # Disable reload to avoid double-initialization
            log_level="info"
        )
    except Exception as e:
        logger.error(f"Failed to start server: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
