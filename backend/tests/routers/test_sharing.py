"""Sharing-gate tests: Free users blocked from sharing; Pro/Ultra unchanged."""
import pytest

from models.enums import PlanTier

VALID_PROJECT = {"name": "Share Test", "description": "A sharing gate test project"}


async def test_free_cannot_invite_by_email(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        resp = await c.post(f"/projects/{pid}/shares", json={"email": "friend@example.com"})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Sharing requires Pro or Ultra"


async def test_free_cannot_create_share_link(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        resp = await c.post(f"/projects/{pid}/share-link")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Sharing requires Pro or Ultra"


async def test_pro_can_invite_by_email(client_as):
    async with client_as(plan=PlanTier.PRO) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        resp = await c.post(f"/projects/{pid}/shares", json={"email": "friend@example.com"})
        assert resp.status_code == 201
        assert resp.json()["invited_email"] == "friend@example.com"


async def test_pro_can_create_share_link(client_as):
    async with client_as(plan=PlanTier.PRO) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        resp = await c.post(f"/projects/{pid}/share-link")
        assert resp.status_code == 200
        assert "url" in resp.json()


async def test_ultra_can_create_share_link(client_as):
    async with client_as(plan=PlanTier.ULTRA) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        resp = await c.post(f"/projects/{pid}/share-link")
        assert resp.status_code == 200
