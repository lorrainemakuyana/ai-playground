# SDLC Orchestrator

An autonomous multi-agent AI engineering team that takes a plain-English project description and self-organizes to execute the full software development lifecycle — from discovery through deployment readiness.

A team of specialized AI agents (tech lead, engineers, QA, SRE) collaborate in real time, with full visibility through a web dashboard and the option to direct the team mid-project.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript strict, Tailwind CSS |
| Backend | FastAPI, SQLModel, SQLite (WAL mode), Alembic |
| AI | Anthropic Claude API (streaming) |
| Real-time | Server-Sent Events (SSE) |

```
ai-playground/
├── docs/
│   ├── ARCHITECTURE.md   # System design, API contracts, data models
│   ├── DESIGN_SPEC.md    # UI/UX spec, component hierarchy, design tokens
│   └── PLAN.md           # Feature plan, user stories, acceptance criteria
├── backend/              # FastAPI app
│   ├── routers/          # API endpoints
│   ├── services/         # Orchestrator, agent runner, prompt builder, file parser
│   ├── models/           # SQLModel ORM models and Pydantic schemas
│   └── tests/            # pytest test suite
│       ├── routers/
│       └── services/
├── frontend/             # Next.js app
│   ├── app/              # App Router pages
│   ├── components/       # Shared UI components
│   ├── hooks/            # Custom React hooks (SSE, etc.)
│   ├── lib/              # API client and utilities
│   └── tests/            # Jest test suite
│       ├── components/
│       └── lib/
└── .claude/skills/       # Claude Code slash commands
```

For detailed documentation see the [`docs/`](./docs) folder.

## Agent Roles

- **Tech Lead** — decomposes the project into tasks, delegates to agents, reviews outputs, and handles user directives
- **Engineer 1 & 2** — implement tasks in parallel (any language appropriate to the task)
- **QA Engineer** — writes test plans, validates engineer output, returns failures with actionable feedback
- **SRE** — reviews deployment readiness, infrastructure concerns, and reliability risks

## Prerequisites

- Python 3.11+
- Node.js 18+
- An Anthropic API key

## Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-test.txt
```

Create a `.env` file in the `backend/` directory:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

Run the API server:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Run the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`. The frontend proxies API requests to `http://localhost:8000`.

## Running Tests

Run both backend and frontend tests with a single command from the project root:

```bash
./run_tests.sh
```

### Backend tests only

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

### Frontend tests only

```bash
cd frontend
npm test -- --passWithNoTests
```

## Claude Code Skills

The project includes Claude Code slash commands that run the full SDLC pipeline directly from your terminal without the web UI.

| Command | Description |
|---|---|
| `/orchestrate` | Launch the full SDLC pipeline for a new project |
| `/orchestrate-update` | Send a directive to an in-progress project |
| `/orchestrate-status` | Check which phases and artifacts are complete |

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `backend/.env` | Required — your Anthropic API key |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Optional — backend URL (defaults to `http://localhost:8000`) |
