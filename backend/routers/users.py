from __future__ import annotations

from fastapi import APIRouter, Depends

from dependencies import get_current_user, get_effective_plan
from models.db import User
from models.schemas import UserMeSchema

router = APIRouter()


@router.get("/me", response_model=UserMeSchema)
async def get_me(current_user: User = Depends(get_current_user)) -> UserMeSchema:
    return UserMeSchema(
        id=current_user.id,
        email=current_user.email,
        plan=current_user.plan,
        plan_expires_at=current_user.plan_expires_at,
        effective_plan=get_effective_plan(current_user),
    )
