# Feature: AI Engineering Team — SDLC Agent Orchestrator

## Goal
Build a fully autonomous multi-agent engineering team where the user describes a project and a team of specialized AI agents (tech lead, 2 engineers, QA tester, SRE) self-organizes to execute the full SDLC — from discovery through deployment readiness. The system exists in two layers: Claude Code skills for daily terminal use, and a Next.js + FastAPI web app for project visibility, real-time agent monitoring, and dynamic team composition at runtime.

## User Stories
- [ ] As a user, I want to describe a project in plain English so that my AI team autonomously plans and executes the full SDLC without manual intervention.
- [ ] As a user, I want a tech lead agent to decompose my project into tasks and assign them to the right agents so that work is organized and sequenced correctly.
- [ ] As a user, I want two software engineer agents working in parallel so that implementation is faster and independent tasks don't block each other.
- [ ] As a user, I want a QA agent to write tests and validate completed work so that quality is maintained automatically.
- [ ] As a user, I want an SRE agent to review infrastructure, deployment, and reliability so that the project is production-ready before delivery.
- [ ] As a user, I want to tell the tech lead to add a new specialist agent mid-project so that I can extend the team for any project's unique needs.
- [ ] As a user, I want a web dashboard showing real-time agent activity and SDLC phase progress so that I have full visibility without reading terminal output.
- [ ] As a user, I want to invoke any agent via a Claude Code skill so that I can use the team without opening the web app.

## Acceptance Criteria

### Story 1 — Project kickoff
- [ ] User can submit a project name + description via web UI or `/start-project` skill
- [ ] Tech lead agent produces a project plan (phases, tasks, assignments) within one round-trip to the Claude API
- [ ] SDLC phases are tracked in order: Discovery → Architecture → Implementation → Testing → SRE Review → Done
- [ ] Project is persisted in the database and accessible via URL

### Story 2 — Tech lead orchestration
- [ ] Tech lead breaks project into discrete tasks with clear titles, descriptions, and expected outputs
- [ ] Each task is assigned to an agent role (engineer-1, engineer-2, qa, sre)
- [ ] Tech lead reviews agent outputs before marking a phase complete
- [ ] Tech lead can send feedback to an agent to revise their output

### Story 3 — Parallel engineer agents
- [ ] Two engineer agents can execute separate tasks concurrently via parallel Claude API calls
- [ ] Engineers work in any programming language appropriate to the task
- [ ] Engineer output (code, configs, docs) is stored as task artifacts accessible to other agents
- [ ] Either engineer can be reassigned a task by the tech lead

### Story 4 — QA agent
- [ ] QA agent receives completed implementation tasks and their artifacts
- [ ] QA produces a test plan and test cases for each task
- [ ] QA outputs a pass/fail report with specific, actionable feedback
- [ ] Failed tasks are returned to the assigned engineer with QA's report attached

### Story 5 — SRE agent
- [ ] SRE reviews deployment configs, infrastructure concerns, and reliability risks
- [ ] SRE produces a readiness report (green/yellow/red) before final delivery
- [ ] SRE can flag blockers back to the tech lead, which pauses the Done transition

### Story 6 — Dynamic agent addition
- [ ] User can type "add a [role] engineer" to the tech lead (in web UI or skill) mid-project
- [ ] System spawns a new agent with a dynamically-generated system prompt for the specified specialization
- [ ] New agent appears in the dashboard and is assigned pending or new tasks
- [ ] No hard cap on number of agents (soft default: 2 engineers)

### Story 7 — Web dashboard
- [ ] Project list page shows all projects with current phase and status
- [ ] Project detail page shows all agents, their status, and latest output in real time via SSE
- [ ] SDLC phase tracker shows which phase is active and which are complete
- [ ] Clicking a task shows full agent output and message history
- [ ] "Add Agent" button opens a modal with role name input

### Story 8 — Claude Code skills
- [ ] `/start-project <description>` skill launches the full team and writes a project memory file
- [ ] `/tech-lead`, `/engineer`, `/qa`, `/sre` skills work standalone for focused tasks
- [ ] `/add-agent <role>` skill spawns a new agent for the current project context
- [ ] Skills read/write a shared `project-context.md` memory file for cross-agent state

## Technical Scope

### Frontend (Next.js)
- `app/page.tsx` — project list + new project form (name, description, submit)
- `app/projects/[id]/page.tsx` — project dashboard: phase tracker, agent cards, task feed
- `app/projects/[id]/agents/page.tsx` — team management view with Add Agent modal
- Components:
  - `PhaseTracker` — horizontal stepper showing current SDLC phase
  - `AgentCard` — shows agent role, status (idle/working/done), latest output snippet
  - `TaskFeed` — live-updating list of tasks with status badges
  - `AgentOutputDrawer` — slide-out panel with full task output and message history
  - `AddAgentModal` — input for role name, triggers POST /projects/{id}/agents
- Real-time updates via Server-Sent Events (SSE) — no WebSocket dependency

### Backend (FastAPI)
- `POST /projects` — create project, persist, kick off tech lead orchestration async
- `GET /projects` — list all projects
- `GET /projects/{id}` — project detail with phase + agent statuses
- `GET /projects/{id}/stream` — SSE endpoint streaming agent events
- `POST /projects/{id}/agents` — dynamically add a new agent with role/specialization
- `GET /projects/{id}/tasks` — all tasks with status, assigned agent, output
- `PATCH /projects/{id}/tasks/{task_id}` — update task status or reassign
- `services/orchestrator.py` — routes messages between agents, manages phase transitions
- `services/agent_runner.py` — wraps Claude API calls with per-role system prompts
- `services/prompt_builder.py` — generates system prompts dynamically for new agent roles

### Data Models
- `Project` — id, name, description, status (active/paused/done), current_phase (enum), created_at
- `Agent` — id, project_id, role (tech-lead/engineer/qa/sre/custom), specialization (str), system_prompt (text), status (idle/working/blocked/done)
- `Task` — id, project_id, assigned_agent_id, phase (enum), title, description, status (pending/in-progress/review/done/failed), output (text), created_at, updated_at
- `AgentMessage` — id, project_id, from_agent_id, to_agent_id (nullable = broadcast), content, timestamp

### Claude Code Skills (new files)
- `.claude/skills/start-project/` — orchestrates full SDLC, writes `project-context.md`
- `.claude/skills/tech-lead/` — tech lead role: planning, task breakdown, review
- `.claude/skills/engineer/` — software engineer role: implementation in any language
- `.claude/skills/qa/` — QA tester: test plans, test cases, pass/fail reports
- `.claude/skills/sre/` — SRE: infra review, deployment readiness, reliability report
- `.claude/skills/add-agent/` — dynamic agent spawning with generated system prompt

### Auth
- No authentication in this phase — single-user local deployment only

## Out of Scope
- Executing or running the generated code (agents produce artifacts, not run them)
- Git integration or automatic PR/commit creation
- Multi-user support or authentication
- Cost tracking or token usage reporting per agent
- Agent memory persistence across browser sessions (in-memory per project run)
- CI/CD pipeline integration (covered by existing `setup-cicd` skill separately)
- Voice input or chat-style UI (text form only)

---

## Open Questions
1. **State persistence**: Should the database be SQLite (simple, no setup) or PostgreSQL (more production-like)? SQLite recommended for local-first use.
2. **Agent parallelism in skills**: Claude Code skills run in the main session — parallel engineer agents will use `Agent` tool spawns. Is there a concern about context window usage when running 2+ agents simultaneously?
3. **Tech lead model**: Should the tech lead use a more capable model (Opus 4.7) while engineers use Sonnet 4.6 for cost efficiency?
4. **Skill context sharing**: `project-context.md` will be written to the project root. Should it live in `.claude/` instead to avoid polluting the workspace?
