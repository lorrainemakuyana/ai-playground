import pytest

TEMPLATE_BASE = {"role": "custom", "specialization": "DevOps Engineer", "model_name": "claude-sonnet-4-6"}


# ---------------------------------------------------------------------------
# GET /agent-templates
# ---------------------------------------------------------------------------

async def test_list_templates_empty(client):
    resp = await client.get("/agent-templates")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_templates_returns_created(client):
    await client.post("/agent-templates", json=TEMPLATE_BASE)
    resp = await client.get("/agent-templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert len(templates) == 1
    assert templates[0]["specialization"] == "DevOps Engineer"


# ---------------------------------------------------------------------------
# POST /agent-templates
# ---------------------------------------------------------------------------

async def test_create_template_success(client):
    resp = await client.post("/agent-templates", json=TEMPLATE_BASE)
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "custom"
    assert data["specialization"] == "DevOps Engineer"
    assert data["model_name"] == "claude-sonnet-4-6"
    assert data["system_prompt"] is None
    assert data["is_active"] is True


async def test_create_template_with_system_prompt(client):
    resp = await client.post("/agent-templates", json={
        **TEMPLATE_BASE,
        "system_prompt": "You are a DevOps specialist focused on CI/CD.",
    })
    assert resp.status_code == 201
    assert resp.json()["system_prompt"] == "You are a DevOps specialist focused on CI/CD."


async def test_create_template_with_named_role(client):
    resp = await client.post("/agent-templates", json={
        "role": "engineer-1",
        "specialization": "Senior Engineer (1)",
        "model_name": "claude-opus-4-7",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "engineer-1"
    assert data["model_name"] == "claude-opus-4-7"


async def test_create_template_specialization_required(client):
    resp = await client.post("/agent-templates", json={"role": "custom", "model_name": "claude-sonnet-4-6"})
    assert resp.status_code == 422


async def test_create_template_rejects_arbitrary_model_name(client):
    resp = await client.post("/agent-templates", json={**TEMPLATE_BASE, "model_name": "gpt-4o"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# PATCH /agent-templates/{id}
# ---------------------------------------------------------------------------

async def test_update_template_specialization(client):
    created = (await client.post("/agent-templates", json=TEMPLATE_BASE)).json()
    resp = await client.patch(f"/agent-templates/{created['id']}", json={"specialization": "Platform Engineer"})
    assert resp.status_code == 200
    assert resp.json()["specialization"] == "Platform Engineer"


async def test_update_template_model(client):
    created = (await client.post("/agent-templates", json=TEMPLATE_BASE)).json()
    resp = await client.patch(f"/agent-templates/{created['id']}", json={"model_name": "claude-haiku-4-5-20251001"})
    assert resp.status_code == 200
    assert resp.json()["model_name"] == "claude-haiku-4-5-20251001"


async def test_update_template_system_prompt(client):
    created = (await client.post("/agent-templates", json=TEMPLATE_BASE)).json()
    resp = await client.patch(
        f"/agent-templates/{created['id']}",
        json={"system_prompt": "You specialize in infrastructure automation."},
    )
    assert resp.status_code == 200
    assert resp.json()["system_prompt"] == "You specialize in infrastructure automation."


async def test_update_template_not_found(client):
    resp = await client.patch("/agent-templates/nonexistent", json={"specialization": "X"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /agent-templates/{id}  (soft archive — sets is_active=False)
# ---------------------------------------------------------------------------

async def test_archive_template(client):
    created = (await client.post("/agent-templates", json=TEMPLATE_BASE)).json()
    resp = await client.delete(f"/agent-templates/{created['id']}")
    assert resp.status_code == 204
    # Template still returned by list but marked inactive (frontend filters by is_active)
    templates = (await client.get("/agent-templates")).json()
    match = next((t for t in templates if t["id"] == created["id"]), None)
    assert match is not None
    assert match["is_active"] is False


async def test_archive_template_not_found(client):
    resp = await client.delete("/agent-templates/nonexistent")
    assert resp.status_code == 404
