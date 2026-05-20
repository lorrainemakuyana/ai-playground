# Feature: Project Sharing + Archiving

## Goal
Allow project owners to share their projects with up to 5 collaborators via email invite or shareable link. Collaborators get view + interact access. Owners can revoke access; revoked collaborators see the project greyed out in their list and can delete it from their view (with confirmation). Owners can archive their own projects (hiding them by default) and permanently delete them only after archiving. The project list is sectioned: active → archived (hidden by default, togglable) → no-longer-accessible shared projects (shown by default, after divider).

## User Stories
- [ ] As an owner, I want to invite a collaborator by email so they can access my project.
- [ ] As an owner, I want to generate a shareable link so I can share without knowing their email.
- [ ] As an owner, I want to see and revoke collaborator access so I control who can interact with my project.
- [ ] As an owner, I want to archive my project so it's hidden from my active list but not lost.
- [ ] As an owner, I want to permanently delete an archived project so I can clean up.
- [ ] As a collaborator, I want to see when my access is revoked so I know I can no longer interact.
- [ ] As a collaborator, I want to remove a revoked project from my list (with confirmation) so my list stays clean.
- [ ] As any user, I want to join a project via a share link so I don't need a direct invite.

## Acceptance Criteria

### Sharing
- [ ] Max 5 active (non-revoked) collaborators per project; 6th invite returns 422
- [ ] Email invite: POST `/projects/{id}/shares` — stored as pending if user not yet registered
- [ ] Duplicate email invite returns 409; owner cannot invite themselves
- [ ] Shareable link: POST `/projects/{id}/share-link` — idempotent, returns same token if one exists
- [ ] GET `/projects/join/{token}` adds authenticated user as collaborator; unauthenticated → redirect to `/auth?next=/app/projects/join/{token}`
- [ ] DELETE `/projects/{id}/share-link` invalidates token
- [ ] Owner can GET `/projects/{id}/shares` (lists all, including pending)
- [ ] Owner can DELETE `/projects/{id}/shares/{share_id}` — sets `revoked_at`, does NOT delete record

### Revoked access (collaborator view)
- [ ] Revoked projects appear in collaborator's project list, visually greyed out, no clickable link
- [ ] A "Remove" button is shown; clicking it requires confirmation dialog ("This cannot be undone")
- [ ] Confirming deletes the ProjectShare record entirely and removes the card
- [ ] Revoked collaborators get 403 on all project endpoints

### Own project lifecycle
- [ ] PATCH `/projects/{id}/archive` — sets `archived_at`; project disappears from active list
- [ ] DELETE `/projects/{id}` — only allowed if `archived_at` is set; hard-deletes project + all related data; returns 422 if not archived
- [ ] Archived projects hidden by default; "Show archived projects" toggle reveals them
- [ ] Archived project cards show an "Archived" badge and a "Delete permanently" button (with confirmation)

### Project list layout
- [ ] Section 1: active own + active shared projects (default view)
- [ ] Horizontal divider + "Show archived projects" toggle (only rendered if user has ≥1 archived project)
- [ ] Section 2: archived own projects (hidden until toggle is on)
- [ ] Horizontal divider "Projects you no longer have access to" (only rendered if user has ≥1 revoked share)
- [ ] Section 3: revoked-share project cards (greyed out, Remove button only, shown by default)

### Seed data
- [ ] Running `python seed.py` populates DB with 3 users and varied project states for manual testing

## Technical Scope

### Frontend (Next.js)
- Update `app/app/page.tsx`: section layout, archived toggle, dividers
- Update `ProjectCard`: collaborator count badge, greyed-out revoked variant, archived badge + delete button
- `ShareModal` in `app/app/projects/[id]/_components/ShareModal.tsx`
- Share button (owner-only) wired into project detail page
- `app/app/projects/join/[token]/page.tsx` — join-via-link handler
- New API functions: `getShares`, `inviteByEmail`, `removeShare`, `getShareLink`, `revokeShareLink`, `joinViaLink`, `archiveProject`, `deleteProject`, `removeRevokedShare`

### Backend (FastAPI)
- `POST   /projects/{id}/shares` — invite by email (owner, ≤5 active collaborators)
- `GET    /projects/{id}/shares` — list shares (owner)
- `DELETE /projects/{id}/shares/{share_id}` — revoke (sets revoked_at)
- `POST   /projects/{id}/share-link` — get/create share token (owner)
- `DELETE /projects/{id}/share-link` — invalidate token (owner)
- `GET    /projects/join/{token}` — join via link (authenticated)
- `PATCH  /projects/{id}/archive` — archive own project (owner)
- `DELETE /projects/{id}` — hard-delete archived project (owner)
- `DELETE /projects/{id}/my-share` — collaborator removes their own revoked-share record
- Update `GET /projects` — return own + shared + revoked, with `share_status` field
- New `get_accessible_project` dependency (owner or active collaborator)
- New `require_owner` dependency (owner only)

### Data Models

```
ProjectShare
  id             str (uuid, PK)
  project_id     str (FK → projects.id)
  user_id        str | null (FK → users.id) — null until invited user registers
  invited_email  str
  invite_method  str  ("email" | "link")
  joined_at      datetime | null
  revoked_at     datetime | null
  created_at     datetime

ProjectShareLink
  id          str (uuid, PK)
  project_id  str (FK → projects.id, unique)
  token       str (unique, random 32-byte hex)
  created_at  datetime

Project  (additions)
  archived_at  datetime | null
```

### Seed data (`backend/seed.py`)
- User A: 3 own projects (1 active, 1 shared-with-B, 1 archived)
- User B: 2 own projects (1 active, 1 with revoked access from A)
- User C: 1 project shared with B (active collaborator)
- Pre-set passwords so they're usable in the UI

## Out of Scope
- Email notifications for invites or revocation
- Role tiers beyond owner / collaborator
- Collaborators re-sharing a project
- Project transfer (changing owner)
- Restoring a revoked share without a new invite
- Un-archiving a project (archive is a one-way gate to deletion)
