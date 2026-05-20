from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import select

from database import get_session
from dependencies import get_accessible_project, get_current_user
from models.db import User
import services.orchestrator as orchestrator

router = APIRouter()


@router.get("/{project_id}/stream")
async def stream_project_events(
    project_id: str,
    session: Any = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    await get_accessible_project(project_id, current_user, session)

    return StreamingResponse(
        orchestrator.stream_events(project_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
