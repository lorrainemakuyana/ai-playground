"""Subscription plan tiers: limits, model access, and effective-plan resolution.

Single source of truth for what each tier (Free / Pro / Ultra) may do:
  - how many projects a user may own
  - how many non-template agents a project may have
  - which Claude model families the user's agents may run
  - whether the user may share projects

`None` is the "unlimited" sentinel for numeric limits — every consumer must
treat it as "skip the count check".

Model access is checked by *family* (haiku / sonnet / opus) rather than by exact
model id, so it stays correct as model version suffixes change
(e.g. claude-opus-4-6, claude-opus-4-7, claude-opus-4-8 are all "opus").
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, TypedDict

from models.enums import PlanTier

# Canonical model ids — used only as silent-clamp *targets* (the model an agent
# is downgraded to when its configured model is outside the owner's plan).
HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-6"
OPUS = "claude-opus-4-8"

# Best -> worst family preference, used to pick a clamp target.
_FAMILY_PREFERENCE = ("opus", "sonnet", "haiku")
_FAMILY_CANONICAL = {"opus": OPUS, "sonnet": SONNET, "haiku": HAIKU}


class PlanLimit(TypedDict):
    projects: Optional[int]            # None = unlimited
    agents_per_project: Optional[int]  # None = unlimited; counts NON-template agents only
    allowed_families: frozenset[str]   # subset of {"haiku", "sonnet", "opus"}
    sharing: bool


PLAN_LIMITS: dict[PlanTier, PlanLimit] = {
    PlanTier.FREE: {
        "projects": 2,
        "agents_per_project": 3,
        "allowed_families": frozenset({"haiku"}),
        "sharing": False,
    },
    PlanTier.PRO: {
        "projects": 10,
        "agents_per_project": 8,
        "allowed_families": frozenset({"haiku", "sonnet"}),
        "sharing": True,
    },
    PlanTier.ULTRA: {
        "projects": None,
        "agents_per_project": None,
        "allowed_families": frozenset({"haiku", "sonnet", "opus"}),
        "sharing": True,
    },
}


def is_unlimited(limit: Optional[int]) -> bool:
    return limit is None


def model_family(model_name: Optional[str]) -> str:
    """Classify a model id into a family. Unknown/empty -> 'sonnet' (mid tier)."""
    name = (model_name or "").lower()
    if "haiku" in name:
        return "haiku"
    if "opus" in name:
        return "opus"
    if "sonnet" in name:
        return "sonnet"
    return "sonnet"


def get_effective_plan(user) -> PlanTier:
    """The ONE place plan expiry is applied.

    Returns the stored plan unless ``plan_expires_at`` is set and in the past,
    in which case the user falls back to FREE. ``user`` is a models.db.User
    (typed loosely to avoid importing the table model here).
    """
    expires = getattr(user, "plan_expires_at", None)
    if expires is not None:
        # Stored datetimes may be naive (SQLite); treat naive as UTC.
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            return PlanTier.FREE
    return getattr(user, "plan", PlanTier.FREE) or PlanTier.FREE


def project_limit(plan: PlanTier) -> Optional[int]:
    return PLAN_LIMITS[plan]["projects"]


def agent_limit(plan: PlanTier) -> Optional[int]:
    return PLAN_LIMITS[plan]["agents_per_project"]


def sharing_allowed(plan: PlanTier) -> bool:
    return PLAN_LIMITS[plan]["sharing"]


def allowed_families_for(plan: PlanTier) -> frozenset[str]:
    return PLAN_LIMITS[plan]["allowed_families"]


def model_is_allowed(plan: PlanTier, model_name: str) -> bool:
    return model_family(model_name) in PLAN_LIMITS[plan]["allowed_families"]


def best_allowed_model(plan: PlanTier) -> str:
    """Highest-tier canonical model id allowed by ``plan`` — the clamp target."""
    allowed = PLAN_LIMITS[plan]["allowed_families"]
    for family in _FAMILY_PREFERENCE:
        if family in allowed:
            return _FAMILY_CANONICAL[family]
    return HAIKU  # defensive floor; every tier allows haiku


def clamp_model(plan: PlanTier, model_name: Optional[str]) -> str:
    """Return ``model_name`` if its family is allowed by ``plan``; else the best
    model the plan does allow."""
    requested = model_name or SONNET
    if model_is_allowed(plan, requested):
        return requested
    return best_allowed_model(plan)
