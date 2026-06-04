from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import delete as sql_delete, select
from sqlalchemy import func

from database import get_session, async_session_factory
from dependencies import get_accessible_project, get_current_user, get_owned_project
from models.db import Project, Agent, AgentMessage, AgentTemplate, ProjectShare, ProjectShareLink, Task, User
from models.enums import AgentRole
from models.schemas import (
    AgentMessageSchema,
    AgentSchema,
    CreateProjectRequest,
    ProjectDetailSchema,
    ProjectSummarySchema,
    TaskSchema,
)
from datetime import datetime, timezone
import services.orchestrator as orchestrator
import services.prompt_builder as prompt_builder

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectDetailSchema)
async def create_project(
    body: CreateProjectRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectDetailSchema:
    project = Project(name=body.name, description=body.description, user_id=current_user.id)
    session.add(project)
    await session.commit()
    await session.refresh(project)

    # Seed agents from global templates (fall back to hard-coded defaults if none exist)
    templates_result = await session.exec(
        select(AgentTemplate)
        .where(AgentTemplate.is_active == True, AgentTemplate.user_id == current_user.id)
        .order_by(AgentTemplate.created_at.asc())
    )
    templates = templates_result.all()

    if not templates:
        templates = [
            AgentTemplate(role=AgentRole.TECH_LEAD,  specialization="Tech Lead",           model_name="claude-sonnet-4-6"),
            AgentTemplate(role=AgentRole.ENGINEER_1, specialization="Software Engineer 1", model_name="claude-sonnet-4-6"),
            AgentTemplate(role=AgentRole.ENGINEER_2, specialization="Software Engineer 2", model_name="claude-sonnet-4-6"),
            AgentTemplate(role=AgentRole.QA,         specialization="QA Engineer",          model_name="claude-sonnet-4-6"),
            AgentTemplate(role=AgentRole.SRE,        specialization="SRE",                  model_name="claude-sonnet-4-6"),
        ]

    agents: list[Agent] = []
    for tmpl in templates:
        system_prompt = tmpl.system_prompt or prompt_builder.build_system_prompt(
            role=tmpl.role,
            specialization=tmpl.specialization,
            project=project,
        )
        agent = Agent(
            project_id=project.id,
            role=tmpl.role,
            specialization=tmpl.specialization,
            model_name=tmpl.model_name,
            system_prompt=system_prompt,
            is_template_agent=True,
        )
        session.add(agent)
        agents.append(agent)

    await session.commit()
    for agent in agents:
        await session.refresh(agent)

    # Fire-and-forget orchestration with a new session
    async def _start() -> None:
        async with async_session_factory() as new_session:
            await orchestrator.start_project(project.id, new_session)

    asyncio.create_task(_start())

    # Build response — no tasks yet, messages empty
    result = ProjectDetailSchema(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        current_phase=project.current_phase,
        created_at=project.created_at,
        agents=[],
        tasks=[],
        messages=[],
    )
    result.agents = [AgentSchema.model_validate(a) for a in agents]
    return result


@router.get("", response_model=dict)
async def list_projects(
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Own projects
    own_result = await session.exec(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    own_projects = own_result.all()

    # Projects shared with the current user (active + revoked)
    shares_result = await session.exec(
        select(ProjectShare, Project)
        .join(Project, ProjectShare.project_id == Project.id)
        .where(ProjectShare.user_id == current_user.id)
        .order_by(ProjectShare.created_at.desc())
    )
    share_rows = shares_result.all()

    agent_counts_result = await session.exec(
        select(Agent.project_id, func.count(Agent.id)).group_by(Agent.project_id)
    )
    agent_counts: dict[str, int] = dict(agent_counts_result.all())

    task_counts_result = await session.exec(
        select(Task.project_id, func.count(Task.id)).group_by(Task.project_id)
    )
    task_counts: dict[str, int] = dict(task_counts_result.all())

    # Collaborator counts for own projects
    collab_counts_result = await session.exec(
        select(ProjectShare.project_id, func.count(ProjectShare.id))
        .where(
            ProjectShare.revoked_at == None,  # noqa: E711
            ProjectShare.joined_at != None,  # noqa: E711
        )
        .group_by(ProjectShare.project_id)
    )
    collab_counts: dict[str, int] = dict(collab_counts_result.all())

    summaries: list[ProjectSummarySchema] = []

    for project in own_projects:
        summaries.append(ProjectSummarySchema(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            current_phase=project.current_phase,
            created_at=project.created_at,
            archived_at=project.archived_at,
            agent_count=agent_counts.get(project.id, 0),
            task_count=task_counts.get(project.id, 0),
            is_owner=True,
            collaborator_count=collab_counts.get(project.id, 0),
        ))

    for share, project in share_rows:
        summaries.append(ProjectSummarySchema(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            current_phase=project.current_phase,
            created_at=project.created_at,
            archived_at=project.archived_at,
            agent_count=agent_counts.get(project.id, 0),
            task_count=task_counts.get(project.id, 0),
            is_owner=False,
            collaborator_count=0,
            share_status="revoked" if share.revoked_at else "active",
            share_id=share.id,
        ))

    return {"projects": summaries}


@router.get("/{project_id}", response_model=ProjectDetailSchema)
async def get_project(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectDetailSchema:
    project = await get_accessible_project(project_id, current_user, session)

    agents_result = await session.exec(
        select(Agent)
        .where(Agent.project_id == project_id, Agent.is_archived == False)
        .order_by(Agent.is_template_agent.desc())
    )
    agents = agents_result.all()

    tasks_result = await session.exec(
        select(Task).where(Task.project_id == project_id).order_by(Task.created_at.asc())
    )
    tasks = tasks_result.all()

    messages_result = await session.exec(
        select(AgentMessage)
        .where(AgentMessage.project_id == project_id)
        .order_by(AgentMessage.timestamp.desc())
        .limit(100)
    )
    messages_raw = messages_result.all()
    # Re-sort ascending for response
    messages = list(reversed(messages_raw))

    return ProjectDetailSchema(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        current_phase=project.current_phase,
        created_at=project.created_at,
        is_owner=(project.user_id == current_user.id),
        agents=[AgentSchema.model_validate(a) for a in agents],
        tasks=[TaskSchema.model_validate(t) for t in tasks],
        messages=[AgentMessageSchema.model_validate(m) for m in messages],
    )


async def _project_summary(project: Project, session: Any) -> ProjectSummarySchema:
    agent_count_result = await session.exec(
        select(func.count(Agent.id)).where(Agent.project_id == project.id)
    )
    task_count_result = await session.exec(
        select(func.count(Task.id)).where(Task.project_id == project.id)
    )
    return ProjectSummarySchema(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        current_phase=project.current_phase,
        created_at=project.created_at,
        archived_at=project.archived_at,
        agent_count=agent_count_result.one(),
        task_count=task_count_result.one(),
        is_owner=True,
    )


@router.patch("/{project_id}/archive", response_model=ProjectSummarySchema)
async def archive_project(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectSummarySchema:
    project = await get_owned_project(project_id, current_user, session)
    if project.archived_at is not None:
        raise HTTPException(status_code=409, detail="Project is already archived")
    project.archived_at = datetime.now(timezone.utc)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return await _project_summary(project, session)


@router.patch("/{project_id}/unarchive", response_model=ProjectSummarySchema)
async def unarchive_project(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectSummarySchema:
    project = await get_owned_project(project_id, current_user, session)
    if project.archived_at is None:
        raise HTTPException(status_code=409, detail="Project is not archived")
    project.archived_at = None
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return await _project_summary(project, session)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    project = await get_owned_project(project_id, current_user, session)
    if project.archived_at is None:
        raise HTTPException(
            status_code=422,
            detail="Project must be archived before it can be permanently deleted",
        )
    for model, col in [
        (AgentMessage, AgentMessage.project_id),
        (ProjectShare, ProjectShare.project_id),
        (ProjectShareLink, ProjectShareLink.project_id),
        (Task, Task.project_id),
        (Agent, Agent.project_id),
    ]:
        await session.exec(sql_delete(model).where(col == project_id))

    await session.delete(project)
    await session.commit()
