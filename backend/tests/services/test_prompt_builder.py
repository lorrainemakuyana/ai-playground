import pytest
from models.db import Project
from models.enums import AgentRole, SDLCPhase
from services.prompt_builder import build_system_prompt, get_role_instructions


def _make_project(name: str = "My Project", description: str = "A detailed project description") -> Project:
    """Build an unsaved Project instance for unit testing (no DB needed)."""
    return Project(name=name, description=description)


# ---------------------------------------------------------------------------
# build_system_prompt — one test per built-in role
# ---------------------------------------------------------------------------

def test_build_system_prompt_tech_lead():
    project = _make_project()
    prompt = build_system_prompt(AgentRole.TECH_LEAD, "Technical Leadership and Architecture", project)
    assert prompt
    assert project.name in prompt
    assert "tech-lead" in prompt.lower() or "tech_lead" in prompt.lower() or "tech" in prompt.lower()


def test_build_system_prompt_engineer_1():
    project = _make_project()
    prompt = build_system_prompt(AgentRole.ENGINEER_1, "Primary Feature Development", project)
    assert prompt
    assert project.name in prompt


def test_build_system_prompt_engineer_2():
    project = _make_project()
    prompt = build_system_prompt(AgentRole.ENGINEER_2, "Secondary Feature Development", project)
    assert prompt
    assert project.name in prompt


def test_build_system_prompt_qa():
    project = _make_project()
    prompt = build_system_prompt(AgentRole.QA, "Quality Assurance and Testing", project)
    assert prompt
    assert project.name in prompt


def test_build_system_prompt_sre():
    project = _make_project()
    prompt = build_system_prompt(AgentRole.SRE, "Site Reliability and Infrastructure", project)
    assert prompt
    assert project.name in prompt


def test_build_system_prompt_custom_includes_specialization():
    project = _make_project()
    specialization = "Blockchain Security Researcher"
    prompt = build_system_prompt(AgentRole.CUSTOM, specialization, project)
    assert prompt
    assert project.name in prompt
    assert specialization in prompt


# ---------------------------------------------------------------------------
# get_role_instructions — CUSTOM role
# ---------------------------------------------------------------------------

def test_get_role_instructions_custom_includes_specialization():
    specialization = "Payment Systems Expert"
    instructions = get_role_instructions(AgentRole.CUSTOM, specialization)
    assert specialization in instructions


def test_get_role_instructions_tech_lead_non_empty():
    instructions = get_role_instructions(AgentRole.TECH_LEAD)
    assert instructions


def test_get_role_instructions_engineer_1_non_empty():
    instructions = get_role_instructions(AgentRole.ENGINEER_1)
    assert instructions


def test_get_role_instructions_engineer_2_non_empty():
    instructions = get_role_instructions(AgentRole.ENGINEER_2)
    assert instructions


def test_get_role_instructions_qa_non_empty():
    instructions = get_role_instructions(AgentRole.QA)
    assert instructions


def test_get_role_instructions_sre_non_empty():
    instructions = get_role_instructions(AgentRole.SRE)
    assert instructions
