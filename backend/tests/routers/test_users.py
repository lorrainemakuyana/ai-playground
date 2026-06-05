"""GET /users/me — plan, plan_expires_at, effective_plan."""
import pytest
from datetime import datetime, timedelta, timezone

from models.enums import PlanTier


async def test_me_free_user(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        resp = await c.get("/users/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["plan"] == "free"
        assert data["effective_plan"] == "free"
        assert data["plan_expires_at"] is None
        assert "email" in data


async def test_me_pro_user(client_as):
    async with client_as(plan=PlanTier.PRO) as c:
        data = (await c.get("/users/me")).json()
        assert data["plan"] == "pro"
        assert data["effective_plan"] == "pro"


async def test_me_expired_plan_reports_free_effective(client_as):
    past = datetime.now(timezone.utc) - timedelta(days=1)
    async with client_as(plan=PlanTier.ULTRA, plan_expires_at=past) as c:
        data = (await c.get("/users/me")).json()
        # Stored plan stays ultra; effective is downgraded to free.
        assert data["plan"] == "ultra"
        assert data["effective_plan"] == "free"
        assert data["plan_expires_at"] is not None


async def test_me_future_expiry_keeps_plan(client_as):
    future = datetime.now(timezone.utc) + timedelta(days=30)
    async with client_as(plan=PlanTier.PRO, plan_expires_at=future) as c:
        data = (await c.get("/users/me")).json()
        assert data["plan"] == "pro"
        assert data["effective_plan"] == "pro"
