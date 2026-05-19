from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from database import get_session
from models.db import Project, Agent
from models.schemas import AgentSchema, CreateAgentRequest, UpdateAgentRequest
import services.prompt_builder as prompt_builder

router = APIRouter()


@router.get("/{project_id}/agents", response_model=list[AgentSchema])
async def list_agents(
    project_id: str,
    session: Any = Depends(get_session),
) -> list[AgentSchema]:
    result = await session.exec(select(Project).where(Project.id == project_id))
    if not result.first():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await session.exec(
        select(Agent)
        .where(Agent.project_id == project_id, Agent.is_archived == False)
        .order_by(Agent.is_template_agent.desc())
    )
    return [AgentSchema.model_validate(a) for a in result.all()]


@router.post("/{project_id}/agents", status_code=status.HTTP_201_CREATED, response_model=AgentSchema)
async def create_agent(
    project_id: str,
    body: CreateAgentRequest,
    session: Any = Depends(get_session),
) -> AgentSchema:
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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
) -> AgentSchema:
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
) -> None:
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
