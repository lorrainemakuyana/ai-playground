from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import select

from database import get_session
from models.db import Project
import services.orchestrator as orchestrator

router = APIRouter()


@router.get("/{project_id}/stream")
async def stream_project_events(
    project_id: str,
    session: Any = Depends(get_session),
) -> StreamingResponse:
    # Verify project exists
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return StreamingResponse(
        orchestrator.stream_events(project_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
