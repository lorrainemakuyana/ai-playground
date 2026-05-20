# ARCHITECTURE.md
# Multi-Agent SDLC Orchestrator

> **Target audience:** Implementation agents and engineers building this system.
> Every section is authoritative. Deviations require explicit justification.

---

## Table of Contents

1. [System Diagram](#1-system-diagram)
2. [API Contracts](#2-api-contracts)
3. [Data Models](#3-data-models)
4. [Service Contracts](#4-service-contracts)
5. [Key Decisions](#5-key-decisions)

---

## 1. System Diagram

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                    │
│                                                                         │
│   ┌─────────────────────────┐     ┌─────────────────────────────────┐  │
│   │   Next.js App Router    │     │      EventSource (SSE)          │  │
│   │   (React Components)    │     │  GET /projects/{id}/stream      │  │
│   │                         │     │  Content-Type: text/event-stream│  │
│   │  /                      │     └──────────────┬──────────────────┘  │
│   │  /projects/[id]         │                    │ persistent           │
│   │  /projects/[id]/agents  │                    │ HTTP connection      │
│   │  /projects/[id]/preview │                    │                      │
│   │  /agents                │                    │                      │
│   └────────────┬────────────┘                    │                      │
└────────────────┼────────────────────────────────┼──────────────────────┘
                 │ REST (fetch)                    │
                 │ HTTP/1.1 JSON                   │
                 │ proxied via Next.js /api rewrite│
┌────────────────▼────────────────────────────────▼──────────────────────┐
│                         FastAPI (Python 3.11+)                          │
│                         uvicorn, asyncio event loop                     │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                          Routers                                │    │
│  │  projects.py │ agents.py │ tasks.py │ stream.py                │    │
│  │  agent_templates.py      │ downloads.py                        │    │
│  └──────────────────────────────┬─────────────────────────────────┘    │
│                                 │                                       │
│  ┌──────────────────────────────▼─────────────────────────────────┐    │
│  │                          Services                               │    │
│  │                                                                  │    │
│  │  orchestrator.py   agent_runner.py   prompt_builder.py          │    │
│  │  ─────────────     ───────────────   ───────────────────        │    │
│  │  Phase FSM         Claude API calls  Dynamic prompts            │    │
│  │  Message routing   Streaming         Role templates             │    │
│  │  asyncio.Queue     Prompt caching    Specializations            │    │
│  │  Directive handler                                              │    │
│  │                                                                  │    │
│  │  file_parser.py                                                 │    │
│  │  ──────────────                                                 │    │
│  │  Parses <file path="..."> tags from agent output for zip export │    │
│  └──────────────────────────────┬─────────────────────────────────┘    │
│                                 │                                       │
│  ┌──────────────────────────────▼─────────────────────────────────┐    │
│  │                       Data Layer                                │    │
│  │  SQLModel (SQLAlchemy core) + aiosqlite                         │    │
│  └──────────────────────────────┬─────────────────────────────────┘    │
│                                 │                                       │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │
          ┌───────────────────────▼──────────────────────────┐
          │                   SQLite DB                       │
          │              ./data/orchestrator.db               │
          │  (WAL mode enabled for concurrent reads+writes)   │
          └──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        Anthropic Claude API                              │
│                    (api.anthropic.com/v1/messages)                       │
│                                                                          │
│   Tech Lead:   claude-opus-4-6   (complex reasoning, architecture)       │
│   Engineer-1:  claude-sonnet-4-6 (implementation)                        │
│   Engineer-2:  claude-sonnet-4-6 (implementation)                        │
│   QA:          claude-sonnet-4-6 (test generation, review)               │
│   SRE:         claude-sonnet-4-6 (infra, reliability review)             │
│   Custom:      claude-sonnet-4-6 (dynamic roles, overridable per agent)  │
│                                                                          │
│   FastAPI → Anthropic SDK (async) → streaming responses                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### SSE Stream Data Flow

```
FastAPI /projects/{id}/stream
         │
         │  asyncio.Queue per project (in-memory, process-local)
         │
         ▼
  OrchestratorService.publish(project_id, event)
         │
         ├─── AgentMessage saved to SQLite
         ├─── Task status updated in SQLite
         └─── Event pushed to Queue
                    │
                    ▼
         StreamingResponse (text/event-stream)
         iterates queue, formats SSE:
           data: {"type": "agent_message",     "payload": {...}}\n\n
           data: {"type": "task_update",        "payload": {...}}\n\n
           data: {"type": "phase_change",       "payload": {...}}\n\n
           data: {"type": "agent_status",       "payload": {...}}\n\n
           data: {"type": "task_output_chunk",  "payload": {...}}\n\n
           data: {"type": "heartbeat",          "payload": {...}}\n\n
                    │
                    ▼
         Browser EventSource
         onmessage handler → React state update → re-render
```

### SDLC Phase State Machine

```
  DISCOVERY ──► ARCHITECTURE ──► IMPLEMENTATION ──► TESTING ──► SRE_REVIEW ──► DONE
      │               │                 │               │            │
      └───────────────┴─────────────────┴───────────────┴────────────┘
                              (paused at any phase)
                              (re-opened on user directive if DONE)
```

### User Directive Flow

```
User types directive in TaskFeed input
         │
         ▼
POST /projects/{id}/directive  { content: string }
         │
         ▼
orchestrator.handle_user_directive()
  ├── If project.status == DONE → re-open (set ACTIVE)
  ├── Create Task: "User Directive" → assigned to tech lead
  └── dispatch_task() → tech lead runs
              │
              ▼
  tech lead response parsed for <delegate role="...">...</delegate> tags
              │
              ▼
  Sub-tasks created and dispatched to named agent roles automatically
```

---

## 2. API Contracts

### Base URL
- Development: `http://localhost:8000`
- All endpoints: no authentication required (local-first tool)
- All request/response bodies: `application/json`
- SSE endpoint: `text/event-stream`

---

### POST /projects

Creates a new project and initializes the default agent team from active templates.

**Request (Pydantic):**
```python
class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=10)
```

**Response:** `201 Created`
```typescript
type CreateProjectResponse = {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "done";
  current_phase: SDLCPhase;    // always "discovery" on creation
  created_at: string;          // ISO 8601
  agents: Agent[];
  tasks: Task[];
  messages: AgentMessage[];
}
```

---

### GET /projects

Returns all projects, newest first.

**Response:** `200 OK` — `{ projects: ProjectSummary[] }`

---

### GET /projects/{id}

Returns full project detail with agents, tasks, and last 100 messages.

**Response:** `200 OK` — full `Project`

**Errors:** `404` project not found

---

### GET /projects/{id}/stream

SSE stream. Connection stays open until project reaches `done` or client disconnects.

**Response:** `text/event-stream`

```typescript
type SSEEvent =
  | { type: "agent_message";     payload: AgentMessage }
  | { type: "task_update";       payload: Task }
  | { type: "phase_change";      payload: { project_id: string; new_phase: SDLCPhase } }
  | { type: "agent_status";      payload: { agent_id: string; status: AgentStatus } }
  | { type: "task_output_chunk"; payload: { task_id: string; chunk: string; reset: boolean } }
  | { type: "heartbeat";         payload: { timestamp: string } }   // every 15s
  | { type: "error";             payload: { message: string } }
```

---

### POST /projects/{id}/directive

Sends a user directive to the tech lead. Re-opens the project if its status is `done`.

**Request:**
```python
class DirectiveRequest(BaseModel):
    content: str   # non-empty after strip
```

**Response:** `202 Accepted` — the newly created directive `Task`

---

### POST /projects/{id}/dispatch-next

Manually dispatches the next pending task (used by the Resume button).

**Response:** `200 OK` — the dispatched `Task`

---

### GET /projects/{id}/download

Returns a `.zip` of all project artifacts, including source files parsed from `<file path="...">` tags in task outputs and phase-structured markdown summaries.

**Response:** `application/zip` with `Content-Disposition: attachment`

---

### GET /projects/{id}/docs/{doc_type}

Returns a single generated document for the preview page.

**Path param:** `doc_type` — one of `architecture`, `implementation`, `testing`, `sre`

**Response:** `200 OK` — `{ content: string }` (markdown)

---

### GET /projects/{id}/preview-info

Returns metadata for the preview page.

**Response:** `200 OK` — `{ project_name: string; available_docs: string[] }`

---

### GET /projects/{id}/tasks

Returns all tasks, optionally filtered.

**Query params:** `?phase=implementation&status=in-progress`

**Response:** `200 OK` — `{ tasks: Task[] }`

---

### PATCH /projects/{id}/tasks/{task_id}

Updates a task's status, output, or assignment.

**Request:**
```python
class UpdateTaskRequest(BaseModel):
    status: TaskStatus | None = None
    output: str | None = None
    assigned_agent_id: str | None = None
    model_config = ConfigDict(extra="forbid")
```

**Response:** `200 OK` — updated `Task`

---

### POST /projects/{id}/tasks/{task_id}/retry

Retries a failed task.

**Response:** `200 OK` — updated `Task`

---

### POST /projects/{id}/tasks/{task_id}/cancel

Cancels a pending or in-progress task.

**Response:** `200 OK` — updated `Task`

---

### GET /projects/{id}/agents

Returns all non-archived agents for a project.

**Response:** `200 OK` — `Agent[]`

---

### POST /projects/{id}/agents

Adds a custom agent to an existing project.

**Request:**
```python
class CreateAgentRequest(BaseModel):
    role: AgentRole = AgentRole.CUSTOM
    specialization: str = Field(..., min_length=1, max_length=200)
    model_name: str = "claude-sonnet-4-6"
    system_prompt: str | None = None   # generated from specialization if None
```

**Response:** `201 Created` — `Agent`

---

### PATCH /projects/{id}/agents/{agent_id}

Updates an agent's specialization, model, or system prompt.

**Response:** `200 OK` — updated `Agent`

---

### DELETE /projects/{id}/agents/{agent_id}

Archives (soft-deletes) an agent.

**Response:** `204 No Content`

---

### GET /agent-templates

Returns all active default agent templates.

**Response:** `200 OK` — `AgentTemplate[]`

---

### POST /agent-templates

Creates a new default agent template.

**Request:**
```python
class CreateAgentTemplateRequest(BaseModel):
    role: AgentRole
    specialization: str
    model_name: str = "claude-sonnet-4-6"
    system_prompt: str | None = None
```

**Response:** `201 Created` — `AgentTemplate`

---

### PATCH /agent-templates/{id}

Updates a template's model, system prompt, or active status.

**Request:**
```python
class UpdateAgentTemplateRequest(BaseModel):
    specialization: str | None = None
    model_name: str | None = None
    system_prompt: str | None = None
    is_active: bool | None = None
```

**Response:** `200 OK` — updated `AgentTemplate`

---

### DELETE /agent-templates/{id}

Archives a template (`is_active = False`). Tech Lead cannot be archived.

**Response:** `204 No Content`

---

## 3. Data Models

### Python — Enums

```python
# models/enums.py

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
    IDLE    = "idle"
    WORKING = "working"
    BLOCKED = "blocked"
    DONE    = "done"

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
```

> **Important:** SQLAlchemy stores enum values by Python NAME (e.g. `TECH_LEAD`, `IN_PROGRESS`) not by value (`tech-lead`, `in-progress`). Raw SQL inserts must use the uppercase name.

---

### Python — SQLModel Table Models

```python
# models/db.py

class Project(SQLModel, table=True):
    id: str                          # UUID
    name: str
    description: str
    status: ProjectStatus            # default ACTIVE
    current_phase: SDLCPhase         # default DISCOVERY
    created_at: datetime

class Agent(SQLModel, table=True):
    id: str                          # UUID
    project_id: str                  # FK → projects.id
    role: AgentRole
    specialization: str
    model_name: str                  # e.g. "claude-opus-4-6"
    system_prompt: str | None        # stored at creation; merged with base role prompt at runtime
    status: AgentStatus              # default IDLE
    is_template_agent: bool          # True if seeded from a template
    is_archived: bool                # soft delete

class AgentTemplate(SQLModel, table=True):
    id: str                          # UUID
    role: AgentRole
    specialization: str
    model_name: str                  # tech-lead default: "claude-opus-4-6"
    system_prompt: str | None        # optional user-defined persona/context
    is_active: bool
    created_at: datetime

class Task(SQLModel, table=True):
    id: str                          # UUID
    project_id: str                  # FK → projects.id
    assigned_agent_id: str | None    # FK → agents.id
    role: AgentRole | None           # role hint before assignment
    phase: SDLCPhase
    title: str
    description: str
    status: TaskStatus               # default PENDING
    output: str | None
    created_at: datetime
    updated_at: datetime

class AgentMessage(SQLModel, table=True):
    id: str                          # UUID
    project_id: str                  # FK → projects.id
    from_agent_id: str               # FK → agents.id
    to_agent_id: str | None          # FK → agents.id; None = broadcast
    content: str
    timestamp: datetime
```

---

### Python — Pydantic Response Schemas

```python
# models/schemas.py

class AgentSchema(BaseModel):
    id: str
    project_id: str
    role: AgentRole
    specialization: str
    model_name: str
    status: AgentStatus
    is_template_agent: bool
    is_archived: bool
    # system_prompt intentionally excluded from API responses

class AgentTemplateSchema(BaseModel):
    id: str
    role: AgentRole
    specialization: str
    model_name: str
    system_prompt: str | None
    is_active: bool
    created_at: datetime

class TaskSchema(BaseModel):
    id: str
    project_id: str
    assigned_agent_id: str | None
    role: AgentRole | None
    phase: SDLCPhase
    title: str
    description: str
    status: TaskStatus
    output: str | None
    created_at: datetime
    updated_at: datetime

class AgentMessageSchema(BaseModel):
    id: str
    project_id: str
    from_agent_id: str
    to_agent_id: str | None
    content: str
    timestamp: datetime

class ProjectDetailSchema(BaseModel):
    id: str; name: str; description: str
    status: ProjectStatus; current_phase: SDLCPhase; created_at: datetime
    agents: list[AgentSchema]; tasks: list[TaskSchema]; messages: list[AgentMessageSchema]

class ProjectSummarySchema(BaseModel):
    id: str; name: str; status: ProjectStatus; current_phase: SDLCPhase
    created_at: datetime; agent_count: int; task_count: int

class DirectiveRequest(BaseModel):
    content: str   # stripped, non-empty
```

---

### TypeScript — Frontend Interfaces

```typescript
// types/index.ts

export type SDLCPhase =
  | "discovery" | "architecture" | "implementation"
  | "testing"   | "sre_review"   | "done";

export type AgentRole =
  | "tech-lead" | "engineer-1" | "engineer-2"
  | "qa"        | "sre"        | "custom";

export type AgentStatus   = "idle" | "working" | "blocked" | "done";
export type TaskStatus    = "pending" | "in-progress" | "review" | "done" | "failed" | "cancelled";
export type ProjectStatus = "active" | "paused" | "done";

export interface Agent {
  id: string; project_id: string; role: AgentRole;
  specialization: string; model_name: string; status: AgentStatus;
  is_template_agent: boolean; is_archived: boolean;
}

export interface AgentTemplate {
  id: string; role: AgentRole; specialization: string;
  model_name: string; system_prompt: string | null;
  is_active: boolean; created_at: string;
}

export interface Task {
  id: string; project_id: string; assigned_agent_id: string | null;
  role: AgentRole | null; phase: SDLCPhase; title: string; description: string;
  status: TaskStatus; output: string | null; created_at: string; updated_at: string;
}

export interface AgentMessage {
  id: string; project_id: string; from_agent_id: string;
  to_agent_id: string | null; content: string; timestamp: string;
}

export interface Project {
  id: string; name: string; description: string; status: ProjectStatus;
  current_phase: SDLCPhase; created_at: string;
  agents: Agent[]; tasks: Task[]; messages: AgentMessage[];
}

export interface ProjectSummary {
  id: string; name: string; status: ProjectStatus; current_phase: SDLCPhase;
  created_at: string; agent_count: number; task_count: number;
}

export type SSEEvent =
  | { type: "agent_message";     payload: AgentMessage }
  | { type: "task_update";       payload: Task }
  | { type: "phase_change";      payload: { project_id: string; new_phase: SDLCPhase } }
  | { type: "agent_status";      payload: { agent_id: string; status: AgentStatus } }
  | { type: "task_output_chunk"; payload: { task_id: string; chunk: string; reset: boolean } }
  | { type: "heartbeat";         payload: { timestamp: string } }
  | { type: "error";             payload: { message: string } };
```

---

## 4. Service Contracts

### services/orchestrator.py

Phase state machine, message routing, SSE event queues, user directive handling.

Key functions:
- `start_project(project_id, session)` — seeds discovery tasks, dispatches first task to tech lead
- `advance_phase(project_id, session)` — transitions to next phase, seeds tasks, publishes `phase_change`
- `dispatch_task(task, session)` — assigns task to agent, fires `agent_runner.run_agent_task()` as background asyncio.Task
- `handle_agent_output(task_id, agent_id, output, session)` — persists output, checks phase completion, parses `<delegate>` tags to create sub-tasks
- `handle_agent_failure(task_id, agent_id, error, session)` — sets `FAILED`/`BLOCKED`, publishes error SSE
- `handle_user_directive(project_id, content, session)` — re-opens done projects, creates directive task, dispatches immediately
- `publish_event(project_id, event)` — pushes to `asyncio.Queue`
- `stream_events(project_id)` — async generator yielding SSE strings with 15s heartbeats

**Delegate tag pattern:**
```python
_DELEGATE_RE = re.compile(
    r'<delegate\s+role=["\']([^"\']+)["\']>(.*?)</delegate>', re.DOTALL
)
# Parsed from tech lead output → sub-tasks created and dispatched automatically
```

---

### services/agent_runner.py

Wraps Anthropic SDK. Handles streaming, prompt caching, retries.

```python
MODEL_TECH_LEAD = "claude-opus-4-6"
MODEL_DEFAULT   = "claude-sonnet-4-6"
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0  # seconds, exponential
```

- `run_agent_task(agent, task, project, conversation_history, session)` — streams Claude response; callbacks into orchestrator on completion or failure
- `get_model_for_agent(agent)` — returns `agent.model_name` (stored per-agent from template at creation)
- `build_messages_for_task(task, project, conversation_history)` — builds messages array with full project context
- `get_conversation_history(agent_id, project_id, session)` — reconstructs turns from `AgentMessage` records

Prompt caching: system prompt sent with `cache_control: {"type": "ephemeral"}`. TTL is 5 minutes.

---

### services/prompt_builder.py

Generates system prompts at agent creation time. Stored in `agents.system_prompt`, never regenerated after creation.

- `build_system_prompt(role, specialization, project)` — base template + role instructions; user-defined `system_prompt` from template is prepended
- `get_role_instructions(role)` — static per-role instructions
- `build_custom_agent_prompt(specialization, project)` — infers responsibilities from specialization string

---

### services/file_parser.py

Parses `<file path="...">content</file>` tags from agent task outputs.

- `parse_files(output)` → `list[{path: str, content: str}]`
- Used by `downloads.py` to populate the project zip with actual source files alongside markdown summaries

---

## 5. Key Decisions

### Decision 1: SSE vs WebSockets
SSE chosen because all real-time data flows server → browser. Built-in browser reconnection, works through proxies without config, natively supported by FastAPI `StreamingResponse`. User input goes via REST (`POST /directive`) — no bidirectional stream needed.

### Decision 2: SQLite vs PostgreSQL
SQLite with WAL mode. Zero setup, file-based, single-user local tool. WAL allows concurrent reads (SSE stream) during writes (orchestrator). Migration to PostgreSQL requires only a connection URL change — no model or query changes.

### Decision 3: Model Tiering (claude-opus-4-6 / claude-sonnet-4-6)
Tech Lead uses `claude-opus-4-6` for highest-complexity reasoning: interpreting requirements, designing architecture, decomposing work, reviewing all agent outputs. All other roles use `claude-sonnet-4-6` for 3–5× cost/latency savings on scoped tasks.

Model is stored per-agent and per-template, overridable from the Manage Team page (`/agents`). A single constant change in `agent_runner.py` can fall all agents back to Sonnet.

### Decision 4: Prompt Caching
`cache_control: {"type": "ephemeral"}` on system prompts. System prompts are 300–800 tokens, identical across all API calls for a given agent — ideal stable cache prefix. Cache hits reduce input token cost ~90%. TTL is 5 minutes.

### Decision 5: asyncio Background Tasks
`asyncio.create_task()` within FastAPI — no Celery, Redis, or external queue. Agent tasks are I/O-bound; asyncio handles concurrent I/O efficiently. Compatible with in-process `asyncio.Queue` powering SSE. Trade-off: in-flight tasks lost on process crash; `FAILED` tasks need manual retry.

### Decision 6: Soft Delete
`is_archived` / `is_active` flags instead of hard deletes. Preserves referential integrity for tasks and messages referencing archived agents/templates.

---

## Appendix: Directory Structure

```
ai-playground/
├── docs/
│   ├── ARCHITECTURE.md     ← this file
│   ├── DESIGN_SPEC.md
│   └── PLAN.md
├── backend/
│   ├── main.py
│   ├── database.py         # Engine, session factory, migrations, template seeding
│   ├── models/
│   │   ├── db.py           # SQLModel table models
│   │   ├── enums.py        # All enums
│   │   └── schemas.py      # Pydantic request/response schemas
│   ├── routers/
│   │   ├── projects.py     # POST/GET /projects
│   │   ├── agents.py       # CRUD /projects/{id}/agents
│   │   ├── tasks.py        # CRUD + directive + dispatch
│   │   ├── stream.py       # SSE /projects/{id}/stream
│   │   ├── agent_templates.py  # CRUD /agent-templates
│   │   └── downloads.py    # /download, /docs/{type}, /preview-info
│   ├── services/
│   │   ├── orchestrator.py
│   │   ├── agent_runner.py
│   │   ├── prompt_builder.py
│   │   └── file_parser.py
│   ├── tests/
│   │   ├── routers/
│   │   └── services/
│   └── data/
│       └── orchestrator.db     # SQLite (gitignored)
├── frontend/
│   ├── app/
│   │   ├── page.tsx                        # / — project list
│   │   ├── agents/page.tsx                 # /agents — default team management
│   │   └── projects/[id]/
│   │       ├── page.tsx                    # dashboard
│   │       ├── agents/page.tsx             # per-project team
│   │       └── preview/page.tsx            # doc preview
│   ├── components/
│   │   ├── PhaseTracker.tsx
│   │   ├── AgentCard.tsx
│   │   ├── TaskFeed.tsx
│   │   ├── AgentOutputDrawer.tsx
│   │   ├── StatusBadge.tsx
│   │   └── Spinner.tsx
│   ├── hooks/useProjectStream.ts
│   ├── lib/api.ts
│   ├── lib/utils.ts
│   ├── types/index.ts
│   └── tests/
│       ├── components/
│       └── lib/
├── .claude/skills/         # Claude Code slash commands
├── CLAUDE.md               # Claude Code standing instructions
├── README.md
├── start.sh
└── run_tests.sh
```

---

*Document version: 2.0 — updated 2026-05-19*
