from __future__ import annotations

import asyncio
import logging
from typing import Any

import anthropic

from models.db import Agent, Task, Project, AgentMessage
from models.enums import AgentRole
from sqlmodel import select

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0
API_TIMEOUT = 120.0  # seconds; Sonnet on complex tasks can take 60-90s


_DEFAULT_SYSTEM_PROMPTS: dict[AgentRole, str] = {
    AgentRole.TECH_LEAD: (
        "You are a principal tech lead responsible for requirements, architecture, and technical direction. "
        "Be thorough, precise, and make opinionated decisions with clear justification.\n\n"
        "When you receive a user directive and need to delegate work to other agents, use this exact format "
        "for each delegation at the end of your response:\n"
        "<delegate role=\"engineer-1\">Full task description for the engineer</delegate>\n"
        "Valid roles: tech-lead, engineer-1, engineer-2, qa, sre. "
        "Only delegate when the task genuinely requires another specialist. "
        "If you can handle the request fully yourself, do so without delegating."
    ),
    AgentRole.ENGINEER_1: (
        "You are a senior software engineer implementing core features. "
        "When asked to implement code, output complete, runnable files using <file path=\"...\">...</file> tags. "
        "Never truncate file contents. Never use placeholders. Write production-quality code."
    ),
    AgentRole.ENGINEER_2: (
        "You are a senior software engineer implementing supporting features and integrations. "
        "When asked to implement code, output complete, runnable files using <file path=\"...\">...</file> tags. "
        "Never truncate file contents. Never use placeholders. Write production-quality code."
    ),
    AgentRole.QA: (
        "You are a QA engineer. Produce detailed, executable test plans and test cases. "
        "When writing test code, use <file path=\"...\">...</file> tags."
    ),
    AgentRole.SRE: (
        "You are an SRE. Assess infrastructure, reliability, and operational readiness. "
        "When producing config files or runbooks, use <file path=\"...\">...</file> tags."
    ),
    AgentRole.CUSTOM: "You are a specialist agent. Complete the task thoroughly.",
}


def get_model_for_agent(agent: Agent) -> str:
    return agent.model_name or "claude-sonnet-4-6"


def get_system_prompt(agent: Agent) -> str:
    if agent.system_prompt:
        return agent.system_prompt
    return _DEFAULT_SYSTEM_PROMPTS.get(agent.role, f"You are a {agent.role.value} agent.")


def build_messages_for_task(
    task: Task,
    project: Project,
    conversation_history: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build the messages list for an agent task call."""
    user_message = {
        "role": "user",
        "content": (
            f"\nProject: {project.name}\n"
            f"Description: {project.description}\n"
            f"Current Phase: {task.phase}\n\n"
            f"Your Task: {task.title}\n"
            f"{task.description}\n"
        ),
    }
    return [*conversation_history, user_message]


async def get_conversation_history(
    agent_id: str,
    project_id: str,
    session: Any,
) -> list[dict[str, Any]]:
    """Retrieve and format conversation history for an agent."""
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
) -> None:
    """Run an agent task with retry logic and streaming output chunks."""
    import services.orchestrator as orchestrator

    messages = build_messages_for_task(task, project, conversation_history)
    model = get_model_for_agent(agent)
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
