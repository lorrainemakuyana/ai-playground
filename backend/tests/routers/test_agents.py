import pytest

VALID_PROJECT = {"name": "Agent Test", "description": "Testing agent creation endpoint"}


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
    assert "system_prompt" not in data  # must be excluded


async def test_add_agent_project_not_found(client):
    resp = await client.post(
        "/projects/nonexistent/agents",
        json={"specialization": "Security Expert"},
    )
    assert resp.status_code == 404


async def test_add_agent_specialization_required(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.post(
        f"/projects/{project_id}/agents",
        json={},
    )
    assert resp.status_code == 422
