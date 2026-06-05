"""Admin plan endpoints — PATCH/GET /admin/users/{id} behind ADMIN_SECRET."""
import pytest
import pytest_asyncio

from models.db import User
from models.enums import PlanTier

_SECRET = "test-admin-secret"
_AUTH = {"Authorization": f"Bearer {_SECRET}"}


@pytest.fixture(autouse=True)
def _admin_secret(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", _SECRET)


@pytest_asyncio.fixture
async def seeded_user(test_session):
    user = User(id="admin-target-1", email="target@example.com", password_hash="x", plan=PlanTier.FREE)
    test_session.add(user)
    await test_session.commit()
    return user


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------

async def test_set_plan_upgrades_user(client, seeded_user):
    resp = await client.patch(
        f"/admin/users/{seeded_user.id}/plan",
        json={"plan": "pro"},
        headers=_AUTH,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "pro"
    assert data["effective_plan"] == "pro"


async def test_set_plan_with_expiry(client, seeded_user):
    resp = await client.patch(
        f"/admin/users/{seeded_user.id}/plan",
        json={"plan": "ultra", "plan_expires_at": "2020-01-01T00:00:00+00:00"},
        headers=_AUTH,
    )
    assert resp.status_code == 200
    data = resp.json()
    # Stored ultra, but the past expiry makes effective_plan free.
    assert data["plan"] == "ultra"
    assert data["effective_plan"] == "free"


async def test_get_user(client, seeded_user):
    resp = await client.get(f"/admin/users/{seeded_user.id}", headers=_AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == seeded_user.id
    assert data["email"] == "target@example.com"
    assert data["plan"] == "free"


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------

async def test_set_plan_unknown_user(client):
    resp = await client.patch("/admin/users/nope/plan", json={"plan": "pro"}, headers=_AUTH)
    assert resp.status_code == 404


async def test_set_plan_invalid_value(client, seeded_user):
    resp = await client.patch(
        f"/admin/users/{seeded_user.id}/plan",
        json={"plan": "platinum"},
        headers=_AUTH,
    )
    assert resp.status_code == 422


async def test_missing_auth_header(client, seeded_user):
    resp = await client.patch(f"/admin/users/{seeded_user.id}/plan", json={"plan": "pro"})
    assert resp.status_code == 401


async def test_wrong_secret(client, seeded_user):
    resp = await client.patch(
        f"/admin/users/{seeded_user.id}/plan",
        json={"plan": "pro"},
        headers={"Authorization": "Bearer wrong"},
    )
    assert resp.status_code == 403


async def test_admin_not_configured(client, seeded_user, monkeypatch):
    monkeypatch.delenv("ADMIN_SECRET", raising=False)
    resp = await client.get(f"/admin/users/{seeded_user.id}", headers=_AUTH)
    assert resp.status_code == 503
