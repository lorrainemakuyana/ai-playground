from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import event, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/orchestrator.db")

engine = create_async_engine(DATABASE_URL, echo=False)


@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Columns added to existing tables — safe to re-run (errors are suppressed)
_MIGRATIONS = [
    "ALTER TABLE agents ADD COLUMN model_name TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'",
    "ALTER TABLE agents ADD COLUMN is_template_agent INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE agents ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
    "UPDATE agent_templates SET model_name = 'claude-opus-4-6' WHERE role = 'tech-lead'",
    # Auth migrations
    "ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id)",
    "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1",
    # Sharing + archiving migrations
    "ALTER TABLE projects ADD COLUMN archived_at TEXT",
    """CREATE TABLE IF NOT EXISTS project_shares (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        user_id TEXT REFERENCES users(id),
        invited_email TEXT NOT NULL,
        invite_method TEXT NOT NULL DEFAULT 'email',
        joined_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS project_share_links (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
        token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    )""",
]

_DEFAULT_TEMPLATES = [
    {"role": "TECH_LEAD",  "specialization": "Tech Lead",           "model_name": "claude-opus-4-6"},
    {"role": "ENGINEER_1", "specialization": "Software Engineer 1", "model_name": "claude-sonnet-4-6"},
    {"role": "ENGINEER_2", "specialization": "Software Engineer 2", "model_name": "claude-sonnet-4-6"},
    {"role": "QA",         "specialization": "QA Engineer",          "model_name": "claude-sonnet-4-6"},
    {"role": "SRE",        "specialization": "SRE",                  "model_name": "claude-sonnet-4-6"},
]


async def _migrate(conn):
    for stmt in _MIGRATIONS:
        try:
            await conn.execute(text(stmt))
        except Exception:
            pass  # column already exists


async def _seed_templates(conn):
    from models.db import _new_uuid
    from datetime import datetime, timezone

    result = await conn.execute(text("SELECT COUNT(*) FROM agent_templates"))
    if result.scalar():
        return
    now = datetime.now(timezone.utc).isoformat()
    for t in _DEFAULT_TEMPLATES:
        await conn.execute(
            text(
                "INSERT INTO agent_templates (id, role, specialization, model_name, is_active, created_at) "
                "VALUES (:id, :role, :spec, :model, 1, :now)"
            ),
            {"id": _new_uuid(), "role": t["role"], "spec": t["specialization"], "model": t["model_name"], "now": now},
        )


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await _migrate(conn)
        await _seed_templates(conn)


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
