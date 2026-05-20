import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel.ext.asyncio.session import AsyncSession
from unittest.mock import AsyncMock, patch, MagicMock

# Import all models so SQLModel.metadata knows about every table before create_all.
import models.db  # noqa: F401

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

_TEST_USER_ID = "test-user-00000000"
_TEST_USER_EMAIL = "test@example.com"


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


def _make_client_context(app, factory):
    from database import get_session
    from dependencies import get_current_user
    from models.db import User

    mock_user = User(id=_TEST_USER_ID, email=_TEST_USER_EMAIL, password_hash="irrelevant")

    async def override_get_session():
        async with factory() as session:
            yield session

    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user


@pytest_asyncio.fixture
async def client(test_engine):
    from main import app

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory)

    with patch("services.orchestrator.start_project", new_callable=AsyncMock), \
         patch("routers.projects.async_session_factory", _make_null_session_factory()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def raw_client(test_engine):
    """Client with real get_current_user — use for testing auth endpoints."""
    from database import get_session
    from main import app

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    with patch("services.orchestrator.start_project", new_callable=AsyncMock), \
         patch("routers.projects.async_session_factory", _make_null_session_factory()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()
