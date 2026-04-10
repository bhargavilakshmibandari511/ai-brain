import sqlite3
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATABASE_FILE = Path(__file__).parent.parent / "data" / "brain.db"

def get_db_connection():
    """Establishes a connection to the SQLite database with concurrency support."""
    conn = sqlite3.connect(
        DATABASE_FILE, 
        timeout=30.0, 
        check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA cache_size=10000;")
    return conn

def init_db():
    """Initializes the database and creates tables if they don't exist."""
    print("Initializing SQLite database tables (v2.0.0)...")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL
    )
    """)

    # 2. Chat history (v2.0.0 enhanced)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        doc_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 3. Documents (v2.0.0)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        status TEXT DEFAULT 'processing',
        version INTEGER DEFAULT 1,
        chunk_count INTEGER DEFAULT 0,
        summary TEXT,
        category TEXT,
        processing_time REAL,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 4. XP History (v2.0.0)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS xp_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        xp INTEGER NOT NULL,
        reason TEXT,
        doc_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 5. Projects (Legacy)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        name TEXT NOT NULL,
        domain TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)

    # 6. Pages (Legacy)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        html TEXT,
        css TEXT,
        js TEXT,
        thought_process TEXT,
        style_tokens TEXT DEFAULT '{}',
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id)
    )
    """)

    # 7. Assets (Legacy)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT,
        size INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id)
    )
    """)

    conn.commit()
    conn.close()
    print("[OK] Database initialized successfully.")

# ─── Auth ───────────────────────────────────────────────────────────────────

def add_user_to_db(username: str, hashed_password: str):
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, hashed_password) VALUES (?, ?)",
            (username, hashed_password),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()
    return {"username": username}

# ─── Chat ───────────────────────────────────────────────────────────────────

def db_save_chat_message(session_id, user_id, doc_id, role, content, metadata=None):
    conn = get_db_connection()
    meta_json = json.dumps(metadata or {})
    conn.execute(
        "INSERT INTO chat_history (session_id, user_id, doc_id, role, content, metadata) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, user_id, doc_id, role, content, meta_json)
    )
    conn.commit()
    conn.close()

def db_get_chat_history(session_id, doc_id=None, limit=50, offset=0):
    conn = get_db_connection()
    if doc_id:
        rows = conn.execute(
            "SELECT * FROM chat_history WHERE session_id = ? AND doc_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?",
            (session_id, doc_id, limit, offset)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM chat_history WHERE session_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?",
            (session_id, limit, offset)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_clear_chat_history(session_id, doc_id=None):
    conn = get_db_connection()
    if doc_id:
        conn.execute("DELETE FROM chat_history WHERE session_id = ? AND doc_id = ?", (session_id, doc_id))
    else:
        conn.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()

# ─── Documents ────────────────────────────────────────────────────────────────

def db_create_document(doc_id, user_id, filename, file_path, status, version):
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, status, version) VALUES (?, ?, ?, ?, ?, ?)",
        (doc_id, user_id, filename, file_path, status, version)
    )
    conn.commit()
    conn.close()

def db_update_document(doc_id, **kwargs):
    if not kwargs: return
    conn = get_db_connection()
    keys = [f"{k} = ?" for k in kwargs.keys()]
    query = f"UPDATE documents SET {', '.join(keys)} WHERE id = ?"
    params = list(kwargs.values()) + [doc_id]
    conn.execute(query, params)
    conn.commit()
    conn.close()

def db_get_document(doc_id):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def db_list_documents(status=None, category=None, limit=50, offset=0):
    conn = get_db_connection()
    query = "SELECT * FROM documents WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_delete_document(doc_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()

def db_get_doc_versions(filename):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM documents WHERE filename = ? ORDER BY version DESC", (filename,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ─── XP ───────────────────────────────────────────────────────────────────────

def db_award_xp(user_id, xp, reason, doc_id=None):
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO xp_history (user_id, xp, reason, doc_id) VALUES (?, ?, ?, ?)",
        (user_id, xp, reason, doc_id)
    )
    conn.commit()
    conn.close()
    logger.info(f"Awarded {xp} XP to {user_id} for {reason}")
