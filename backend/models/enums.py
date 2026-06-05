from enum import Enum


class SDLCPhase(str, Enum):
    DISCOVERY       = "discovery"
    ARCHITECTURE    = "architecture"
    IMPLEMENTATION  = "implementation"
    TESTING         = "testing"
    SRE_REVIEW      = "sre_review"
    DONE            = "done"


class AgentRole(str, Enum):
    TECH_LEAD  = "tech-lead"
    ENGINEER_1 = "engineer-1"
    ENGINEER_2 = "engineer-2"
    QA         = "qa"
    SRE        = "sre"
    CUSTOM     = "custom"


class AgentStatus(str, Enum):
    IDLE     = "idle"
    WORKING  = "working"
    BLOCKED  = "blocked"
    DONE     = "done"


class TaskStatus(str, Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in-progress"
    REVIEW      = "review"
    DONE        = "done"
    FAILED      = "failed"
    CANCELLED   = "cancelled"


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DONE   = "done"


class PlanTier(str, Enum):
    FREE  = "free"
    PRO   = "pro"
    ULTRA = "ultra"
