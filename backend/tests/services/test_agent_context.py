"""Tests for agent_prompts, context_builder, and the updated agent_runner helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from models.enums import AgentRole, SDLCPhase, TaskStatus
from services.agent_prompts import MASTER_PROMPTS
from services.context_builder import (
    build_project_context,
    invalidate_context_cache,
    _cache,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow():
    return datetime.now(timezone.utc)


def _make_project(phase: SDLCPhase = SDLCPhase.IMPLEMENTATION):
    from models.db import Project
    return Project(
        id="proj-ctx-001",
        name="Test App",
        description="A test application for verifying context builder output.",
        current_phase=phase,
    )


def _make_task(
    phase: SDLCPhase,
    role: AgentRole,
    status: TaskStatus,
    title: str,
    output: str | None = None,
    task_id: str | None = None,
):
    from models.db import Task
    return Task(
        id=task_id or f"task-{title[:8].replace(' ', '-').lower()}",
        project_id="proj-ctx-001",
        phase=phase,
        role=role,
        title=title,
        description=f"Description for {title}",
        status=status,
        output=output,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )


# ---------------------------------------------------------------------------
# agent_prompts
# ---------------------------------------------------------------------------

def test_all_roles_have_master_prompt():
    for role in AgentRole:
        assert role in MASTER_PROMPTS, f"Missing master prompt for {role}"
        assert len(MASTER_PROMPTS[role]) > 100, f"Master prompt for {role} is too short"


def test_tech_lead_prompt_contains_delegate_section():
    prompt = MASTER_PROMPTS[AgentRole.TECH_LEAD]
    assert "<delegate" in prompt
    assert "engineer-1" in prompt
    assert "engineer-2" in prompt
    assert "qa" in prompt
    assert "sre" in prompt


def test_engineer_prompts_contain_file_tag_instruction():
    for role in (AgentRole.ENGINEER_1, AgentRole.ENGINEER_2):
        prompt = MASTER_PROMPTS[role]
        assert "<file path=" in prompt, f"{role} missing file tag instruction"
        assert "No truncation" in prompt or "no truncation" in prompt.lower()


def test_qa_prompt_contains_test_plan_structure():
    prompt = MASTER_PROMPTS[AgentRole.QA]
    assert "Test Plan" in prompt
    assert "deterministic" in prompt


def test_sre_prompt_contains_readiness_report():
    prompt = MASTER_PROMPTS[AgentRole.SRE]
    assert "PASS" in prompt
    assert "FAIL" in prompt
    assert "Blockers" in prompt or "blockers" in prompt.lower()


# ---------------------------------------------------------------------------
# get_system_prompt merging
# ---------------------------------------------------------------------------

def test_get_system_prompt_master_only():
    from services.agent_runner import get_system_prompt
    from models.db import Agent

    agent = Agent(
        id="a1", project_id="p1", role=AgentRole.ENGINEER_1,
        specialization="Backend", model_name="claude-sonnet-4-6",
        system_prompt=None,
    )
    result = get_system_prompt(agent)
    assert result == MASTER_PROMPTS[AgentRole.ENGINEER_1]


def test_get_system_prompt_merges_custom():
    from services.agent_runner import get_system_prompt
    from models.db import Agent

    agent = Agent(
        id="a2", project_id="p1", role=AgentRole.ENGINEER_1,
        specialization="Backend", model_name="claude-sonnet-4-6",
        system_prompt="Always use async/await.",
    )
    result = get_system_prompt(agent)
    assert result.startswith(MASTER_PROMPTS[AgentRole.ENGINEER_1])
    assert "## Your Custom Instructions" in result
    assert "Always use async/await." in result


def test_get_system_prompt_empty_string_no_separator():
    from services.agent_runner import get_system_prompt
    from models.db import Agent

    agent = Agent(
        id="a3", project_id="p1", role=AgentRole.QA,
        specialization="QA", model_name="claude-sonnet-4-6",
        system_prompt="   ",  # whitespace only
    )
    result = get_system_prompt(agent)
    assert "## Your Custom Instructions" not in result
    assert result == MASTER_PROMPTS[AgentRole.QA]


def test_get_system_prompt_custom_role_uses_fallback():
    from services.agent_runner import get_system_prompt
    from models.db import Agent

    agent = Agent(
        id="a4", project_id="p1", role=AgentRole.CUSTOM,
        specialization="Security", model_name="claude-sonnet-4-6",
        system_prompt=None,
    )
    result = get_system_prompt(agent)
    assert result == MASTER_PROMPTS[AgentRole.CUSTOM]


# ---------------------------------------------------------------------------
# build_project_context
# ---------------------------------------------------------------------------

def test_context_contains_project_header():
    project = _make_project(SDLCPhase.IMPLEMENTATION)
    tasks = []
    result = build_project_context(project, tasks, AgentRole.ENGINEER_1)
    assert "Test App" in result
    assert "Implementation" in result


def test_context_shows_completed_phases():
    project = _make_project(SDLCPhase.IMPLEMENTATION)
    tasks = [
        _make_task(SDLCPhase.DISCOVERY, AgentRole.TECH_LEAD, TaskStatus.DONE, "Requirements Analysis"),
        _make_task(SDLCPhase.ARCHITECTURE, AgentRole.TECH_LEAD, TaskStatus.DONE, "System Architecture"),
    ]
    result = build_project_context(project, tasks, AgentRole.ENGINEER_1)
    assert "Discovery" in result or "Requirements" in result
    assert "Architecture" in result or "System Architecture" in result


def test_context_includes_prior_role_output():
    project = _make_project(SDLCPhase.TESTING)
    tasks = [
        _make_task(
            SDLCPhase.IMPLEMENTATION, AgentRole.QA, TaskStatus.DONE,
            "Test Plan Creation", output="Unit tests: 42 cases defined.",
            task_id="t-qa-001",
        ),
    ]
    result = build_project_context(project, tasks, AgentRole.QA)
    assert "Test Plan Creation" in result or "Unit tests" in result


def test_context_respects_budget():
    project = _make_project(SDLCPhase.IMPLEMENTATION)
    long_output = "x" * 10_000
    tasks = [
        _make_task(
            SDLCPhase.DISCOVERY, AgentRole.ENGINEER_1, TaskStatus.DONE,
            "Big Task", output=long_output, task_id="t-big-001",
        ),
    ]
    result = build_project_context(project, tasks, AgentRole.ENGINEER_1)
    # 1600 chars budget + some slack for truncation ellipsis
    assert len(result) <= 1700


def test_context_is_cached():
    invalidate_context_cache("proj-cache-test")

    from models.db import Project
    project = Project(
        id="proj-cache-test",
        name="Cache Test",
        description="desc",
        current_phase=SDLCPhase.ARCHITECTURE,
    )
    result1 = build_project_context(project, [], AgentRole.TECH_LEAD)
    result2 = build_project_context(project, [], AgentRole.TECH_LEAD)
    assert result1 is result2  # same object from cache


def test_invalidate_clears_cache():
    from models.db import Project
    project = Project(
        id="proj-invalidate-test",
        name="Inv Test",
        description="desc",
        current_phase=SDLCPhase.DISCOVERY,
    )
    build_project_context(project, [], AgentRole.TECH_LEAD)
    key = ("proj-invalidate-test", "discovery")
    assert key in _cache
    invalidate_context_cache("proj-invalidate-test")
    assert key not in _cache


# ---------------------------------------------------------------------------
# master-prompts endpoint
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_master_prompts_endpoint(test_engine):
    from main import app
    from database import get_session
    from dependencies import get_current_user
    from models.db import User
    from models.enums import PlanTier
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from sqlmodel.ext.asyncio.session import AsyncSession
    from httpx import AsyncClient, ASGITransport

    user = User(id="mp-user-001", email="mp@test.com", password_hash="x", plan=PlanTier.FREE)
    factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with factory() as s:
            yield s

    app.dependency_overrides[get_session] = override_session
    # master-prompts has no auth, but override anyway to keep other routes clean
    app.dependency_overrides[get_current_user] = lambda: user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/agent-templates/master-prompts")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()
    assert "tech-lead" in data
    assert "engineer-1" in data
    assert "qa" in data
    assert "sre" in data
    assert len(data["tech-lead"]) > 100
