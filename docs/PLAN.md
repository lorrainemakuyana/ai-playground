# Feature: AI Engineering Team — SDLC Agent Orchestrator

## Goal
Build a fully autonomous multi-agent engineering team where the user describes a project and a team of specialized AI agents (tech lead, 2 engineers, QA tester, SRE) self-organizes to execute the full SDLC — from discovery through deployment readiness. The system exists in two layers: Claude Code skills for daily terminal use, and a Next.js + FastAPI web app for project visibility, real-time agent monitoring, dynamic team composition, and live user direction of the team at any point during or after a project run.

---

## User Stories

### Original Stories
- [x] As a user, I want to describe a project in plain English so that my AI team autonomously plans and executes the full SDLC without manual intervention.
- [x] As a user, I want a tech lead agent to decompose my project into tasks and assign them to the right agents so that work is organized and sequenced correctly.
- [x] As a user, I want two software engineer agents working in parallel so that implementation is faster and independent tasks don't block each other.
- [x] As a user, I want a QA agent to write tests and validate completed work so that quality is maintained automatically.
- [x] As a user, I want an SRE agent to review infrastructure, deployment, and reliability so that the project is production-ready before delivery.
- [x] As a user, I want to tell the tech lead to add a new specialist agent mid-project so that I can extend the team for any project's unique needs.
- [x] As a user, I want a web dashboard showing real-time agent activity and SDLC phase progress so that I have full visibility without reading terminal output.
- [x] As a user, I want to invoke any agent via a Claude Code skill so that I can use the team without opening the web app.

### New Stories (added during development)
- [x] As a user, I want to send directives to the team at any time — even after a project is marked done — so that I can refine, extend, or redirect work without restarting.
- [x] As a user, I want the tech lead to interpret my directive and automatically delegate sub-tasks to the right agents using `<delegate>` tags, so that I don't have to manually assign work.
- [x] As a user, I want to filter the task feed by agent so I can focus on one agent's work without noise from the rest of the team.
- [x] As a user, I want selected agents to be visually highlighted with their role color so that I always know which agent I'm filtering by.
- [x] As a user, I want to define a custom system prompt for each default agent so that I can shape each agent's persona, expertise, and behavior before starting a project.
- [x] As a user, I want to download my completed project as a zip file so that I can use the generated artifacts outside the tool.
- [x] As a user, I want a preview of generated project documents (architecture, design, implementation notes) in the browser so that I don't have to download to inspect the output.
- [x] As a user, I want to manage my default team of agents (add, edit, archive) in a dedicated page so that every new project starts with the right team composition.
- [x] As a user, I want to resume a stalled project with a single button click so that I don't lose work when agents stop mid-run.
- [x] As a user, I want to run all tests (backend and frontend) with a single command so that I can verify the system quickly.
- [x] As a user, I want to start both servers with a single command so that local setup is fast and friction-free.

---

## Acceptance Criteria

### Story 1 — Project kickoff
- [x] User can submit a project name + description via web UI
- [x] Tech lead agent produces a project plan (phases, tasks, assignments) within one round-trip to the Claude API
- [x] SDLC phases are tracked in order: Discovery → Architecture → Implementation → Testing → SRE Review → Done
- [x] Project is persisted in SQLite and accessible via URL

### Story 2 — Tech lead orchestration
- [x] Tech lead breaks project into discrete tasks with clear titles, descriptions, and expected outputs
- [x] Each task is assigned to an agent role (engineer-1, engineer-2, qa, sre)
- [x] Tech lead reviews agent outputs before marking a phase complete
- [x] Tech lead can send feedback to an agent to revise their output
- [x] Tech lead parses `<delegate role="...">` tags in its own output to create and dispatch sub-tasks automatically

### Story 3 — Parallel engineer agents
- [x] Two engineer agents can execute separate tasks concurrently via parallel Claude API calls
- [x] Engineers work in any programming language appropriate to the task
- [x] Engineer output (code, configs, docs) is stored as task artifacts accessible to other agents

### Story 4 — QA agent
- [x] QA agent receives completed implementation tasks and their artifacts
- [x] QA produces a test plan and test cases for each task
- [x] QA outputs a pass/fail report with specific, actionable feedback

### Story 5 — SRE agent
- [x] SRE reviews deployment configs, infrastructure concerns, and reliability risks
- [x] SRE produces a readiness report before final delivery

### Story 6 — Dynamic agent addition
- [x] User can add a new custom agent to a project via the web UI
- [x] New agent appears in the dashboard and can be assigned pending or new tasks

### Story 7 — Web dashboard
- [x] Project list page shows all projects with current phase and status
- [x] Project detail page shows all agents, their status, and latest output in real time via SSE
- [x] SDLC phase tracker shows which phase is active (amber pulsing dot), which are complete (green check), and which are upcoming (muted dot)
- [x] Clicking a task opens the agent output drawer with full output and message history
- [x] Clicking an agent card filters the task feed to that agent's tasks (with a dismissible filter pill)
- [x] Selected agent card is highlighted with its role color
- [x] Live connection status indicator (green "Live" / red "Reconnecting...") in the task feed header
- [x] Connection-lost banner with a "Retry connection" button
- [x] Directive input pinned to the bottom of the task feed — sends messages to the tech lead at any time
- [x] Resume button appears when agents are idle but pending tasks exist
- [x] Download button appears when project status is done

### Story 8 — Claude Code skills
- [x] `/orchestrate` skill launches the full SDLC pipeline (Discovery → Architecture → Implementation → Testing → SRE Review) and writes output to `.sdlc/<project-slug>/`
- [x] `/orchestrate-update` skill sends a directive to an in-progress project and the tech lead delegates to the right agents
- [x] `/orchestrate-status` skill checks which phases and artifacts are complete

### Story 9 — User directives (new)
- [x] User can send a directive message at any time from the task feed input
- [x] If the project is marked done, sending a directive automatically re-opens it
- [x] Tech lead receives the directive as a new task and responds by delegating via `<delegate role="...">` tags
- [x] Sub-tasks parsed from delegate tags are created and dispatched immediately

### Story 10 — Agent task feed filtering (new)
- [x] Clicking an agent card filters the task feed to only that agent's tasks
- [x] Clicking the same agent card again clears the filter
- [x] A dismissible filter pill shows the active filter label
- [x] Clicking the pill's × clears the filter

### Story 11 — System prompt per agent template (new)
- [x] Edit form in Manage Team includes a resizable monospace textarea for System Prompt
- [x] System prompt is optional — empty field saves as null
- [x] A 2-line preview of the system prompt appears in the read view when one is set
- [x] System prompt is passed to the Claude API as the agent's system context at runtime

### Story 12 — Project downloads and preview (new)
- [x] Completed project can be downloaded as a `.zip` file containing all task artifacts and a generated README
- [x] Preview page shows generated architecture and design documents in the browser
- [x] Download endpoint generates phase-structured markdown files for architecture, implementation, testing, and SRE outputs

### Story 13 — Default team management (new)
- [x] Dedicated `/agents` page lists all active default agent templates
- [x] Each template shows role, model, and a truncated system prompt preview
- [x] Templates can be edited (model, system prompt) and archived
- [x] Tech lead template cannot be archived (only edited)
- [x] New custom agent templates can be added via an inline form
- [x] Templates are seeded automatically on first run

### Story 14 — Developer tooling (new)
- [x] `run_tests.sh` — runs backend (pytest) and frontend (jest) test suites with a single command
- [x] `start.sh` — activates venv, installs all dependencies, and starts both servers with labeled, interleaved log output; Ctrl+C stops both cleanly
- [x] Backend tests organized under `backend/tests/routers/` and `backend/tests/services/`
- [x] Frontend tests organized under `frontend/tests/components/` and `frontend/tests/lib/`

---

## Technical Scope

### Frontend (Next.js)

**Routes**
- `app/page.tsx` — project list with inline new-project form; "Manage Team" button in header
- `app/projects/[id]/page.tsx` — project dashboard: phase tracker, agent cards, task feed, output drawer
- `app/projects/[id]/agents/page.tsx` — per-project team view (add/archive custom agents)
- `app/projects/[id]/preview/page.tsx` — browser preview of generated project documents
- `app/agents/page.tsx` — default team management (global agent templates)

**Components**
- `PhaseTracker` — horizontal stepper with amber pulsing dot (current), green check (done), muted dot (upcoming)
- `AgentCard` — role avatar, status badge, current task title, latest output snippet; click to filter task feed; selected state uses role color
- `TaskFeed` — live task list (newest first), agent filter pill, directive input pinned to bottom
- `AgentOutputDrawer` — slide-out panel with full task output (no horizontal scroll), message history, retry/cancel actions
- `StatusBadge` — color-coded badge for project/agent/task status
- `Spinner` — loading indicator

**Lib**
- `lib/api.ts` — typed fetch client for all backend endpoints
- `lib/utils.ts` — `getInitials`, `agentBorderClass`, `agentAvatarClass`, `agentSelectedClass`
- `hooks/useProjectStream.ts` — SSE hook managing connection lifecycle (connected / reconnecting / failed)

### Backend (FastAPI)

**Endpoints**
- `POST   /projects` — create project, kick off tech lead async
- `GET    /projects` — list all projects (summary)
- `GET    /projects/{id}` — project detail with agents, tasks, messages
- `GET    /projects/{id}/stream` — SSE stream of agent events
- `GET    /projects/{id}/tasks` — tasks filtered by phase/status
- `PATCH  /projects/{id}/tasks/{task_id}` — update task status or output
- `POST   /projects/{id}/tasks/{task_id}/retry` — retry a failed task
- `POST   /projects/{id}/tasks/{task_id}/cancel` — cancel a task
- `POST   /projects/{id}/directive` — send a user directive to the tech lead
- `POST   /projects/{id}/dispatch-next` — manually dispatch the next pending task
- `GET    /projects/{id}/download` — download project as zip
- `GET    /projects/{id}/docs/{doc_type}` — fetch a specific generated document
- `GET    /projects/{id}/preview-info` — metadata for the preview page
- `GET    /projects/{id}/agents` — list project agents
- `POST   /projects/{id}/agents` — add a custom agent to a project
- `PATCH  /projects/{id}/agents/{agent_id}` — update agent (specialization, model, system prompt)
- `DELETE /projects/{id}/agents/{agent_id}` — archive an agent
- `GET    /agent-templates` — list default agent templates
- `POST   /agent-templates` — create a new template
- `PATCH  /agent-templates/{id}` — update template (model, system prompt)
- `DELETE /agent-templates/{id}` — archive a template

**Services**
- `services/orchestrator.py` — routes messages between agents, manages phase transitions, parses `<delegate>` tags, handles user directives (re-opens done projects, creates and dispatches directive tasks)
- `services/agent_runner.py` — wraps Claude API streaming calls with per-role system prompts; merges user-defined system prompt with base role prompt
- `services/prompt_builder.py` — generates system prompts dynamically for custom agent roles
- `services/file_parser.py` — parses `<file path="...">` tags from agent output to extract artifacts for the zip download

### Data Models

- `Project` — id, name, description, status (active/paused/done), current_phase, created_at
- `Agent` — id, project_id, role (enum), specialization, model_name, system_prompt, status (idle/working/blocked/done), is_template_agent, is_archived
- `AgentTemplate` — id, role (enum), specialization, model_name, system_prompt, is_active, created_at
- `Task` — id, project_id, assigned_agent_id, phase (enum), title, description, status (pending/in-progress/review/done/failed/cancelled), output, created_at, updated_at
- `AgentMessage` — id, project_id, from_agent_id, to_agent_id (nullable = broadcast), content, timestamp

**Notes**
- SQLAlchemy stores Python enum values by NAME (uppercase, e.g. `TECH_LEAD`) not value (`tech-lead`) — raw SQL inserts must match
- WAL mode enabled on SQLite for concurrent reads during streaming
- Agent model has no `created_at` — ordering is by `is_template_agent DESC`

### Claude Code Skills

| Skill | Path | Purpose |
|---|---|---|
| `/orchestrate` | `.claude/skills/orchestrate/` | Full SDLC pipeline — Discovery → SRE Review; output to `.sdlc/<slug>/` |
| `/orchestrate-update` | `.claude/skills/orchestrate-update/` | Send directive to existing project; tech lead delegates via `<delegate>` tags |
| `/orchestrate-status` | `.claude/skills/orchestrate-status/` | Report which phases and artifacts are complete |
| `/plan` | `.claude/skills/plan/` | Product planning assistant — produces PLAN.md and creates branch |
| `/design` | `.claude/skills/design/` | Architect — produces ARCHITECTURE.md and DESIGN_SPEC.md in parallel |
| `/implement-backend` | `.claude/skills/implement-backend/` | FastAPI implementation guided by PLAN.md and ARCHITECTURE.md |
| `/implement-frontend` | `.claude/skills/implement-frontend/` | Next.js implementation guided by PLAN.md and DESIGN_SPEC.md |
| `/test` | `.claude/skills/test/` | Test engineer — writes and runs backend + frontend tests |
| `/simplify` | `.claude/skills/simplify/` | Code review — reuse, quality, and efficiency checks via parallel agents |
| `/setup-cicd` | `.claude/skills/setup-cicd/` | CI/CD pipeline setup |
| `/deploy` | `.claude/skills/deploy/` | Deployment helper |

### Developer Tooling

- `start.sh` — one-command local startup: creates venv, installs all deps, starts both servers with labeled log output; Ctrl+C stops both cleanly
- `run_tests.sh` — one-command test runner: backend pytest + frontend jest with pass/fail summary; exits non-zero on any failure (CI-safe)

---

## Out of Scope

- Executing or running the generated code (agents produce artifacts only)
- Git integration or automatic PR/commit creation
- Multi-user support or authentication
- Cost tracking or token usage reporting per agent
- Voice input or chat-style UI
- CI/CD pipeline integration (covered separately by `/setup-cicd` skill)

---

## Open Questions (resolved)

1. **State persistence** — SQLite (WAL mode) chosen for local-first simplicity. ✓
2. **Agent parallelism in skills** — parallel engineer agents use the `Agent` tool spawns inside skills. ✓
3. **Tech lead model** — configurable per template; defaults to Sonnet 4.6, can be upgraded to Opus 4.7 in Manage Team. ✓
4. **Skill context sharing** — skills write output to `.sdlc/<project-slug>/` at the project root; added to `.gitignore`. ✓
