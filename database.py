
import sqlite3
import json
from contextlib import closing
from pathlib import Path

# Database is created next to this Python file
DB_PATH = Path(__file__).with_name("pear_logs.db")


def init_db():
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                first_login DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                exercise_id TEXT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        """)
        conversation_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(conversations)")
        }
        if "exercise_id" not in conversation_columns:
            connection.execute(
                "ALTER TABLE conversations ADD COLUMN exercise_id TEXT"
            )


def log_login(user_id):
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("""
            INSERT INTO users (user_id)
            VALUES (?)
            ON CONFLICT(user_id)
            DO UPDATE SET last_login = CURRENT_TIMESTAMP
        """, (user_id,))
        connection.execute("""
            INSERT INTO events (user_id, event_type, details)
            VALUES (?, ?, ?)
        """, (user_id, "login", json.dumps({})))


def log_event(user_id, event_type, details=None):
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        connection.execute("PRAGMA foreign_keys = ON")
        user = connection.execute(
            "SELECT user_id FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        if user is None:
            return False
        connection.execute("""
            INSERT INTO events (user_id, event_type, details)
            VALUES (?, ?, ?)
        """, (user_id, event_type, json.dumps(details or {}, ensure_ascii=False)))
        return True


def log_conversation(user_id, question, answer, exercise_id=None):
    """Save a completed user question and Pear Programmer answer."""
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        connection.execute("PRAGMA foreign_keys = ON")
        user = connection.execute(
            "SELECT user_id FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        if user is None:
            return False
        connection.execute("""
            INSERT INTO conversations (user_id, exercise_id, question, answer)
            VALUES (?, ?, ?, ?)
        """, (user_id, exercise_id, question, answer))
        return True


def get_conversations(user_id, limit=100):
    """Return a user's most recent saved conversations, oldest first."""
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
        raise ValueError("limit must be a positive integer")

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute("""
            SELECT conversation_id, user_id, exercise_id, question, answer, created_at
            FROM (
                SELECT conversation_id, user_id, exercise_id, question, answer, created_at
                FROM conversations
                WHERE user_id = ?
                ORDER BY conversation_id DESC
                LIMIT ?
            )
            ORDER BY conversation_id ASC
        """, (user_id, limit)).fetchall()
        return [dict(row) for row in rows]


# Create database and tables when the module is initialized
init_db()
