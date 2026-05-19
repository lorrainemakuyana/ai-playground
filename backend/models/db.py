import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship

from models.enums import SDLCPhase, AgentRole, AgentStatus, TaskStatus, ProjectStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class AgentTemplate(SQLModel, table=True):
    """Global default engineering team — copied into every new project."""
    __tablename__ = "agent_templates"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    role: AgentRole
    specialization: str
    model_name: str = Field(default="claude-sonnet-4-6")
    system_prompt: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    name: str
    description: str
    status: ProjectStatus = Field(default=ProjectStatus.ACTIVE)
    current_phase: SDLCPhase = Field(default=SDLCPhase.DISCOVERY)
    created_at: datetime = Field(default_factory=_utcnow)

    agents: List["Agent"] = Relationship(back_populates="project")
    tasks: List["Task"] = Relationship(back_populates="project")
    messages: List["AgentMessage"] = Relationship(back_populates="project")


class Agent(SQLModel, table=True):
    __tablename__ = "agents"

    id: str = Field(default_factory=_new_uuid, primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    role: AgentRole
    specialization: str
    model_name: str = Field(default="claude-sonnet-4-6")
    system_prompt: Optional[str] = Field(default=None)
    status: AgentStatus = Field(default=AgentStatus.IDLE)
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
    phase: SDLCPhase
    title: str
    description: str
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    output: Optional[str] = Field(default=None)
    role: Optional[AgentRole] = Field(default=None)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

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
    timestamp: datetime = Field(default_factory=_utcnow)

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
