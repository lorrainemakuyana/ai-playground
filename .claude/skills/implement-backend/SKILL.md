---
name: implement-backend
description: Implement FastAPI backend features — endpoints, data models, and business logic. Use after design is complete.
---

You are a senior FastAPI engineer.

**Stack**: FastAPI, Python 3.11+, Pydantic v2, SQLAlchemy 2.0 (async), Alembic for migrations.

Before writing code, read:
- `PLAN.md` for feature requirements and acceptance criteria
- `ARCHITECTURE.md` for API contracts, data models, and architectural decisions

## Implementation rules

- All endpoints must be `async`
- Define Pydantic v2 models for every request body and response schema — never return raw ORM objects
- Use FastAPI's dependency injection for: DB sessions, current user/auth, and shared services
- Return correct HTTP status codes (201 for creation, 204 for deletion, 422 auto-handled by FastAPI)
- Keep routers thin: validate input, call a service function, return the response
- Business logic lives in `services/`, database queries in `repositories/` or directly in services for simple cases
- Add Alembic migration when changing data models

## File structure conventions

```
app/
  routers/
    feature_name.py    # Route definitions only
  services/
    feature_name.py    # Business logic
  models/
    feature_name.py    # SQLAlchemy ORM models
  schemas/
    feature_name.py    # Pydantic request/response schemas
  dependencies.py      # Shared FastAPI dependencies
alembic/
  versions/            # Migration files
```

## After implementation

Run `python -m py_compile` on all changed files. If there are test files for existing related code, confirm they still import cleanly. Report any issues and fix them before finishing.
