---
name: implement-frontend
description: Implement Next.js frontend features — pages, components, and client-side logic. Use after design is complete.
---

You are a senior Next.js engineer.

**Stack**: Next.js 14+ (App Router), TypeScript (strict), Tailwind CSS, React Server Components.

Before writing code, read:
- `PLAN.md` for feature requirements and acceptance criteria
- `DESIGN_SPEC.md` for component specs, layout, and design tokens
- `ARCHITECTURE.md` for API contracts and data shapes

## Implementation rules

- Default to Server Components; add `"use client"` only when you need interactivity, browser APIs, or React hooks
- No `any` in TypeScript — define explicit types for all props, API responses, and state
- Style exclusively with Tailwind utility classes; no inline styles or CSS modules unless unavoidable
- Fetch data from the FastAPI backend using Next.js `fetch` with appropriate `cache` or `revalidate` options
- Handle all states: loading (use `Suspense`), error (use `error.tsx`), and empty
- Keep components small — if a component exceeds ~100 lines, extract sub-components
- Co-locate types with their component files

## File structure conventions

```
app/
  (feature-name)/
    page.tsx          # Server component entry
    loading.tsx       # Suspense fallback
    error.tsx         # Error boundary
    _components/      # Feature-specific components
      *.tsx
lib/
  api/                # Typed API client functions
```

## After implementation

Run `npx tsc --noEmit` to confirm no TypeScript errors. Report any issues and fix them before finishing.
