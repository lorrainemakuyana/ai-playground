from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlmodel import select

from database import get_session
from dependencies import get_accessible_project, get_current_user, get_effective_plan, get_owned_project
from models.db import Project, ProjectShare, ProjectShareLink, User
from models.schemas import InviteByEmailRequest, ProjectShareSchema, ShareLinkSchema
from plans import sharing_allowed
from rate_limit import limiter

router = APIRouter()

_MAX_COLLABORATORS = 5
_FRONTEND_BASE = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Join via link  (registered before /{project_id}/... to avoid route conflict)
# ---------------------------------------------------------------------------

@router.post("/join/{token}", status_code=status.HTTP_200_OK)
@limiter.limit("20/minute")
async def join_via_link(
    request: Request,
    token: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    link_result = await session.exec(
        select(ProjectShareLink).where(ProjectShareLink.token == token)
    )
    link = link_result.first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or has been revoked")

    if link.expires_at is not None and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This share link has expired")

    project_result = await session.exec(select(Project).where(Project.id == link.project_id))
    project = project_result.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Owner trying to join their own project
    if project.user_id == current_user.id:
        return {"project_id": project.id}

    # Already an active collaborator
    existing_result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.project_id == link.project_id,
            ProjectShare.user_id == current_user.id,
            ProjectShare.revoked_at == None,  # noqa: E711
        )
    )
    if existing_result.first():
        return {"project_id": project.id}

    # Enforce collaborator cap
    active_count_result = await session.exec(
        select(func.count(ProjectShare.id)).where(
            ProjectShare.project_id == link.project_id,
            ProjectShare.revoked_at == None,  # noqa: E711
            ProjectShare.joined_at != None,  # noqa: E711
        )
    )
    if active_count_result.one() >= _MAX_COLLABORATORS:
        raise HTTPException(
            status_code=422,
            detail=f"Project already has the maximum of {_MAX_COLLABORATORS} collaborators",
        )

    # Check for a previously revoked share for this user and reuse it
    revoked_result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.project_id == link.project_id,
            ProjectShare.user_id == current_user.id,
        )
    )
    old_share = revoked_result.first()
    if old_share:
        old_share.revoked_at = None
        old_share.joined_at = _utcnow()
        session.add(old_share)
    else:
        share = ProjectShare(
            project_id=link.project_id,
            user_id=current_user.id,
            invited_email=current_user.email,
            invite_method="link",
            joined_at=_utcnow(),
        )
        session.add(share)

    await session.commit()
    return {"project_id": project.id}


# ---------------------------------------------------------------------------
# Invite by email
# ---------------------------------------------------------------------------

@router.post("/{project_id}/shares", response_model=ProjectShareSchema, status_code=status.HTTP_201_CREATED)
async def invite_by_email(
    project_id: str,
    body: InviteByEmailRequest,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProjectShareSchema:
    project = await get_owned_project(project_id, current_user, session)

    if not sharing_allowed(get_effective_plan(current_user)):
        raise HTTPException(status_code=403, detail="Sharing requires Pro or Ultra")

    if body.email.lower() == current_user.email.lower():
        raise HTTPException(status_code=422, detail="You cannot invite yourself")

    # Enforce collaborator cap (active + pending, non-revoked)
    total_result = await session.exec(
        select(func.count(ProjectShare.id)).where(
            ProjectShare.project_id == project_id,
            ProjectShare.revoked_at == None,  # noqa: E711
        )
    )
    if total_result.one() >= _MAX_COLLABORATORS:
        raise HTTPException(
            status_code=422,
            detail=f"Project already has the maximum of {_MAX_COLLABORATORS} collaborators",
        )

    # Check for existing non-revoked share for this email
    dup_result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.invited_email == body.email.lower(),
            ProjectShare.revoked_at == None,  # noqa: E711
        )
    )
    if dup_result.first():
        raise HTTPException(status_code=409, detail="This email already has access or a pending invite")

    # Resolve user_id if the email is already registered
    user_result = await session.exec(select(User).where(User.email == body.email.lower()))
    invited_user = user_result.first()

    share = ProjectShare(
        project_id=project_id,
        user_id=invited_user.id if invited_user else None,
        invited_email=body.email.lower(),
        invite_method="email",
        joined_at=_utcnow() if invited_user else None,
    )
    session.add(share)
    await session.commit()
    await session.refresh(share)
    return ProjectShareSchema.model_validate(share)


# ---------------------------------------------------------------------------
# List shares (owner only)
# ---------------------------------------------------------------------------

@router.get("/{project_id}/shares", response_model=list[ProjectShareSchema])
async def list_shares(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ProjectShareSchema]:
    await get_owned_project(project_id, current_user, session)
    result = await session.exec(
        select(ProjectShare)
        .where(ProjectShare.project_id == project_id)
        .order_by(ProjectShare.created_at.asc())
    )
    return [ProjectShareSchema.model_validate(s) for s in result.all()]


# ---------------------------------------------------------------------------
# Revoke a share (owner only)
# ---------------------------------------------------------------------------

@router.delete("/{project_id}/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    project_id: str,
    share_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await get_owned_project(project_id, current_user, session)
    result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.id == share_id,
            ProjectShare.project_id == project_id,
        )
    )
    share = result.first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.revoked_at is not None:
        raise HTTPException(status_code=409, detail="Share is already revoked")

    share.revoked_at = _utcnow()
    session.add(share)
    await session.commit()


# ---------------------------------------------------------------------------
# Collaborator removes their own revoked share record
# ---------------------------------------------------------------------------

@router.delete("/{project_id}/my-share", status_code=status.HTTP_204_NO_CONTENT)
async def remove_my_share(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    result = await session.exec(
        select(ProjectShare).where(
            ProjectShare.project_id == project_id,
            ProjectShare.user_id == current_user.id,
            ProjectShare.revoked_at != None,  # noqa: E711
        )
    )
    share = result.first()
    if not share:
        raise HTTPException(status_code=404, detail="No revoked share found for this project")
    await session.delete(share)
    await session.commit()


# ---------------------------------------------------------------------------
# Share link management (owner only)
# ---------------------------------------------------------------------------

@router.post("/{project_id}/share-link", response_model=ShareLinkSchema, status_code=status.HTTP_200_OK)
async def get_or_create_share_link(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShareLinkSchema:
    await get_owned_project(project_id, current_user, session)

    if not sharing_allowed(get_effective_plan(current_user)):
        raise HTTPException(status_code=403, detail="Sharing requires Pro or Ultra")

    result = await session.exec(
        select(ProjectShareLink).where(ProjectShareLink.project_id == project_id)
    )
    link = result.first()
    if not link:
        link = ProjectShareLink(
            project_id=project_id,
            token=secrets.token_hex(32),
        )
        session.add(link)
        await session.commit()
        await session.refresh(link)

    return ShareLinkSchema(
        id=link.id,
        project_id=link.project_id,
        token=link.token,
        url=f"{_FRONTEND_BASE}/app/projects/join/{link.token}",
        created_at=link.created_at,
    )


@router.delete("/{project_id}/share-link", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    await get_owned_project(project_id, current_user, session)
    result = await session.exec(
        select(ProjectShareLink).where(ProjectShareLink.project_id == project_id)
    )
    link = result.first()
    if not link:
        raise HTTPException(status_code=404, detail="No share link exists for this project")
    await session.delete(link)
    await session.commit()
