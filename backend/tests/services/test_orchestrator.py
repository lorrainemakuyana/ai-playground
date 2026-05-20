import asyncio
import pytest
from models.enums import AgentRole, SDLCPhase
from services.orchestrator import get_or_create_queue, get_phase_task_templates, _project_queues


# ---------------------------------------------------------------------------
# get_or_create_queue
# ---------------------------------------------------------------------------

def test_get_or_create_queue_creates_new():
    project_id = "test-queue-project-unique-1"
    # Clean up any leftover state
    _project_queues.pop(project_id, None)

    q = get_or_create_queue(project_id)
    assert isinstance(q, asyncio.Queue)

    _project_queues.pop(project_id, None)  # cleanup


def test_get_or_create_queue_returns_same_instance():
    project_id = "test-queue-project-unique-2"
    _project_queues.pop(project_id, None)

    q1 = get_or_create_queue(project_id)
    q2 = get_or_create_queue(project_id)
    assert q1 is q2

    _project_queues.pop(project_id, None)  # cleanup


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
