import sqlite3
import os
import uuid
import hashlib
from typing import Optional, List, Dict
from datetime import datetime

class UserService:
    def __init__(self, db_path: str = "backend/data/brain.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(
            self.db_path, 
            timeout=30.0, 
            check_same_thread=False
        ) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=10000;")
            cursor = conn.cursor()
            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Chat history table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS chat_history (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            conn.commit()

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def create_user(self, username: str, password: str) -> Optional[str]:
        user_id = str(uuid.uuid4())
        pw_hash = self._hash_password(password)
        try:
            with sqlite3.connect(
                self.db_path, 
                timeout=30.0, 
                check_same_thread=False
            ) as conn:
                conn.execute("PRAGMA journal_mode=WAL;")
                conn.execute("PRAGMA synchronous=NORMAL;")
                conn.execute("PRAGMA cache_size=10000;")
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
                    (user_id, username, pw_hash)
                )
                conn.commit()
            return user_id
        except sqlite3.IntegrityError:
            print(f"User registration failed: {username} already exists.")
            return None
        except Exception as e:
            print(f"CRITICAL ERROR in create_user: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        pw_hash = self._hash_password(password)
        with sqlite3.connect(
            self.db_path, 
            timeout=30.0, 
            check_same_thread=False
        ) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=10000;")
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, username FROM users WHERE username = ? AND password_hash = ?",
                (username, pw_hash)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
        return None

    def save_chat_message(self, user_id: str, role: str, content: str, conversation_id: str):
        msg_id = str(uuid.uuid4())
        with sqlite3.connect(
            self.db_path, 
            timeout=30.0, 
            check_same_thread=False
        ) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=10000;")
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO chat_history (id, user_id, role, content, conversation_id) VALUES (?, ?, ?, ?, ?)",
                (msg_id, user_id, role, content, conversation_id)
            )
            conn.commit()

    def get_chat_history(self, user_id: str, conversation_id: str) -> List[Dict]:
        with sqlite3.connect(
            self.db_path, 
            timeout=30.0, 
            check_same_thread=False
        ) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=10000;")
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT role, content, timestamp FROM chat_history WHERE user_id = ? AND conversation_id = ? ORDER BY timestamp ASC",
                (user_id, conversation_id)
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_user_conversations(self, user_id: str) -> List[Dict]:
        with sqlite3.connect(
            self.db_path, 
            timeout=30.0, 
            check_same_thread=False
        ) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=10000;")
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            # Get unique conversation IDs and the first message preview
            cursor.execute('''
                SELECT conversation_id, content as title, COUNT(*) as message_count, MAX(timestamp) as last_updated
                FROM chat_history
                WHERE user_id = ?
                GROUP BY conversation_id
                ORDER BY last_updated DESC
            ''', (user_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_user(self, user_id: str) -> Optional[Dict]:
        with sqlite3.connect(
            self.db_path, 
            timeout=30.0, 
            check_same_thread=False
        ) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
            conn.execute("PRAGMA cache_size=10000;")
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, created_at FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
