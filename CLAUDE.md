# Claude Instructions

## Skill auto-selection

Read every user prompt and invoke the most appropriate skill **before** doing anything else. Do not ask for confirmation — just invoke it. Use the mapping below.

| When the user asks about… | Invoke |
|---|---|
| Planning a new feature, defining requirements, writing user stories | `/plan` |
| System design, architecture, API contracts, data models, UI specs | `/design` |
| Building or changing backend code (FastAPI, endpoints, models, services) | `/implement-backend` |
| Building or changing frontend code (Next.js, components, pages, hooks) | `/implement-frontend` |
| Writing or running tests, test coverage, fixing test failures | `/test` |
| Deploying, opening a PR, pushing a branch | `/deploy` |
| Setting up CI/CD, GitHub Actions, Netlify, Render | `/setup-cicd` |
| Starting a brand-new project end-to-end with the full AI team | `/orchestrate` |
| Sending a new requirement or change to an in-progress project | `/orchestrate-update` |
| Checking what phases or artifacts are complete for a project | `/orchestrate-status` |

### Judgment rules

- If the prompt touches **both** backend and frontend, invoke `/implement-backend` first, then `/implement-frontend` when it finishes.
- If the prompt is ambiguous between planning and design, prefer `/plan` — design follows naturally.
- If the prompt is a question or a debugging request with no new feature work, skip skill invocation and answer directly.
- If the prompt is clearly a whole new project (not a feature inside this repo), prefer `/orchestrate`.

## Project context

- **Backend**: FastAPI, Python 3.11+, SQLModel/SQLAlchemy async, SQLite WAL, Alembic — lives in `backend/`
- **Frontend**: Next.js 14 App Router, TypeScript strict, Tailwind CSS — lives in `frontend/`
- **Tests**: backend in `backend/tests/`, frontend in `frontend/tests/`
- **Skills**: `.claude/skills/` — each has a `SKILL.md` with full instructions
- **Start servers**: `./start.sh`
- **Run all tests**: `./run_tests.sh`

## Knowledge graph

- `graphify-out/graph.json` is pre-built — **never re-extract the full codebase**. Use it directly.
- At the start of every session, run `graphify query "<question>"` to answer codebase questions instead of reading files manually.
- To update the graph after code changes, run `graphify extract . --update` (incremental only).

## Security rules

- Never print, log, or reveal the value of any environment variable, API key, secret, or token — not in responses, not in commit messages, not in files.
- If a command or tool output exposes a key or secret, redact it before showing the user.

## Commit rules

- Never add `Co-Authored-By: Claude` trailers to commit messages.
- Always run `./run_tests.sh` before pushing any commits. Fix all failures before pushing.
- Before opening or updating a PR, confirm tests pass locally.
