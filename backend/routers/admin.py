from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from database import get_session
from dependencies import admin_required, get_effective_plan
from models.db import User
from models.enums import PlanTier
from models.schemas import AdminUserSchema, SetPlanRequest

router = APIRouter(dependencies=[Depends(admin_required)])


async def apply_plan(
    session: Any,
    user: User,
    plan: PlanTier,
    plan_expires_at: Optional[datetime],
) -> User:
    """The single place a user's plan is mutated.

    The admin endpoint and (later) the Stripe webhook both route through here so
    plan-change logic lives in exactly one spot.
    """
    user.plan = plan
    user.plan_expires_at = plan_expires_at
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


def _to_schema(user: User) -> AdminUserSchema:
    return AdminUserSchema(
        id=user.id,
        email=user.email,
        plan=user.plan,
        plan_expires_at=user.plan_expires_at,
        effective_plan=get_effective_plan(user),
    )


@router.get("/users/{user_id}", response_model=AdminUserSchema)
async def get_user_admin(
    user_id: str,
    session: Any = Depends(get_session),
) -> AdminUserSchema:
    user = (await session.exec(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_schema(user)


@router.patch("/users/{user_id}/plan", response_model=AdminUserSchema)
async def set_user_plan(
    user_id: str,
    body: SetPlanRequest,
    session: Any = Depends(get_session),
) -> AdminUserSchema:
    user = (await session.exec(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = await apply_plan(session, user, body.plan, body.plan_expires_at)
    return _to_schema(user)
