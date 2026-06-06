"""Tests for the GitHub integration router."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch, MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models.db import Project, User
from models.enums import PlanTier, SDLCPhase, ProjectStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(github_token_enc: str | None = None, plan: PlanTier = PlanTier.ULTRA) -> User:
    return User(
        id="gh-user-0001",
        email="gh@example.com",
        password_hash="x",
        plan=plan,
        github_token_enc=github_token_enc,
    )


def _make_project(user_id: str = "gh-user-0001", **kwargs) -> Project:
    return Project(
        id="gh-proj-0001",
        name="Test Project",
        description="A test project",
        user_id=user_id,
        status=ProjectStatus.ACTIVE,
        current_phase=SDLCPhase.IMPLEMENTATION,
        **kwargs,
    )


def _make_client_context(app, factory, user: User):
    from database import get_session
    from dependencies import get_current_user

    async def override_session():
        async with factory() as s:
            yield s

    async def override_user():
        return user

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user


# ---------------------------------------------------------------------------
# Plan gate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_free_user_cannot_access_github_token(test_engine):
    from main import app

    user = _make_user(plan=PlanTier.FREE)
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/github/token/status")

    app.dependency_overrides.clear()
    assert resp.status_code == 403
    assert "Pro or Ultra" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_free_user_cannot_save_token(test_engine):
    from main import app

    user = _make_user(plan=PlanTier.FREE)
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/github/token", json={"token": "ghp_test"})

    app.dependency_overrides.clear()
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_pro_user_can_access_github(test_engine):
    from main import app

    user = _make_user(plan=PlanTier.PRO, github_token_enc="enc")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/github/token/status")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.json()["connected"] is True


# ---------------------------------------------------------------------------
# Token endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_save_token_valid(test_engine):
    from main import app

    user = _make_user()
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        await s.commit()

    _make_client_context(app, factory, user)

    with patch("services.github_service.validate_pat", new=AsyncMock(return_value=True)), \
         patch("services.github_service._fernet") as mock_fernet:
        mock_f = MagicMock()
        mock_f.encrypt.return_value = b"encrypted-token"
        mock_fernet.return_value = mock_f

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/github/token", json={"token": "ghp_test123"})

    app.dependency_overrides.clear()
    assert resp.status_code == 204

    async with factory() as s:
        result = await s.exec(select(User).where(User.id == user.id))
        saved = result.first()
    assert saved.github_token_enc == "encrypted-token"


@pytest.mark.asyncio
async def test_save_token_invalid(test_engine):
    from main import app

    user = _make_user()
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        await s.commit()

    _make_client_context(app, factory, user)

    with patch("services.github_service.validate_pat", new=AsyncMock(return_value=False)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/github/token", json={"token": "bad-token"})

    app.dependency_overrides.clear()
    assert resp.status_code == 400
    assert "Invalid GitHub token" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_save_token_empty(test_engine):
    from main import app

    user = _make_user()
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/github/token", json={"token": "  "})

    app.dependency_overrides.clear()
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_token(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc-token")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        await s.commit()

    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.delete("/github/token")

    app.dependency_overrides.clear()
    assert resp.status_code == 204

    async with factory() as s:
        result = await s.exec(select(User).where(User.id == user.id))
        saved = result.first()
    assert saved.github_token_enc is None


@pytest.mark.asyncio
async def test_token_status_connected(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/github/token/status")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.json()["connected"] is True


@pytest.mark.asyncio
async def test_token_status_not_connected(test_engine):
    from main import app

    user = _make_user(github_token_enc=None)
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/github/token/status")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.json()["connected"] is False


# ---------------------------------------------------------------------------
# Repo linking
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_link_repo(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc")
    project = _make_project()
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    with patch("services.github_service.validate_repo", new=AsyncMock(return_value=True)), \
         patch("services.github_service.decrypt_pat", return_value="ghp_real"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.patch(
                "/projects/gh-proj-0001/github",
                json={"github_repo": "acme/myapp"},
            )

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()
    assert data["github_repo"] == "acme/myapp"
    assert data["github_branch"] == "sdlc/gh-proj-0001"


@pytest.mark.asyncio
async def test_link_repo_invalid_format(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc")
    project = _make_project()
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            "/projects/gh-proj-0001/github",
            json={"github_repo": "not-a-valid-repo"},
        )

    app.dependency_overrides.clear()
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_link_repo_no_token(test_engine):
    from main import app

    user = _make_user(github_token_enc=None)
    project = _make_project()
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            "/projects/gh-proj-0001/github",
            json={"github_repo": "acme/myapp"},
        )

    app.dependency_overrides.clear()
    assert resp.status_code == 400
    assert "token" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unlink_repo(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc")
    project = _make_project(github_repo="acme/myapp", github_branch="sdlc/gh-proj-0001")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            "/projects/gh-proj-0001/github",
            json={"github_repo": ""},
        )

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()
    assert data["github_repo"] is None
    assert data["github_branch"] is None


# ---------------------------------------------------------------------------
# Manual push / PR
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_trigger_push_success(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc")
    project = _make_project(github_repo="acme/myapp")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    with patch("services.github_service.auto_push", new=AsyncMock(return_value="success")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/projects/gh-proj-0001/github/push")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"


@pytest.mark.asyncio
async def test_trigger_push_skipped(test_engine):
    from main import app

    user = _make_user()
    project = _make_project()  # no github_repo
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    with patch("services.github_service.auto_push", new=AsyncMock(return_value="skipped")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/projects/gh-proj-0001/github/push")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.json()["status"] == "skipped"


@pytest.mark.asyncio
async def test_trigger_pr_success(test_engine):
    from main import app

    user = _make_user(github_token_enc="enc")
    project = _make_project(github_repo="acme/myapp", github_push_status="success")
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        s.add(user)
        s.add(project)
        await s.commit()

    _make_client_context(app, factory, user)

    with patch(
        "services.github_service.auto_pr",
        new=AsyncMock(return_value=("success", "https://github.com/acme/myapp/pull/1")),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/projects/gh-proj-0001/github/pr")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["pr_url"] == "https://github.com/acme/myapp/pull/1"
