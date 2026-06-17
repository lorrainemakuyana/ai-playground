import logging
import os

from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import event, text
from sqlalchemy.engine import make_url

from models.enums import (
    AgentRole,
    AgentStatus,
    PlanTier,
    ProjectStatus,
    SDLCPhase,
    TaskStatus,
)

logger = logging.getLogger(__name__)

_RAW_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/orchestrator.db")


def _normalize_url(url: str) -> str:
    """Ensure the URL uses the correct async driver prefix.

    Render's Postgres connection strings use the bare `postgresql://` scheme.
    SQLAlchemy needs `postgresql+asyncpg://` for async use.
    """
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


DATABASE_URL = _normalize_url(_RAW_URL)

_parsed = make_url(DATABASE_URL)
_is_sqlite = _parsed.get_backend_name() == "sqlite"


def _ensure_sqlite_dir(url: str) -> None:
    parsed = make_url(url)
    db_path = parsed.database
    if not db_path or db_path == ":memory:":
        return
    parent = os.path.dirname(os.path.abspath(db_path))
    if parent:
        os.makedirs(parent, exist_ok=True)


if _is_sqlite:
    _ensure_sqlite_dir(DATABASE_URL)

engine = create_async_engine(DATABASE_URL, echo=False)


if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Columns added to existing tables after initial schema creation.
# On a fresh DB, create_all already includes these — the ALTER TABLEs will
# fail with "already exists" / "duplicate column", which _migrate ignores.
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
    # GitHub integration migrations
    "ALTER TABLE users ADD COLUMN github_token_enc TEXT",
    "ALTER TABLE projects ADD COLUMN github_repo TEXT",
    "ALTER TABLE projects ADD COLUMN github_branch TEXT",
    "ALTER TABLE projects ADD COLUMN github_push_status TEXT",
    "ALTER TABLE projects ADD COLUMN github_push_error TEXT",
    "ALTER TABLE projects ADD COLUMN github_pr_url TEXT",
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

# The default engineering team seeded for each user when they register.
DEFAULT_AGENT_TEAM = [
    {"role": AgentRole.TECH_LEAD,  "specialization": "Tech Lead",           "model_name": "claude-opus-4-8"},
    {"role": AgentRole.ENGINEER_1, "specialization": "Software Engineer 1", "model_name": "claude-sonnet-4-6"},
    {"role": AgentRole.ENGINEER_2, "specialization": "Software Engineer 2", "model_name": "claude-sonnet-4-6"},
    {"role": AgentRole.QA,         "specialization": "QA Engineer",          "model_name": "claude-sonnet-4-6"},
    {"role": AgentRole.SRE,        "specialization": "SRE",                  "model_name": "claude-sonnet-4-6"},
]


# Enum columns are persisted by member *value* (e.g. "tech-lead", "in-progress").
# Older rows stored by member *name* ("TECH_LEAD", ...) are backfilled here.
_ENUM_COLUMNS = [
    ("users", "plan", PlanTier),
    ("agent_templates", "role", AgentRole),
    ("projects", "status", ProjectStatus),
    ("projects", "current_phase", SDLCPhase),
    ("agents", "role", AgentRole),
    ("agents", "status", AgentStatus),
    ("tasks", "phase", SDLCPhase),
    ("tasks", "status", TaskStatus),
    ("tasks", "role", AgentRole),
]


def _is_column_exists_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "duplicate column" in msg or "already exists" in msg


def _is_missing_table_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "no such table" in msg or "does not exist" in msg


async def _migrate_enum_values():
    for table, column, enum_cls in _ENUM_COLUMNS:
        for member in enum_cls:
            if member.name == member.value:
                continue
            try:
                async with engine.begin() as conn:
                    await conn.execute(
                        text(f"UPDATE {table} SET {column} = :value WHERE {column} = :name"),
                        {"value": member.value, "name": member.name},
                    )
            except Exception as exc:
                if not _is_missing_table_error(exc):
                    logger.warning("Enum backfill failed (%s.%s): %s", table, column, exc)


async def _migrate():
    for stmt in _MIGRATIONS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception as exc:
            if not _is_column_exists_error(exc):
                logger.warning("Migration step failed (%s): %s", stmt, exc)
    await _migrate_enum_values()


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
    await _migrate()


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
