import asyncio
import pytest
from models.db import Agent
from models.enums import AgentRole, SDLCPhase, PlanTier
from services.agent_runner import get_model_for_agent
from services.orchestrator import (
    get_phase_task_templates,
    publish_event,
    subscribe,
    unsubscribe,
    _project_subscribers,
)


# ---------------------------------------------------------------------------
# subscribe / unsubscribe / publish_event (event fan-out)
# ---------------------------------------------------------------------------

def test_subscribe_registers_queue():
    project_id = "test-sub-project-unique-1"
    _project_subscribers.pop(project_id, None)

    q = subscribe(project_id)
    assert isinstance(q, asyncio.Queue)
    assert q in _project_subscribers[project_id]

    unsubscribe(project_id, q)
    assert project_id not in _project_subscribers  # entry dropped when empty


async def test_publish_event_fans_out_to_all_subscribers():
    project_id = "test-sub-project-unique-2"
    _project_subscribers.pop(project_id, None)

    q1 = subscribe(project_id)
    q2 = subscribe(project_id)
    event = {"type": "heartbeat", "payload": {}}

    await publish_event(project_id, event)

    assert q1.get_nowait() == event
    assert q2.get_nowait() == event

    unsubscribe(project_id, q1)
    unsubscribe(project_id, q2)


async def test_publish_event_with_no_subscribers_is_dropped():
    project_id = "test-sub-project-unique-3"
    _project_subscribers.pop(project_id, None)

    # Should not raise or leak any state when nobody is listening.
    await publish_event(project_id, {"type": "heartbeat", "payload": {}})
    assert project_id not in _project_subscribers


# ---------------------------------------------------------------------------
# get_phase_task_templates
# ---------------------------------------------------------------------------

def test_discovery_returns_two_tasks():
    templates = get_phase_task_templates(SDLCPhase.DISCOVERY)
    assert len(templates) == 2


def test_discovery_tasks_assigned_to_tech_lead():
    templates = get_phase_task_templates(SDLCPhase.DISCOVERY)
    for tmpl in templates:
        assert tmpl["role"] == AgentRole.TECH_LEAD


def test_done_returns_empty_list():
    templates = get_phase_task_templates(SDLCPhase.DONE)
    assert templates == []


def test_architecture_returns_non_empty():
    templates = get_phase_task_templates(SDLCPhase.ARCHITECTURE)
    assert len(templates) > 0


def test_implementation_returns_non_empty():
    templates = get_phase_task_templates(SDLCPhase.IMPLEMENTATION)
    assert len(templates) > 0


def test_testing_returns_non_empty():
    templates = get_phase_task_templates(SDLCPhase.TESTING)
    assert len(templates) > 0


def test_sre_review_returns_non_empty():
    templates = get_phase_task_templates(SDLCPhase.SRE_REVIEW)
    assert len(templates) > 0


def test_all_non_done_phases_return_tasks():
    non_done_phases = [
        SDLCPhase.DISCOVERY,
        SDLCPhase.ARCHITECTURE,
        SDLCPhase.IMPLEMENTATION,
        SDLCPhase.TESTING,
        SDLCPhase.SRE_REVIEW,
    ]
    for phase in non_done_phases:
        templates = get_phase_task_templates(phase)
        assert len(templates) > 0, f"Expected tasks for phase {phase}, got none"


# ---------------------------------------------------------------------------
# get_model_for_agent — run-time clamp to the owner's plan
# ---------------------------------------------------------------------------

def _agent(model_name: str) -> Agent:
    return Agent(id="a1", project_id="p1", role=AgentRole.ENGINEER_1,
                 specialization="x", model_name=model_name)


def test_free_clamps_sonnet_and_opus_to_haiku():
    assert get_model_for_agent(_agent("claude-sonnet-4-6"), PlanTier.FREE) == "claude-haiku-4-5-20251001"
    assert get_model_for_agent(_agent("claude-opus-4-8"), PlanTier.FREE) == "claude-haiku-4-5-20251001"


def test_pro_clamps_opus_to_sonnet_keeps_sonnet():
    assert get_model_for_agent(_agent("claude-opus-4-8"), PlanTier.PRO) == "claude-sonnet-4-6"
    assert get_model_for_agent(_agent("claude-sonnet-4-6"), PlanTier.PRO) == "claude-sonnet-4-6"


def test_ultra_keeps_opus():
    assert get_model_for_agent(_agent("claude-opus-4-7"), PlanTier.ULTRA) == "claude-opus-4-7"


def test_free_keeps_haiku():
    assert get_model_for_agent(_agent("claude-haiku-4-5-20251001"), PlanTier.FREE) == "claude-haiku-4-5-20251001"
