from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from sqlalchemy import func
from sqlmodel import select

from models.db import Project, Agent, Task, AgentMessage
from models.enums import AgentRole, AgentStatus, SDLCPhase, TaskStatus, ProjectStatus
from models.schemas import AgentMessageSchema, TaskSchema

logger = logging.getLogger(__name__)

# Module-level dict: one asyncio.Queue per project_id
_project_queues: dict[str, asyncio.Queue] = {}

# task_id → running asyncio.Task, so we can cancel on demand
_running_tasks: dict[str, asyncio.Task] = {}

# Ordered list of SDLC phases for phase advancement
_PHASE_ORDER = [
    SDLCPhase.DISCOVERY,
    SDLCPhase.ARCHITECTURE,
    SDLCPhase.IMPLEMENTATION,
    SDLCPhase.TESTING,
    SDLCPhase.SRE_REVIEW,
    SDLCPhase.DONE,
]


def get_or_create_queue(project_id: str) -> asyncio.Queue:
    """Return the existing queue for project_id or create a new one."""
    if project_id not in _project_queues:
        _project_queues[project_id] = asyncio.Queue()
    return _project_queues[project_id]


def get_phase_task_templates(phase: SDLCPhase) -> list[dict[str, Any]]:
    """Return task template dicts for each SDLC phase."""
    templates: dict[SDLCPhase, list[dict[str, Any]]] = {
        SDLCPhase.DISCOVERY: [
            {
                "title": "Requirements Analysis",
                "description": (
                    "Analyze the project description and produce structured requirements, "
                    "user personas, and success criteria."
                ),
                "role": AgentRole.TECH_LEAD,
            },
            {
                "title": "Tech Stack Proposal",
                "description": (
                    "Propose appropriate tech stack based on requirements. "
                    "Justify choices with trade-offs."
                ),
                "role": AgentRole.TECH_LEAD,
            },
        ],
        SDLCPhase.ARCHITECTURE: [
            {
                "title": "System Architecture Design",
                "description": (
                    "Design system architecture including components, data flows, and integration points. "
                    "Produce an architecture diagram in ASCII."
                ),
                "role": AgentRole.TECH_LEAD,
            },
            {
                "title": "API Contract Definition",
                "description": (
                    "Define all API endpoints with request/response shapes and error cases."
                ),
                "role": AgentRole.ENGINEER_1,
            },
            {
                "title": "Data Model Design",
                "description": "Design database schema and data models.",
                "role": AgentRole.ENGINEER_2,
            },
        ],
        SDLCPhase.IMPLEMENTATION: [
            {
                "title": "Core Feature Implementation",
                "description": (
                    "Review the conversation history to understand the agreed tech stack and architecture. "
                    "Implement ALL primary features as complete, runnable source files.\n\n"
                    "Output EVERY file needed to run the project using this exact format:\n\n"
                    "<file path=\"relative/path/to/file.ext\">\n"
                    "full file contents here\n"
                    "</file>\n\n"
                    "Include ALL config files (package.json, tsconfig.json, requirements.txt, go.mod, "
                    "Dockerfile, .env.example, etc.) so the project runs with a single install command. "
                    "Write complete, production-quality code — no placeholders, no TODOs, no truncation. "
                    "End your response with a 'START COMMAND' section listing the exact terminal commands "
                    "to install dependencies and start the project."
                ),
                "role": AgentRole.ENGINEER_1,
            },
            {
                "title": "Secondary Feature Implementation",
                "description": (
                    "Review the conversation history and the core implementation already produced. "
                    "Implement ALL supporting features, integrations, and any files not yet covered.\n\n"
                    "Output each new or modified file using this exact format:\n\n"
                    "<file path=\"relative/path/to/file.ext\">\n"
                    "full file contents here\n"
                    "</file>\n\n"
                    "Do not repeat files already output by the core implementation unless you are "
                    "changing them. Write complete file contents — no truncation. "
                    "If a config file (package.json, etc.) needs updating, output the full updated version."
                ),
                "role": AgentRole.ENGINEER_2,
            },
        ],
        SDLCPhase.TESTING: [
            {
                "title": "Test Plan Creation",
                "description": (
                    "Create comprehensive test plan covering unit, integration, and e2e tests "
                    "for all features."
                ),
                "role": AgentRole.QA,
            },
            {
                "title": "Test Case Generation",
                "description": (
                    "Generate concrete test cases with expected inputs/outputs. "
                    "Flag any edge cases."
                ),
                "role": AgentRole.QA,
            },
        ],
        SDLCPhase.SRE_REVIEW: [
            {
                "title": "Infrastructure Review",
                "description": (
                    "Review deployment architecture, infrastructure requirements, "
                    "scaling considerations, and operational runbook."
                ),
                "role": AgentRole.SRE,
            },
            {
                "title": "Reliability Assessment",
                "description": (
                    "Assess reliability, availability, and failure modes. "
                    "Produce green/yellow/red readiness report."
                ),
                "role": AgentRole.SRE,
            },
        ],
        SDLCPhase.DONE: [],
    }
    return templates.get(phase, [])


async def _seed_tasks(project_id: str, phase: SDLCPhase, session: Any) -> list[Task]:
    """Create Task rows for every template in a given phase and add them to the session."""
    tasks_created: list[Task] = []
    for tmpl in get_phase_task_templates(phase):
        task = Task(
            project_id=project_id,
            phase=phase,
            title=tmpl["title"],
            description=tmpl["description"],
            role=tmpl["role"],
            status=TaskStatus.PENDING,
        )
        session.add(task)
        tasks_created.append(task)
    return tasks_created


async def publish_event(project_id: str, event: dict[str, Any]) -> None:
    """Push an event to the project's queue."""
    queue = get_or_create_queue(project_id)
    await queue.put(event)


async def start_project(project_id: str, session: Any) -> None:
    """Seed discovery tasks and dispatch the first one."""
    try:
        templates = get_phase_task_templates(SDLCPhase.DISCOVERY)

        result = await session.exec(
            select(Project).where(Project.id == project_id)
        )
        project = result.first()
        if not project:
            logger.error("start_project: project %s not found", project_id)
            return

        tasks_created = await _seed_tasks(project_id, SDLCPhase.DISCOVERY, session)

        await session.commit()
        for t in tasks_created:
            await session.refresh(t)

        # Publish phase_change event
        await publish_event(
            project_id,
            {
                "type": "phase_change",
                "payload": {"project_id": project_id, "new_phase": SDLCPhase.DISCOVERY.value},
            },
        )

        await _dispatch_phase_start_tasks(tasks_created, session)

    except Exception:
        logger.exception("Error in start_project for %s", project_id)


async def advance_phase(project_id: str, session: Any) -> SDLCPhase | None:
    """Move the project to the next SDLC phase, seed tasks, dispatch first task."""
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if not project:
        logger.error("advance_phase: project %s not found", project_id)
        return None

    current_phase = project.current_phase

    # Handle gracefully if already DONE
    if current_phase == SDLCPhase.DONE:
        logger.info("advance_phase: project %s already DONE", project_id)
        return SDLCPhase.DONE

    try:
        current_index = _PHASE_ORDER.index(current_phase)
    except ValueError:
        logger.error("advance_phase: unknown phase %s", current_phase)
        return None

    next_index = current_index + 1
    if next_index >= len(_PHASE_ORDER):
        next_phase = SDLCPhase.DONE
    else:
        next_phase = _PHASE_ORDER[next_index]

    project.current_phase = next_phase
    session.add(project)

    # If reaching DONE, update project status
    if next_phase == SDLCPhase.DONE:
        project.status = ProjectStatus.DONE

    tasks_created = await _seed_tasks(project_id, next_phase, session)

    await session.commit()
    for t in tasks_created:
        await session.refresh(t)
    await session.refresh(project)

    await publish_event(
        project_id,
        {
            "type": "phase_change",
            "payload": {"project_id": project_id, "new_phase": next_phase.value},
        },
    )

    await _dispatch_phase_start_tasks(tasks_created, session)

    return next_phase


async def _dispatch_phase_start_tasks(tasks: list[Task], session: Any) -> None:
    """Dispatch one task per unique role so agents with different roles run in parallel."""
    seen_roles: set = set()
    for task in tasks:
        if task.role not in seen_roles:
            seen_roles.add(task.role)
            await dispatch_task(task, session)


async def dispatch_task(task: Task, session: Any) -> None:
    """Assign a task to the appropriate agent and fire off the agent runner."""
    import services.agent_runner as agent_runner
    from database import async_session_factory

    if not task.role:
        logger.warning("dispatch_task: task %s has no role, skipping", task.id)
        return

    # Find agent with matching role in this project (prefer template agents, skip archived)
    result = await session.exec(
        select(Agent).where(
            Agent.project_id == task.project_id,
            Agent.role == task.role,
            Agent.is_archived == False,  # noqa: E712
        ).order_by(Agent.is_template_agent.desc())
    )
    agent = result.first()

    if not agent:
        logger.warning(
            "dispatch_task: no agent with role %s for project %s",
            task.role,
            task.project_id,
        )
        return

    # Load project for context
    proj_result = await session.exec(
        select(Project).where(Project.id == task.project_id)
    )
    project = proj_result.first()
    if not project:
        logger.error("dispatch_task: project %s not found", task.project_id)
        return

    # Update task and agent status
    task.status = TaskStatus.IN_PROGRESS
    task.assigned_agent_id = agent.id
    agent.status = AgentStatus.WORKING
    session.add(task)
    session.add(agent)
    await session.commit()
    await session.refresh(task)
    await session.refresh(agent)

    # Publish events
    await publish_event(
        task.project_id,
        {
            "type": "task_update",
            "payload": TaskSchema.model_validate(task).model_dump(mode="json"),
        },
    )
    await publish_event(
        task.project_id,
        {
            "type": "agent_status",
            "payload": {"agent_id": agent.id, "status": agent.status.value},
        },
    )

    # Get conversation history and fire background task
    history = await agent_runner.get_conversation_history(agent.id, task.project_id, session)

    # Snapshot objects needed by the background task (avoid session detachment issues)
    agent_snapshot = Agent(
        id=agent.id,
        project_id=agent.project_id,
        role=agent.role,
        specialization=agent.specialization,
        system_prompt=agent.system_prompt,
        status=agent.status,
    )
    task_snapshot = Task(
        id=task.id,
        project_id=task.project_id,
        assigned_agent_id=task.assigned_agent_id,
        phase=task.phase,
        title=task.title,
        description=task.description,
        status=task.status,
        output=task.output,
        role=task.role,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
    project_snapshot = Project(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        current_phase=project.current_phase,
        created_at=project.created_at,
    )

    bg = asyncio.create_task(
        agent_runner.run_agent_task(
            agent_snapshot,
            task_snapshot,
            project_snapshot,
            history,
            async_session_factory,
        )
    )
    _running_tasks[task.id] = bg
    bg.add_done_callback(lambda _: _running_tasks.pop(task.id, None))


async def handle_agent_output(
    task_id: str, agent_id: str, output: str, session: Any
) -> None:
    """Handle successful agent output: update DB, publish events, advance phase if needed."""
    now = datetime.now(timezone.utc)

    task_result = await session.exec(select(Task).where(Task.id == task_id))
    task = task_result.first()
    if not task:
        logger.error("handle_agent_output: task %s not found", task_id)
        return

    agent_result = await session.exec(select(Agent).where(Agent.id == agent_id))
    agent = agent_result.first()
    if not agent:
        logger.error("handle_agent_output: agent %s not found", agent_id)
        return

    if task.status == TaskStatus.CANCELLED:
        logger.info("handle_agent_output: task %s already cancelled, ignoring late output", task_id)
        return

    task.output = output
    task.status = TaskStatus.DONE
    task.updated_at = now
    agent.status = AgentStatus.IDLE
    session.add(task)
    session.add(agent)

    # Save broadcast agent message
    message = AgentMessage(
        project_id=task.project_id,
        from_agent_id=agent_id,
        to_agent_id=None,
        content=output,
        timestamp=now,
    )
    session.add(message)
    await session.commit()
    await session.refresh(task)
    await session.refresh(agent)
    await session.refresh(message)

    # Publish events
    await publish_event(
        task.project_id,
        {
            "type": "task_update",
            "payload": TaskSchema.model_validate(task).model_dump(mode="json"),
        },
    )
    await publish_event(
        task.project_id,
        {
            "type": "agent_status",
            "payload": {"agent_id": agent.id, "status": agent.status.value},
        },
    )
    await publish_event(
        task.project_id,
        {
            "type": "agent_message",
            "payload": AgentMessageSchema.model_validate(message).model_dump(mode="json"),
        },
    )

    # Parse and dispatch any <delegate> tags from this task's output
    delegates = _parse_delegates(output)
    delegate_tasks: list[Task] = []
    for d in delegates:
        try:
            role_enum = AgentRole(d["role"])
        except ValueError:
            logger.warning("handle_agent_output: unknown delegate role %r, skipping", d["role"])
            continue
        delegate_task = Task(
            project_id=task.project_id,
            phase=task.phase,
            title=f"Delegated: {d['description'][:60]}",
            description=d["description"],
            role=role_enum,
            status=TaskStatus.PENDING,
        )
        session.add(delegate_task)
        delegate_tasks.append(delegate_task)

    if delegate_tasks:
        await session.commit()
        for dt in delegate_tasks:
            await session.refresh(dt)
            await dispatch_task(dt, session)

    # Check if all tasks in the current phase are DONE using a COUNT query
    proj_result = await session.exec(
        select(Project).where(Project.id == task.project_id)
    )
    project = proj_result.first()
    if not project:
        return

    not_done_result = await session.exec(
        select(func.count(Task.id)).where(
            Task.project_id == task.project_id,
            Task.phase == project.current_phase,
            Task.status != TaskStatus.DONE,
        )
    )
    not_done_count = not_done_result.one()

    if not_done_count == 0:
        await advance_phase(task.project_id, session)
    else:
        # Dispatch the next pending task for the same role (agents with different
        # roles are already running in parallel from phase start).
        next_result = await session.exec(
            select(Task).where(
                Task.project_id == task.project_id,
                Task.phase == project.current_phase,
                Task.status == TaskStatus.PENDING,
                Task.role == task.role,
            ).limit(1)
        )
        next_task = next_result.first()
        if next_task:
            await dispatch_task(next_task, session)


_DELEGATE_RE = re.compile(
    r'<delegate\s+role=["\']([^"\']+)["\']>(.*?)</delegate>',
    re.DOTALL,
)


def _parse_delegates(output: str) -> list[dict[str, str]]:
    """Extract delegate instructions from agent output."""
    return [
        {"role": m.group(1).strip(), "description": m.group(2).strip()}
        for m in _DELEGATE_RE.finditer(output)
    ]


async def handle_user_directive(project_id: str, content: str, session: Any) -> Task:
    """Create a directive task for the tech lead and dispatch it immediately."""
    proj_result = await session.exec(select(Project).where(Project.id == project_id))
    project = proj_result.first()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Re-open the project so agents can work again
    if project.status == ProjectStatus.DONE:
        project.status = ProjectStatus.ACTIVE
        session.add(project)

    task = Task(
        project_id=project_id,
        phase=project.current_phase,
        title="User Directive",
        description=(
            f"The user has sent the following directive:\n\n\"{content}\"\n\n"
            "Analyse the request carefully. If you can address it directly (e.g. update requirements, "
            "refine architecture, answer a question), do so thoroughly in your response.\n\n"
            "If implementation or specialist work is needed, include one or more <delegate> tags at the "
            "end of your response to assign sub-tasks to the right agents:\n"
            "<delegate role=\"engineer-1\">Full description of what to implement</delegate>\n\n"
            "Be specific in delegate descriptions — the assigned agent will only see that description."
        ),
        role=AgentRole.TECH_LEAD,
        status=TaskStatus.PENDING,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    await session.refresh(project)

    await publish_event(
        project_id,
        {"type": "phase_change", "payload": {"project_id": project_id, "new_phase": project.current_phase.value}},
    )

    await dispatch_task(task, session)
    return task


async def cancel_task(task_id: str, session: Any) -> None:
    """Cancel an in-progress task: kill the background coroutine and mark the DB."""
    task_result = await session.exec(select(Task).where(Task.id == task_id))
    task = task_result.first()
    if not task:
        logger.error("cancel_task: task %s not found", task_id)
        return

    agent_result = await session.exec(select(Agent).where(Agent.id == task.assigned_agent_id))
    agent = agent_result.first()

    # Kill the background asyncio task first
    bg = _running_tasks.pop(task_id, None)
    if bg and not bg.done():
        bg.cancel()

    task.status = TaskStatus.CANCELLED
    task.output = "Cancelled by user"
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)

    if agent:
        agent.status = AgentStatus.IDLE
        session.add(agent)

    await session.commit()
    await session.refresh(task)

    await publish_event(
        task.project_id,
        {
            "type": "task_update",
            "payload": TaskSchema.model_validate(task).model_dump(mode="json"),
        },
    )
    if agent:
        await publish_event(
            task.project_id,
            {"type": "agent_status", "payload": {"agent_id": agent.id, "status": AgentStatus.IDLE.value}},
        )


async def handle_agent_failure(
    task_id: str, agent_id: str, error: str, session: Any
) -> None:
    """Handle agent failure: mark task FAILED and agent BLOCKED."""
    task_result = await session.exec(select(Task).where(Task.id == task_id))
    task = task_result.first()
    if not task:
        logger.error("handle_agent_failure: task %s not found", task_id)
        return

    agent_result = await session.exec(select(Agent).where(Agent.id == agent_id))
    agent = agent_result.first()
    if not agent:
        logger.error("handle_agent_failure: agent %s not found", agent_id)
        return

    if task.status == TaskStatus.CANCELLED:
        logger.info("handle_agent_failure: task %s already cancelled, ignoring", task_id)
        return

    task.status = TaskStatus.FAILED
    task.output = f"Error: {error}"
    task.updated_at = datetime.now(timezone.utc)
    agent.status = AgentStatus.BLOCKED
    session.add(task)
    session.add(agent)
    await session.commit()

    # Emit task_update so the frontend flips the card to failed immediately
    await publish_event(
        task.project_id,
        {
            "type": "task_update",
            "payload": TaskSchema.model_validate(task).model_dump(mode="json"),
        },
    )
    # Emit error so the frontend can show a toast
    await publish_event(
        task.project_id,
        {
            "type": "error",
            "payload": {"message": f"Task '{task.title}' failed: {error}"},
        },
    )


async def stream_events(project_id: str) -> AsyncIterator[str]:
    """Async generator yielding SSE-formatted event strings for a project."""
    queue = get_or_create_queue(project_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
            except asyncio.TimeoutError:
                # Yield heartbeat
                heartbeat = {
                    "type": "heartbeat",
                    "payload": {"timestamp": datetime.now(timezone.utc).isoformat()},
                }
                yield f"data: {json.dumps(heartbeat)}\n\n"
                continue

            yield f"data: {json.dumps(event)}\n\n"

            # Stop when the project reaches DONE phase and free the queue
            if (
                event.get("type") == "phase_change"
                and event.get("payload", {}).get("new_phase") == SDLCPhase.DONE.value
            ):
                _project_queues.pop(project_id, None)
                break

    except asyncio.CancelledError:
        logger.info("stream_events: client disconnected for project %s", project_id)
        raise
