import pytest

VALID_CREDS = {"email": "user@example.com", "password": "securepass123"}


async def test_register_success(raw_client):
    resp = await raw_client.post("/auth/register", json=VALID_CREDS)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == VALID_CREDS["email"]
    assert "access_token" in data
    assert "user_id" in data
    assert data["token_type"] == "bearer"
    # Cookie should be set
    assert "auth_token" in resp.cookies


async def test_register_seeds_default_agent_team(raw_client):
    reg = await raw_client.post("/auth/register", json=VALID_CREDS)
    token = reg.json()["access_token"]
    resp = await raw_client.get("/agent-templates", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    templates = resp.json()
    # The new user gets their own customizable default team (tech-lead + 2 eng + qa + sre)
    assert len(templates) == 5
    roles = {t["role"] for t in templates}
    assert "tech-lead" in roles


async def test_register_duplicate_email(raw_client):
    await raw_client.post("/auth/register", json=VALID_CREDS)
    resp = await raw_client.post("/auth/register", json=VALID_CREDS)
    assert resp.status_code == 409
    assert "already registered" in resp.json()["detail"].lower()


async def test_register_weak_password(raw_client):
    resp = await raw_client.post("/auth/register", json={"email": "user@example.com", "password": "short"})
    assert resp.status_code == 422


async def test_register_invalid_email(raw_client):
    resp = await raw_client.post("/auth/register", json={"email": "not-an-email", "password": "securepass123"})
    assert resp.status_code == 422


async def test_login_success(raw_client):
    await raw_client.post("/auth/register", json=VALID_CREDS)
    resp = await raw_client.post("/auth/login", json=VALID_CREDS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == VALID_CREDS["email"]
    assert "access_token" in data
    assert "auth_token" in resp.cookies


async def test_login_wrong_password(raw_client):
    await raw_client.post("/auth/register", json=VALID_CREDS)
    resp = await raw_client.post("/auth/login", json={**VALID_CREDS, "password": "wrongpassword"})
    assert resp.status_code == 401


async def test_login_unknown_email(raw_client):
    resp = await raw_client.post("/auth/login", json={"email": "ghost@example.com", "password": "securepass123"})
    assert resp.status_code == 401


async def test_logout(raw_client):
    reg = await raw_client.post("/auth/register", json=VALID_CREDS)
    token = reg.json()["access_token"]
    resp = await raw_client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204
    assert resp.cookies.get("auth_token") is None or resp.cookies.get("auth_token") == ""


async def test_logout_invalidates_token(raw_client):
    reg = await raw_client.post("/auth/register", json=VALID_CREDS)
    token = reg.json()["access_token"]
    await raw_client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    resp = await raw_client.get("/projects", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
