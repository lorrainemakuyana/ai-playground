import pytest

VALID_PROJECT = {"name": "Test Project", "description": "A test project description that is long enough"}


# ---------------------------------------------------------------------------
# POST /projects
# ---------------------------------------------------------------------------

async def test_create_project_success(client):
    resp = await client.post("/projects", json=VALID_PROJECT)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == VALID_PROJECT["name"]
    assert data["current_phase"] == "discovery"
    assert data["status"] == "active"
    assert len(data["agents"]) == 5  # default team seeded


async def test_create_project_name_too_short(client):
    resp = await client.post("/projects", json={"name": "", "description": "A valid description here"})
    assert resp.status_code == 422


async def test_create_project_description_too_short(client):
    resp = await client.post("/projects", json={"name": "Test", "description": "short"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /projects
# ---------------------------------------------------------------------------

async def test_list_projects_empty(client):
    resp = await client.get("/projects")
    assert resp.status_code == 200
    assert resp.json() == {"projects": []}


async def test_list_projects_returns_summary(client):
    await client.post("/projects", json=VALID_PROJECT)
    resp = await client.get("/projects")
    assert resp.status_code == 200
    projects = resp.json()["projects"]
    assert len(projects) == 1
    assert "agent_count" in projects[0]
    assert "task_count" in projects[0]
    assert projects[0]["agent_count"] == 5


# ---------------------------------------------------------------------------
# GET /projects/{id}
# ---------------------------------------------------------------------------

async def test_get_project_success(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/projects/{project_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == project_id


async def test_get_project_not_found(client):
    resp = await client.get("/projects/nonexistent-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /projects/{id}/archive & /unarchive
# ---------------------------------------------------------------------------

async def test_archive_project(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.patch(f"/projects/{proj['id']}/archive")
    assert resp.status_code == 200
    data = resp.json()
    assert data["archived_at"] is not None


async def test_archive_project_already_archived(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    await client.patch(f"/projects/{proj['id']}/archive")
    resp = await client.patch(f"/projects/{proj['id']}/archive")
    assert resp.status_code == 409


async def test_archive_project_not_found(client):
    resp = await client.patch("/projects/nonexistent/archive")
    assert resp.status_code == 404


async def test_unarchive_project(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    await client.patch(f"/projects/{proj['id']}/archive")
    resp = await client.patch(f"/projects/{proj['id']}/unarchive")
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is None


async def test_unarchive_project_not_archived(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.patch(f"/projects/{proj['id']}/unarchive")
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# DELETE /projects/{id}
# ---------------------------------------------------------------------------

async def test_delete_archived_project(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    await client.patch(f"/projects/{proj['id']}/archive")
    resp = await client.delete(f"/projects/{proj['id']}")
    assert resp.status_code == 204
    # Should no longer appear in list
    projects = (await client.get("/projects")).json()["projects"]
    assert all(p["id"] != proj["id"] for p in projects)


async def test_delete_non_archived_project_rejected(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.delete(f"/projects/{proj['id']}")
    assert resp.status_code == 422


async def test_delete_project_not_found(client):
    resp = await client.delete("/projects/nonexistent")
    assert resp.status_code == 404
