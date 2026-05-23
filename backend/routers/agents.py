from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from database import get_session
from dependencies import get_current_user, get_owned_project
from models.db import Agent, User
from models.schemas import AgentSchema, CreateAgentRequest, UpdateAgentRequest
import services.prompt_builder as prompt_builder

router = APIRouter()


@router.post("/{project_id}/agents", status_code=status.HTTP_201_CREATED, response_model=AgentSchema)
async def create_agent(
    project_id: str,
    body: CreateAgentRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AgentSchema:
    project = await get_owned_project(project_id, current_user, session)
    system_prompt = body.system_prompt or prompt_builder.build_system_prompt(
        role=body.role,
        specialization=body.specialization,
        project=project,
    )
    agent = Agent(
        project_id=project_id,
        role=body.role,
        specialization=body.specialization,
        model_name=body.model_name,
        system_prompt=system_prompt,
        is_template_agent=False,
    )
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return AgentSchema.model_validate(agent)


@router.patch("/{project_id}/agents/{agent_id}", response_model=AgentSchema)
async def update_agent(
    project_id: str,
    agent_id: str,
    body: UpdateAgentRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AgentSchema:
    await get_owned_project(project_id, current_user, session)
    result = await session.exec(
        select(Agent).where(Agent.id == agent_id, Agent.project_id == project_id)
    )
    agent = result.first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.is_template_agent:
        raise HTTPException(status_code=403, detail="Default team agents can only be edited from the global team settings")

    if body.specialization is not None:
        agent.specialization = body.specialization.strip()
    if body.model_name is not None:
        agent.model_name = body.model_name
    if body.system_prompt is not None:
        agent.system_prompt = body.system_prompt

    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return AgentSchema.model_validate(agent)


@router.delete("/{project_id}/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_agent(
    project_id: str,
    agent_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await get_owned_project(project_id, current_user, session)
    result = await session.exec(
        select(Agent).where(Agent.id == agent_id, Agent.project_id == project_id)
    )
    agent = result.first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.is_template_agent:
        raise HTTPException(status_code=403, detail="Default team agents cannot be removed from a project")

    agent.is_archived = True
    session.add(agent)
    await session.commit()
