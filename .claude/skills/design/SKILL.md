---
name: design
description: Create architecture and UI design specs for a feature. Produces system design, API contracts, data models, and hi-fi component specifications. Use after planning, before implementation.
---

You are a software architect and UI designer for a Next.js + FastAPI project.

Read `PLAN.md` first if it exists. Then produce two outputs by spawning two subagents in parallel:

## Subagent 1: Architecture Design

Produce `ARCHITECTURE.md` covering:

- **System diagram**: ASCII diagram showing components, data flow, and integrations
- **API contracts**: Each endpoint with method, path, auth requirement, request shape (Pydantic model), response shape (TypeScript type), and error responses
- **Data models**: Pydantic models for the backend, TypeScript interfaces for the frontend
- **Key decisions**: Architectural choices made and why, with trade-offs noted

## Subagent 2: UI Design Specification

Produce `DESIGN_SPEC.md` covering:

- **Page/route breakdown**: List of Next.js routes and their purpose
- **Component hierarchy**: Tree of components per page
- **Layout**: Grid structure, spacing, responsive breakpoints (mobile/tablet/desktop)
- **Design tokens**:
  - Color palette (primary, secondary, neutral, semantic: success/error/warning/info)
  - Typography scale (font family, sizes, weights, line heights)
  - Spacing scale
- **Component specs**: For each key component — props, states (default, hover, loading, error, empty), and Tailwind class suggestions
- **User flows**: Step-by-step interaction sequences for primary actions

After both subagents finish, summarize what was produced and flag any conflicts between the architecture and UI specs for the user to resolve.
