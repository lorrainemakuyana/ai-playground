import logging
import os

from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import event, text

from models.enums import AgentRole

logger = logging.getLogger(__name__)

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

# Columns added to existing tables. Each ADD COLUMN is expected to fail with a
# "duplicate column" error on subsequent runs; any other failure is logged.
_MIGRATIONS = [
    "ALTER TABLE agents ADD COLUMN model_name TEXT NOT NULL DEFAULT 'claude-sonnet-4-6'",
    "ALTER TABLE agents ADD COLUMN is_template_agent INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE agents ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
    # Per-user agent templates
    "ALTER TABLE agent_templates ADD COLUMN user_id TEXT REFERENCES users(id)",
    # Auth migrations
    "ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id)",
    "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1",
    # Subscription plan migrations
    "ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN plan_expires_at TEXT",
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

# The default engineering team seeded for each user when they register. Stored
# as (role enum, specialization, model_name) tuples; the Tech Lead runs on Opus,
# everyone else on Sonnet.
DEFAULT_AGENT_TEAM = [
    {"role": AgentRole.TECH_LEAD,  "specialization": "Tech Lead",           "model_name": "claude-opus-4-8"},
    {"role": AgentRole.ENGINEER_1, "specialization": "Software Engineer 1", "model_name": "claude-sonnet-4-6"},
    {"role": AgentRole.ENGINEER_2, "specialization": "Software Engineer 2", "model_name": "claude-sonnet-4-6"},
    {"role": AgentRole.QA,         "specialization": "QA Engineer",          "model_name": "claude-sonnet-4-6"},
    {"role": AgentRole.SRE,        "specialization": "SRE",                  "model_name": "claude-sonnet-4-6"},
]


async def _migrate(conn):
    for stmt in _MIGRATIONS:
        try:
            await conn.execute(text(stmt))
        except Exception as exc:
            # ADD COLUMN on an existing column is expected; anything else is logged.
            if "duplicate column" not in str(exc).lower():
                logger.warning("Migration step failed (%s): %s", stmt, exc)


async def seed_default_templates_for_user(user_id: str, session) -> None:
    """Create the default agent team for a user if they have none yet."""
    from models.db import AgentTemplate

    existing = await session.exec(
        select(AgentTemplate).where(AgentTemplate.user_id == user_id).limit(1)
    )
    if existing.first():
        return
    for t in DEFAULT_AGENT_TEAM:
        session.add(AgentTemplate(
            user_id=user_id,
            role=t["role"],
            specialization=t["specialization"],
            model_name=t["model_name"],
        ))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await _migrate(conn)


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
