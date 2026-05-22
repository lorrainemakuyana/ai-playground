import pytest
from unittest.mock import AsyncMock, patch
from models.enums import SDLCPhase, TaskStatus

VALID_PROJECT = {"name": "Task Test", "description": "Testing task endpoints for this project"}


async def _create_project_with_task(client, test_session, status=TaskStatus.PENDING):
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
        status=status,
    )
    test_session.add(task)
    await test_session.commit()
    await test_session.refresh(task)
    return project_id, task.id


# ---------------------------------------------------------------------------
# GET /{project_id}/tasks
# ---------------------------------------------------------------------------

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


async def test_list_tasks_status_filter(client, test_session):
    project_id, _ = await _create_project_with_task(client, test_session, status=TaskStatus.PENDING)
    resp = await client.get(f"/projects/{project_id}/tasks?status=done")
    assert resp.status_code == 200
    assert resp.json()["tasks"] == []


async def test_list_tasks_project_not_found(client):
    resp = await client.get("/projects/nonexistent/tasks")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /{project_id}/tasks/{task_id}
# ---------------------------------------------------------------------------

async def test_update_task_status(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session)
    resp = await client.patch(
        f"/projects/{project_id}/tasks/{task_id}",
        json={"status": "done"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "done"


async def test_update_task_output(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session)
    resp = await client.patch(
        f"/projects/{project_id}/tasks/{task_id}",
        json={"output": "Task completed successfully."},
    )
    assert resp.status_code == 200
    assert resp.json()["output"] == "Task completed successfully."


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


# ---------------------------------------------------------------------------
# POST /{project_id}/tasks/{task_id}/cancel
# ---------------------------------------------------------------------------

async def test_cancel_pending_task(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session, status=TaskStatus.PENDING)
    with patch("routers.tasks.orchestrator.cancel_task", new_callable=AsyncMock) as mock_cancel:
        # Simulate cancel_task setting status to cancelled in DB
        from models.db import Task
        from sqlmodel import select

        async def _do_cancel(tid, session):
            result = await session.exec(select(Task).where(Task.id == tid))
            t = result.first()
            t.status = TaskStatus.CANCELLED
            session.add(t)
            await session.commit()

        mock_cancel.side_effect = _do_cancel
        resp = await client.post(f"/projects/{project_id}/tasks/{task_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


async def test_cancel_done_task_rejected(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session, status=TaskStatus.DONE)
    resp = await client.post(f"/projects/{project_id}/tasks/{task_id}/cancel")
    assert resp.status_code == 400


async def test_cancel_task_not_found(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.post(f"/projects/{proj['id']}/tasks/nonexistent/cancel")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /{project_id}/tasks/{task_id}/retry
# ---------------------------------------------------------------------------

async def test_retry_failed_task(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session, status=TaskStatus.FAILED)
    with patch("routers.tasks.orchestrator.dispatch_task", new_callable=AsyncMock):
        resp = await client.post(f"/projects/{project_id}/tasks/{task_id}/retry")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


async def test_retry_in_progress_task_rejected(client, test_session):
    project_id, task_id = await _create_project_with_task(client, test_session, status=TaskStatus.IN_PROGRESS)
    resp = await client.post(f"/projects/{project_id}/tasks/{task_id}/retry")
    assert resp.status_code == 400


async def test_retry_task_not_found(client):
    proj = (await client.post("/projects", json=VALID_PROJECT)).json()
    resp = await client.post(f"/projects/{proj['id']}/tasks/nonexistent/retry")
    assert resp.status_code == 404
