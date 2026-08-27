import sqlite3
import os
from contextlib import contextmanager


DB_PATH = os.path.join("data", "knowledge_agent.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def db():
    conn = get_conn()

    try:
        yield conn
        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


def init_db():

    with db() as conn:

        # =====================================================
        # EXISTING RESOURCES
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS resources (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                resource_key TEXT NOT NULL,
                title        TEXT NOT NULL,
                link         TEXT,
                description  TEXT,
                tags         TEXT,
                created_at   TEXT DEFAULT (datetime('now')),
                updated_at   TEXT DEFAULT (datetime('now'))
            )
        """)

        # Upgrade older databases if necessary
        try:
            conn.execute(
                "ALTER TABLE resources ADD COLUMN tags TEXT"
            )
        except Exception:
            pass

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_resources_key
            ON resources(resource_key)
        """)


        # =====================================================
        # EXISTING UPLOADED FILES
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name  TEXT NOT NULL,
                stored_name    TEXT NOT NULL,
                file_type      TEXT NOT NULL,
                file_size      INTEGER,
                page_count     INTEGER,
                extracted_text TEXT,
                text_extracted INTEGER DEFAULT 0,
                uploaded_at    TEXT DEFAULT (datetime('now'))
            )
        """)


        # =====================================================
        # EXISTING SESSIONS
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                user_id          TEXT PRIMARY KEY,
                user_name        TEXT NOT NULL,
                status           TEXT DEFAULT 'active',
                chunks_extracted INTEGER DEFAULT 0,
                conversation     TEXT DEFAULT '[]',
                topics_covered   TEXT DEFAULT '[]',
                created_at       TEXT DEFAULT (datetime('now')),
                last_active      TEXT DEFAULT (datetime('now'))
            )
        """)


        # =====================================================
        # EXISTING KNOWLEDGE CHUNKS
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id             TEXT,
                employee_name       TEXT,
                topic               TEXT,
                domain              TEXT,
                content             TEXT,
                confidence          REAL DEFAULT 0.5,
                linked_person       TEXT,
                linked_system       TEXT,
                requires_followup   INTEGER DEFAULT 0,
                validated           INTEGER DEFAULT 0,
                extracted_at        TEXT DEFAULT (datetime('now'))
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_user
            ON knowledge_chunks(user_id)
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_domain
            ON knowledge_chunks(domain)
        """)


        # =====================================================
        # NEW: WEBSITE CHAT SESSIONS
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS website_sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                url         TEXT NOT NULL,
                title       TEXT,
                created_at  TEXT DEFAULT (datetime('now')),
                last_active TEXT DEFAULT (datetime('now'))
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_website_sessions_url
            ON website_sessions(url)
        """)


        # =====================================================
        # NEW: WEBSITE PAGES
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS website_pages (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id   INTEGER NOT NULL,
                url          TEXT NOT NULL,
                title        TEXT,
                link_text    TEXT,
                content      TEXT,
                is_main_page INTEGER DEFAULT 0,
                created_at   TEXT DEFAULT (datetime('now')),

                FOREIGN KEY (session_id)
                REFERENCES website_sessions(id)
                ON DELETE CASCADE
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_website_pages_session
            ON website_pages(session_id)
        """)


        # =====================================================
        # NEW: WEBSITE CHAT MESSAGES
        # =====================================================

        conn.execute("""
            CREATE TABLE IF NOT EXISTS website_messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL,
                role        TEXT NOT NULL,
                message     TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now')),

                FOREIGN KEY (session_id)
                REFERENCES website_sessions(id)
                ON DELETE CASCADE
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_website_messages_session
            ON website_messages(session_id)
        """)


    print(
        "[DB] SQLite initialized at",
        DB_PATH
    )