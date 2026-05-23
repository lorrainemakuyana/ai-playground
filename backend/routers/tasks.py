from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select

from database import get_session
from dependencies import get_accessible_project, get_current_user, get_owned_project
from models.db import Task, User
from models.enums import SDLCPhase, TaskStatus
from models.schemas import TaskSchema, UpdateTaskRequest, DirectiveRequest
import services.orchestrator as orchestrator

router = APIRouter()


@router.get("/{project_id}/tasks", response_model=dict)
async def list_tasks(
    project_id: str,
    phase: Optional[SDLCPhase] = Query(default=None),
    status: Optional[TaskStatus] = Query(default=None),
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    await get_accessible_project(project_id, current_user, session)
    query = select(Task).where(Task.project_id == project_id)
    if phase is not None:
        query = query.where(Task.phase == phase)
    if status is not None:
        query = query.where(Task.status == status)
    result = await session.exec(query.order_by(Task.created_at.asc()))
    return {"tasks": [TaskSchema.model_validate(t) for t in result.all()]}


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskSchema)
async def update_task(
    project_id: str,
    task_id: str,
    body: UpdateTaskRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TaskSchema:
    await get_owned_project(project_id, current_user, session)
    task_result = await session.exec(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = task_result.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not body.model_dump(exclude_none=True):
        raise HTTPException(status_code=400, detail="No fields provided for update")

    if body.status is not None:
        task.status = body.status
    if body.output is not None:
        task.output = body.output
    if body.assigned_agent_id is not None:
        task.assigned_agent_id = body.assigned_agent_id

    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return TaskSchema.model_validate(task)


@router.post("/{project_id}/tasks/{task_id}/retry", response_model=TaskSchema)
async def retry_task(
    project_id: str,
    task_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TaskSchema:
    await get_accessible_project(project_id, current_user, session)
    task_result = await session.exec(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = task_result.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in (TaskStatus.FAILED, TaskStatus.PENDING, TaskStatus.CANCELLED):
        raise HTTPException(status_code=400, detail=f"Cannot retry task with status: {task.status}")

    task.status = TaskStatus.PENDING
    task.output = None
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    await session.commit()
    await session.refresh(task)
    await orchestrator.dispatch_task(task, session)
    return TaskSchema.model_validate(task)


@router.post("/{project_id}/tasks/{task_id}/cancel", response_model=TaskSchema)
async def cancel_task(
    project_id: str,
    task_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TaskSchema:
    await get_owned_project(project_id, current_user, session)
    task_result = await session.exec(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = task_result.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in (TaskStatus.IN_PROGRESS, TaskStatus.PENDING):
        raise HTTPException(status_code=400, detail=f"Cannot cancel task with status: {task.status}")

    await orchestrator.cancel_task(task_id, session)
    await session.refresh(task)
    return TaskSchema.model_validate(task)


@router.post("/{project_id}/directive", response_model=TaskSchema, status_code=202)
async def send_directive(
    project_id: str,
    body: DirectiveRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TaskSchema:
    await get_accessible_project(project_id, current_user, session)
    task = await orchestrator.handle_user_directive(project_id, body.content, session)
    return TaskSchema.model_validate(task)


@router.post("/{project_id}/dispatch-next", response_model=TaskSchema)
async def dispatch_next_task(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TaskSchema:
    project = await get_accessible_project(project_id, current_user, session)
    task_result = await session.exec(
        select(Task).where(
            Task.project_id == project_id,
            Task.phase == project.current_phase,
            Task.status == TaskStatus.PENDING,
        ).limit(1)
    )
    task = task_result.first()
    if not task:
        raise HTTPException(status_code=409, detail=f"No pending tasks in phase '{project.current_phase.value}'")
    await orchestrator.dispatch_task(task, session)
    await session.refresh(task)
    return TaskSchema.model_validate(task)
