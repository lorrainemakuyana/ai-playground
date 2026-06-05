from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

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
from models.enums import PlanTier

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

_TEST_USER_ID = "test-user-00000000"
_TEST_USER_EMAIL = "test@example.com"


def make_user(
    plan: PlanTier = PlanTier.ULTRA,
    plan_expires_at: Optional[datetime] = None,
    id: str = _TEST_USER_ID,
    email: str = _TEST_USER_EMAIL,
):
    """Build an (unpersisted) User at a given tier for dependency overrides.

    Defaults to ULTRA so existing tests that aren't about plan limits keep
    passing; plan-gate tests pass an explicit lower tier.
    """
    from models.db import User
    return User(
        id=id,
        email=email,
        password_hash="irrelevant",
        plan=plan,
        plan_expires_at=plan_expires_at,
    )


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


def _make_client_context(app, factory, user=None):
    from database import get_session
    from dependencies import get_current_user

    mock_user = user if user is not None else make_user()

    async def override_get_session():
        async with factory() as session:
            yield session

    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user


@asynccontextmanager
async def _client_for_user(test_engine, user):
    from main import app

    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    with patch("services.orchestrator.start_project", new_callable=AsyncMock), \
         patch("routers.projects.async_session_factory", _make_null_session_factory()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(test_engine):
    # Default user is ULTRA (no limits) so tests not about plan gating are unaffected.
    async with _client_for_user(test_engine, make_user(plan=PlanTier.ULTRA)) as ac:
        yield ac


@pytest_asyncio.fixture
async def client_as(test_engine):
    """Factory fixture: `async with client_as(plan=PlanTier.FREE) as c: ...`.

    Builds a client authenticated as a user on the given tier. Each call swaps
    the active auth override, so use one client at a time per test.
    """
    def _factory(plan: PlanTier = PlanTier.ULTRA, plan_expires_at: Optional[datetime] = None):
        return _client_for_user(test_engine, make_user(plan=plan, plan_expires_at=plan_expires_at))
    return _factory


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
