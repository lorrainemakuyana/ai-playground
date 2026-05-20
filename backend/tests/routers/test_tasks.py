import pytest
from models.enums import SDLCPhase, TaskStatus

VALID_PROJECT = {"name": "Task Test", "description": "Testing task endpoints for this project"}


async def _create_project_with_task(client, test_session):
    """Helper: create project and insert a task directly via session."""
    from models.db import Task

    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project = create_resp.json()
    project_id = project["id"]

    task = Task(
        project_id=project_id,
        phase=SDLCPhase.DISCOVERY,
        title="Test Task",
        description="A test task description",
        status=TaskStatus.PENDING,
    )
    test_session.add(task)
    await test_session.commit()
    await test_session.refresh(task)
    return project_id, task.id


async def test_list_tasks_empty(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/projects/{project_id}/tasks")
    assert resp.status_code == 200
    assert resp.json()["tasks"] == []


async def test_list_tasks_returns_tasks(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session)
    resp = await client.get(f"/projects/{project_id}/tasks")
    assert resp.status_code == 200
    tasks = resp.json()["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["id"] == task_id


async def test_list_tasks_phase_filter(client, test_session):
    project_id, _ = await _create_project_with_task(client, test_session)
    resp = await client.get(f"/projects/{project_id}/tasks?phase=architecture")
    assert resp.status_code == 200
    assert resp.json()["tasks"] == []


async def test_list_tasks_project_not_found(client):
    resp = await client.get("/projects/nonexistent/tasks")
    assert resp.status_code == 404


async def test_update_task_status(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session)
    resp = await client.patch(
        f"/projects/{project_id}/tasks/{task_id}",
        json={"status": "done"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"


async def test_update_task_no_fields(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session)
    resp = await client.patch(f"/projects/{project_id}/tasks/{task_id}", json={})
    assert resp.status_code == 400


async def test_update_task_not_found(client):
    create_resp = await client.post("/projects", json=VALID_PROJECT)
    project_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/projects/{project_id}/tasks/nonexistent",
        json={"status": "done"},
    )
    assert resp.status_code == 404
