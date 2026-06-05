from __future__ import annotations

import re
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from models.enums import (
    SDLCPhase,
    AgentRole,
    AgentStatus,
    TaskStatus,
    ProjectStatus,
    PlanTier,
)

# Anthropic model identifiers, e.g. "claude-sonnet-4-6". Validated by shape
# rather than an exact allow-list so new model versions don't require a code
# change, while still rejecting arbitrary free-text sent to the API.
_MODEL_NAME_RE = re.compile(r"^claude-[a-z0-9.\-]{1,80}$")
_MAX_SYSTEM_PROMPT = 20_000


def _validate_model_name(v: str) -> str:
    v = v.strip()
    if not _MODEL_NAME_RE.match(v):
        raise ValueError("model_name must be a valid Claude model identifier (e.g. claude-sonnet-4-6)")
    return v


def _validate_system_prompt(v: Optional[str]) -> Optional[str]:
    if v is not None and len(v) > _MAX_SYSTEM_PROMPT:
        raise ValueError(f"system_prompt must be at most {_MAX_SYSTEM_PROMPT} characters")
    return v


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


# ---------------------------------------------------------------------------
# Subscription plan schemas
# ---------------------------------------------------------------------------

class UserMeSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    plan: PlanTier                       # stored plan
    plan_expires_at: Optional[datetime] = None
    effective_plan: PlanTier             # computed (after expiry applied)


class AdminUserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    plan: PlanTier
    plan_expires_at: Optional[datetime] = None
    effective_plan: PlanTier


class SetPlanRequest(BaseModel):
    plan: PlanTier                       # invalid value -> FastAPI 422 automatically
    plan_expires_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class AgentTemplateSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: AgentRole
    specialization: str
    model_name: str
    system_prompt: Optional[str] = None
    is_active: bool
    created_at: datetime


class AgentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    role: AgentRole
    specialization: str
    model_name: str
    system_prompt: Optional[str] = None
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
    is_owner: bool = True
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
    archived_at: Optional[datetime] = None
    agent_count: int
    task_count: int
    # Sharing metadata
    is_owner: bool = True
    collaborator_count: int = 0
    share_status: Optional[str] = None   # None (own) | "active" | "revoked"
    share_id: Optional[str] = None       # ProjectShare.id for collaborator's own share record


class ProjectShareSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    user_id: Optional[str] = None
    invited_email: str
    invite_method: str
    joined_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime


class ShareLinkSchema(BaseModel):
    id: str
    project_id: str
    token: str
    url: str
    created_at: datetime


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
        if len(v) > 5000:
            raise ValueError("description must be at most 5000 characters")
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

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        return _validate_model_name(v)

    @field_validator("system_prompt")
    @classmethod
    def validate_system_prompt(cls, v: Optional[str]) -> Optional[str]:
        return _validate_system_prompt(v)


class UpdateAgentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    specialization: Optional[str] = None
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: Optional[str]) -> Optional[str]:
        return _validate_model_name(v) if v is not None else v

    @field_validator("system_prompt")
    @classmethod
    def validate_system_prompt(cls, v: Optional[str]) -> Optional[str]:
        return _validate_system_prompt(v)


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

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: str) -> str:
        return _validate_model_name(v)

    @field_validator("system_prompt")
    @classmethod
    def validate_system_prompt(cls, v: Optional[str]) -> Optional[str]:
        return _validate_system_prompt(v)


class UpdateAgentTemplateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    specialization: Optional[str] = None
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("model_name")
    @classmethod
    def validate_model_name(cls, v: Optional[str]) -> Optional[str]:
        return _validate_model_name(v) if v is not None else v

    @field_validator("system_prompt")
    @classmethod
    def validate_system_prompt(cls, v: Optional[str]) -> Optional[str]:
        return _validate_system_prompt(v)


class DirectiveRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v


class InviteByEmailRequest(BaseModel):
    email: EmailStr
