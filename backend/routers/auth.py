from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import select

from database import get_session, seed_default_templates_for_user
from dependencies import get_current_user
from models.db import ProjectShare, User
from models.schemas import LoginRequest, RegisterRequest, TokenResponse
from rate_limit import limiter
from services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter()

_COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days — matches ACCESS_TOKEN_EXPIRE_DAYS
_SECURE_COOKIE = os.getenv("ENVIRONMENT", "development") == "production"


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="auth_token",
        value=token,
        max_age=_COOKIE_MAX_AGE,
        path="/",
        httponly=True,    # not JS-readable; sent automatically on same-origin /api requests
        samesite="lax",
        secure=_SECURE_COOKIE,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    session: Any = Depends(get_session),
) -> TokenResponse:
    existing = await session.exec(select(User).where(User.email == body.email))
    if existing.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=body.email, password_hash=hash_password(body.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Give the new user their own default engineering team to customize
    await seed_default_templates_for_user(user.id, session)
    await session.commit()

    # Activate any pending email invites for this address
    pending_result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.invited_email == user.email.lower(),
            ProjectShare.user_id == None,  # noqa: E711
            ProjectShare.revoked_at == None,  # noqa: E711
        )
    )
    pending_shares = pending_result.all()
    for pending in pending_shares:
        pending.user_id = user.id
        pending.joined_at = user.created_at
        session.add(pending)
    if pending_shares:
        await session.commit()

    token = create_access_token(user.id, user.email, user.token_version)
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    session: Any = Depends(get_session),
) -> TokenResponse:
    result = await session.exec(select(User).where(User.email == body.email))
    user = result.first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user.id, user.email, user.token_version)
    _set_auth_cookie(response, token)
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    session: Any = Depends(get_session),
) -> None:
    current_user.token_version += 1
    session.add(current_user)
    await session.commit()
    response.delete_cookie(key="auth_token", path="/")

