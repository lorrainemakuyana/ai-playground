import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy import DateTime, Enum as SAEnum
from sqlmodel import SQLModel, Field, Relationship

from models.enums import SDLCPhase, AgentRole, AgentStatus, TaskStatus, ProjectStatus, PlanTier


# Persist every enum column by its string *value* (e.g. "free", "tech-lead",
# "in-progress") rather than the member name ("FREE", "TECH_LEAD", ...). This
# matches how the API serializes enums and keeps all columns consistent;
# without it, SQLAlchemy stores/reads by name and value-form rows raise
# `LookupError: '<value>' is not among the defined enum values`.
def _value_enum(enum_cls: type) -> SAEnum:
    return SAEnum(
        enum_cls,
        name=enum_cls.__name__.lower(),
        values_callable=lambda enum: [member.value for member in enum],
    )


_plan_tier_type = _value_enum(PlanTier)
_agent_role_type = _value_enum(AgentRole)
_agent_status_type = _value_enum(AgentStatus)
_task_status_type = _value_enum(TaskStatus)
_project_status_type = _value_enum(ProjectStatus)
_sdlc_phase_type = _value_enum(SDLCPhase)

# All datetime columns use TIMESTAMP WITH TIME ZONE so Postgres/asyncpg
# accepts timezone-aware datetimes without raising DataError.
_TZ_DATETIME = DateTime(timezone=True)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    token_version: int = Field(default=1)
    plan: PlanTier = Field(default=PlanTier.FREE, sa_type=_plan_tier_type)
    plan_expires_at: Optional[datetime] = Field(default=None, sa_type=_TZ_DATETIME)
    github_token_enc: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)

    projects: List["Project"] = Relationship(back_populates="owner")
    shares: List["ProjectShare"] = Relationship(back_populates="user")


class AgentTemplate(SQLModel, table=True):
    """A user's default engineering team — copied into each of their new projects."""
    __tablename__ = "agent_templates"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="users.id", index=True)
    role: AgentRole = Field(sa_type=_agent_role_type)
    specialization: str
    model_name: str = Field(default="claude-sonnet-4-6")
    system_prompt: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    name: str
    description: str
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE, sa_type=_project_status_type)
    current_phase: SDLCPhase = Field(default=SDLCPhase.DISCOVERY, sa_type=_sdlc_phase_type)
    created_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)
    archived_at: Optional[datetime] = Field(default=None, sa_type=_TZ_DATETIME)
    user_id: Optional[str] = Field(default=None, foreign_key="users.id", index=True)
    github_repo: Optional[str] = Field(default=None)
    github_branch: Optional[str] = Field(default=None)
    github_push_status: Optional[str] = Field(default=None)
    github_push_error: Optional[str] = Field(default=None)
    github_pr_url: Optional[str] = Field(default=None)

    owner: Optional["User"] = Relationship(back_populates="projects")
    agents: List["Agent"] = Relationship(back_populates="project")
    tasks: List["Task"] = Relationship(back_populates="project")
    messages: List["AgentMessage"] = Relationship(back_populates="project")
    shares: List["ProjectShare"] = Relationship(back_populates="project")


class Agent(SQLModel, table=True):
    __tablename__ = "agents"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    role: AgentRole = Field(sa_type=_agent_role_type)
    specialization: str
    model_name: str = Field(default="claude-sonnet-4-6")
    system_prompt: Optional[str] = Field(default=None)
    status: AgentStatus = Field(default=AgentStatus.IDLE, sa_type=_agent_status_type)
    is_template_agent: bool = Field(default=False)  # copied from a global template
    is_archived: bool = Field(default=False)         # soft-deleted

    project: Optional[Project] = Relationship(back_populates="agents")
    tasks_assigned: List["Task"] = Relationship(
        back_populates="assigned_agent",
        sa_relationship_kwargs={
            "foreign_keys": "[Task.assigned_agent_id]",
            "lazy": "select",
        },
    )


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    assigned_agent_id: Optional[str] = Field(default=None, foreign_key="agents.id")
    phase: SDLCPhase = Field(sa_type=_sdlc_phase_type)
    title: str
    description: str
    status: TaskStatus = Field(default=TaskStatus.PENDING, sa_type=_task_status_type)
    output: Optional[str] = Field(default=None)
    role: Optional[AgentRole] = Field(default=None, sa_type=_agent_role_type)
    created_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)
    updated_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)

    project: Optional[Project] = Relationship(back_populates="tasks")
    assigned_agent: Optional[Agent] = Relationship(
        back_populates="tasks_assigned",
        sa_relationship_kwargs={
            "foreign_keys": "[Task.assigned_agent_id]",
            "lazy": "select",
        },
    )


class AgentMessage(SQLModel, table=True):
    __tablename__ = "agent_messages"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    from_agent_id: str = Field(foreign_key="agents.id")
    to_agent_id: Optional[str] = Field(default=None, foreign_key="agents.id")
    content: str
    timestamp: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)

    project: Optional[Project] = Relationship(back_populates="messages")
    from_agent: Optional[Agent] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[AgentMessage.from_agent_id]",
            "lazy": "select",
        }
    )
    to_agent: Optional[Agent] = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[AgentMessage.to_agent_id]",
            "lazy": "select",
        }
    )


class ProjectShare(SQLModel, table=True):
    __tablename__ = "project_shares"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    user_id: Optional[str] = Field(default=None, foreign_key="users.id", index=True)
    invited_email: str = Field(index=True)
    invite_method: str = Field(default="email")  # "email" | "link"
    joined_at: Optional[datetime] = Field(default=None, sa_type=_TZ_DATETIME)
    revoked_at: Optional[datetime] = Field(default=None, sa_type=_TZ_DATETIME)
    created_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)

    project: Optional[Project] = Relationship(back_populates="shares")
    user: Optional[User] = Relationship(back_populates="shares")


class ProjectShareLink(SQLModel, table=True):
    __tablename__ = "project_share_links"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id", unique=True, index=True)
    token: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=_utcnow, sa_type=_TZ_DATETIME)
    expires_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=30),
        sa_type=_TZ_DATETIME,
    )
