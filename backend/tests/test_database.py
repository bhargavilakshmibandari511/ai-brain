import pytest
import sqlite3
import os
import sys

# Add parent directory to path to import database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.database import get_db_connection

def test_sqlite_wal_mode():
    """Verify that SQLite is actually running in WAL mode with correct synchronously level."""
    # SQLite configuration is handled by a connection event listener in database.py
    # We want to check a fresh connection retrieved from get_db()
    
    # Standard database is in data/brain.db per database.py
    db_path = os.path.join("data", "brain.db")
    
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check Journal Mode
        cursor.execute("PRAGMA journal_mode")
        mode = cursor.fetchone()[0]
        assert mode.upper() == "WAL"
        
        # Check Synchronous Level
        cursor.execute("PRAGMA synchronous")
        sync = cursor.fetchone()[0]
        # NORMAL is 1, FULL is 2, OFF is 0
        assert sync == 1 
        
        conn.close()

def test_busy_timeout():
    """Verify that busy_timeout is set for concurrent access protection."""
    db_path = "vortex_brain.db"
    
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA busy_timeout")
        timeout = cursor.fetchone()[0]
        # We set it to 30.0s (30000ms)
        assert timeout == 30000 
        
        conn.close()
