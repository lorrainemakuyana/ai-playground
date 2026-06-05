# Feature: Subscription Tiers (Free / Pro / Ultra)

## Goal

Introduce three plan tiers — Free, Pro, and Ultra — that gate the number of projects a user can create, the number of agents per project, and the Claude models available to those agents. Project sharing (already built) becomes a Pro/Ultra-only feature. Plan assignment is managed by a protected admin API; no self-service payment flow is in scope yet, leaving a clean integration point for Stripe later.

## Tier Reference

| | Free | Pro | Ultra |
|---|---|---|---|
| Projects | 2 | 10 | Unlimited |
| Agents per project | 3 | 8 | Unlimited |
| Models | Haiku only | Haiku, Sonnet | Haiku, Sonnet, Opus |
| Project sharing | — | ✓ | ✓ |

---

## User Stories

### Limits & enforcement
- [ ] **US-1** As a Free user, I want to be told clearly when I've hit my project limit so I know why I can't create more.
- [ ] **US-2** As a Free user, I want to be told clearly when I've hit the agent limit for a project so I know why adding more agents is blocked.
- [ ] **US-3** As any user, I want project and agent limits enforced on the server so they cannot be bypassed from the client.
- [ ] **US-4** As a Free user, I want my agents to only use Haiku so that I stay within the free tier's model access.
- [ ] **US-5** As a Pro user, I want my agents to be able to use Haiku or Sonnet so I can get higher-quality results.
- [ ] **US-6** As an Ultra user, I want my agents to be able to use any Claude model, including Opus, so I get the best possible output.

### Plan visibility
- [ ] **US-7** As any logged-in user, I want to see my current plan and its limits on my account/settings page so I always know what I'm entitled to.
- [ ] **US-8** As a user who hits a limit, I want to see an upgrade prompt that describes what Pro or Ultra would give me so I can make an informed decision.

### Currency toggle
- [ ] **US-9** As a visitor or logged-in user viewing pricing, I want to toggle between USD and GBP so I can see prices in my preferred currency.

### Sharing gate
- [ ] **US-10** As a Free user, I want a clear message when I try to share a project explaining that sharing requires Pro or Ultra.
- [ ] **US-11** As a Pro or Ultra user, I want project sharing to continue working exactly as it does today.

### Public pricing & subscribe
- [ ] **US-15** As a visitor (logged out), I want a public `/pricing` page showing the three tiers so I can compare them before signing up.
- [ ] **US-16** As a logged-out visitor, I want clicking "Subscribe" on `/pricing` to send me to sign up/login and then return me to checkout so I don't lose my place.
- [ ] **US-17** As a logged-in user, I want my session to persist when I navigate to `/pricing` so that clicking "Subscribe" takes me straight to checkout without logging in again.

### Admin plan management
- [ ] **US-18** As an admin, I want to set any user's plan via a protected API endpoint so I can manually upgrade or downgrade accounts.
- [ ] **US-19** As an admin, I want to optionally set a plan expiry date when upgrading a user so that trial upgrades expire automatically.
- [ ] **US-20** As an admin, I want to retrieve any user's current plan and expiry via API so I can check account status.

---

## Acceptance Criteria

### US-1 — Free project limit
- [ ] `POST /projects` returns `HTTP 403` with `{"detail": "Free plan limit: 2 projects"}` when the user already has 2 projects.
- [ ] The frontend surfaces this as an upgrade modal (not a generic error toast).

### US-2 — Free agent limit
- [ ] `POST /projects/{id}/agents` returns `HTTP 403` with `{"detail": "Free plan limit: 3 agents per project"}` when the project already has 3 agents.
- [ ] The frontend surfaces this as an upgrade modal.

### US-3 — Server-side enforcement
- [ ] Limits are checked inside FastAPI route handlers via a shared `get_effective_plan(user)` dependency.
- [ ] Direct API calls still return `403` when the limit is exceeded regardless of frontend state.

### US-4 — Free model gate
- [ ] When a Free user's agent run triggers, the orchestrator/agent runner overrides `model_name` to `claude-haiku-4-5-20251001` regardless of the agent template value.
- [ ] `POST /agent-templates` and `PATCH /agent-templates/{id}` return `HTTP 403` if `model_name` is a Sonnet or Opus variant and the user is on Free.

### US-5 — Pro model gate
- [ ] Pro users can set `model_name` to any Haiku or Sonnet variant without restriction.
- [ ] Opus variants return `HTTP 403` for Pro users on agent-template creation/update.

### US-6 — Ultra model gate
- [ ] Ultra users can set `model_name` to any valid Claude model without restriction.

### US-7 — Plan visibility
- [ ] `GET /users/me` response includes `plan`, `plan_expires_at`, and `effective_plan` fields.
- [ ] The settings/account page displays the plan name with a colour-coded badge and the per-tier limits (projects, agents, models).
- [ ] If `plan_expires_at` is set, the expiry date is shown alongside the plan name.

### US-8 — Upgrade modal on limit hit
- [ ] Any limit-exceeded `403` from the projects, agents, or sharing routes triggers an `UpgradeModal`.
- [ ] The modal lists Pro and Ultra benefits side-by-side with a placeholder "Upgrade" CTA (links to `/billing`, which shows "Coming soon").

### US-9 — Currency toggle
- [ ] Pricing UI (upgrade modal, billing placeholder page) renders a toggle with two options: **£ GBP** and **$ USD**.
- [ ] Default currency is **GBP**; toggle state persists in `localStorage` across page reloads.
- [ ] Switching the toggle immediately re-renders all prices in the selected currency — no page reload.
- [ ] Exchange rate is a static config constant (e.g. `USD_RATE = 1.27`); no live FX API required.
- [ ] Stripe Checkout sessions are always created in the user's selected currency — `currency: "gbp"` or `currency: "usd"` passed from the frontend when Stripe is eventually wired in.
- [ ] The toggle is visible wherever prices are displayed: `UpgradeModal` and `/billing` page.

### US-10 — Sharing gate for Free
- [ ] `POST /projects/{id}/shares` and `POST /projects/{id}/share-links` return `HTTP 403` with `{"detail": "Sharing requires Pro or Ultra"}` for Free users.
- [ ] The share button in the UI is visually disabled with a tooltip ("Upgrade to Pro to share") for Free users — no post-click error.

### US-11 — Sharing unchanged for Pro/Ultra
- [ ] All existing sharing routes work without change for Pro and Ultra users.
- [ ] All existing sharing tests continue to pass.

### US-15 — Public pricing page
- [ ] `/pricing` is a **public** route (no auth required, no redirect to `/auth` on load).
- [ ] It renders the same `PlanComparisonTable` + `CurrencyToggle` used by the upgrade modal and `/billing`.
- [ ] Each paid tier has a "Subscribe" CTA; the Free tier has a "Get started" CTA.

### US-16 — Subscribe while logged out
- [ ] Clicking "Subscribe" while logged out routes to `/auth?next=/pricing?checkout=<tier>` (reusing the existing safe-`next` redirect in `auth/page.tsx`).
- [ ] After successful login/registration the user lands back on `/pricing` with the checkout intent preserved, and the checkout (placeholder for now) opens automatically.

### US-17 — Auth persists on /pricing
- [ ] The `auth_token` cookie (path `/`, JS-readable) is read on `/pricing` so a logged-in user is recognised without re-authenticating.
- [ ] For a logged-in user, the "Subscribe" CTA goes straight to checkout (placeholder `/billing` for now) — no login step.
- [ ] `/pricing` shows a logged-in user's current tier as "Current plan" (disabled CTA on that tier).

### US-18 — Admin set plan
- [ ] `PATCH /admin/users/{user_id}/plan` accepts `{"plan": "free"|"pro"|"ultra", "plan_expires_at": <ISO datetime or null>}`.
- [ ] Requires `Authorization: Bearer <ADMIN_SECRET>` header validated against an `ADMIN_SECRET` env var.
- [ ] Returns the updated user object with `plan`, `plan_expires_at`, `effective_plan`.
- [ ] Returns `HTTP 404` if user not found; `HTTP 422` if plan value is invalid.

### US-19 — Plan expiry
- [ ] `get_effective_plan(user)` returns `PlanTier.free` if `plan_expires_at` is in the past, regardless of `user.plan`.
- [ ] Expiry logic lives in one place (`get_effective_plan`) — not duplicated per route.
- [ ] A user with an expired paid plan sees their stored plan label with an "Expired" badge in the UI.

### US-20 — Admin read plan
- [ ] `GET /admin/users/{user_id}` returns `id`, `email`, `plan`, `plan_expires_at`, `effective_plan`.
- [ ] Requires the same admin token as US-18.

---

## Technical Scope

### Frontend (Next.js)
- `PlanTierBadge` component — Free / Pro / Ultra with colour chip + optional "Expired" state
- `UpgradeModal` component — triggered by limit-hit 403s, shows tier comparison table with prices, currency toggle, placeholder CTA
- `CurrencyToggle` component — GBP/USD pill toggle, reads/writes `localStorage`; used in `UpgradeModal` and `/billing`
- `useCurrency` hook — returns `{ currency, setCurrency, format(penceOrCents) }`; static rate constant lives here
- `useCurrentUser` hook — expose `plan`, `plan_expires_at`, `effective_plan`
- Settings/account page — add plan section: badge + limits table + expiry date if set
- Share button — disabled state + tooltip when `effective_plan === "free"`
- Global 403 interceptor — detect limit-hit responses and fire `UpgradeModal`
- `/billing` placeholder page — tier comparison table, `CurrencyToggle`, "Payment coming soon" copy
- `/pricing` **public** page — `PlanComparisonTable` + `CurrencyToggle`, Subscribe CTAs; reads `auth_token` cookie to detect logged-in state and route Subscribe to checkout vs `/auth?next=...`
- Reuse existing `?next=` safe-redirect in `app/auth/page.tsx` to carry checkout intent through login

### Backend (FastAPI)
- `models/enums.py` — add `PlanTier(str, Enum)` with `free`, `pro`, `ultra`
- `models/db.py` — add `plan: PlanTier` and `plan_expires_at: Optional[datetime]` to `User`
- `backend/plans.py` — `PLAN_LIMITS` dict (single source of truth for numbers) + `get_effective_plan(user)`
- `dependencies.py` — export `get_effective_plan` for injection into routes
- `GET /users/me` — add `plan`, `plan_expires_at`, `effective_plan` to response schema
- `POST /projects` — enforce project count limit
- `POST /projects/{id}/agents` — enforce agent count limit
- `POST/PATCH /agent-templates` — enforce model access per plan
- `services/orchestrator.py` + `services/agent_runner.py` — enforce model override at run time for Free users
- `POST /projects/{id}/shares` + `POST /projects/{id}/share-links` — enforce sharing gate
- `routers/admin.py` (new) — `PATCH /admin/users/{id}/plan`, `GET /admin/users/{id}`
- `dependencies.py` — `admin_required` dependency (validates `ADMIN_SECRET` header)
- Alembic migration — `add_plan_fields_to_users`

### Data Models
```
User  (additions)
  plan              PlanTier  default="free"
  plan_expires_at   datetime | null
```

No new tables required.

---

## Billing
- Default currency: **GBP (£)**; user can toggle to **USD ($)**
- Toggle state stored in `localStorage` key `preferred_currency`
- Static exchange rate constant in the frontend config — no live FX API
- When Stripe lands: `currency` param on Checkout session derived from the user's selected currency

## Out of Scope
- Stripe or any payment processing (deferred — the `/pricing` and `/billing` Subscribe CTAs route to a "coming soon" checkout placeholder; the auth-persistence and checkout-intent plumbing is built now so Stripe drops in cleanly later)
- Actual plan changes from the UI — `/pricing` collects intent and routes through auth, but the plan is still only set via the admin API until Stripe lands
- Team or multi-seat plans
- Usage metering (token counts, API call logging)
- Grandfathering — all existing users default to Free on migration
- Email notifications on plan expiry
- Proration, refunds, or invoice history
