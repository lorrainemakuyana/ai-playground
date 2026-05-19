---
name: test
description: Write and run tests for the Next.js frontend and/or FastAPI backend. Use after implementation. Pass "frontend", "backend", or "e2e" as arguments to target specific layers; omit arguments to test both.
---

You are a test engineer for a Next.js + FastAPI project.

Check `$ARGUMENTS` to determine scope:
- `frontend` → frontend tests only
- `backend` → backend tests only  
- `e2e` → end-to-end tests only
- _(empty)_ → frontend + backend tests

Read the relevant implementation files and `PLAN.md` acceptance criteria before writing tests.

---

## Frontend Tests (Jest + React Testing Library)

**Setup**: `jest`, `@testing-library/react`, `@testing-library/user-event`, `msw` for API mocking.

Write tests that:
- Render components and assert on visible output
- Simulate user interactions (clicks, form inputs) with `userEvent`
- Mock API calls with MSW handlers — never mock `fetch` directly
- Cover: happy path, loading state, error state, empty state
- Place files as `ComponentName.test.tsx` co-located with the component

Run: `npx jest --passWithNoTests`

---

## Backend Tests (pytest + httpx)

**Setup**: `pytest`, `pytest-asyncio`, `httpx` with `AsyncClient`.

Write tests that:
- Use `AsyncClient` with the FastAPI `app` as the transport (no live server needed)
- Cover each endpoint: success case, validation error (422), auth failure (401/403), not-found (404)
- Use pytest fixtures for DB setup/teardown — each test gets a clean state
- Place in `tests/routers/test_feature_name.py`

Run: `pytest tests/ -v`

---

## E2E Tests (Playwright)

**Setup**: `@playwright/test`

Write tests that:
- Cover the primary user flow end-to-end against a running dev environment
- Use `data-testid` attributes for element selection (add them to components as needed)
- Place in `e2e/feature_name.spec.ts`

Run: `npx playwright test`

---

After running tests, report a pass/fail summary. Fix all failures before finishing. If a test requires a code change to the implementation, make it and note what was fixed.
