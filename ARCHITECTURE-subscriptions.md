# Architecture: Subscription Tiers (Free / Pro / Ultra) — Backend Design

Backend/architecture design for the subscription-tiers feature described in
`PLAN-subscriptions.md`. This is a **design document only** — no repository code is
changed by it. Where the plan conflicts with the actual codebase, the conflict is
called out inline and resolved in [§8 Resolved conflicts](#8-resolved-conflicts).

Stack ground truth: FastAPI, Python 3.11+, async SQLModel/SQLAlchemy, SQLite WAL,
Alembic, Pydantic v2 (`ConfigDict(from_attributes=True)`). Routers are mounted with
`redirect_slashes=False`, so every path below is exact (trailing slashes matter).

Model IDs in scope:
- Haiku — `claude-haiku-4-5-20251001`
- Sonnet — `claude-sonnet-4-6`
- Opus — `claude-opus-4-8`

---

## 1. System diagram

### 1.1 Request path (limit / gate enforcement)

```
HTTP request
   │  Authorization: Bearer <jwt>   (or auth_token cookie)
   ▼
get_current_user (dependencies.py)         → 401 if token bad / revoked
   │  returns User (now carries .plan, .plan_expires_at)
   ▼
get_effective_plan(user)  (plans.py via dependencies)
   │  applies expiry: plan_expires_at < now()  ⇒  PlanTier.free
   │  returns PlanTier (the SINGLE place expiry is applied)
   ▼
route handler limit / gate check  (uses PLAN_LIMITS[effective_plan])
   │
   ├─ POST /projects ─────────── count owned Projects ≥ limit?  → 403 "Free plan limit: 2 projects"
   ├─ POST /projects/{id}/agents count non-template agents ≥ limit? → 403 "Free plan limit: 3 agents per project"
   ├─ PATCH .../agents/{id} ───── requested model ∉ allowed_models? → 403 "<plan> plan does not include <model>"
   ├─ POST /projects/{id}/shares  effective_plan == free? → 403 "Sharing requires Pro or Ultra"
   └─ POST /projects/{id}/share-link  effective_plan == free? → 403 "Sharing requires Pro or Ultra"
   │
   ▼
business logic → DB → response
```

### 1.2 Run-time model-clamp path (the Free→Haiku override)

The override is **not** a request-path check. Agent runs are fired as detached
background tasks from the orchestrator, so the clamp lives on the dispatch path and
is resolved from the **project owner's** effective plan (the running user is
irrelevant — a Free collaborator can run a Pro owner's Opus agent, and a downgraded
owner's agents must clamp).

```
orchestrator.dispatch_task(task, session)
   │  loads Project (already does)  → project.user_id  = OWNER id
   │  NEW: load owner User by project.user_id
   │  NEW: effective_plan = get_effective_plan(owner)        (owner None → treat as free)
   │  NEW: allowed = allowed_models_for(effective_plan)      (a frozenset[str])
   │  passes `allowed` into the Agent snapshot path
   ▼
agent_runner.run_agent_task(agent, task, project, history, factory, allowed_models)
   │
   ▼
get_model_for_agent(agent, allowed_models)   ← NEW SIGNATURE
   │  requested = agent.model_name or "claude-sonnet-4-6"
   │  if requested in allowed:  return requested
   │  else: best = best_allowed_model(allowed); log.warning(clamp); return best
   ▼
anthropic.AsyncAnthropic(...).messages.stream(model=<clamped>, ...)   (agent_runner.py:133)
```

Key consequence: the model clamp is enforced **only here** (the single seam at
`agent_runner.py:53` / call site `:124`). The request-path `PATCH .../agents` gate
is a UX nicety (early, clear 403); the run-time clamp is the real safety net.

---

## 2. `plans.py` — PlanTier enum + PLAN_LIMITS (proposed contents)

New file `backend/plans.py`. `PlanTier` itself is added to `models/enums.py` (next to
the other `(str, Enum)` types, matching the plan's "models/enums.py — add PlanTier"
instruction); `plans.py` owns the limits table and the pure helpers so it has no
circular dependency on `dependencies.py`.

**Unlimited sentinel convention:** `None` means "no limit". Numeric limits are `int`.
Every consumer must treat `None` as "skip the count check".

```python
# models/enums.py  (addition)
class PlanTier(str, Enum):
    FREE  = "free"
    PRO   = "pro"
    ULTRA = "ultra"
```

```python
# backend/plans.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, TypedDict

from models.enums import PlanTier

# Canonical model IDs (single source of truth for tier→model mapping)
HAIKU  = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-6"
OPUS   = "claude-opus-4-8"

# Best→worst preference order, used by the run-time clamp to pick a downgrade target.
_MODEL_PREFERENCE = (OPUS, SONNET, HAIKU)


class PlanLimit(TypedDict):
    projects: Optional[int]            # None = unlimited
    agents_per_project: Optional[int]  # None = unlimited; counts NON-template agents only
    allowed_models: frozenset[str]
    sharing: bool


# Single source of truth for all tier numbers.
PLAN_LIMITS: dict[PlanTier, PlanLimit] = {
    PlanTier.FREE: {
        "projects": 2,
        "agents_per_project": 3,
        "allowed_models": frozenset({HAIKU}),
        "sharing": False,
    },
    PlanTier.PRO: {
        "projects": 10,
        "agents_per_project": 8,
        "allowed_models": frozenset({HAIKU, SONNET}),
        "sharing": True,
    },
    PlanTier.ULTRA: {
        "projects": None,
        "agents_per_project": None,
        "allowed_models": frozenset({HAIKU, SONNET, OPUS}),
        "sharing": True,
    },
}


def is_unlimited(limit: Optional[int]) -> bool:
    return limit is None


def get_effective_plan(user) -> PlanTier:
    """The ONE place plan expiry is applied.

    Returns the stored plan unless plan_expires_at is set and in the past,
    in which case the user falls back to FREE. `user` is models.db.User
    (typed loosely to avoid importing the table model into plans.py).
    """
    expires = getattr(user, "plan_expires_at", None)
    if expires is not None:
        # stored datetimes may be naive (SQLite); treat naive as UTC.
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            return PlanTier.FREE
    return getattr(user, "plan", PlanTier.FREE) or PlanTier.FREE


def allowed_models_for(plan: PlanTier) -> frozenset[str]:
    return PLAN_LIMITS[plan]["allowed_models"]


def best_allowed_model(allowed: frozenset[str]) -> str:
    """Highest-tier model in `allowed`, used as the silent-clamp target."""
    for model in _MODEL_PREFERENCE:
        if model in allowed:
            return model
    return HAIKU  # defensive floor; every tier allows Haiku


def model_is_allowed(plan: PlanTier, model_name: str) -> bool:
    return model_name in PLAN_LIMITS[plan]["allowed_models"]


def sharing_allowed(plan: PlanTier) -> bool:
    return PLAN_LIMITS[plan]["sharing"]
```

`PLAN_LIMITS` is also the source the frontend's tier-comparison table is driven from
(serialised via `GET /users/me` / a small `/plans` endpoint if desired later — not in
this scope; the frontend can hardcode from the same numbers for now).

---

## 3. Data model changes

### 3.1 New `User` fields (`backend/models/db.py`)

Add exactly two columns to `User`:

```python
from models.enums import PlanTier  # add to existing enums import

class User(SQLModel, table=True):
    ...
    plan: PlanTier = Field(default=PlanTier.FREE)
    plan_expires_at: Optional[datetime] = Field(default=None)
    ...
```

- `plan` stored as the enum's string value (`"free"|"pro"|"ultra"`) — consistent with
  how `AgentRole`, `ProjectStatus` etc. are already persisted as `(str, Enum)`.
- `plan_expires_at` nullable; `NULL` = never expires (the common case for manually
  assigned permanent plans).
- No relationships, no new tables (matches plan "No new tables required").

### 3.2 Alembic migration outline — `add_plan_fields_to_users`

```
revision: add_plan_fields_to_users
down_revision: <current head>

def upgrade():
    # 1. Add columns. SQLite requires a server_default for a NOT NULL add on an
    #    existing table, so add `plan` with server_default='free'.
    op.add_column("users",
        sa.Column("plan", sa.String(), nullable=False, server_default="free"))
    op.add_column("users",
        sa.Column("plan_expires_at", sa.DateTime(), nullable=True))

    # 2. Backfill is implicit via server_default — every existing row becomes 'free'
    #    (matches "Grandfathering — all existing users default to Free on migration").
    #    Optional explicit safety net:
    #    op.execute("UPDATE users SET plan = 'free' WHERE plan IS NULL")

    # 3. Drop the server_default so future inserts go through the app/ORM default,
    #    keeping the DB schema clean. (Use batch_alter_table for SQLite.)
    with op.batch_alter_table("users") as batch:
        batch.alter_column("plan", server_default=None)

def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_column("plan_expires_at")
        batch.drop_column("plan")
```

Note: SQLite ALTER is limited; if the project's Alembic config doesn't already use
`render_as_batch=True`, the column drops in `downgrade` must go through
`batch_alter_table` (shown above).

---

## 4. API contracts

Conventions followed: Pydantic v2 request/response models, response schemas use
`ConfigDict(from_attributes=True)`, errors raised as
`HTTPException(status_code=..., detail="...")`. TypeScript types below describe the
JSON the frontend receives.

### 4.0 New schemas (`backend/models/schemas.py`)

```python
class UserMeSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    plan: PlanTier                       # stored plan
    plan_expires_at: Optional[datetime] = None
    effective_plan: PlanTier             # computed; injected by handler, not from ORM

class AdminUserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    plan: PlanTier
    plan_expires_at: Optional[datetime] = None
    effective_plan: PlanTier

class SetPlanRequest(BaseModel):
    plan: PlanTier                       # invalid value ⇒ FastAPI 422 automatically
    plan_expires_at: Optional[datetime] = None
```

`effective_plan` is not an ORM column, so the handler builds the schema with
`UserMeSchema.model_validate(user, update={"effective_plan": get_effective_plan(user)})`
(Pydantic v2 `model_validate(..., update=...)`), or constructs it field-by-field.

---

### 4.1 `GET /users/me` (NEW)

**Recommendation: new `routers/users.py` mounted at prefix `/users`** rather than
`/auth/me`. Justification:
- The plan's acceptance criteria, US-7, and the frontend `useCurrentUser` hook all
  explicitly reference `GET /users/me`. Matching the documented contract avoids a
  frontend/back-end mismatch.
- `auth.router` (prefix `/auth`) is about credential lifecycle (register/login/logout).
  A current-user *resource* read is conceptually a `users` resource, and gives room
  for future `/users/...` reads without overloading the auth router.
- Cost is one tiny router + one `include_router(users.router, prefix="/users")` line
  in `main.py`. Low.

```python
# routers/users.py  (mounted: app.include_router(users.router, prefix="/users"))
@router.get("/me", response_model=UserMeSchema)
async def get_me(current_user: User = Depends(get_current_user)) -> UserMeSchema:
    return UserMeSchema.model_validate(
        current_user,
        update={"effective_plan": get_effective_plan(current_user)},
    )
```

- **Path:** `GET /users/me`
- **Auth:** `get_current_user` (401 if unauthenticated)
- **Request body:** none
- **Response 200:**

```typescript
type UserMe = {
  id: string;
  email: string;
  plan: "free" | "pro" | "ultra";          // stored
  plan_expires_at: string | null;          // ISO 8601
  effective_plan: "free" | "pro" | "ultra"; // after expiry applied
};
```

- **Errors:** `401 {"detail": "Not authenticated"}` / `"Invalid or expired token"` /
  `"Session has been revoked"` (inherited from `get_current_user`).

---

### 4.2 `PATCH /admin/users/{user_id}/plan` (NEW)

New `routers/admin.py`, mounted `app.include_router(admin.router, prefix="/admin")`.

```python
@router.patch("/users/{user_id}/plan", response_model=AdminUserSchema,
              dependencies=[Depends(admin_required)])
async def set_user_plan(user_id: str, body: SetPlanRequest,
                        session: Any = Depends(get_session)) -> AdminUserSchema:
    user = (await session.exec(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.plan = body.plan
    user.plan_expires_at = body.plan_expires_at
    session.add(user); await session.commit(); await session.refresh(user)
    return AdminUserSchema.model_validate(
        user, update={"effective_plan": get_effective_plan(user)})
```

- **Path:** `PATCH /admin/users/{user_id}/plan`
- **Auth:** `admin_required` — `Authorization: Bearer <ADMIN_SECRET>` (see §6). This
  endpoint does **not** use `get_current_user`; it is a back-office secret, not a JWT.
- **Request body:**

```typescript
type SetPlanRequest = {
  plan: "free" | "pro" | "ultra";
  plan_expires_at?: string | null; // ISO 8601 or null
};
```

- **Response 200:** `AdminUser` (same shape as §4.4 response).
- **Errors:**
  - `401 {"detail": "Admin authentication required"}` — missing/malformed header.
  - `403 {"detail": "Invalid admin credentials"}` — wrong secret.
  - `404 {"detail": "User not found"}`.
  - `422` — invalid `plan` value (automatic Pydantic enum validation).

---

### 4.3 `GET /admin/users/{user_id}` (NEW)

```python
@router.get("/users/{user_id}", response_model=AdminUserSchema,
            dependencies=[Depends(admin_required)])
async def get_user_admin(user_id: str, session: Any = Depends(get_session)) -> AdminUserSchema:
    user = (await session.exec(select(User).where(User.id == user_id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminUserSchema.model_validate(
        user, update={"effective_plan": get_effective_plan(user)})
```

- **Path:** `GET /admin/users/{user_id}`
- **Auth:** `admin_required`.
- **Response 200:**

```typescript
type AdminUser = {
  id: string;
  email: string;
  plan: "free" | "pro" | "ultra";
  plan_expires_at: string | null;
  effective_plan: "free" | "pro" | "ultra";
};
```

- **Errors:** `401 {"detail": "Admin authentication required"}`,
  `403 {"detail": "Invalid admin credentials"}`, `404 {"detail": "User not found"}`.

---

### 4.4 `POST /projects` — project-count gate (CHANGED)

Full path `POST /projects` (no trailing slash; handler is `@router.post("")` mounted
at prefix `/projects`).

Insert the gate at the **top** of `create_project`, before constructing `Project`:

```python
effective = get_effective_plan(current_user)
limit = PLAN_LIMITS[effective]["projects"]
if limit is not None:
    count = (await session.exec(
        select(func.count(Project.id)).where(Project.user_id == current_user.id)
    )).one()
    if count >= limit:
        raise HTTPException(status_code=403,
                            detail=f"{effective.value.capitalize()} plan limit: {limit} projects")
```

**Acceptance-criteria detail string:** for Free this yields exactly
`"Free plan limit: 2 projects"` (matches US-1). Pro yields
`"Pro plan limit: 10 projects"`. Ultra is `None` → no check.

**Archived projects count?** — **Recommendation: count all non-deleted projects
(archived included).** In this codebase, "delete" is a hard delete (`delete_project`
physically removes the row only after archiving); `archived_at` is a soft-pause, not a
deletion, and archived projects still consume the user's namespace and can be
unarchived at will. Counting them prevents a Free user from parking projects in the
archive to bypass the limit. So the count is simply
`Project.user_id == current_user.id` with no `archived_at` filter.

- **Auth:** `get_current_user`.
- **Errors added:** `403 {"detail": "Free plan limit: 2 projects"}` (or Pro variant).
  Existing 201 response (`ProjectDetailSchema`) unchanged.

---

### 4.5 `POST /projects/{project_id}/agents` — agent-count gate (CHANGED)

Full path `POST /projects/{project_id}/agents` (agents router at prefix `/projects`).

Insert after `get_owned_project(...)`, before constructing the `Agent`:

```python
effective = get_effective_plan(current_user)
limit = PLAN_LIMITS[effective]["agents_per_project"]
if limit is not None:
    count = (await session.exec(
        select(func.count(Agent.id)).where(
            Agent.project_id == project_id,
            Agent.is_template_agent == False,   # noqa: E712
            Agent.is_archived == False,         # noqa: E712
        )
    )).one()
    if count >= limit:
        raise HTTPException(status_code=403,
            detail=f"{effective.value.capitalize()} plan limit: {limit} agents per project")
```

**Critical resolution — what counts toward the limit:** projects are auto-seeded with
**5 template agents** at creation (`create_project`, all `is_template_agent=True`). A
Free limit of 3 would be exceeded by seeding alone, making the feature impossible. So
the limit applies to **non-template, non-archived agents only**
(`is_template_agent == False AND is_archived == False`). Template agents are the
shared default team and are not user-created via this endpoint, so they are excluded.
This is stated explicitly so the seeded team never blocks agent creation.

**Acceptance-criteria detail string:** Free → `"Free plan limit: 3 agents per project"`
(matches US-2).

- **Auth:** `get_current_user` + `get_owned_project` (only the owner can add agents).
- **Errors added:** `403 {"detail": "Free plan limit: 3 agents per project"}`.

---

### 4.6 `PATCH /projects/{project_id}/agents/{agent_id}` — model-access gate (CHANGED)

Full path `PATCH /projects/{project_id}/agents/{agent_id}`.

When `body.model_name` is provided, validate it against the owner's plan before
assigning. (Owner == `current_user`, since the route already enforces
`get_owned_project`.)

```python
if body.model_name is not None:
    effective = get_effective_plan(current_user)
    if not model_is_allowed(effective, body.model_name):
        raise HTTPException(status_code=403,
            detail=f"{effective.value.capitalize()} plan does not include {body.model_name}")
    agent.model_name = body.model_name
```

This is one of the two correct enforcement points the plan's `/agent-templates` gate
should have targeted (see §5 and §8). The same check applies if/when a `model_name`
field is added to `POST /projects/{id}/agents` (`CreateAgentRequest` already has
`model_name`, default Sonnet) — gate it identically there. **Recommendation: add the
identical model-access check to `create_agent` as well**, since a Free user could
otherwise create a Sonnet agent directly even though the run-time clamp would
override it; gating at create gives the clear, early 403 the plan wants.

- **Auth:** `get_current_user` + `get_owned_project`.
- **Errors added:** `403 {"detail": "Free plan does not include claude-sonnet-4-6"}`
  (Free setting Sonnet/Opus); `403 {"detail": "Pro plan does not include claude-opus-4-8"}`
  (Pro setting Opus). Ultra: never rejected. Existing 404 / template-agent 403 unchanged.

---

### 4.7 `POST /projects/{project_id}/shares` — sharing gate (CHANGED)

Full path `POST /projects/{project_id}/shares`. Insert at the top of
`invite_by_email`, before/after `get_owned_project` (after is fine — owner is resolved
from `current_user`):

```python
if not sharing_allowed(get_effective_plan(current_user)):
    raise HTTPException(status_code=403, detail="Sharing requires Pro or Ultra")
```

- **Auth:** `get_current_user` + `get_owned_project`.
- **Errors added:** `403 {"detail": "Sharing requires Pro or Ultra"}` (matches US-10).
  Existing 422 (self-invite, collaborator cap, dup) and 409 unchanged.

---

### 4.8 `POST /projects/{project_id}/share-link` — sharing gate (CHANGED)

**Path correction:** the actual route is `POST /projects/{project_id}/share-link`
(**singular**). The plan writes `/share-links` (plural) — that is wrong; design and
tests must use the singular form. Insert the same gate at the top of
`get_or_create_share_link`:

```python
if not sharing_allowed(get_effective_plan(current_user)):
    raise HTTPException(status_code=403, detail="Sharing requires Pro or Ultra")
```

- **Auth:** `get_current_user` + `get_owned_project`.
- **Errors added:** `403 {"detail": "Sharing requires Pro or Ultra"}`.

**`POST /projects/join/{token}` is NOT gated.** The gated action is *creating* a share
(an owner privilege). Joining is the *joiner's* action; the joiner may legitimately be
on any tier (a Free user invited to a Pro owner's project must be able to accept). The
project being shareable was already validated when the owner (a Pro/Ultra user) created
the invite/link. Gating join on the joiner's plan would break the core sharing UX and
contradicts US-11 ("sharing works exactly as today for Pro/Ultra"). The existing
`_MAX_COLLABORATORS = 5` cap on join remains, unchanged and tier-independent.

---

## 5. Model-access enforcement strategy

### 5.1 New `get_model_for_agent` signature

Current:

```python
def get_model_for_agent(agent: Agent) -> str:
    return agent.model_name or "claude-sonnet-4-6"
```

Proposed:

```python
def get_model_for_agent(agent: Agent, allowed_models: frozenset[str]) -> str:
    requested = agent.model_name or "claude-sonnet-4-6"
    if requested in allowed_models:
        return requested
    clamped = best_allowed_model(allowed_models)
    logger.warning(
        "Clamping agent %s model %s → %s (not in owner's allowed set %s)",
        agent.id, requested, clamped, sorted(allowed_models),
    )
    return clamped
```

### 5.2 Where the owner's plan is fetched

In `orchestrator.dispatch_task` (the single dispatch seam). It already loads the
`Project` (`orchestrator.py:309-312`), which carries `project.user_id` = owner id.
Add, after the project is loaded:

```python
allowed = allowed_models_for(PlanTier.FREE)  # safe default
if project.user_id is not None:
    owner = (await session.exec(select(User).where(User.id == project.user_id))).first()
    if owner is not None:
        allowed = allowed_models_for(get_effective_plan(owner))
```

(Legacy projects with `user_id is None` — which `get_owned_project` already tolerates —
fall back to Free/Haiku, the safe floor.)

### 5.3 Call-site / snapshot change

`run_agent_task` is fired with detached snapshots (`agent_snapshot`, `task_snapshot`,
`project_snapshot`) to avoid session-detachment issues. **The current
`project_snapshot` does not copy `user_id`**, and the snapshots are plain objects, so
the runner cannot re-derive the plan itself. Therefore the resolved `allowed` set must
be **passed as an explicit argument**, not re-read inside the runner:

```python
# orchestrator.dispatch_task
bg = asyncio.create_task(
    agent_runner.run_agent_task(
        agent_snapshot, task_snapshot, project_snapshot, history,
        async_session_factory,
        allowed_models=allowed,      # NEW
    )
)
```

```python
# agent_runner.run_agent_task signature
async def run_agent_task(agent, task, project, conversation_history,
                         session_factory, allowed_models: frozenset[str]) -> None:
    ...
    model = get_model_for_agent(agent, allowed_models)   # was: get_model_for_agent(agent)
```

No other call sites of `get_model_for_agent` exist (verified: only the one at
`agent_runner.py:124`). Tests that call `run_agent_task` / `get_model_for_agent`
directly must pass an `allowed_models` set (see §10).

### 5.4 Clamp rule: silent downgrade, not hard error — justification

If the requested model is not in the owner's allowed set, **silently downgrade to the
best allowed model and log a warning** — do **not** raise at run time. Reasons:

1. **Run time has no caller to receive an error.** The run is a detached
   `asyncio.create_task` background job streaming over an event channel; a raised
   exception just lands in `handle_agent_failure` and shows the user a failed task with
   no actionable message. A clamp keeps the run productive.
2. **Plans change after agents are configured.** An owner downgrades Pro→Free (or a
   trial expires) while agents still carry `claude-sonnet-4-6`. The agent rows are not
   rewritten on downgrade; clamping at run time is exactly how a stale `model_name`
   gets corrected without a migration sweep.
3. **It is the real enforcement boundary.** The `PATCH .../agents` 403 (§4.6) is a
   best-effort early signal; the run-time clamp is the guarantee that a Free owner's
   run never bills Sonnet/Opus, regardless of how the row got its value.
4. **US-4 says "overrides … regardless of the agent template value"** — i.e. override,
   not reject. Silent clamp is the literal reading.

The warning log preserves observability (we can detect misconfigured/stale agents).

---

## 6. Admin auth — `admin_required`

A back-office shared secret, deliberately separate from the user JWT system. Lives in
`dependencies.py`; the secret comes from the `ADMIN_SECRET` env var (same pattern as
the existing `os.getenv(...)` usage in `auth.py` / `sharing.py`).

```python
# dependencies.py
import os, secrets as _secrets

def admin_required(authorization: Optional[str] = Header(default=None)) -> None:
    expected = os.getenv("ADMIN_SECRET")
    if not expected:
        # Misconfiguration: fail closed, never open the admin surface.
        raise HTTPException(status_code=503, detail="Admin API not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    presented = authorization[7:]
    if not _secrets.compare_digest(presented, expected):  # constant-time
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
```

Design notes:
- Used as a router/route-level dependency (`dependencies=[Depends(admin_required)]`),
  returning `None` — it gates, it does not inject a principal.
- `compare_digest` avoids timing oracles on the secret.
- Fails **closed** (503) if `ADMIN_SECRET` is unset, so a missing env var can never
  leave `/admin` open.
- `.env.example` / deploy config (Render) must document `ADMIN_SECRET`. It is unrelated
  to the JWT signing key; rotating it does not invalidate user sessions.

---

## 7. Stripe seam (future)

Stripe is explicitly out of scope; the design only reserves the seam:

- **Plan mutation is already centralized.** `set_user_plan` (§4.2) is the *only* place
  that writes `user.plan` / `user.plan_expires_at`. A future `routers/subscriptions.py`
  with `POST /subscriptions/webhook` (Stripe signature-verified) does its work and then
  calls the **same** internal helper that the admin endpoint uses. Refactor the
  body of `set_user_plan` into a plain `async def apply_plan(session, user, plan,
  expires_at)` helper now (or at Stripe time) so both the admin route and the webhook
  share one code path — no duplicate plan logic.
- **Mapping:** Stripe `checkout.session.completed` / `customer.subscription.updated` →
  resolve the local user (by stored `stripe_customer_id`, a future column) → derive
  tier from the Stripe price ID → `apply_plan(...)`. `plan_expires_at` maps to the
  subscription's `current_period_end` for trials/lapses; permanent active subs leave it
  `NULL` (renewal webhooks push it forward).
- **Currency is a frontend-only concern until then.** Per the plan (US-9), the GBP/USD
  toggle, the static `USD_RATE` constant, and `localStorage` persistence all live in the
  frontend. The backend stores no price/currency. When Stripe lands, the frontend passes
  the chosen `currency: "gbp" | "usd"` into the Checkout-session creation call; the
  backend simply forwards it to Stripe. No backend schema change is needed now.

---

## 8. Resolved conflicts

- **`/agent-templates` model gate is wrong (US-4/US-5 acceptance criteria).**
  `AgentTemplate` is a **global, shared, user-less** table copied into every project.
  Gating it by one requesting user's plan would let any user's tier mutate a resource
  shared by everyone (and there is no `user_id` to scope it). **Resolution: drop the
  per-plan model gate on `POST /agent-templates` and `PATCH /agent-templates/{id}`.**
  The correct enforcement points are (a) `PATCH /projects/{id}/agents/{id}` and
  `POST /projects/{id}/agents` — per-project, per-owner (§4.6) — and (b) the run-time
  clamp in the orchestrator/runner (§5). If the global template editor must still be
  protected, make it **admin-only** (`admin_required`) rather than plan-gated, since it
  defines defaults for all tenants. Document choice: keep the templates endpoints as-is
  for now (any logged-in user, as today) and rely on the per-project gate + run-time
  clamp for actual model access control.

- **`/share-links` (plural) does not exist.** Real route is
  `POST /projects/{id}/share-link` (singular). Design + tests use the singular form
  (§4.8).

- **`GET /users/me` does not exist yet, and no users router exists.** Resolution: new
  `routers/users.py` at prefix `/users` (justified in §4.1), rather than `/auth/me`.

- **Free agent limit (3) vs 5 seeded template agents.** Resolution: the per-project
  agent limit counts **non-template, non-archived** agents only (§4.5). Seeded default
  team never counts.

- **Run-time model override has no plan access in `get_model_for_agent`.** Resolution:
  change the signature to accept `allowed_models: frozenset[str]`; the orchestrator
  resolves the **owner's** effective plan (not the running user's) at `dispatch_task`
  and passes the set down (§5).

- **Archived projects and the project limit.** Plan is silent. Resolution: count all of
  a user's projects regardless of `archived_at` (archive is a soft-pause that is
  trivially reversible; only hard delete frees a slot). Justified in §4.4.

- **Plan expiry duplication risk.** Resolution: expiry is applied in exactly one
  function, `get_effective_plan` (§2); every route and the orchestrator call it rather
  than comparing `plan_expires_at` themselves (satisfies US-13).

- **Admin endpoints vs user JWT.** Resolution: `/admin/*` uses `admin_required`
  (`ADMIN_SECRET` Bearer), **not** `get_current_user`. Admins need not be registered
  users (§6).

---

## 9. Key decisions & trade-offs

- **`None` = unlimited sentinel.** Simple and explicit; every numeric check is guarded
  by `if limit is not None`. Trade-off: callers must remember the guard — mitigated by
  the `is_unlimited()` helper and `PLAN_LIMITS` being the single table.

- **Owner's plan governs model access, not the runner's plan.** A project's compute
  tier is a property of its owner. This keeps sharing coherent (a Free collaborator
  running a Pro owner's project gets the owner's Sonnet) and means downgrades take
  effect on the next run with no row rewrites. Trade-off: an extra `User` lookup per
  dispatch — negligible (one indexed PK fetch), and only on dispatch, not per chunk.

- **Silent run-time clamp over hard error** (§5.4) — productive runs, tolerates stale
  `model_name`, with a warning log for observability.

- **Two-layer model enforcement (request 403 + run-time clamp).** The 403 is UX/early
  feedback; the clamp is the guarantee. Belt and braces, but the clamp is the one that
  must never be removed.

- **Admin secret separate from JWT.** Lets ops manage plans without a user account and
  without touching the auth-token machinery; fails closed if unset.

- **Count-based limits computed with `func.count` at write time**, not cached on
  `User`. No denormalized counters to keep in sync (consistent with how the codebase
  already counts agents/tasks via `func.count`). Trade-off: a count query per
  create — cheap and correct; avoids drift bugs.

- **`PLAN_LIMITS` as the single source of truth** for numbers and model sets, consumed
  by routes, orchestrator, and `/users/me`. One place to change tier definitions.

---

## 10. Test impact

Existing tests live in `backend/tests/routers/` and `backend/tests/services/`. New
columns default to `free`, so any user created without an explicit plan is Free — that
silently tightens limits and will break tests that create >2 projects, >3 custom
agents, or exercise sharing.

- **`tests/routers/test_projects.py`** — any test creating ≥3 projects for one user now
  hits `403 "Free plan limit: 2 projects"`. Update fixtures to set the user's plan to
  `pro`/`ultra` (or assert the new 403). Add: Free hits limit at the 3rd create; Pro at
  the 11th; Ultra unlimited; expired-plan user is clamped to Free limits.

- **`tests/routers/test_agents.py`** — tests adding ≥4 custom agents to a project now
  hit `403 "Free plan limit: 3 agents per project"`. Use a Pro/Ultra user, or assert
  the 403. Add: the 5 seeded **template** agents do NOT count toward the limit (the key
  regression guard). Add model-access tests for `PATCH .../agents/{id}` (and
  `create_agent` if gated): Free rejecting Sonnet/Opus, Pro rejecting Opus, Ultra
  accepting all.

- **`tests/routers/test_agent_templates.py`** — if the plan's `/agent-templates` model
  gate is (correctly) **not** implemented, ensure no test asserts a plan-based 403 here.
  If the endpoints become admin-only, update these tests to send the `ADMIN_SECRET`
  header.

- **Sharing tests** (wherever `invite_by_email` / `get_or_create_share_link` /
  `join_via_link` are exercised) — owners must now be **Pro or Ultra**, or the share
  routes return `403 "Sharing requires Pro or Ultra"`. Update share fixtures to set the
  owner's plan. Add: Free owner blocked on `/shares` and `/share-link`; Pro/Ultra
  unchanged (US-11); **join is NOT gated** (a Free joiner can still accept). Confirm the
  test paths use the **singular** `/share-link`.

- **`tests/services/test_orchestrator.py`** — `dispatch_task` now loads the owner and
  resolves the allowed set; tests must ensure the project's owner `User` exists with a
  plan. `run_agent_task` / `get_model_for_agent` calls must pass `allowed_models`.
  Add: Free owner clamps Sonnet/Opus agent → `claude-haiku-4-5-20251001`; Pro owner
  clamps Opus → Sonnet, keeps Sonnet; Ultra owner keeps Opus; `user_id is None`
  (legacy) → Free/Haiku floor.

- **New tests:** `tests/routers/test_users.py` (`GET /users/me` returns
  `plan/plan_expires_at/effective_plan`; expired plan reports `effective_plan == "free"`
  while `plan` stays the stored value). `tests/routers/test_admin.py`
  (`PATCH/GET /admin/users/{id}` happy path; 404 unknown user; 422 bad plan; 401 missing
  header; 403 wrong secret; 503 when `ADMIN_SECRET` unset). `tests/test_plans.py` unit
  tests for `get_effective_plan` (future/past/null expiry), `allowed_models_for`,
  `best_allowed_model`, and the `None`-unlimited sentinel.

- **Fixtures/conftest** — a shared helper to create users at a given tier
  (`make_user(plan=PlanTier.PRO, plan_expires_at=None)`) keeps the above updates small
  and consistent across files.

---

## Addendum: Public `/pricing` route & auth persistence (US-15 – US-17)

This is predominantly a frontend concern (see `DESIGN_SPEC-subscriptions.md`), but it has three backend implications:

### 1. No new auth surface needed
The existing `auth_token` cookie is already set at `path="/"` with `httponly=False`, `samesite="lax"` (`routers/auth.py` `_set_auth_cookie`). It is therefore sent on, and JS-readable from, **every** route on the origin — including a public `/pricing`. No backend change is required for a logged-in user's session to "persist" onto `/pricing`; the cookie is the persistence.

### 2. `/pricing` must not be coupled to any auth dependency
`/pricing` is a public marketing page rendered entirely client-side from static tier data + `useCurrency`. It calls **no** authenticated backend endpoint on load. `GET /users/me` is called only opportunistically (if a token cookie is present) to show the "Current plan" state — a 401 there is non-fatal and must be swallowed, not redirected. (Contrast with `fetchJSON`'s default 401→`/auth` redirect: the pricing page's "am I logged in?" probe must use a variant that does **not** redirect. Documented in the frontend spec as `getCurrentUserOptional()`.)

### 3. Checkout-intent seam for Stripe (future)
The Subscribe flow carries the chosen tier as a query param (`?checkout=<tier>`) through the existing `?next=` login redirect. When Stripe lands, the only new backend surface is:

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| `POST` | `/subscriptions/checkout` | `get_current_user` | `{ "tier": "pro"\|"ultra", "currency": "gbp"\|"usd" }` | `{ "checkout_url": string }` | Creates a Stripe Checkout Session with `currency` from the request; returns the redirect URL. |
| `POST` | `/subscriptions/webhook` | Stripe signature | Stripe event | `204` | On `checkout.session.completed`, calls the **same** `apply_plan(user, tier, expires_at)` helper used by `PATCH /admin/users/{id}/plan`. |

Until then, the frontend Subscribe CTA deep-links to the `/app/billing` "coming soon" placeholder. Because `apply_plan` is already the single mutation point for the admin endpoint, wiring the webhook later is additive — no refactor of the gate logic.

**Resolved conflict (additive):** the original plan listed "self-service upgrade UI" as fully out of scope. The `/pricing` page is now in scope as an *intent-collection* surface only; it does not mutate plans. Plan mutation remains admin-only until the Stripe seam above is built.
