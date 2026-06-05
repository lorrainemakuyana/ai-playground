"""Plan-gate tests: project count, agent count, and per-agent model access."""
import pytest
from datetime import datetime, timedelta, timezone

from models.enums import PlanTier

VALID_PROJECT = {"name": "Sub Test", "description": "A subscription gate test project"}


# ---------------------------------------------------------------------------
# Project-count gate
# ---------------------------------------------------------------------------

async def test_free_project_limit(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201
        assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201
        resp = await c.post("/projects", json=VALID_PROJECT)
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Free plan limit: 2 projects"


async def test_pro_allows_more_than_free(client_as):
    async with client_as(plan=PlanTier.PRO) as c:
        for _ in range(3):  # exceeds the Free limit of 2
            assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201


async def test_ultra_project_unlimited(client_as):
    async with client_as(plan=PlanTier.ULTRA) as c:
        for _ in range(5):
            assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201


async def test_archived_projects_still_count_toward_limit(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        p1 = (await c.post("/projects", json=VALID_PROJECT)).json()
        assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201
        # Archiving does NOT free a slot — only a hard delete does.
        assert (await c.patch(f"/projects/{p1['id']}/archive")).status_code == 200
        resp = await c.post("/projects", json=VALID_PROJECT)
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Free plan limit: 2 projects"


async def test_expired_plan_falls_back_to_free_limit(client_as):
    past = datetime.now(timezone.utc) - timedelta(days=1)
    async with client_as(plan=PlanTier.ULTRA, plan_expires_at=past) as c:
        assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201
        assert (await c.post("/projects", json=VALID_PROJECT)).status_code == 201
        resp = await c.post("/projects", json=VALID_PROJECT)
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Free plan limit: 2 projects"


# ---------------------------------------------------------------------------
# Agent-count gate (template agents must NOT count)
# ---------------------------------------------------------------------------

async def test_free_agent_limit_excludes_template_agents(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        proj = (await c.post("/projects", json=VALID_PROJECT)).json()
        pid = proj["id"]
        # 5 template agents already exist but do not count.
        for i in range(2):
            r = await c.post(f"/projects/{pid}/agents", json={"specialization": f"Custom {i}"})
            assert r.status_code == 201, r.text
        resp = await c.post(f"/projects/{pid}/agents", json={"specialization": "Over limit"})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Free plan limit: 2 agents per project"


async def test_pro_agent_limit_higher(client_as):
    async with client_as(plan=PlanTier.PRO) as c:
        proj = (await c.post("/projects", json=VALID_PROJECT)).json()
        pid = proj["id"]
        for i in range(4):  # exceeds the Free limit of 2, within the Pro limit of 5
            r = await c.post(f"/projects/{pid}/agents", json={"specialization": f"Custom {i}"})
            assert r.status_code == 201


# ---------------------------------------------------------------------------
# Model-access gate (PATCH agent model)
# ---------------------------------------------------------------------------

async def _custom_agent(c, pid):
    return (await c.post(f"/projects/{pid}/agents", json={"specialization": "ML"})).json()


async def test_free_cannot_set_sonnet_or_opus(client_as):
    async with client_as(plan=PlanTier.FREE) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        agent = await _custom_agent(c, pid)
        for model in ("claude-sonnet-4-6", "claude-opus-4-8"):
            resp = await c.patch(f"/projects/{pid}/agents/{agent['id']}", json={"model_name": model})
            assert resp.status_code == 403
            assert resp.json()["detail"] == f"Free plan does not include {model}"
        # Haiku is allowed.
        ok = await c.patch(
            f"/projects/{pid}/agents/{agent['id']}",
            json={"model_name": "claude-haiku-4-5-20251001"},
        )
        assert ok.status_code == 200


async def test_pro_cannot_set_opus_but_can_set_sonnet(client_as):
    async with client_as(plan=PlanTier.PRO) as c:
        pid = (await c.post("/projects", json=VALID_PROJECT)).json()["id"]
        agent = await _custom_agent(c, pid)
        bad = await c.patch(f"/projects/{pid}/agents/{agent['id']}", json={"model_name": "claude-opus-4-8"})
        assert bad.status_code == 403
        good = await c.patch(f"/projects/{pid}/agents/{agent['id']}", json={"model_name": "claude-sonnet-4-6"})
        assert good.status_code == 200
        assert good.json()["model_name"] == "claude-sonnet-4-6"
