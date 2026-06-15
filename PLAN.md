# Feature: Agent Context Summarisation & Master Role Prompts

## Goal

Improve agent output quality and reduce token waste by giving every agent a compact, structured project-context block at the start of each task (replacing the raw full-message dump), and by replacing the current thin placeholder system prompts with authoritative master role prompts for all five default agent roles. Master prompts define each agent's identity, responsibilities, output format, quality bar, and tone. They are merged with any user-supplied system prompt from the AgentTemplate. A read-only "Base prompt" disclosure on the Agents page lets users inspect the master prompt for each role.

---

## User Stories

- [ ] **US-1** As an agent, I want to receive a concise, structured summary of the project state so that I have the full context I need without being overwhelmed by raw message history.
- [ ] **US-2** As a tech lead agent, I want a detailed role prompt that tells me exactly how to decompose work, when to delegate, and what format to produce so that my output is consistently high quality.
- [ ] **US-3** As an engineer, QA, or SRE agent, I want a detailed role prompt that defines my responsibilities, output format, and quality bar so that my output is production-ready on the first attempt.
- [ ] **US-4** As a user who has written a custom system prompt for an agent template, I want my custom additions to extend — not replace — the master prompt so that the agent keeps its role identity.
- [ ] **US-5** As a user browsing agent templates, I want to read the base prompt for each role so that I understand what the agent is capable of and what I'm extending when I customise it.

---

## Acceptance Criteria

### US-1 — Project context block

- [ ] A new `build_project_context(project, tasks, agent_role, session)` function in `services/context_builder.py` produces a markdown-formatted block ≤ 400 tokens (measured with `tiktoken` or approximated at 4 chars/token) containing:
  - Project name, description, current phase.
  - A one-line summary of each completed phase (e.g. "✓ Discovery: Requirements captured, stack chosen: FastAPI + Next.js").
  - Relevant prior task outputs for the calling agent's role (last 3 tasks in the same role, truncated to 300 tokens each if needed).
  - A section listing tasks assigned to this agent that are `done` or `in-progress`.
- [ ] Context is cached in an in-process dict keyed by `(project_id, phase)` and invalidated on phase change.
- [ ] `build_messages_for_task()` in `agent_runner.py` prepends this context block to the user message instead of the current minimal header.
- [ ] Raw conversation history (`get_conversation_history`) is still passed through but capped: only the last 10 messages are included (to stay within context windows for long-running projects).
- [ ] All existing `run_agent_task` tests continue to pass.

### US-2 — Tech Lead master prompt

- [ ] `services/agent_prompts.py` defines `MASTER_PROMPTS[AgentRole.TECH_LEAD]` as a multi-paragraph string covering:
  - **Identity**: Principal tech lead, strategic decision-maker, team coordinator.
  - **Responsibilities**: Decompose project into phases and tasks; assign to the right role; review agent output; make architectural decisions; handle user directives.
  - **Delegation format** (required section): explain `<delegate role="...">...</delegate>` tags with valid roles, when to use them (delegate only when the task genuinely requires another specialist), and that the full task description must be self-contained in the tag body.
  - **Output format**: structured markdown with clear headings; decisions recorded with rationale.
  - **Quality bar**: decisions must be justified; no hand-waving; if ambiguous, state assumptions explicitly.
  - **Tone**: direct, opinionated, clear. Avoid filler phrases.

### US-3 — Engineer, QA, SRE master prompts

- [ ] `MASTER_PROMPTS[AgentRole.ENGINEER_1]` and `[AgentRole.ENGINEER_2]` cover:
  - Identity (senior software engineer), language-agnostic.
  - File output format: `<file path="...">complete contents</file>` — no truncation, no placeholders.
  - Expectations: include all config files, make code run with a single install command.
  - Quality bar: production-quality, with error handling, input validation, and tests where asked.
  - Tone: precise, minimal commentary; let the code speak.

- [ ] `MASTER_PROMPTS[AgentRole.QA]` covers:
  - Identity (QA engineer / test strategist).
  - Responsibilities: write test plans, test cases, and runnable test code.
  - Output format: markdown test plan + `<file>` blocks for test code.
  - Quality bar: tests must be deterministic, isolated, and cover edge cases; include both happy-path and failure scenarios.
  - Tone: methodical, thorough.

- [ ] `MASTER_PROMPTS[AgentRole.SRE]` covers:
  - Identity (site reliability engineer / platform engineer).
  - Responsibilities: review infrastructure, deployment configs, reliability risks, and observability.
  - Output format: readiness report with PASS / WARN / FAIL ratings per area + `<file>` blocks for runbooks/configs.
  - Quality bar: actionable recommendations only; flag blockers vs. nice-to-haves.
  - Tone: risk-focused, concise.

### US-4 — Prompt merging

- [ ] `get_system_prompt(agent)` in `agent_runner.py` is updated to:
  1. Look up `MASTER_PROMPTS.get(agent.role, MASTER_PROMPTS[AgentRole.CUSTOM])`.
  2. If `agent.system_prompt` is set and non-empty, append it after a `\n\n---\n\n## Your Custom Instructions\n\n` separator.
  3. Return the merged string.
- [ ] If `agent.system_prompt` is `None` or empty, the master prompt alone is returned (no separator appended).
- [ ] Existing behaviour is preserved: custom-role agents (`AgentRole.CUSTOM`) use a generic master prompt.
- [ ] Default AgentTemplate seeds (`database.py` or equivalent seeder) set `system_prompt=None` so master prompt alone applies on fresh installs; existing templates in production are not modified by any migration.

### US-5 — Frontend "Base prompt" disclosure

- [ ] The Agents page (`/app/agents`) adds a collapsible "Base prompt" row below each template card.
- [ ] The disclosed content renders the master prompt text in a monospace `<pre>` block (read-only).
- [ ] Master prompt text is served from a new endpoint: `GET /agent-templates/master-prompts` → `{role: string}` dict (no auth required — prompts are not secret).
- [ ] The UI shows "No base prompt" for `CUSTOM` roles with a generic fallback.
- [ ] The disclosure chevron toggles open/closed; state is local (no persistence needed).

---

## Technical Scope

### Backend (FastAPI)

**New files**
- `backend/services/agent_prompts.py` — `MASTER_PROMPTS: dict[AgentRole, str]` constant dict; one entry per role including `CUSTOM` fallback.
- `backend/services/context_builder.py` — `build_project_context(project, all_tasks, agent_role, completed_messages)` → `str`; in-process phase-keyed cache.

**Modified files**
- `backend/services/agent_runner.py`
  - `get_system_prompt(agent)` — merge master + user prompt as described.
  - `build_messages_for_task()` — call `build_project_context` instead of the current minimal header.
  - `get_conversation_history()` — cap result to last 10 messages.
- `backend/routers/agent_templates.py` (or `agents.py`) — add `GET /agent-templates/master-prompts` endpoint.
- `backend/main.py` — no changes expected (router already registered).

**No data model changes** — `AgentTemplate.system_prompt` already exists and is `Optional[str]`.

**No Alembic migration** — no new columns.

### Frontend (Next.js)

**Modified files**
- `frontend/app/app/agents/page.tsx` — add "Base prompt" collapsible section to each template card.
- `frontend/lib/api.ts` — add `getMasterPrompts(): Promise<Record<string, string>>`.
- `frontend/types/index.ts` — add `MasterPrompts` type alias.

### Data Models
- No new tables or columns.

### Dependencies
- No new packages. Token counting approximated at 4 chars/token to avoid adding `tiktoken` as a dependency.

---

## Out of Scope
- Summarising conversation history with a second LLM call (too expensive and slow — structured extraction is used instead).
- Per-agent persistent memory across projects.
- Streaming the context build step to the frontend.
- Changing the phase task templates themselves.
- Editing master prompts from the UI (they are code constants; use the custom system prompt field to extend them).
- Migrating or updating `system_prompt` on existing user-created AgentTemplate rows in production.
