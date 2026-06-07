from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from database import get_session
from dependencies import get_current_user
from models.db import AgentTemplate, User
from models.schemas import AgentTemplateSchema, CreateAgentTemplateRequest, UpdateAgentTemplateRequest
from services.agent_prompts import MASTER_PROMPTS

router = APIRouter()


@router.get("/master-prompts", response_model=dict[str, str])
async def get_master_prompts() -> dict[str, str]:
    """Return the master system prompt for each agent role (no auth required)."""
    return {role.value: prompt for role, prompt in MASTER_PROMPTS.items()}


@router.get("", response_model=list[AgentTemplateSchema])
async def list_templates(
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[AgentTemplateSchema]:
    result = await session.exec(
        select(AgentTemplate)
        .where(AgentTemplate.user_id == current_user.id)
        .order_by(AgentTemplate.created_at.asc())
    )
    return [AgentTemplateSchema.model_validate(t) for t in result.all()]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AgentTemplateSchema)
async def create_template(
    body: CreateAgentTemplateRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AgentTemplateSchema:
    tmpl = AgentTemplate(
        user_id=current_user.id,
        role=body.role,
        specialization=body.specialization,
        model_name=body.model_name,
        system_prompt=body.system_prompt,
    )
    session.add(tmpl)
    await session.commit()
    await session.refresh(tmpl)
    return AgentTemplateSchema.model_validate(tmpl)


@router.patch("/{template_id}", response_model=AgentTemplateSchema)
async def update_template(
    template_id: str,
    body: UpdateAgentTemplateRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AgentTemplateSchema:
    result = await session.exec(
        select(AgentTemplate).where(
            AgentTemplate.id == template_id,
            AgentTemplate.user_id == current_user.id,
        )
    )
    tmpl = result.first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    if body.specialization is not None:
        tmpl.specialization = body.specialization.strip()
    if body.model_name is not None:
        tmpl.model_name = body.model_name
    if body.system_prompt is not None:
        tmpl.system_prompt = body.system_prompt
    if body.is_active is not None:
        tmpl.is_active = body.is_active

    session.add(tmpl)
    await session.commit()
    await session.refresh(tmpl)
    return AgentTemplateSchema.model_validate(tmpl)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_template(
    template_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    result = await session.exec(
        select(AgentTemplate).where(
            AgentTemplate.id == template_id,
            AgentTemplate.user_id == current_user.id,
        )
    )
    tmpl = result.first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    tmpl.is_active = False
    session.add(tmpl)
    await session.commit()
