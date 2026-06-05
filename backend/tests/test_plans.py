from datetime import datetime, timedelta, timezone

from models.enums import PlanTier
import plans


# ---------------------------------------------------------------------------
# get_effective_plan — expiry handling
# ---------------------------------------------------------------------------

class _U:
    """Minimal stand-in for a User (get_effective_plan reads attrs duck-typed)."""
    def __init__(self, plan, plan_expires_at=None):
        self.plan = plan
        self.plan_expires_at = plan_expires_at


def test_effective_plan_no_expiry_returns_stored():
    assert plans.get_effective_plan(_U(PlanTier.PRO)) == PlanTier.PRO


def test_effective_plan_future_expiry_keeps_plan():
    future = datetime.now(timezone.utc) + timedelta(days=30)
    assert plans.get_effective_plan(_U(PlanTier.ULTRA, future)) == PlanTier.ULTRA


def test_effective_plan_past_expiry_falls_back_to_free():
    past = datetime.now(timezone.utc) - timedelta(days=1)
    assert plans.get_effective_plan(_U(PlanTier.ULTRA, past)) == PlanTier.FREE


def test_effective_plan_naive_past_expiry_treated_as_utc():
    naive_past = (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None)
    assert plans.get_effective_plan(_U(PlanTier.PRO, naive_past)) == PlanTier.FREE


def test_effective_plan_missing_attrs_defaults_free():
    class Bare:
        pass
    assert plans.get_effective_plan(Bare()) == PlanTier.FREE


# ---------------------------------------------------------------------------
# Unlimited sentinel
# ---------------------------------------------------------------------------

def test_ultra_limits_are_unlimited():
    assert plans.project_limit(PlanTier.ULTRA) is None
    assert plans.agent_limit(PlanTier.ULTRA) is None
    assert plans.is_unlimited(plans.project_limit(PlanTier.ULTRA))


def test_numeric_limits():
    assert plans.project_limit(PlanTier.FREE) == 2
    assert plans.agent_limit(PlanTier.FREE) == 3
    assert plans.project_limit(PlanTier.PRO) == 10
    assert plans.agent_limit(PlanTier.PRO) == 8


# ---------------------------------------------------------------------------
# Model family classification + allow checks
# ---------------------------------------------------------------------------

def test_model_family_by_substring():
    assert plans.model_family("claude-haiku-4-5-20251001") == "haiku"
    assert plans.model_family("claude-sonnet-4-6") == "sonnet"
    assert plans.model_family("claude-opus-4-8") == "opus"
    assert plans.model_family("claude-opus-4-7") == "opus"  # version-suffix robust
    assert plans.model_family(None) == "sonnet"  # unknown -> mid tier


def test_free_allows_only_haiku():
    assert plans.model_is_allowed(PlanTier.FREE, "claude-haiku-4-5-20251001")
    assert not plans.model_is_allowed(PlanTier.FREE, "claude-sonnet-4-6")
    assert not plans.model_is_allowed(PlanTier.FREE, "claude-opus-4-8")


def test_pro_allows_haiku_and_sonnet_not_opus():
    assert plans.model_is_allowed(PlanTier.PRO, "claude-haiku-4-5-20251001")
    assert plans.model_is_allowed(PlanTier.PRO, "claude-sonnet-4-6")
    assert not plans.model_is_allowed(PlanTier.PRO, "claude-opus-4-8")


def test_ultra_allows_all():
    for m in ("claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8", "claude-opus-4-7"):
        assert plans.model_is_allowed(PlanTier.ULTRA, m)


# ---------------------------------------------------------------------------
# best_allowed_model / clamp_model
# ---------------------------------------------------------------------------

def test_best_allowed_model_per_tier():
    assert plans.best_allowed_model(PlanTier.FREE) == plans.HAIKU
    assert plans.best_allowed_model(PlanTier.PRO) == plans.SONNET
    assert plans.best_allowed_model(PlanTier.ULTRA) == plans.OPUS


def test_clamp_model_downgrades_when_disallowed():
    assert plans.clamp_model(PlanTier.FREE, "claude-sonnet-4-6") == plans.HAIKU
    assert plans.clamp_model(PlanTier.FREE, "claude-opus-4-8") == plans.HAIKU
    assert plans.clamp_model(PlanTier.PRO, "claude-opus-4-8") == plans.SONNET


def test_clamp_model_keeps_allowed():
    assert plans.clamp_model(PlanTier.PRO, "claude-sonnet-4-6") == "claude-sonnet-4-6"
    assert plans.clamp_model(PlanTier.ULTRA, "claude-opus-4-7") == "claude-opus-4-7"
