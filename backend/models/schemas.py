from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, field_validator

from models.enums import (
    SDLCPhase,
    AgentRole,
    AgentStatus,
    TaskStatus,
    ProjectStatus,
)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class AgentTemplateSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: AgentRole
    specialization: str
    model_name: str
    is_active: bool
    created_at: datetime


class AgentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    role: AgentRole
    specialization: str
    model_name: str
    status: AgentStatus
    is_template_agent: bool
    is_archived: bool


class TaskSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    assigned_agent_id: Optional[str] = None
    phase: SDLCPhase
    title: str
    description: str
    status: TaskStatus
    output: Optional[str] = None
    role: Optional[AgentRole] = None
    created_at: datetime
    updated_at: datetime


class AgentMessageSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    from_agent_id: str
    to_agent_id: Optional[str] = None
    content: str
    timestamp: datetime


class ProjectDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    status: ProjectStatus
    current_phase: SDLCPhase
    created_at: datetime
    agents: List[AgentSchema] = []
    tasks: List[TaskSchema] = []
    messages: List[AgentMessageSchema] = []


class ProjectSummarySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    status: ProjectStatus
    current_phase: SDLCPhase
    created_at: datetime
    agent_count: int
    task_count: int


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CreateProjectRequest(BaseModel):
    name: str
    description: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("name must have at least 1 character")
        if len(v) > 200:
            raise ValueError("name must be at most 200 characters")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("description must have at least 10 characters")
        return v


class CreateAgentRequest(BaseModel):
    role: AgentRole = AgentRole.CUSTOM
    specialization: str
    model_name: str = "claude-sonnet-4-6"
    system_prompt: Optional[str] = None

    @field_validator("specialization")
    @classmethod
    def validate_specialization(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("specialization must have at least 1 character")
        if len(v) > 200:
            raise ValueError("specialization must be at most 200 characters")
        return v


class UpdateAgentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    specialization: Optional[str] = None
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None


class CreateAgentTemplateRequest(BaseModel):
    role: AgentRole
    specialization: str
    model_name: str = "claude-sonnet-4-6"
    system_prompt: Optional[str] = None

    @field_validator("specialization")
    @classmethod
    def validate_specialization(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("specialization required")
        return v


class UpdateAgentTemplateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    specialization: Optional[str] = None
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None
    is_active: Optional[bool] = None


class UpdateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[TaskStatus] = None
    output: Optional[str] = None
    assigned_agent_id: Optional[str] = None


class DirectiveRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v
