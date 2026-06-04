# Graph Report - .  (2026-05-25)

## Corpus Check
- Corpus is ~44,596 words - fits in a single context window. You may not need a graph.

## Summary
- 633 nodes · 1100 edges · 55 communities (47 shown, 8 thin omitted)
- Extraction: 80% EXTRACTED · 20% INFERRED · 0% AMBIGUOUS · INFERRED: 218 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Architecture & SDLC Docs|Architecture & SDLC Docs]]
- [[_COMMUNITY_Data Models & Schemas|Data Models & Schemas]]
- [[_COMMUNITY_Orchestrator Service|Orchestrator Service]]
- [[_COMMUNITY_Agent Management UI|Agent Management UI]]
- [[_COMMUNITY_Auth & Sharing Pages|Auth & Sharing Pages]]
- [[_COMMUNITY_Auth Dependencies & Access Control|Auth Dependencies & Access Control]]
- [[_COMMUNITY_Frontend Runtime Dependencies|Frontend Runtime Dependencies]]
- [[_COMMUNITY_Agent & Template Tests|Agent & Template Tests]]
- [[_COMMUNITY_Project Detail UI|Project Detail UI]]
- [[_COMMUNITY_Frontend TypeScript Config|Frontend TypeScript Config]]
- [[_COMMUNITY_Prompt Builder Service|Prompt Builder Service]]
- [[_COMMUNITY_Backend Python Dependencies|Backend Python Dependencies]]
- [[_COMMUNITY_Downloads & File Parser|Downloads & File Parser]]
- [[_COMMUNITY_CLAUDE.md & CICD Config|CLAUDE.md & CI/CD Config]]
- [[_COMMUNITY_Archived Projects UI|Archived Projects UI]]
- [[_COMMUNITY_App Home & New Project|App Home & New Project]]
- [[_COMMUNITY_Task Router Tests|Task Router Tests]]
- [[_COMMUNITY_Auth Router & Service|Auth Router & Service]]
- [[_COMMUNITY_Active Project Card|Active Project Card]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 54|Community 54]]

## God Nodes (most connected - your core abstractions)
1. `SDLCPhase` - 29 edges
2. `AgentRole` - 29 edges
3. `AgentStatus` - 29 edges
4. `TaskStatus` - 29 edges
5. `ProjectStatus` - 29 edges
6. `Architecture Document` - 23 edges
7. `compilerOptions` - 16 edges
8. `get_owned_project()` - 15 edges
9. `SDLC Orchestrator` - 14 edges
10. `fetchJSON()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `CI Workflow (ci.yml)` --semantically_similar_to--> `run_tests.sh`  [INFERRED] [semantically similar]
  .github/workflows/ci.yml → README.md
- `test_archive_template()` --calls--> `next`  [INFERRED]
  backend/tests/routers/test_agent_templates.py → frontend/package.json
- `test_update_template_agent_forbidden()` --calls--> `next`  [INFERRED]
  backend/tests/routers/test_agents.py → frontend/package.json
- `test_delete_template_agent_forbidden()` --calls--> `next`  [INFERRED]
  backend/tests/routers/test_agents.py → frontend/package.json
- `detect_project_type()` --calls--> `next`  [INFERRED]
  backend/services/file_parser.py → frontend/package.json

## Hyperedges (group relationships)
- **SDLC Pipeline: Agents, Orchestrator, and Phase FSM working together** — concept_sdlc_pipeline, docs_architecture_orchestrator_service, docs_architecture_sdlc_phase_fsm, readme_tech_lead_agent, readme_engineer_agents, readme_qa_agent, readme_sre_agent [EXTRACTED 1.00]
- **Real-time SSE flow: asyncio.Queue, OrchestratorService, SSE endpoint, and frontend hook** — concept_asyncio_queue, docs_architecture_orchestrator_service, docs_architecture_sse_stream, docs_plan_use_project_stream [EXTRACTED 1.00]
- **CI/CD: CI workflow, frontend deploy, backend deploy form deployment pipeline** — workflow_ci, workflow_deploy_frontend, workflow_deploy_backend [EXTRACTED 1.00]

## Communities (55 total, 8 thin omitted)

### Community 0 - "Architecture & SDLC Docs"
Cohesion: 0.05
Nodes (53): asyncio.Queue (per-project in-memory event queue), SDLC Pipeline (Discovery→Architecture→Implementation→Testing→SRE→Done), Architecture Document, AgentMessage DB Model, Agent DB Model, AgentRunnerService, AgentTemplate DB Model, asyncio Background Tasks (no Celery/Redis) (+45 more)

### Community 1 - "Data Models & Schemas"
Cohesion: 0.19
Nodes (38): BaseModel, Enum, Agent, AgentMessage, AgentTemplate, _new_uuid(), Project, ProjectShare (+30 more)

### Community 2 - "Orchestrator Service"
Cohesion: 0.09
Nodes (38): advance_phase(), cancel_task(), _dispatch_phase_start_tasks(), dispatch_task(), get_or_create_queue(), get_phase_task_templates(), handle_agent_failure(), handle_agent_output() (+30 more)

### Community 3 - "Agent Management UI"
Cohesion: 0.09
Nodes (26): AgentCard(), AgentCardProps, EditState, NewAgentState, ROLE_LABELS, ROLES, AgentCard(), AgentCardProps (+18 more)

### Community 4 - "Auth & Sharing Pages"
Cohesion: 0.09
Nodes (24): Props, addAgent(), ApiError, archiveAgent(), archiveAgentTemplate(), createAgentTemplate(), fetchJSON(), getAgentTemplates() (+16 more)

### Community 5 - "Auth Dependencies & Access Control"
Cohesion: 0.09
Nodes (26): get_accessible_project(), get_owned_project(), Fetch a project and verify the current user owns it., Fetch a project accessible to the current user (owner or active collaborator)., archive_agent(), create_agent(), update_agent(), archive_project() (+18 more)

### Community 6 - "Frontend Runtime Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, react, react-dom, sonner, @stackblitz/sdk, devDependencies, autoprefixer, jest (+20 more)

### Community 7 - "Agent & Template Tests"
Cohesion: 0.08
Nodes (9): next, test_archive_template(), _create_custom_agent(), test_delete_custom_agent(), test_delete_template_agent_forbidden(), test_update_agent_model(), test_update_agent_specialization(), test_update_agent_system_prompt() (+1 more)

### Community 8 - "Project Detail UI"
Cohesion: 0.21
Nodes (15): AgentOutputDrawerProps, ConnectionStatus, useProjectStream(), UseProjectStreamOptions, ProjectDashboardPage(), cancelTask(), dispatchNextTask(), retryTask() (+7 more)

### Community 9 - "Frontend TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "Prompt Builder Service"
Cohesion: 0.19
Nodes (18): build_system_prompt(), get_role_instructions(), Return role-specific instruction string., Build a complete system prompt for a given role, specialization, and project., _make_project(), Build an unsaved Project instance for unit testing (no DB needed)., test_build_system_prompt_custom_includes_specialization(), test_build_system_prompt_engineer_1() (+10 more)

### Community 11 - "Backend Python Dependencies"
Cohesion: 0.12
Nodes (18): Backend Python Requirements, Backend Test Requirements, Alembic Migrations, bcrypt (Password Hashing), httpx AsyncClient (Test HTTP Client), Netlify Deployment, Pydantic v2 Schemas, pytest-asyncio (Async Test Framework) (+10 more)

### Community 12 - "Downloads & File Parser"
Cohesion: 0.24
Nodes (15): download_doc(), download_project_zip(), _load(), _phase_markdown(), preview_info(), _readme(), _slug(), default_start_command() (+7 more)

### Community 14 - "CLAUDE.md & CI/CD Config"
Cohesion: 0.18
Nodes (15): FastAPI Backend, Next.js 14 Frontend, Judgment Rules, Project Context, Skill Auto-Selection Rules, Deploy Skill, Design Skill, Implement Backend Skill (+7 more)

### Community 15 - "Archived Projects UI"
Cohesion: 0.20
Nodes (8): Props, PhaseTrackerProps, deleteProject(), getProject(), unarchiveProject(), ALL_PHASES, PHASE_LABELS, SDLCPhase

### Community 16 - "App Home & New Project"
Cohesion: 0.15
Nodes (6): Props, createProject(), getProjects(), logout(), removeMyShare(), ProjectSummary

### Community 17 - "Task Router Tests"
Cohesion: 0.22
Nodes (9): _create_project_with_task(), Helper: create project and insert a task directly via session., test_cancel_done_task_rejected(), test_cancel_pending_task(), test_list_tasks_phase_filter(), test_list_tasks_returns_tasks(), test_list_tasks_status_filter(), test_retry_failed_task() (+1 more)

### Community 18 - "Auth Router & Service"
Cohesion: 0.22
Nodes (9): get_current_user(), login(), register(), _set_auth_cookie(), create_access_token(), decode_token(), hash_password(), Raises JWTError on invalid/expired token. (+1 more)

### Community 19 - "Active Project Card"
Cohesion: 0.15
Nodes (7): Props, CLASSES, Status, { container }, archiveProject(), ProjectStatus, TaskStatus

### Community 21 - "Community 21"
Cohesion: 0.20
Nodes (6): TaskFeedProps, mockTask, onTaskClick, task2, taskNoRole, user

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (10): graphify-out/graph.json, Knowledge Graph Instructions, Security Rules, ANTHROPIC_API_KEY Secret, graphify CLI Tool, update-graph Job, Commit Updated Graph Step, Install graphify Step (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.31
Nodes (8): build_messages_for_task(), get_conversation_history(), get_model_for_agent(), get_system_prompt(), Run an agent task with retry logic and streaming output chunks., Build the messages list for an agent task call., Retrieve and format conversation history for an agent., run_agent_task()

### Community 24 - "Community 24"
Cohesion: 0.31
Nodes (6): client(), _make_client_context(), _make_null_session_factory(), Return an async context manager that yields a no-op AsyncMock session., Client with real get_current_user — use for testing auth endpoints., raw_client()

### Community 25 - "Community 25"
Cohesion: 0.32
Nodes (4): init_db(), _migrate(), _seed_templates(), lifespan()

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (5): AddAgentModalProps, defaultProps, onClose, onSubmit, user

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (5): cleanup(), log(), ok(), warn(), start.sh script

### Community 28 - "Community 28"
Cohesion: 0.53
Nodes (5): _hash(), _now(), Seed the database with test users, projects, and sharing scenarios.  Usage (from, run(), _seed_agents()

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (4): clearToken(), getToken(), isAuthenticated(), setToken()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (5): compilerOptions, jsx, types, extends, include

## Knowledge Gaps
- **125 isolated node(s):** `config`, `nextConfig`, `config`, `extends`, `types` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Agent & Template Tests` to `Downloads & File Parser`, `Frontend Runtime Dependencies`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `detect_project_type()` connect `Downloads & File Parser` to `Agent & Template Tests`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend Runtime Dependencies` to `Agent & Template Tests`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `SDLCPhase` (e.g. with `User` and `AgentTemplate`) actually correct?**
  _`SDLCPhase` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 26 inferred relationships involving `AgentRole` (e.g. with `User` and `AgentTemplate`) actually correct?**
  _`AgentRole` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 26 inferred relationships involving `AgentStatus` (e.g. with `User` and `AgentTemplate`) actually correct?**
  _`AgentStatus` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 26 inferred relationships involving `TaskStatus` (e.g. with `User` and `AgentTemplate`) actually correct?**
  _`TaskStatus` has 26 INFERRED edges - model-reasoned connections that need verification._