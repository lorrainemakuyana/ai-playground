from __future__ import annotations

import asyncio
import logging
from typing import Any, TYPE_CHECKING

import anthropic

from models.db import Agent, Task, Project, AgentMessage
from models.enums import AgentRole
from services.agent_prompts import MASTER_PROMPTS
from services.context_builder import build_project_context

if TYPE_CHECKING:
    from models.enums import PlanTier
from sqlmodel import select

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0
API_TIMEOUT = 120.0  # seconds; Sonnet on complex tasks can take 60-90s




def get_model_for_agent(agent: Agent, plan: "PlanTier") -> str:
    """Resolve the model for an agent run, clamped to the owner's plan.

    If the agent's configured model is outside the owner's allowed families,
    silently downgrade to the best model the plan allows and log a warning.
    The clamp (not a hard error) keeps detached background runs productive and
    self-corrects stale model_name values after a downgrade.
    """
    from plans import best_allowed_model, model_is_allowed

    requested = agent.model_name or "claude-sonnet-4-6"
    if model_is_allowed(plan, requested):
        return requested
    clamped = best_allowed_model(plan)
    if clamped != requested:
        logger.warning(
            "Clamping agent %s model %s -> %s (not allowed on %s plan)",
            agent.id, requested, clamped, plan.value,
        )
    return clamped


def get_system_prompt(agent: Agent) -> str:
    """Return the effective system prompt: master prompt merged with any user customisation.

    The master prompt is always the foundation. A user-supplied system_prompt
    is appended after a separator so the agent retains its role identity.
    """
    master = MASTER_PROMPTS.get(agent.role, MASTER_PROMPTS[AgentRole.CUSTOM])
    if agent.system_prompt and agent.system_prompt.strip():
        return master + "\n\n---\n\n## Your Custom Instructions\n\n" + agent.system_prompt.strip()
    return master


def build_messages_for_task(
    task: Task,
    project: Project,
    conversation_history: list[dict[str, Any]],
    all_tasks: list[Task] | None = None,
) -> list[dict[str, Any]]:
    """Build the messages list for an agent task call.

    Prepends a compact project-context block (built from ``all_tasks``) to the
    user message so the agent has structured project state without a raw message
    dump. When ``all_tasks`` is omitted the context block falls back to the
    minimal header used before this feature was introduced.
    """
    if all_tasks is not None:
        context_block = build_project_context(project, all_tasks, task.role or AgentRole.CUSTOM)
        content = (
            f"{context_block}\n\n"
            f"---\n\n"
            f"## Your Task\n\n"
            f"**{task.title}**\n\n"
            f"{task.description}\n"
        )
    else:
        content = (
            f"Project: {project.name}\n"
            f"Description: {project.description}\n"
            f"Current Phase: {task.phase}\n\n"
            f"Your Task: {task.title}\n"
            f"{task.description}\n"
        )
    user_message = {"role": "user", "content": content}
    return [*conversation_history, user_message]


_MAX_HISTORY_MESSAGES = 10


async def get_conversation_history(
    agent_id: str,
    project_id: str,
    session: Any,
) -> list[dict[str, Any]]:
    """Retrieve and format conversation history for an agent.

    Capped to the most recent ``_MAX_HISTORY_MESSAGES`` messages to stay within
    context windows for long-running projects. Older history is represented by
    the structured project-context block injected by ``build_messages_for_task``.
    """
    from sqlalchemy import or_, and_

    result = await session.exec(
        select(AgentMessage)
        .where(
            and_(
                AgentMessage.project_id == project_id,
                or_(
                    AgentMessage.from_agent_id == agent_id,
                    AgentMessage.to_agent_id == agent_id,
                    AgentMessage.to_agent_id.is_(None),
                ),
            )
        )
        .order_by(AgentMessage.timestamp.asc())
    )
    messages_db = result.all()

    # Keep only the tail to bound token usage
    messages_db = messages_db[-_MAX_HISTORY_MESSAGES:]

    history: list[dict[str, Any]] = []
    for msg in messages_db:
        role = "assistant" if msg.from_agent_id == agent_id else "user"
        history.append({"role": role, "content": msg.content})
    return history


async def run_agent_task(
    agent: Agent,
    task: Task,
    project: Project,
    conversation_history: list[dict[str, Any]],
    session_factory: Any,
    plan: "PlanTier" = None,
    all_tasks: list[Task] | None = None,
) -> None:
    """Run an agent task with retry logic and streaming output chunks.

    ``plan`` is the project owner's effective plan, used to clamp the model.
    Defaults to FREE (the safe floor) when not supplied.
    ``all_tasks`` is a snapshot of all project tasks used to build the compact
    context block. When omitted, a minimal header is used instead.
    """
    import services.orchestrator as orchestrator
    from models.enums import PlanTier

    if plan is None:
        plan = PlanTier.FREE

    messages = build_messages_for_task(task, project, conversation_history, all_tasks)
    model = get_model_for_agent(agent, plan)
    system_prompt = get_system_prompt(agent)

    # max_retries=0: we own the retry loop; don't let the SDK retry internally.
    client = anthropic.AsyncAnthropic(max_retries=0, timeout=API_TIMEOUT)
    last_error: Exception | None = None

    async def _stream() -> str:
        text = ""
        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=[{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
            messages=messages,
        ) as stream:
            async for chunk in stream.text_stream:
                text += chunk
                await orchestrator.publish_event(
                    task.project_id,
                    {"type": "task_output_chunk", "payload": {"task_id": task.id, "chunk": chunk, "reset": False}},
                )
        return text

    for attempt in range(MAX_RETRIES):
        try:
            # Signal the frontend to clear any partial output from a previous attempt.
            await orchestrator.publish_event(
                task.project_id,
                {"type": "task_output_chunk", "payload": {"task_id": task.id, "chunk": "", "reset": True}},
            )

            accumulated = await asyncio.wait_for(_stream(), timeout=API_TIMEOUT)

            async with session_factory() as session:
                await orchestrator.handle_agent_output(task.id, agent.id, accumulated, session)
            return

        except (anthropic.APITimeoutError, anthropic.APIConnectionError, asyncio.TimeoutError) as exc:
            # Network-level or wall-clock stream stall — retryable
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "Agent task attempt %d/%d timed out, retrying in %.1fs: %s",
                    attempt + 1, MAX_RETRIES, wait, exc,
                )
                await asyncio.sleep(wait)
                continue
            break
        except anthropic.APIStatusError as exc:
            last_error = exc
            if exc.status_code >= 500:
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_BACKOFF_BASE ** attempt
                    logger.warning(
                        "Agent task attempt %d/%d failed (status %d), retrying in %.1fs: %s",
                        attempt + 1, MAX_RETRIES, exc.status_code, wait, exc,
                    )
                    await asyncio.sleep(wait)
                    continue
            break
        except Exception as exc:
            last_error = exc
            logger.exception("Unexpected error running agent task %s", task.id)
            break

    error_msg = str(last_error) if last_error else "Unknown error"
    logger.error("Agent task %s failed after %d attempt(s): %s", task.id, attempt + 1, error_msg)
    async with session_factory() as session:
        await orchestrator.handle_agent_failure(task.id, agent.id, error_msg, session)
