from __future__ import annotations

from typing import Any, Optional

from fastapi import Cookie, Depends, Header, HTTPException, status
from jose import JWTError
from sqlmodel import select

from database import get_session
from models.db import Project, User
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
    # user_id may be None for legacy projects created before auth was added
    if project.user_id is not None and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project
