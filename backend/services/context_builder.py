"""Build a compact project-context block for agent tasks.

The context block is prepended to every agent's user message so agents have
structured project state without requiring them to parse a raw message dump.

Token budget: ~400 tokens per block (approximated at 4 chars/token = 1600 chars).
Cache: in-process dict keyed by (project_id, phase) — invalidated when the
project advances phases (orchestrator calls invalidate_context_cache).
"""
from __future__ import annotations

from typing import Any

from models.db import Project, Task
from models.enums import AgentRole, SDLCPhase, TaskStatus

# ---------------------------------------------------------------------------
# In-process cache
# ---------------------------------------------------------------------------

_cache: dict[tuple[str, str], str] = {}

_PHASE_LABELS: dict[SDLCPhase, str] = {
    SDLCPhase.DISCOVERY:       "Discovery",
    SDLCPhase.ARCHITECTURE:    "Architecture",
    SDLCPhase.IMPLEMENTATION:  "Implementation",
    SDLCPhase.TESTING:         "Testing",
    SDLCPhase.SRE_REVIEW:      "SRE Review",
    SDLCPhase.DONE:            "Done",
}

_PHASE_ORDER: list[SDLCPhase] = [
    SDLCPhase.DISCOVERY,
    SDLCPhase.ARCHITECTURE,
    SDLCPhase.IMPLEMENTATION,
    SDLCPhase.TESTING,
    SDLCPhase.SRE_REVIEW,
    SDLCPhase.DONE,
]

# Char budget constants (1 token ≈ 4 chars)
_TOTAL_BUDGET = 1_600       # ~400 tokens for the whole block
_TASK_OUTPUT_BUDGET = 1_200  # ~300 tokens per prior task output snippet


def invalidate_context_cache(project_id: str) -> None:
    """Remove all cached context entries for a project (call on phase change)."""
    keys = [k for k in _cache if k[0] == project_id]
    for k in keys:
        del _cache[k]


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 3] + "..."


def _phase_index(phase: SDLCPhase) -> int:
    try:
        return _PHASE_ORDER.index(phase)
    except ValueError:
        return -1


def _completed_phases(current_phase: SDLCPhase) -> list[SDLCPhase]:
    idx = _phase_index(current_phase)
    return _PHASE_ORDER[:idx]


def _summarise_phase_tasks(phase: SDLCPhase, tasks: list[Task]) -> str:
    """One-line summary of a completed phase derived from its done tasks."""
    phase_tasks = [t for t in tasks if t.phase == phase and t.status == TaskStatus.DONE]
    if not phase_tasks:
        return f"✓ {_PHASE_LABELS[phase]}: completed (no task outputs recorded)"
    titles = ", ".join(t.title for t in phase_tasks[:3])
    if len(phase_tasks) > 3:
        titles += f" (+{len(phase_tasks) - 3} more)"
    return f"✓ {_PHASE_LABELS[phase]}: {titles}"


def _prior_role_outputs(role: AgentRole, tasks: list[Task]) -> str:
    """Snippet of the last 3 done tasks for this agent's role."""
    role_done = [
        t for t in tasks
        if t.role == role and t.status == TaskStatus.DONE and t.output
    ]
    # Most recent first
    role_done = sorted(role_done, key=lambda t: t.updated_at, reverse=True)[:3]
    if not role_done:
        return ""

    parts: list[str] = ["### Your Previous Work"]
    for t in role_done:
        snippet = _truncate(t.output or "", _TASK_OUTPUT_BUDGET)
        parts.append(f"**{t.title}** ({_PHASE_LABELS.get(t.phase, t.phase.value)})\n{snippet}")
    return "\n\n".join(parts)


def _active_tasks_for_role(role: AgentRole, tasks: list[Task]) -> str:
    """Tasks currently assigned to this role that are pending or in-progress."""
    active = [
        t for t in tasks
        if t.role == role and t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS)
    ]
    if not active:
        return ""
    lines = ["### Your Pending Tasks"]
    for t in active:
        lines.append(f"- **{t.title}**: {_truncate(t.description, 200)}")
    return "\n".join(lines)


def build_project_context(
    project: Project,
    tasks: list[Task],
    agent_role: AgentRole,
) -> str:
    """Return a compact markdown context block for an agent task.

    Results are cached by (project_id, current_phase) and reused across tasks
    in the same phase. Call ``invalidate_context_cache`` on phase advance.
    """
    cache_key = (project.id, project.current_phase.value)
    if cache_key in _cache:
        return _cache[cache_key]

    sections: list[str] = []

    # --- Project header ---
    header = (
        f"## Project Context\n\n"
        f"**Project**: {project.name}\n"
        f"**Description**: {_truncate(project.description, 300)}\n"
        f"**Current Phase**: {_PHASE_LABELS.get(project.current_phase, project.current_phase.value)}"
    )
    sections.append(header)

    # --- Completed phases summary ---
    completed = _completed_phases(project.current_phase)
    if completed:
        phase_lines = [_summarise_phase_tasks(p, tasks) for p in completed]
        sections.append("### Progress\n" + "\n".join(phase_lines))

    # --- Prior role outputs ---
    role_output = _prior_role_outputs(agent_role, tasks)
    if role_output:
        sections.append(role_output)

    # --- Active tasks ---
    active = _active_tasks_for_role(agent_role, tasks)
    if active:
        sections.append(active)

    result = "\n\n".join(sections)

    # Enforce total budget
    result = _truncate(result, _TOTAL_BUDGET)

    _cache[cache_key] = result
    return result
