import pytest

VALID_PROJECT = {"name": "Agent Test", "description": "Testing agent creation endpoint"}


# ---------------------------------------------------------------------------
# POST /{project_id}/agents
# ---------------------------------------------------------------------------

async def test_add_agent_success(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.post(
        f"/projects/{project_id}/agents",
        json={"specialization": "Security Expert"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "custom"
    assert data["specialization"] == "Security Expert"
    assert data["status"] == "idle"
    assert data["system_prompt"] is not None  # auto-generated from prompt_builder


async def test_add_agent_with_system_prompt(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.post(
        f"/projects/{project_id}/agents",
        json={"specialization": "DevOps Expert", "system_prompt": "You are a DevOps specialist."},
    )
    assert resp.status_code == 201
    assert resp.json()["system_prompt"] == "You are a DevOps specialist."


async def test_add_agent_with_role_and_model(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.post(
        f"/projects/{project_id}/agents",
        json={
            "specialization": "Senior Engineer (1)",
            "role": "engineer-1",
            "model_name": "claude-opus-4-7",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "engineer-1"
    assert data["model_name"] == "claude-opus-4-7"


async def test_add_agent_project_not_found(client):
    resp = await client.post(
        "/projects/nonexistent/agents",
        json={"specialization": "Security Expert"},
    )
    assert resp.status_code == 404


async def test_add_agent_specialization_required(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.post(f"/projects/{project_id}/agents", json={})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /{project_id}/agents
# ---------------------------------------------------------------------------

async def test_list_agents(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    await client.post(f"/projects/{project_id}/agents", json={"specialization": "Security Expert"})
    resp = await client.get(f"/projects/{project_id}/agents")
    assert resp.status_code == 200
    agents = resp.json()
    # default team (5) + 1 custom
    assert len(agents) == 6


async def test_list_agents_project_not_found(client):
    resp = await client.get("/projects/nonexistent/agents")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /{project_id}/agents/{agent_id}
# ---------------------------------------------------------------------------

async def _create_custom_agent(client, project_id: str) -> dict:
    resp = await client.post(
        f"/projects/{project_id}/agents",
        json={"specialization": "ML Engineer"},
    )
    assert resp.status_code == 201
    return resp.json()


async def test_update_agent_specialization(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    agent = await _create_custom_agent(client, proj["id"])
    resp = await client.patch(
        f"/projects/{proj['id']}/agents/{agent['id']}",
        json={"specialization": "Senior ML Engineer"},
    )
    assert resp.status_code == 200
    assert resp.json()["specialization"] == "Senior ML Engineer"


async def test_update_agent_model(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    agent = await _create_custom_agent(client, proj["id"])
    resp = await client.patch(
        f"/projects/{proj['id']}/agents/{agent['id']}",
        json={"model_name": "claude-opus-4-7"},
    )
    assert resp.status_code == 200
    assert resp.json()["model_name"] == "claude-opus-4-7"


async def test_update_agent_system_prompt(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    agent = await _create_custom_agent(client, proj["id"])
    resp = await client.patch(
        f"/projects/{proj['id']}/agents/{agent['id']}",
        json={"system_prompt": "You are an expert ML engineer."},
    )
    assert resp.status_code == 200
    assert resp.json()["system_prompt"] == "You are an expert ML engineer."


async def test_update_template_agent_forbidden(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    project_id = proj["id"]
    agents_resp = await client.get(f"/projects/{project_id}/agents")
    template_agent = next(a for a in agents_resp.json() if a["is_template_agent"])
    resp = await client.patch(
        f"/projects/{project_id}/agents/{template_agent['id']}",
        json={"specialization": "Hacked"},
    )
    assert resp.status_code == 403


async def test_update_agent_not_found(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.patch(
        f"/projects/{proj['id']}/agents/nonexistent",
        json={"specialization": "Whatever"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /{project_id}/agents/{agent_id}
# ---------------------------------------------------------------------------

async def test_delete_custom_agent(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    agent = await _create_custom_agent(client, proj["id"])
    resp = await client.delete(f"/projects/{proj['id']}/agents/{agent['id']}")
    assert resp.status_code == 204
    # Confirm agent no longer appears in list
    agents = (await client.get(f"/projects/{proj['id']}/agents")).json()
    assert all(a["id"] != agent["id"] for a in agents)


async def test_delete_template_agent_forbidden(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    project_id = proj["id"]
    agents_resp = await client.get(f"/projects/{project_id}/agents")
    template_agent = next(a for a in agents_resp.json() if a["is_template_agent"])
    resp = await client.delete(f"/projects/{project_id}/agents/{template_agent['id']}")
    assert resp.status_code == 403


async def test_delete_agent_not_found(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.delete(f"/projects/{proj['id']}/agents/nonexistent")
    assert resp.status_code == 404
