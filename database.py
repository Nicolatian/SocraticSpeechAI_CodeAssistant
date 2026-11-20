
import sqlite3
import json
import math
from contextlib import closing
from datetime import datetime, timedelta, timezone
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
                last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
                run_count INTEGER NOT NULL DEFAULT 0
            )
        """)
        user_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(users)")
        }
        if "run_count" not in user_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN run_count INTEGER NOT NULL DEFAULT 0"
            )
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


def run_code(user_id, code, exercise_id, code_works, duration_seconds):
    """Save a completed code run and return its sequential number."""
    if (
        not isinstance(code_works, bool)
        or isinstance(duration_seconds, bool)
        or not isinstance(duration_seconds, (int, float))
        or not math.isfinite(duration_seconds)
        or duration_seconds < 0
    ):
        raise ValueError("Invalid code run completion information.")

    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        connection.execute("PRAGMA foreign_keys = ON")
        updated_user = connection.execute("""
            UPDATE users
            SET run_count = run_count + 1
            WHERE user_id = ?
        """, (user_id,))
        if updated_user.rowcount == 0:
            return None
        run_number = connection.execute(
            "SELECT run_count FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()[0]
        completed_at = datetime.now(timezone.utc)
        started_at = completed_at - timedelta(seconds=duration_seconds)
        connection.execute("""
            INSERT INTO events (user_id, event_type, details)
            VALUES (?, ?, ?)
        """, (
            user_id,
            "run_code",
            json.dumps({
                "code": code,
                "exercise_id": exercise_id,
                "run_number": run_number,
                "completed": code_works,
                "started_at": started_at.isoformat(timespec="milliseconds").replace(
                    "+00:00", "Z"
                ),
                "completed_at": completed_at.isoformat(timespec="milliseconds").replace(
                    "+00:00", "Z"
                ),
                "duration_seconds": round(duration_seconds, 3),
            }),
        ))
        return run_number


def get_run_count(user_id):
    """Return a user's total code-run count, or None if the user does not exist."""
    with sqlite3.connect(DB_PATH) as connection:
        row = connection.execute(
            "SELECT run_count FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        return row[0] if row is not None else None

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
