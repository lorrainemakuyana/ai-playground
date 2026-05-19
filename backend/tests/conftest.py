import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel.ext.asyncio.session import AsyncSession
from unittest.mock import AsyncMock, patch, MagicMock

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    # StaticPool forces all connections to share one underlying connection,
    # which is required for SQLite in-memory DBs so the session factory sees
    # the same tables created during setup.
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


def _make_null_session_factory():
    """Return an async context manager that yields a no-op AsyncMock session."""
    mock_session = AsyncMock(spec=AsyncSession)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=mock_session)
    cm.__aexit__ = AsyncMock(return_value=False)
    factory = MagicMock(return_value=cm)
    return factory


@pytest_asyncio.fixture
async def client(test_engine):
    from database import get_session
    from main import app

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    # Prevent fire-and-forget orchestration from hitting real DB or Anthropic API.
    # Mock at the orchestrator level rather than patching asyncio.create_task globally,
    # which would break SQLAlchemy's internal session cleanup.
    with patch("services.orchestrator.start_project", new_callable=AsyncMock), \
         patch("routers.projects.async_session_factory", _make_null_session_factory()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()
