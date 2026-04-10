import asyncio
import logging
import os
from arq.connections import RedisSettings
from services.vector_db import VectorDB
from utils.pdf_reader import PDFReader
import app_state

# We need to re-initialize some things for the worker process
logger = logging.getLogger(__name__)
pdf_reader = PDFReader()
vector_db = VectorDB()

async def process_document(ctx, document_id: str, file_path: str, filename: str, content_type: str):
    """arq worker job to process document"""
    logger.info(f"Worker processing document: {filename} ({document_id})")
    
    try:
        # Initialize VectorDB if not done
        if not vector_db.is_initialized:
            await vector_db.initialize()
            
        # 1. Extract text
        text_content = ""
        if filename.lower().endswith('.pdf'):
            text_content = await pdf_reader.extract_text(file_path)
        else:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text_content = f.read()
        
        if not text_content:
            logger.error(f"No text extracted for {document_id}")
            return "error_no_text"
            
        # 2. Chunk
        chunks = pdf_reader.split_into_chunks(text_content)
        
        # 3. Vector Indexing
        await vector_db.add_document(
            document_id=document_id,
            chunks=chunks,
            metadata={"filename": filename, "content_type": content_type},
            filename=filename
        )
        
        logger.info(f"Worker completed processing for {document_id}")
        return "completed"
    except Exception as e:
        logger.error(f"Worker failed for {document_id}: {e}")
        return "error"

async def startup(ctx):
    await vector_db.initialize()

class WorkerSettings:
    functions = [process_document]
    on_startup = startup
    redis_settings = RedisSettings()
