# DESIGN SPEC: Multi-Agent SDLC Orchestrator Dashboard

**Version:** 2.0
**Date:** 2026-05-19
**Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, SSE
**Deployment:** Local, single-user, no auth

---

## 1. Page / Route Breakdown

### `GET /`
**Purpose:** Project list landing page. Create new projects and navigate to existing ones.

**Data fetched:**
- `GET /api/projects` → `{ projects: ProjectSummary[] }`

**Behavior:**
- Empty state when no projects exist
- Inline new-project form (name + description textarea) — submits to `POST /projects`
- "Manage Team" button in header links to `/agents`
- Each project card links to `/projects/[id]`

---

### `GET /projects/[id]`
**Purpose:** Main project dashboard. Phase progress, agent cards, live task feed.

**Data fetched:**
- `GET /api/projects/[id]` → full `Project` (agents, tasks, messages)
- `GET /api/projects/[id]/stream` → SSE (opened on mount, kept alive)

**Behavior:**
- Phase tracker updates in real time on `phase_change` events
- Agent cards update status on `agent_status` events
- Task feed prepends new tasks on `task_update` events; live output streams via `task_output_chunk`
- Clicking an agent card filters the task feed to that agent (click again to clear)
- Clicking a task row opens `AgentOutputDrawer`
- Directive input pinned to bottom of task feed — sends to tech lead at any time; re-opens done projects
- Resume button appears when agents are idle but pending tasks remain
- Download button appears when project status is `done`
- Preview button always visible in top bar

---

### `GET /projects/[id]/preview`
**Purpose:** Browser preview of generated project documents (architecture, implementation, testing, SRE).

**Data fetched:**
- `GET /api/projects/[id]/preview-info` → `{ project_name, available_docs }`
- `GET /api/projects/[id]/docs/{doc_type}` → `{ content: string }` per tab

**Behavior:**
- Tab bar for each available doc type
- Markdown rendered in a scrollable panel

---

### `GET /projects/[id]/agents`
**Purpose:** Per-project team management. View agents, add custom agents, archive.

**Data fetched:**
- `GET /api/projects/[id]` → project metadata
- `GET /api/projects/[id]/agents` → `Agent[]`

**Behavior:**
- "Add Agent" form with role and specialization inputs → `POST /projects/[id]/agents`
- Archive button per agent → `DELETE /projects/[id]/agents/{id}`

---

### `GET /agents`
**Purpose:** Default team management. Edit global agent templates applied to every new project.

**Data fetched:**
- `GET /api/agent-templates` → `AgentTemplate[]`

**Behavior:**
- Lists all active templates
- Click edit icon → inline edit form with Model select and System Prompt textarea
- Tech Lead cannot be archived (edit only)
- "Add Agent" button → inline form (Role select + Model select)
- System prompt preview (2-line truncated) shown in read view when set
- Changes apply to new projects only; existing project agents are unaffected

---

## 2. Component Hierarchy

### `/` — Project List Page

```
RootLayout
└── ProjectListPage
    ├── Header
    │   ├── AppLogo / Title
    │   └── ManageTeamButton → /agents
    ├── NewProjectForm
    │   ├── TextInput (name)
    │   ├── TextareaInput (description)
    │   └── SubmitButton
    └── ProjectList
        ├── EmptyState          (conditional)
        └── ProjectCard[]
            ├── StatusBadge
            ├── PhasePill
            └── Link → /projects/[id]
```

---

### `/projects/[id]` — Project Dashboard

```
ProjectDashboardPage
├── TopBar
│   ├── BackLink → /
│   ├── ProjectName + StatusBadge
│   ├── PreviewButton → /projects/[id]/preview
│   ├── DownloadButton (visible when done)
│   ├── ResumeButton (visible when idle + pending tasks)
│   └── ManageTeamLink → /projects/[id]/agents
├── PhaseTracker
├── ConnectionFailedBanner (conditional)
└── MainContent (flex row on md+)
    ├── AgentColumn (left, fixed 340px)
    │   ├── ColumnHeader ("Team", agent count)
    │   └── AgentCard[] (click to toggle task feed filter)
    └── TaskColumn (right, flex-1)
        └── TaskFeed
            ├── FeedHeader ("Tasks", filter pill, connection indicator)
            ├── TaskList (newest first, scrollable)
            │   └── TaskRow[] (click → AgentOutputDrawer)
            └── DirectiveInput (pinned bottom)
                ├── Textarea (auto-expand, Enter to send)
                └── SendButton
    └── AgentOutputDrawer (slide-in overlay)
        ├── DrawerHeader (task title, close button)
        ├── TaskOutput (monospace, word-wrap, no horizontal scroll)
        ├── MessageHistory
        └── ActionRow (Retry / Cancel buttons)
```

---

### `/agents` — Default Team Management

```
DefaultTeamPage
├── Header
│   ├── BackLink → /
│   └── PageTitle ("Default Engineering Team")
├── SubHeader
│   ├── Description text
│   └── AddAgentButton
└── TemplateList
    └── TemplateCard[] (one per active template)
        ├── RoleAvatar (role-colored initials)
        ├── ReadView (default)
        │   ├── SpecializationName
        │   ├── RoleLabel · ModelLabel
        │   ├── SystemPromptPreview (2-line, monospace, conditional)
        │   └── ActionButtons
        │       ├── EditButton
        │       └── ArchiveButton (hidden for tech-lead)
        └── EditView (when editing)
            ├── ModelSelect
            ├── SystemPromptTextarea (resizable, monospace)
            └── SaveButton / CancelButton (right-aligned)
    └── AddAgentForm (inline, conditional)
        ├── RoleSelect
        ├── ModelSelect
        └── AddButton / CancelButton
```

---

## 3. Layout

### Breakpoints
- `< 768px` (mobile): stacked layout — agent column above task feed
- `≥ 768px` (md): side-by-side — agent column fixed 340px left, task feed fills remaining width

### Project Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│  TopBar (h-14, border-b)                                │
├─────────────────────────────────────────────────────────┤
│  PhaseTracker (border-b)                                │
├─────────────────────────────────────────────────────────┤
│  [ConnectionFailedBanner] (conditional)                 │
├─────────────────────┬───────────────────────────────────┤
│  Agent Column       │  Task Feed                        │
│  (w-340px, border-r)│  (flex-1)                         │
│                     │                                   │
│  AgentCard[]        │  TaskList (scrollable, flex-1)    │
│  (scrollable)       │                                   │
│                     ├───────────────────────────────────┤
│                     │  DirectiveInput (flex-none)        │
└─────────────────────┴───────────────────────────────────┘
```

---

## 4. Design Tokens

### Color Palette

| Token | Tailwind | Usage |
|---|---|---|
| Background | `neutral-950` | Page background |
| Surface | `neutral-900` | Cards, panels |
| Surface raised | `neutral-800` | Inputs, chips |
| Border | `neutral-800` | Default borders |
| Border subtle | `neutral-700` | Input focus |
| Text primary | `neutral-100` | Headings, labels |
| Text secondary | `neutral-400` | Subtitles, metadata |
| Text muted | `neutral-500` / `neutral-600` | Placeholders, empty state |
| Primary | `primary-600` | Buttons, focus rings, active states |
| Primary glow | `shadow-primary-glow` | Working agent card shadow |
| Success | `green-400` | Done status, connection live |
| Warning | `amber-500` / `amber-400` | Pending status, current phase |
| Error | `red-400` | Failed status, connection lost |

### Agent Role Colors

| Role | Avatar | Selected border/bg |
|---|---|---|
| tech-lead | `bg-violet-800 text-violet-200` | `border-violet-500 bg-violet-950` |
| engineer-1 | `bg-blue-800 text-blue-200` | `border-blue-500 bg-blue-950` |
| engineer-2 | `bg-blue-800 text-blue-200` | `border-blue-500 bg-blue-950` |
| qa | `bg-emerald-800 text-emerald-200` | `border-emerald-500 bg-emerald-950` |
| sre | `bg-orange-800 text-orange-200` | `border-orange-500 bg-orange-950` |
| custom | `bg-pink-800 text-pink-200` | `border-pink-500 bg-pink-950` |

### Typography

| Usage | Class |
|---|---|
| Page / section headings | `text-sm font-semibold text-neutral-100` |
| Body / labels | `text-sm text-neutral-200` |
| Meta / timestamps | `text-xs text-neutral-500` |
| Code / output | `text-xs font-mono text-neutral-500` |
| Placeholder | `text-neutral-600` |

### Spacing Scale
Tailwind defaults (4px base unit). Card padding: `p-4` or `p-5`. Section gaps: `gap-3` / `space-y-4`. Inner element gaps: `gap-2` / `gap-3`.

---

## 5. Component Specs

### PhaseTracker

**Props:** `currentPhase: SDLCPhase`

**States per step:**
- **Done** (`idx < currentIdx` or `isDone`): green filled circle with checkmark icon
- **Current** (`idx === currentIdx`, not done): amber ring (2px gap) with amber pulsing inner dot + `animate-pulse`
- **Upcoming** (`idx > currentIdx`): muted amber ring with muted amber inner dot (no pulse)

**Layout:** horizontal scroll on mobile, full-width row on desktop; connecting line between steps.

---

### AgentCard

**Props:** `agent`, `latestOutput?`, `currentTask?`, `isSelected?`, `onClick`

**States:**
- Default: `bg-neutral-900` + status-based border (`agentBorderClass`)
- Working: `border-primary-800 shadow-primary-glow`
- Selected: role-colored border + role-colored background (`agentSelectedClass`) — hover effect retained
- Hover (unselected): `hover:bg-neutral-850 hover:border-neutral-700`

**Content:**
- Role avatar (colored initials circle, w-8)
- Specialization name or role fallback
- `StatusBadge` (top right)
- Current task title (only when working + task assigned)
- Latest output snippet (2-line clamp, monospace) or "No output yet…" italic

**Click behavior:** Toggles task feed filter — click to select, click again to deselect. Does NOT open the drawer.

---

### TaskFeed

**Props:** `tasks`, `onTaskClick`, `isConnected`, `onSendDirective`, `filterLabel?`, `onClearFilter?`

**Header:**
- "Tasks" label
- Filter pill (dismissible ×) when `filterLabel` is set — role-colored (`bg-primary-900 border-primary-700`)
- Live connection indicator (green pulsing dot + "Live" / red dot + "Reconnecting...")

**Task list:**
- Newest first (reversed)
- Each row: `TaskStatusIcon` + title + role badge + timestamp
- Animate in with `animate-fadeSlideDown`
- Empty state: clock icon + "Waiting for tasks..."

**Directive input (pinned bottom):**
- Auto-expanding textarea (max 120px), `rows=1`
- Enter to send, Shift+Enter for newline
- Disabled while sending (spinner in send button)
- Placeholder: "Direct the team — add requirements, update scope, ask the tech lead anything…"

---

### AgentOutputDrawer

**Props:** `isOpen`, `task`, `messages`, `liveOutput?`, `onClose`, `onTaskUpdate`

**Behavior:**
- Slides in from right, overlay
- No horizontal scroll (`overflow-x-hidden`)
- Output text: `whitespace-pre-wrap break-words` (long lines wrap, no overflow)
- Live output streams in chunk by chunk via `task_output_chunk` SSE events
- Retry / Cancel action buttons per task status

---

### StatusBadge

**Props:** `status: ProjectStatus | AgentStatus | TaskStatus`

Color mapping:
- `active` / `working` / `in-progress`: blue/primary
- `done`: green
- `failed`: red
- `blocked` / `cancelled`: neutral/muted
- `pending` / `paused`: amber
- `idle`: neutral

---

## 6. User Flows

### Flow 1: Create and run a new project
1. User lands on `/` → sees project list or empty state
2. Fills in name + description → clicks "Create Project"
3. Redirected to `/projects/[id]`
4. Phase tracker shows "Discovery" as current (amber dot)
5. Tech Lead agent appears as working; task feed populates in real time
6. Phases advance automatically; phase tracker updates live
7. Project reaches "Done"; Download button appears in top bar

### Flow 2: Send a directive mid-project
1. User is on `/projects/[id]` while agents are working
2. Types a directive in the bottom input → presses Enter
3. New "User Directive" task appears in feed assigned to Tech Lead
4. Tech Lead processes it and delegates via `<delegate>` tags
5. Sub-tasks appear in feed, dispatched to appropriate agents

### Flow 3: Send a directive to a completed project
1. Project status is "done"
2. User types directive → presses Enter
3. Project status changes back to "active" (SSE update)
4. Tech Lead runs and delegates new tasks as in Flow 2

### Flow 4: Filter tasks by agent
1. User clicks an agent card → card gets role-colored border/background
2. Task feed filters to show only that agent's tasks; filter pill appears in header
3. User clicks × on pill (or clicks agent card again) → filter cleared

### Flow 5: Manage default team
1. User clicks "Manage Team" in home page header → `/agents`
2. Edits Tech Lead's System Prompt to add persona context → Save
3. Changes model of an engineer to Opus → Save
4. Adds a new custom "Security Expert" agent with custom system prompt
5. Next new project automatically includes updated team

---

*Document version: 2.0 — updated 2026-05-19*
