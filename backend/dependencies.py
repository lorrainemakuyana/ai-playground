from __future__ import annotations

import os
import secrets as _secrets
from typing import Any, Optional

from fastapi import Cookie, Depends, Header, HTTPException, status
from jose import JWTError
from sqlmodel import select

from database import get_session
from models.db import Project, ProjectShare, User
from plans import get_effective_plan  # noqa: F401  (re-exported for route imports)
from services.auth_service import decode_token


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    auth_token: Optional[str] = Cookie(default=None),
    session: Any = Depends(get_session),
) -> User:
    token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth_token:
        token = auth_token

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
        user_id: str = payload["sub"]
        token_ver: int = payload["ver"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    result = await session.exec(select(User).where(User.id == user_id))
    user = result.first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.token_version != token_ver:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session has been revoked")
    return user


async def get_owned_project(
    project_id: str,
    current_user: User,
    session: Any,
) -> Project:
    """Fetch a project and verify the current user owns it."""
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


async def get_accessible_project(
    project_id: str,
    current_user: User,
    session: Any,
) -> Project:
    """Fetch a project accessible to the current user (owner or active collaborator)."""
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if project.user_id == current_user.id:
        return project

    share_result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.user_id == current_user.id,
            ProjectShare.revoked_at == None,  # noqa: E711
        )
    )
    if share_result.first():
        return project

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def admin_required(authorization: Optional[str] = Header(default=None)) -> None:
    """Gate back-office /admin routes behind the ADMIN_SECRET bearer token.

    Deliberately separate from the user JWT system: admins need not be
    registered users. Fails closed (503) if ADMIN_SECRET is unset so a missing
    env var can never leave the admin surface open.
    """
    expected = os.getenv("ADMIN_SECRET")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API not configured",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
        )
    presented = authorization[7:]
    if not _secrets.compare_digest(presented, expected):  # constant-time
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin credentials",
        )
