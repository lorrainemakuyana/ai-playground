from __future__ import annotations

import os
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select

from database import get_session
from dependencies import get_current_user, get_effective_plan, get_owned_project
from models.db import Project, User
from models.enums import PlanTier

router = APIRouter()

_REPO_RE = re.compile(r"^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$")


def _require_pro_or_ultra(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that blocks Free-tier users from GitHub integration."""
    plan = get_effective_plan(current_user)
    if plan == PlanTier.FREE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Free plan limit: GitHub integration requires Pro or Ultra",
        )
    return current_user


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class SaveTokenRequest(BaseModel):
    token: str


class TokenStatusResponse(BaseModel):
    connected: bool


class LinkRepoRequest(BaseModel):
    github_repo: Optional[str] = None
    github_branch: Optional[str] = None


class GitHubStatusResponse(BaseModel):
    github_repo: Optional[str] = None
    github_branch: Optional[str] = None
    github_push_status: Optional[str] = None
    github_push_error: Optional[str] = None
    github_pr_url: Optional[str] = None


class PushResponse(BaseModel):
    status: str
    error: Optional[str] = None


class PRResponse(BaseModel):
    status: str
    pr_url: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

@router.post("/github/token", status_code=status.HTTP_204_NO_CONTENT)
async def save_github_token(
    body: SaveTokenRequest,
    current_user: User = Depends(_require_pro_or_ultra),
    session: Any = Depends(get_session),
):
    """Validate and store the user's GitHub PAT (encrypted at rest)."""
    import services.github_service as gh

    pat = body.token.strip()
    if not pat:
        raise HTTPException(status_code=400, detail="token is required")

    if not await gh.validate_pat(pat):
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub token — authentication with GitHub failed",
        )

    result = await session.exec(select(User).where(User.id == current_user.id))
    user = result.first()
    user.github_token_enc = gh.encrypt_pat(pat)
    session.add(user)
    await session.commit()


@router.delete("/github/token", status_code=status.HTTP_204_NO_CONTENT)
async def delete_github_token(
    current_user: User = Depends(_require_pro_or_ultra),
    session: Any = Depends(get_session),
):
    result = await session.exec(select(User).where(User.id == current_user.id))
    user = result.first()
    user.github_token_enc = None
    session.add(user)
    await session.commit()


@router.get("/github/token/status", response_model=TokenStatusResponse)
async def github_token_status(
    current_user: User = Depends(_require_pro_or_ultra),
):
    return TokenStatusResponse(connected=bool(current_user.github_token_enc))


# ---------------------------------------------------------------------------
# Per-project repo settings
# ---------------------------------------------------------------------------

@router.patch("/projects/{project_id}/github", response_model=GitHubStatusResponse)
async def link_github_repo(
    project_id: str,
    body: LinkRepoRequest,
    current_user: User = Depends(_require_pro_or_ultra),
    session: Any = Depends(get_session),
):
    """Set or clear the GitHub repo/branch for a project."""
    import services.github_service as gh

    project = await get_owned_project(project_id, current_user, session)

    repo = (body.github_repo or "").strip() or None

    if repo:
        if not _REPO_RE.match(repo):
            raise HTTPException(
                status_code=400,
                detail="github_repo must be in owner/repo format (e.g. acme/my-app)",
            )
        if not current_user.github_token_enc:
            raise HTTPException(
                status_code=400,
                detail="Connect a GitHub token before linking a repository",
            )
        try:
            pat = gh.decrypt_pat(current_user.github_token_enc)
        except Exception:
            raise HTTPException(status_code=400, detail="Could not read stored GitHub token")

        if not await gh.validate_repo(pat, repo):
            raise HTTPException(
                status_code=400,
                detail="Repository not found or not accessible with your GitHub token",
            )

    project.github_repo = repo
    project.github_branch = (
        (body.github_branch or "").strip() or (f"sdlc/{project_id}" if repo else None)
    )
    if not repo:
        project.github_branch = None

    session.add(project)
    await session.commit()
    await session.refresh(project)

    return GitHubStatusResponse(
        github_repo=project.github_repo,
        github_branch=project.github_branch,
        github_push_status=project.github_push_status,
        github_push_error=project.github_push_error,
        github_pr_url=project.github_pr_url,
    )


# ---------------------------------------------------------------------------
# Manual triggers
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/github/push", response_model=PushResponse)
async def trigger_push(
    project_id: str,
    current_user: User = Depends(_require_pro_or_ultra),
    session: Any = Depends(get_session),
):
    """Manually push implementation content to GitHub."""
    import services.github_service as gh

    project = await get_owned_project(project_id, current_user, session)
    push_status = await gh.auto_push(project, session)

    # Reload after auto_push may have changed session state
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    project.github_push_status = push_status
    error: Optional[str] = None
    if push_status == "failed":
        error = "Push failed — check your GitHub token and repo settings"
        project.github_push_error = error
    else:
        project.github_push_error = None
    session.add(project)
    await session.commit()

    return PushResponse(status=push_status, error=error)


@router.post("/projects/{project_id}/github/pr", response_model=PRResponse)
async def trigger_pr(
    project_id: str,
    current_user: User = Depends(_require_pro_or_ultra),
    session: Any = Depends(get_session),
):
    """Manually open a GitHub pull request for this project."""
    import services.github_service as gh

    project = await get_owned_project(project_id, current_user, session)
    frontend_url = os.getenv("FRONTEND_URL", "")
    pr_status, pr_url = await gh.auto_pr(project, session, frontend_url=frontend_url)

    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if pr_status == "success" and pr_url:
        project.github_pr_url = pr_url
    session.add(project)
    await session.commit()

    error: Optional[str] = (
        "PR creation failed — check your GitHub token and repo settings"
        if pr_status == "failed"
        else None
    )
    return PRResponse(status=pr_status, pr_url=pr_url or None, error=error)
