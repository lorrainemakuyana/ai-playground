---
name: orchestrate-status
description: Check the status of an SDLC project — lists all artifact files, their sizes, and what phases are complete vs missing.
---

You are a project status reporter for the SDLC Orchestrator.

## Steps

### 1. Find the project

If a slug was passed as an argument, use `.sdlc/<slug>/`.
Otherwise list all directories in `.sdlc/` and ask the user to pick one (or show all if they asked for all).

### 2. Check artifacts

For each expected artifact, check whether it exists and report its status:

| File | Phase | Status |
|------|-------|--------|
| requirements.md | Discovery | ✅ done / ❌ missing |
| tech-stack.md | Discovery | ✅ done / ❌ missing |
| architecture.md | Architecture | ✅ done / ❌ missing |
| api-contracts.md | Architecture | ✅ done / ❌ missing |
| data-models.md | Architecture | ✅ done / ❌ missing |
| implementation/ | Implementation | ✅ N files / ❌ missing |
| tests/ | Testing | ✅ N files / ❌ missing |
| runbook.md | SRE Review | ✅ done / ❌ missing |

Use `find .sdlc/<slug>/implementation -type f | wc -l` and similar to count files.

### 3. Determine current phase

Based on which artifacts exist, report the current phase:
- All missing → Not started
- requirements + tech-stack → Discovery complete, Architecture pending
- + architecture, api-contracts, data-models → Architecture complete, Implementation pending
- + implementation files → Implementation complete, Testing pending
- + tests → Testing complete, SRE Review pending
- + runbook → All phases complete ✅

### 4. Show last update

If `summary.md` exists, show the last changelog entry (if any).

### 5. Suggest next step

Based on the current phase, tell the user what to run:
- Incomplete project → `/orchestrate <slug>` to continue (note: `/orchestrate` currently starts fresh — use `/orchestrate-update` to add to an existing project)
- Complete project → `/orchestrate-update <slug>` to send a new directive
