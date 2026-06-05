# Feature: GitHub Integration

## Goal
Allow users to connect a GitHub Personal Access Token (PAT) to their account and link individual projects to a target GitHub repository. When the Implementation phase completes, generated code is automatically pushed to a feature branch. When the SRE Review phase completes, a pull request is opened against the repo's default branch. Users can also trigger push/PR manually from the project dashboard.

## User Stories
- [ ] As a user, I want to save a GitHub PAT on my account so that the platform can push code on my behalf.
- [ ] As a user, I want to link a project to a GitHub repo so that generated code lands in the right place.
- [ ] As a user, I want generated code auto-pushed to a GitHub branch when the Implementation phase completes so that I don't have to copy-paste output manually.
- [ ] As a user, I want a PR automatically opened against the default branch when the SRE Review phase completes so that I can review and merge with one click.
- [ ] As a user, I want to manually trigger a push or PR from the project dashboard so that I can re-push without re-running the whole pipeline.
- [ ] As a user, I want to see the GitHub push/PR status on the project dashboard so that I know whether the integration succeeded.

## Acceptance Criteria

### Story 1 — PAT management
- [ ] Settings page has a "GitHub" section with a PAT input (write-only: value never echoed back).
- [ ] PAT is stored encrypted at rest (Fernet symmetric encryption, key from env).
- [ ] User can delete the stored PAT.
- [ ] Saving an invalid token (fails GitHub `/user` check) returns a 400 with a clear message.

### Story 2 — Project repo linking
- [ ] Project settings panel has a "GitHub repo" field (`owner/repo` format).
- [ ] Saving a repo slug validates it exists and is accessible with the user's PAT.
- [ ] `github_repo` and `github_branch` (default: `sdlc/<project-id>`) are stored on the Project model.
- [ ] Repo can be cleared/unlinked without affecting past pushes.

### Story 3 — Auto-push on Implementation complete
- [ ] When `current_phase` transitions from `IMPLEMENTATION` → `TESTING`, the backend pushes all agent message content from the IMPLEMENTATION phase to the configured branch via the GitHub API.
- [ ] If no PAT or repo is configured, transition proceeds normally with no push attempt.
- [ ] Push result (`success`, `skipped`, `failed`) is stored on the project and emitted as an SSE event.
- [ ] Branch is created from the repo's default branch if it doesn't exist.

### Story 4 — Auto-PR on SRE Review complete
- [ ] When `current_phase` transitions to `DONE`, a PR is opened from `github_branch` → default branch.
- [ ] PR title: `[SDLC] <project name>` ; body includes project description and a link to the dashboard.
- [ ] If a PR already exists for that branch, the step is skipped (no duplicate).
- [ ] PR URL is stored on the project and displayed on the dashboard.

### Story 5 — Manual trigger
- [ ] Project dashboard shows a "Push to GitHub" button (enabled only when a repo is linked).
- [ ] A separate "Open PR" button appears after a successful push.
- [ ] Both actions call dedicated endpoints and update status inline without full page reload.

### Story 6 — Status visibility
- [ ] Project detail schema includes `github_repo`, `github_branch`, `github_push_status`, `github_pr_url`.
- [ ] Dashboard shows a GitHub status chip: `Not linked` / `Pushed` / `PR open` / `Failed`.
- [ ] Failed state shows the error message in a tooltip.

## Technical Scope

### Frontend (Next.js)
- `app/app/settings/page.tsx` — new GitHub section: PAT input + save/delete, repo field per project.
- `app/app/projects/[id]/page.tsx` (dashboard) — GitHub status chip, "Push to GitHub" and "Open PR" buttons.
- `lib/api.ts` — add `saveGitHubToken`, `deleteGitHubToken`, `linkRepo`, `triggerPush`, `triggerPR` calls.
- New `GitHubStatusChip` component.

### Backend (FastAPI)
- `routers/github.py` — new router with endpoints:
  - `POST /github/token` — save/update PAT (encrypted)
  - `DELETE /github/token` — remove PAT
  - `GET /github/token/status` — returns `{connected: bool}` (never the token)
  - `PATCH /projects/{id}/github` — set/clear `github_repo` + `github_branch`
  - `POST /projects/{id}/github/push` — manual push trigger
  - `POST /projects/{id}/github/pr` — manual PR trigger
- `services/github_service.py` — wraps httpx calls to GitHub REST API v3 for push and PR creation.
- `orchestrator.py` — call `github_service.auto_push` on IMPLEMENTATION→TESTING transition; call `github_service.auto_pr` on transition to DONE.

### Data Models
- `User` — add `github_token_enc: Optional[str]` (Fernet-encrypted PAT).
- `Project` — add:
  - `github_repo: Optional[str]` (`owner/repo`)
  - `github_branch: Optional[str]`
  - `github_push_status: Optional[str]` (`success` | `skipped` | `failed`)
  - `github_push_error: Optional[str]`
  - `github_pr_url: Optional[str]`
- New Alembic migration for both changes.

### Dependencies
- `httpx` (already present) — raw calls to GitHub REST API v3.
- `cryptography` (Fernet) — confirm before adding; likely already a transitive dep.

## Out of Scope
- GitHub OAuth App / OAuth flow (PAT only for now).
- Webhooks from GitHub back to the platform.
- Automatic conflict resolution or rebase logic.
- Support for GitLab, Bitbucket, or other providers.
- Fine-grained repo permission scoping beyond what the PAT allows.
- Pushing binary/non-text assets.

## Open Questions
- None — scope is well-defined. PAT approach chosen over OAuth to avoid callback URL complexity in local dev.
