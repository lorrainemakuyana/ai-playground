from __future__ import annotations

from models.enums import AgentRole, SDLCPhase
from models.db import Project

BASE_CONTEXT_TEMPLATE = """\
You are part of an autonomous multi-agent software engineering team.
Project: {project_name}
Description: {project_description}
Your role: {role}
Your specialization: {specialization}

You collaborate with: tech-lead, engineer-1, engineer-2, qa, sre agents.
Communicate findings as structured text. Be concise, technical, and precise.
When you complete a task, summarize your output clearly.\
"""


def get_role_instructions(role: AgentRole, specialization: str = "") -> str:
    """Return role-specific instruction string."""
    if role == AgentRole.TECH_LEAD:
        return (
            "You own the architecture. Break down work, review all agent outputs, "
            "make final technical decisions. Produce clear structured deliverables: "
            "requirements docs, architecture diagrams, task breakdowns."
        )
    elif role == AgentRole.ENGINEER_1:
        return (
            "You implement features from specs. Write clean, production-quality code. "
            "Follow the architecture defined by the tech lead. Focus on the primary feature track."
        )
    elif role == AgentRole.ENGINEER_2:
        return (
            "You implement features in parallel with Engineer 1. Take the secondary feature "
            "track to avoid conflicts. Write clean production code following established architecture."
        )
    elif role == AgentRole.QA:
        return (
            "You write test plans and generate test cases. Review all implementation outputs "
            "for edge cases, missing error handling, and quality issues. Produce pass/fail "
            "reports with specific, actionable feedback."
        )
    elif role == AgentRole.SRE:
        return (
            "You review for reliability, security, observability, and deployment readiness. "
            "Produce infrastructure recommendations and operational runbooks. Issue a "
            "green/yellow/red readiness assessment."
        )
    else:
        return f"You are a specialist: {specialization}. Apply your expertise to the tasks assigned. Be precise and thorough."


def build_system_prompt(role: AgentRole, specialization: str, project: Project) -> str:
    """Build a complete system prompt for a given role, specialization, and project."""
    base = BASE_CONTEXT_TEMPLATE.format(
        project_name=project.name,
        project_description=project.description,
        role=role.value,
        specialization=specialization,
    )
    return f"{base}\n\n{get_role_instructions(role, specialization)}"


def get_phase_context_snippet(phase: SDLCPhase) -> str:
    """Return a short context string for the given SDLC phase."""
    snippets = {
        SDLCPhase.DISCOVERY: "Focus on understanding requirements and proposing solutions.",
        SDLCPhase.ARCHITECTURE: "Focus on system design, component boundaries, and interface definitions.",
        SDLCPhase.IMPLEMENTATION: "Focus on writing correct, maintainable code following established patterns.",
        SDLCPhase.TESTING: "Focus on comprehensive coverage and finding edge cases.",
        SDLCPhase.SRE_REVIEW: "Focus on production readiness, reliability, and operational concerns.",
        SDLCPhase.DONE: "Project complete.",
    }
    return snippets.get(phase, "")
