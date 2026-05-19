from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy import func

from database import get_session, async_session_factory
from dependencies import get_current_user
from models.db import Project, Agent, Task, AgentMessage, AgentTemplate, User
from models.enums import AgentRole, SDLCPhase
from models.schemas import (
    AgentMessageSchema,
    AgentSchema,
    CreateProjectRequest,
    ProjectDetailSchema,
    ProjectSummarySchema,
    TaskSchema,
)
import services.orchestrator as orchestrator
import services.prompt_builder as prompt_builder

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ProjectDetailSchema)
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
        select(AgentTemplate).where(AgentTemplate.is_active == True).order_by(AgentTemplate.created_at.asc())
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



@router.get("/", response_model=dict)
async def list_projects(
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    result = await session.exec(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    projects = result.all()

    # Fetch all counts in two queries (GROUP BY) instead of 2N per-project queries
    agent_counts_result = await session.exec(
        select(Agent.project_id, func.count(Agent.id)).group_by(Agent.project_id)
    )
    agent_counts: dict[str, int] = dict(agent_counts_result.all())

    task_counts_result = await session.exec(
        select(Task.project_id, func.count(Task.id)).group_by(Task.project_id)
    )
    task_counts: dict[str, int] = dict(task_counts_result.all())

    summaries: list[ProjectSummarySchema] = []
    for project in projects:
        summary = ProjectSummarySchema(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            current_phase=project.current_phase,
            created_at=project.created_at,
            agent_count=agent_counts.get(project.id, 0),
            task_count=task_counts.get(project.id, 0),
        )
        summaries.append(summary)

    return {"projects": summaries}


@router.get("/{project_id}", response_model=ProjectDetailSchema)
async def get_project(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectDetailSchema:
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id is not None and project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
        agents=[AgentSchema.model_validate(a) for a in agents],
        tasks=[TaskSchema.model_validate(t) for t in tasks],
        messages=[AgentMessageSchema.model_validate(m) for m in messages],
    )
