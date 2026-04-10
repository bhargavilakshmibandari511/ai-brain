#!/usr/bin/env python3
"""
Offline AI Digital Brain - Backend Server
Run this script to start the FastAPI backend server
"""

import uvicorn
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def main():
    """Main entry point for the backend server"""
    
    print("Starting Offline AI Digital Brain Backend...")
    print("=" * 50)
    
    # Create necessary directories
    data_dir = backend_dir / "data"
    os.makedirs(data_dir / "uploads", exist_ok=True)
    os.makedirs(data_dir / "chromadb", exist_ok=True)
    
    print("Data directories created")
    print("Starting FastAPI server...")
    print("API will be available at: http://localhost:8000")
    print("API docs will be available at: http://localhost:8000/docs")
    print("=" * 50)
    
    # Start the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )

if __name__ == "__main__":
    main()