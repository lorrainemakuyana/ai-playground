# UI Design Spec — Subscription Tiers (Free / Pro / Ultra)

Frontend/UI design specification for the subscription tiers feature.
Scope reference: `PLAN-subscriptions.md`. This is a **design document only** — no
repo code is written or modified by this spec.

Stack: Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · dark theme.
All token names below map directly to the existing `frontend/tailwind.config.ts`.

---

## 0. Conventions matched from the existing codebase

These patterns are observed in the current repo and are reused verbatim so the new
work feels native:

- **Modal shell** (from `AddAgentModal.tsx`): outer
  `fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn`,
  inner card `bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl ... animate-scaleIn`,
  header/footer separated by `border-b/border-t border-neutral-800`, ESC-to-close
  via a `keydown` listener, focus the primary control on open.
- **Badge** (from `StatusBadge.tsx`): `text-xs font-medium px-2 py-0.5 rounded-full`
  with a `bg-*-950 text-*-400` pairing per semantic colour.
- **Primary button**: `bg-primary-600 hover:bg-primary-500 text-white ... disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none`
  with `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900`.
- **Secondary/ghost button**: `text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800`.
- **API access**: every call goes through `fetchJSON<T>` in `frontend/lib/api.ts`
  (Bearer token from `auth_token` cookie, throws `ApiError(status, detail)`, redirects to
  `/auth` on 401).
- **Spinner**: reuse `components/Spinner.tsx` (`animate-spin`, `text-primary-400`).
- Root layout already wires `sonner` `<Toaster theme="dark" />` — generic errors keep
  using toasts; **plan-limit 403s deliberately do NOT toast**, they open the `UpgradeModal`.

---

## 1. Page / Route Breakdown

All authenticated pages live under `app/app/*` (existing convention). Two new routes,
two touch-point edits, plus one provider added to the app subtree layout.

| Route | File | Status | Purpose |
|---|---|---|---|
| `/app/settings` | `app/app/settings/page.tsx` | **NEW** | Account/settings page. Hosts the **Plan section**: `PlanTierBadge`, per-tier limits table, expiry date / Expired badge, and an "Upgrade" link to `/app/billing`. (No settings route exists today; `app/app/settings/` matches the `app/app/*` convention and keeps it behind auth.) |
| `/app/billing` | `app/app/billing/page.tsx` | **NEW** | Billing placeholder. Renders `PlanComparisonTable` + `CurrencyToggle` + a "Payment coming soon" banner. The `UpgradeModal` CTA deep-links here. |
| `/app` (projects list) | `app/app/page.tsx` | **EDIT** | "New Project" creation already calls `createProject`. No new UI element required — the global 403 interceptor turns a `Free plan limit: 2 projects` 403 into the `UpgradeModal`. Optional: a small `PlanTierBadge` + usage hint (`2 / 2 projects`) in the page header. |
| `/app/projects/[id]` | `app/app/projects/[id]/page.tsx` | **EDIT** | The existing **Share button** (lines ~242–252) gains a disabled state + tooltip when `effectivePlan === 'free'`. See §5.6. |
| App subtree layout | `app/app/layout.tsx` (**NEW**, or wrap in existing nearest layout) | **NEW/EDIT** | Mounts `<UpgradeModalProvider>` and `<CurrentUserProvider>` (optional) around `{children}` so the modal can be opened from anywhere (including non-component code in `fetchJSON`). A nav entry **Settings** is added to whatever app chrome exists. |

> Routing note: there is currently no `app/app/layout.tsx`. Adding one scoped to the
> authenticated subtree is the cleanest mount point for `UpgradeModalProvider` — it keeps
> the provider out of the public `/auth` route and the marketing root.
>
> **Verified — no conflict.** The only existing layout is the root `app/layout.tsx`, which
> owns `<html>`/`<body>` and the `<Toaster>`. A new `app/app/layout.tsx` must **not**
> redeclare `<html>`/`<body>` (Next.js nests it inside the root automatically); it only
> wraps `{children}` with the providers. The public routes (`/auth`, `/pricing`) live
> outside `app/app/`, so they correctly never mount the providers. Adding it is safe.

---

## 2. Component Hierarchy

### New shared components (`frontend/components/`)

```
components/
  PlanTierBadge.tsx        — colour chip for free | pro | ultra (+ Expired variant)
  CurrencyToggle.tsx       — GBP/USD pill switch (role="switch")
  PlanComparisonTable.tsx  — side-by-side Free/Pro/Ultra table (shared)
  UpgradeModal.tsx         — modal wrapping PlanComparisonTable + CurrencyToggle + CTA
  UpgradeModalProvider.tsx — context + module-level open() bridge for fetchJSON
```

### Settings page tree — `app/app/settings/page.tsx`

```
SettingsPage  (client component — needs useCurrentUser)
└─ <main> account container
   ├─ PageHeader  ("Settings")
   └─ PlanSection                          ← the "plan section"
      ├─ Row: PlanTierBadge  +  ["Expired" badge if expired]
      ├─ Row: "Renews / Expires {date}"  (only if plan_expires_at set)
      ├─ PlanLimitsTable   (Projects / Agents / Models / Sharing for current tier)
      └─ Link → /app/billing  ("Upgrade" — only shown when effective_plan !== 'ultra')
```

### Billing page tree — `app/app/billing/page.tsx`

```
BillingPage  (client component — CurrencyToggle reads localStorage)
└─ <main>
   ├─ PageHeader ("Billing")
   ├─ ComingSoonBanner  ("Self-service payment coming soon")
   ├─ CurrencyToggle
   └─ PlanComparisonTable  (highlightPlan = current effective_plan)
```

### UpgradeModal tree

```
UpgradeModal  (rendered once by UpgradeModalProvider; visibility from context)
└─ ModalOverlay (fixed inset-0 …)
   └─ ModalCard (animate-scaleIn, role="dialog" aria-modal)
      ├─ Header: title ("Upgrade your plan") + close button (X)
      ├─ Body:
      │   ├─ ContextLine  (reason copy derived from the 403 detail)
      │   ├─ CurrencyToggle
      │   └─ PlanComparisonTable (highlightPlan = recommended upsell)
      └─ Footer: "Maybe later" (ghost) + "Upgrade" → router.push('/app/billing')
```

### Provider tree (mounted in `app/app/layout.tsx`)

```
<UpgradeModalProvider>          // owns isOpen + reason state, registers open() into a module singleton
   {children}
   <UpgradeModal />             // single instance, portaled to body via fixed positioning
</UpgradeModalProvider>
```

---

## 3. Layout

Global container width matches the existing app (content centred, `max-w-*` per page).
Breakpoints use Tailwind defaults: **mobile `<640`**, **tablet `sm` 640–1024**,
**desktop `lg` >1024**.

### PlanComparisonTable

- **Desktop (`lg:`)**: CSS grid `grid grid-cols-3 gap-4`. Three equal tier cards.
- **Tablet (`sm:`)**: `grid grid-cols-3 gap-3` still fits; cards narrow, padding `p-4`.
- **Mobile (`<640`)**: `grid grid-cols-1 gap-3` — cards stack vertically, full width.
- Each tier card: `rounded-xl border p-5 flex flex-col gap-4` (border colour per tier, §4).
- Feature rows inside a card: `flex items-center justify-between text-sm py-1.5`
  with a divider `divide-y divide-neutral-800`.
- Recommended/highlighted tier gets `ring-1 ring-primary-500 shadow-primary-glow` and a
  `Most popular` pill (`bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full`).

### UpgradeModal

- Overlay: `fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn`.
- Card: `w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl flex flex-col animate-scaleIn`.
  `max-w-3xl` because the table needs to show three columns on desktop.
- On mobile the card becomes scrollable: `max-h-[90vh] overflow-y-auto`; table stacks (above).
- Header `px-6 py-5 border-b border-neutral-800`; body `px-6 py-5`; footer `px-6 py-4 border-t border-neutral-800 flex justify-end gap-3`.

### Settings PlanSection

- Card: `rounded-xl border border-neutral-800 bg-neutral-900 p-6`.
- Vertical rhythm: `space-y-4`. Limits table: `w-full text-sm` with
  `text-neutral-400` labels (left) and `text-neutral-100 font-medium` values (right).

### Spacing scale (Tailwind defaults used throughout)

`gap-1.5 / gap-2 / gap-3 / gap-4` · padding `p-4 / p-5 / p-6` · section `space-y-4 / space-y-6`.
Border radius: chips `rounded-full`, buttons `rounded-md/rounded-lg`, cards `rounded-xl`.

---

## 4. Design Tokens

Restated from `tailwind.config.ts` — **no new palette is invented.**

### Colour

| Role | Token | Hex | Usage |
|---|---|---|---|
| Brand accent (primary) | `primary-500/600/700` | `#8b5cf6 / #7c3aed / #6d28d9` | Pro tier, primary buttons, highlights |
| Brand accent dark bg | `primary-950` | `#1e1033` | badge backgrounds (`bg-primary-950 text-primary-400`) |
| Secondary accent | `secondary-400/500/600` | `#22d3ee / #06b6d4 / #0891b2` | Ultra gradient endpoint, secondary chips |
| Neutral surface | `neutral-950/900/850/800` | base bg `#0a0a0a` style / `#1f1f23` custom 850 | page bg, cards, borders |
| Text | `neutral-100 / 300 / 400 / 500 / 600` | — | headings → muted helper text |
| Success | `green-950 / green-400` | Tailwind default | active/healthy |
| Error | `red-950 / red-400 / red-500` | Tailwind default | errors, expired (hard) |
| Warning | `amber-950 / amber-400 / amber-600` | Tailwind default | Expired badge, paused |

Fonts: `font-sans` = **Inter**, `font-mono` = **JetBrains Mono** (use mono for prices,
e.g. `£12`, to match the technical aesthetic — optional).

Shadows/animations: `shadow-primary-glow`, `shadow-success-glow`,
`animate-fadeIn`, `animate-scaleIn`, `animate-fadeSlideDown`.

### Per-tier accent treatment

| Tier | Accent | Badge classes | Card border |
|---|---|---|---|
| **Free** | Neutral | `bg-neutral-800 text-neutral-300` | `border-neutral-800` |
| **Pro** | Violet (primary) | `bg-primary-950 text-primary-300 ring-1 ring-primary-800` | `border-primary-700` |
| **Ultra** | Violet→Cyan gradient (premium) | text: `bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent`; chip bg: `bg-neutral-900 ring-1 ring-primary-700` with gradient text | `border-transparent bg-gradient-to-br from-primary-700/40 to-secondary-600/30 [background-clip:padding-box]` (gradient hairline look); add `shadow-primary-glow` |

### "Expired" badge

`bg-amber-950 text-amber-400 ring-1 ring-amber-800` with label `Expired`.
Rendered **next to** the user's stored `PlanTierBadge` (which itself dims to neutral styling
because `effective_plan` has already fallen back to `free`). If you want a harder signal,
the ring may use `ring-red-800 text-red-400` — spec default is **amber** (a soft warning,
not an error).

---

## 5. Component Specs

> TS types referenced below (centralise in `frontend/types/index.ts`):

```ts
export type PlanTier = 'free' | 'pro' | 'ultra'

export interface CurrentUser {
  id: string
  email: string
  plan: PlanTier                 // stored plan (may be expired)
  plan_expires_at: string | null // ISO datetime
  effective_plan: PlanTier       // server-computed; 'free' if expired
}

export type Currency = 'GBP' | 'USD'
```

### 5.1 `PlanTierBadge`

```ts
interface PlanTierBadgeProps {
  plan: PlanTier
  expired?: boolean        // when true, shows the dimmed plan label + an "Expired" chip
  size?: 'sm' | 'md'       // default 'sm'
}
```

- **States**: static display component — no hover/loading. Variants are tier + expired.
- **default (sm)**: `inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full`
  plus per-tier classes from §4.
- **md**: `text-sm px-2.5 py-1`.
- **Free**: `bg-neutral-800 text-neutral-300`.
- **Pro**: `bg-primary-950 text-primary-300 ring-1 ring-primary-800`.
- **Ultra**: `bg-neutral-900 ring-1 ring-primary-700` with inner
  `<span className="bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent font-semibold">Ultra</span>`.
- **expired**: render the badge for `plan` with `opacity-60` and append a second chip
  `bg-amber-950 text-amber-400 ring-1 ring-amber-800 text-xs px-2 py-0.5 rounded-full` → `Expired`.

### 5.2 `CurrencyToggle`

```ts
interface CurrencyToggleProps {
  className?: string
  // value/onChange come from useCurrency() internally; component is self-contained
}
```

- Implemented as a **two-option segmented pill** behaving as a switch.
- **States**: default, hover (per segment), active/selected, focus-visible. No loading/error/empty.
- Container: `inline-flex rounded-full bg-neutral-850 p-0.5 ring-1 ring-neutral-800`.
- Each segment button: `px-3 py-1 text-xs font-medium rounded-full transition-colors`.
- **Selected** segment: `bg-primary-600 text-white shadow-primary-glow`.
- **Unselected** segment: `text-neutral-400 hover:text-neutral-100`.
- Labels: `£ GBP` and `$ USD`.
- A11y: `role="switch"` with `aria-checked` reflecting whether USD is active, plus
  `aria-label="Toggle currency between GBP and USD"`. (See §8.)

### 5.3 `UpgradeModal`

```ts
interface UpgradeReason {
  title: string            // e.g. "You've hit the Free project limit"
  body: string             // e.g. "Free plans include up to 2 projects. Upgrade to add more."
  recommend: PlanTier      // which tier to highlight ('pro' for limits, 'pro' for sharing)
}

// Driven by context; the modal component itself takes no props:
interface UpgradeModalContextValue {
  open: (reason?: Partial<UpgradeReason>) => void
  close: () => void
  isOpen: boolean
  reason: UpgradeReason
}
```

- **States**:
  - *default/open*: full modal with table + toggle + CTA.
  - *hover*: on CTA and close button (standard hover classes).
  - *loading*: none (no async inside; the originating request already failed). CTA is a
    plain navigation — no spinner needed. If a future Stripe call lands, the CTA gains a
    `disabled` + Spinner state.
  - *error/empty*: none — the modal is purely informational.
  - *closed*: `isOpen === false` → renders nothing.
- Classes: see §3 (overlay + card). Header title `text-lg font-semibold text-neutral-100`.
  Reason body `text-sm text-neutral-400`. Close `X` button reuses the AddAgentModal X-button classes.
- CTA (primary): `px-4 py-2 text-sm font-medium text-white rounded-md bg-primary-600 hover:bg-primary-500 ...`
  → `onClick={() => { close(); router.push('/app/billing') }}`.
- "Maybe later" (ghost): `px-4 py-2 text-sm font-medium text-neutral-400 rounded-md hover:text-neutral-100 hover:bg-neutral-800`.

#### ASCII mockup — UpgradeModal (desktop)

```
┌───────────────────────────────────────────────────────────────────┐
│  Upgrade your plan                                            [ X ] │
├───────────────────────────────────────────────────────────────────┤
│  You've hit the Free project limit.                                 │
│  Free plans include up to 2 projects. Upgrade to add more.          │
│                                                                     │
│                                        ( £ GBP | $ USD )            │  ← CurrencyToggle (right-aligned)
│                                                                     │
│   ┌── Free ──────┐   ┌── Pro ★ ─────┐   ┌── Ultra ──────┐          │
│   │   £0 / mo    │   │  £12 / mo     │   │  £30 / mo      │          │
│   │              │   │  Most popular │   │  ✦ premium ✦   │          │
│   │ 2 projects   │   │ 10 projects   │   │ Unlimited      │          │
│   │ 3 agents/proj│   │ 8 agents/proj │   │ Unlimited      │          │
│   │ Haiku        │   │ Haiku, Sonnet │   │ + Opus         │          │
│   │ Sharing —    │   │ Sharing ✓     │   │ Sharing ✓      │          │
│   │ (current)    │   │               │   │                │          │
│   └──────────────┘   └──────────────┘   └────────────────┘          │
├───────────────────────────────────────────────────────────────────┤
│                                      [ Maybe later ]  [ Upgrade ]   │
└───────────────────────────────────────────────────────────────────┘
```

### 5.4 `PlanComparisonTable`

```ts
interface PlanComparisonTableProps {
  highlightPlan?: PlanTier   // adds ring + "Most popular" pill (default 'pro')
  currentPlan?: PlanTier     // marks the user's effective plan with a "Current" tag
  compact?: boolean          // tighter padding when embedded in the modal
}
```

- **States**: default; *hover* per card (`hover:border-neutral-700` for Free,
  `hover:shadow-primary-glow` for highlighted). No loading/empty — data is static
  from `PLAN_PRICING` + a static feature matrix constant.
- Card base: `rounded-xl border p-5 flex flex-col gap-4` + per-tier border (§4).
- Tier name row: `flex items-center justify-between` → `PlanTierBadge size="md"` + (price).
- Price: `text-2xl font-semibold text-neutral-100` from `useCurrency().format(...)`,
  suffix `text-sm text-neutral-500` ` / mo`.
- Feature list: `<ul className="divide-y divide-neutral-800 text-sm">`, each row
  `flex items-center justify-between py-2`; available `text-neutral-200`,
  unavailable `text-neutral-600` with an em-dash; checks use `text-green-400`,
  crosses/dash `text-neutral-600`.
- `currentPlan` match → small chip `bg-neutral-800 text-neutral-400 text-[10px] px-2 py-0.5 rounded-full` `Current`.

#### ASCII mockup — PlanComparisonTable (desktop, 3-col)

```
┌── Free ─────────────┐  ┌── Pro ★ ─────────────┐  ┌── Ultra ✦ ──────────┐
│ [Free]        £0/mo │  │ [Pro]  Most popular  │  │ [Ultra]  (gradient) │
│                     │  │           £12/mo     │  │            £30/mo    │
├─────────────────────┤  ├──────────────────────┤  ├─────────────────────┤
│ Projects        2   │  │ Projects        10   │  │ Projects   Unlimited│
│ Agents/proj     3   │  │ Agents/proj      8   │  │ Agents/proj Unlimited│
│ Models      Haiku   │  │ Models  Haiku·Sonnet │  │ Models   +Opus      │
│ Sharing         —   │  │ Sharing          ✓   │  │ Sharing         ✓   │
│ [Current]           │  │                      │  │                     │
└─────────────────────┘  └──────────────────────┘  └─────────────────────┘
```

On mobile (`<640`) these stack into a single column, full width, in the order Free→Pro→Ultra.

### 5.5 Settings — Plan Section

Part of `app/app/settings/page.tsx`. Consumes `useCurrentUser()`.

- **States**:
  - *loading*: `useCurrentUser().loading` → render a skeleton card
    (`animate-pulse bg-neutral-850 rounded-xl h-40`) or `<Spinner />` centred.
  - *error*: `useCurrentUser().error` → `text-sm text-red-400` message +
    "Retry" ghost button calling `refetch()`.
  - *loaded*: badge + limits table (below).
  - *empty*: not applicable — an authenticated user always has a plan (default `free`).
  - *expired*: `effective_plan === 'free'` but `plan !== 'free'` and `plan_expires_at` is past
    → show stored-plan badge with `expired` prop + the limits of `effective_plan` (Free).

#### ASCII mockup — Settings Plan Section

```
┌─ Plan ───────────────────────────────────────────────────────────┐
│                                                                   │
│   [ Pro ]   [ Expired ]                Expired on 12 May 2026      │
│                                                                   │
│   Your current entitlements                                       │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │ Projects ............................. 2                 │    │
│   │ Agents per project ................... 3                 │    │
│   │ Models ............................... Haiku             │    │
│   │ Project sharing ...................... —                 │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│   You're on the Free entitlement.  [ Upgrade → ]                  │
└───────────────────────────────────────────────────────────────────┘
```

- Container: `rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4`.
- Heading: `text-sm font-semibold text-neutral-300`.
- Limits table rows: `flex items-center justify-between text-sm`, label `text-neutral-400`,
  value `text-neutral-100 font-medium`.
- "Upgrade" link (hidden when `effective_plan === 'ultra'`):
  `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors` → `href="/app/billing"`.

### 5.6 Disabled Share Button (project detail touch-point)

Edit to `app/app/projects/[id]/page.tsx`. The current button (owner-only, lines ~242–252)
gains a Free-plan disabled state. `effectivePlan` comes from `useCurrentUser()`.

```ts
// pseudocode condition
const sharingLocked = effectivePlan === 'free'
```

- **Enabled (Pro/Ultra)** — unchanged:
  `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex-none`.
- **Disabled (Free)**: wrap in a `group relative` span; button gets
  `... bg-neutral-800/60 text-neutral-500 cursor-not-allowed` and `disabled` +
  `aria-disabled="true"`. A tiny lock icon precedes the "Share" label.
- **Tooltip**: sibling element shown on `group-hover`/`group-focus-within`:
  `absolute top-full mt-1 right-0 z-10 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity animate-fadeSlideDown`
  with copy **"Upgrade to Pro to share"**. The tooltip carries `role="tooltip"` and an
  `id` referenced by the button's `aria-describedby` (see §8).
- **States**: default-locked, hover (tooltip in), focus-visible (tooltip in). No loading/error/empty.
- Because the button is truly disabled, no 403 is ever fired from this path — the gate is
  purely presentational. (Server still enforces; see §7c.)

### 5.7 Billing Page

`app/app/billing/page.tsx`. Client component (CurrencyToggle reads localStorage).

- **States**:
  - *loading*: while `useCurrentUser()` resolves (to know `currentPlan` for highlighting) →
    Spinner; the comparison table itself needs no fetch.
  - *loaded*: ComingSoonBanner + CurrencyToggle + PlanComparisonTable.
  - *error*: if user fetch fails, still render the table without the "Current" marker +
    a muted `text-neutral-500` note.
  - *empty*: n/a.
- ComingSoonBanner: `rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300 text-sm px-4 py-3`
  → "Self-service payment is coming soon. Plan changes are currently handled by an admin."
- Layout container: `mx-auto max-w-5xl px-4 py-8 space-y-6`.

---

## 6. Hooks — `useCurrency` and `useCurrentUser`

**Location decision:** create `frontend/lib/hooks/`. Rationale: existing shared
client utilities already live under `frontend/lib/` (`api.ts`, `auth.ts`, `constants.ts`,
`utils.ts`) and import via the `@/lib/*` alias. A `lib/hooks/` subfolder keeps hooks
co-located with the code they call (`api.ts`, `constants.ts`) and avoids introducing a
second top-level convention (`frontend/hooks/`). Files: `lib/hooks/useCurrency.ts`,
`lib/hooks/useCurrentUser.tsx`.

### 6.1 Pricing + currency constants (`frontend/lib/constants.ts`)

```ts
// Static FX — no live API. 1 GBP = 1.27 USD.
export const USD_PER_GBP = 1.27

// Base prices stored as GBP pence (single source of truth).
export const PLAN_PRICING: Record<PlanTier, number> = {
  free:  0,      // £0.00
  pro:   1200,   // £12.00 / mo
  ultra: 3000,   // £30.00 / mo
}

// Per-tier limit/feature matrix reused by tables (mirrors backend PLAN_LIMITS).
export const PLAN_FEATURES: Record<PlanTier, {
  projects: number | 'unlimited'
  agentsPerProject: number | 'unlimited'
  models: string
  sharing: boolean
}> = {
  free:  { projects: 2,           agentsPerProject: 3,           models: 'Haiku',                sharing: false },
  pro:   { projects: 10,          agentsPerProject: 8,           models: 'Haiku, Sonnet',        sharing: true  },
  ultra: { projects: 'unlimited', agentsPerProject: 'unlimited', models: 'Haiku, Sonnet, Opus',  sharing: true  },
}
```

Display rendering examples: Pro = **£12/mo** (GBP) / **$15/mo** (USD, `1200 * 1.27 = 1524p → $15.24`,
rounded for display per §6.2). Ultra = **£30/mo** / **$38/mo** (`3000 * 1.27 = 3810p → $38.10`).
Free always renders as **Free** (not "£0") in tables.

### 6.2 `useCurrency`

```ts
// frontend/lib/hooks/useCurrency.ts
interface UseCurrencyResult {
  currency: Currency                 // 'GBP' | 'USD'
  setCurrency: (c: Currency) => void
  toggle: () => void
  format: (gbpPence: number) => string   // converts + formats; 0 → "Free"
}

export function useCurrency(): UseCurrencyResult
```

- **localStorage key**: `preferred_currency`. Read on mount (guard `typeof window`),
  default `'GBP'` when unset/SSR. Writes on every `setCurrency`.
- **Cross-tab / cross-component sync**: a tiny module-level `Set<listener>` (or a
  `storage` event listener) so multiple `CurrencyToggle`/table instances re-render together
  when one changes. (Alternatively a thin `CurrencyContext` — acceptable, but a subscribe
  pattern avoids forcing a provider just for currency.)
- **`format(gbpPence)`**:
  - `gbpPence === 0` → returns `"Free"`.
  - GBP: `£{(gbpPence/100).toFixed(0)}` (whole pounds for round prices), e.g. `£12`.
  - USD: `${Math.round(gbpPence * USD_PER_GBP / 100)}` → `$15`. Use
    `Intl.NumberFormat(undefined, { style: 'currency', currency })` for correctness; round to
    whole units for the marketing display.
- No network calls; purely client state.

### 6.3 `useCurrentUser`

```ts
// frontend/lib/hooks/useCurrentUser.tsx
interface UseCurrentUserResult {
  user: CurrentUser | null
  plan: PlanTier | null            // user.plan
  effectivePlan: PlanTier | null   // user.effective_plan
  planExpiresAt: string | null
  isExpired: boolean               // plan !== 'free' && effective_plan === 'free' && expiry in past
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCurrentUser(): UseCurrentUserResult
```

- Fetches **`GET /users/me`** via a new `getCurrentUser()` exported from `lib/api.ts`:

  ```ts
  export async function getCurrentUser() {
    return fetchJSON<import('@/types').CurrentUser>('/users/me')
  }
  ```

- The response shape **must** include `plan`, `plan_expires_at`, `effective_plan`
  (per AC US-7) and maps 1:1 to the `CurrentUser` TS interface in §5.
- **Caching**: wrap in a lightweight `CurrentUserProvider` (context) mounted in
  `app/app/layout.tsx` so the same `/users/me` result is shared by the settings page,
  the share button, and the projects-list header — avoiding duplicate fetches.
  `useCurrentUser()` reads from that context. `refetch()` re-pulls (e.g. after an admin
  changes the plan in another tab — manual refresh path; no realtime requirement).
- **`isExpired`** is derived client-side for badge display only; the server is the source
  of truth via `effective_plan`.

---

## 7. The Global 403 Interceptor + `UpgradeModalProvider`

**Mechanism (specified exactly):** `fetchJSON` is a plain async function, **not** a hook,
so it cannot call React context. We bridge with a **module-level callback singleton**:

```ts
// frontend/components/UpgradeModalProvider.tsx (or lib/upgradeModalBridge.ts)
type OpenFn = (reason?: Partial<UpgradeReason>) => void
let _open: OpenFn | null = null
export function registerUpgradeModalOpener(fn: OpenFn | null) { _open = fn }
export function triggerUpgradeModal(reason?: Partial<UpgradeReason>) { _open?.(reason) }
```

- `UpgradeModalProvider` (a client component) holds `isOpen` + `reason` state and, in a
  `useEffect`, calls `registerUpgradeModalOpener(open)` on mount and
  `registerUpgradeModalOpener(null)` on unmount. It renders `<UpgradeModal />` once.
- In `lib/api.ts`, inside `fetchJSON`'s `!res.ok` branch, **before** throwing:

  ```ts
  if (res.status === 403 && isPlanLimitDetail(message)) {
    // dynamically import the bridge to avoid a lib→component import cycle
    triggerUpgradeModal(reasonFor(message))
  }
  ```

- **Detection** — match these exact backend detail strings:

  | Detail substring | reason.title | reason.recommend |
  |---|---|---|
  | `Free plan limit: 2 projects` | "You've hit the Free project limit" | `pro` |
  | `Free plan limit: 3 agents per project` | "You've hit the agent limit" | `pro` |
  | `Sharing requires Pro or Ultra` | "Sharing is a Pro feature" | `pro` |

  `isPlanLimitDetail` = the message contains `'plan limit'` OR equals
  `'Sharing requires Pro or Ultra'`.

- The original `ApiError(403, message)` is **still thrown** so callers' existing
  `try/catch` continue to work (their generic toast can be suppressed for 403 if desired).
  The modal opening is a side-effect layered on top — it does **not** replace the throw.

> Trade-off noted: the module singleton means only one `UpgradeModalProvider` may be mounted
> at a time (fine — it lives once in `app/app/layout.tsx`). This avoids putting React
> context knowledge inside `lib/api.ts`, keeping the API client framework-agnostic.

---

## 8. User Flows

### (a) Free user hits the project limit → UpgradeModal → Billing

1. User on `/app` clicks **New Project**, submits the create form.
2. Client calls `createProject()` → `fetchJSON('/projects', POST)`.
3. Server returns `403 {"detail": "Free plan limit: 2 projects"}`.
4. `fetchJSON` detects the plan-limit detail → `triggerUpgradeModal({...recommend:'pro'})`,
   then throws `ApiError(403)`.
5. `UpgradeModalProvider` sets `isOpen=true`; `UpgradeModal` mounts with `animate-scaleIn`,
   focus moves to the close button, context line reads "You've hit the Free project limit".
   The create form's `catch` swallows the 403 (no duplicate toast).
6. User reviews the comparison table, clicks **Upgrade**.
7. Modal closes; `router.push('/app/billing')`. Billing page shows the comparison table,
   CurrencyToggle, and the "coming soon" banner.

### (b) Toggle GBP ↔ USD, all prices re-render

1. On `/app/billing` (or in the modal) user clicks the **$ USD** segment of `CurrencyToggle`.
2. `setCurrency('USD')` writes `preferred_currency=USD` to localStorage and notifies all
   subscribers (module listener / storage event).
3. Every `useCurrency()` consumer re-renders: `format(1200)` now returns `$15`, `format(3000)`
   returns `$38`. Free stays "Free". No page reload, no network call.
4. State persists on reload and across the modal/billing surfaces.

### (c) Free user sees the disabled Share button + tooltip

1. Free user opens `/app/projects/[id]` they own.
2. `useCurrentUser().effectivePlan === 'free'` → Share button renders disabled
   (`aria-disabled`, lock icon, muted classes).
3. On hover/focus the tooltip "Upgrade to Pro to share" fades in (`animate-fadeSlideDown`),
   linked via `aria-describedby`. Click does nothing (no 403, no toast).
4. (Server still rejects any direct `POST /projects/{id}/shares` with
   `403 "Sharing requires Pro or Ultra"`, which would open the UpgradeModal — defence in depth.)

### (d) Settings: plan + limits + expiry / Expired

1. User navigates to `/app/settings`.
2. Plan section calls `useCurrentUser()`; while `loading`, a skeleton renders.
3. On load: `PlanTierBadge` shows `plan`. Limits table renders `PLAN_FEATURES[effectivePlan]`.
4. If `plan_expires_at` is set and in the future → "Expires {formatted date}".
5. If expired (`plan !== 'free'` but `effective_plan === 'free'`, expiry past) → badge shows
   `expired` (dimmed + amber **Expired** chip) and the table shows Free entitlements, with
   "Expired on {date}".
6. Unless already Ultra, an **Upgrade →** button links to `/app/billing`.

---

## 9. Accessibility

- **UpgradeModal**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the
  title. Implements a **focus trap** (focus the close button on open; Tab/Shift-Tab cycle
  within the card; restore focus to the triggering element on close). **ESC closes**
  (reuse the AddAgentModal `keydown` pattern). Clicking the overlay closes; clicking the card
  does not (stopPropagation). Body scroll locked while open (`overflow-hidden` on `document.body`).
- **CurrencyToggle**: rendered as a switch — `role="switch"`, `aria-checked={currency==='USD'}`,
  `aria-label="Toggle currency between GBP and USD"`, keyboard operable (Space/Enter toggles).
  Each segment is focusable with a visible `focus-visible:ring-2 focus-visible:ring-primary-500`.
- **Disabled Share button**: real `disabled` + `aria-disabled="true"`; tooltip has
  `role="tooltip"` and an `id` referenced by the button via `aria-describedby`, so screen
  readers announce the upgrade requirement. Tooltip appears on **focus** as well as hover.
- **PlanTierBadge / Expired chip**: not interactive; the "Expired" state is conveyed by text,
  not colour alone (chip literally reads "Expired").
- **PlanComparisonTable**: semantic structure — tier cards as a list; feature availability
  uses both an icon and text (e.g. "Sharing ✓" / "Sharing —") so it isn't colour-only.
- **Contrast**: all text/background pairs use `neutral-100/200/300` on `neutral-900/950`,
  meeting WCAG AA; the Ultra gradient text is decorative on the chip but the label text
  remains legible against `neutral-900`.

---

## 10. Open items / hand-off notes

- Backend must return `plan`, `plan_expires_at`, `effective_plan` on `GET /users/me`
  (AC US-7) — the `CurrentUser` TS type and `useCurrentUser` depend on it.
- `PLAN_FEATURES` (frontend) must stay in sync with backend `PLAN_LIMITS`; consider a
  generated constant later, but a hand-maintained mirror is acceptable for this scope.
- Display rounding for USD (`$15` vs `$15.24`) is a product choice — spec recommends whole
  units for marketing surfaces; revisit if/when Stripe charges exact converted amounts.
- `app/app/layout.tsx` does not exist yet; introducing it is the cleanest provider mount —
  confirm there's no conflicting root behaviour before adding.

---

## Addendum: Public `/pricing` route & auth persistence (US-15 – US-17)

### Route placement
`/pricing` is a **public marketing route at the app root** — `app/pricing/page.tsx` — *not* under `app/app/*` (which is the authenticated area). It sits alongside `app/auth/`. This keeps it reachable logged-out, with no auth guard and no redirect-to-`/auth` on load.

| Route | File | Status | Auth | Purpose |
|---|---|---|---|---|
| `/pricing` | `app/pricing/page.tsx` | **NEW** | Public | Marketing pricing page. Renders `PlanComparisonTable` + `CurrencyToggle`, with Subscribe CTAs that branch on login state. |

### Auth persistence — how it works
No new mechanism. The `auth_token` cookie is `path="/"` and JS-readable, so a logged-in user arriving at `/pricing` is already authenticated. The page detects this on mount with an **opportunistic, non-redirecting** probe:

```ts
// lib/api.ts — variant of getCurrentUser that never redirects on 401
export async function getCurrentUserOptional(): Promise<CurrentUser | null> {
  if (!getStoredToken()) return null          // no cookie → definitely logged out
  try { return await fetchJSON<CurrentUser>('/users/me') }
  catch { return null }                        // expired/invalid → treat as logged out, do NOT redirect
}
```

`useCurrentUser()` on a public page must use this variant (or accept an `{ optional: true }` flag) so a stale token doesn't bounce a visitor off the marketing page.

### Subscribe CTA logic
Each tier card's CTA resolves like this (`tier` = the card's tier):

```
onSubscribe(tier):
  user = useCurrentUser()            // from the optional probe
  if (tier === 'free'):
     → router.push(user ? '/app' : '/auth?next=/app')        // "Get started"
  else if (!user):
     → router.push(`/auth?next=${encodeURIComponent('/pricing?checkout=' + tier)}`)
  else if (user.effective_plan === tier):
     → noop (CTA disabled, labelled "Current plan")
  else if (tierRank(tier) < tierRank(user.effective_plan)):
     → router.push(`/app/billing?change=${tier}`)            // DOWNGRADE — allowed
  else:
     → router.push(`/app/billing?checkout=${tier}`)          // upgrade → checkout
```

`tierRank = { free: 0, pro: 1, ultra: 2 }`. Downgrades and upgrades both route to the billing page; only the query key differs (`change` vs `checkout`) so the billing page can show the right copy ("Switch to Free" / "Confirm downgrade — keeps current features until period end" vs "Subscribe"). Both ultimately call the same plan-change path (admin/`apply_plan` now, Stripe later).

- **Logged out** → `/auth?next=/pricing?checkout=<tier>`. The existing safe-`next` handler in `app/auth/page.tsx` (lines 35–37) already validates and routes back. After login the user lands on `/pricing?checkout=<tier>`.
- **Returning with `?checkout=<tier>`** → a `useEffect` on `/pricing` reads the param and auto-advances to `/app/billing?checkout=<tier>` (the checkout placeholder), so the intent isn't lost.
- **Logged in, higher tier** → `/app/billing?checkout=<tier>`. No login step.
- **Logged in, lower tier** → `/app/billing?change=<tier>` (downgrade — fully supported).
- **Logged in, same tier** → CTA shows "Current plan", disabled (`bg-neutral-800 text-neutral-500 cursor-default`).

### CTA states per tier card

| Visitor state | Free card | Pro card | Ultra card |
|---|---|---|---|
| Logged out | "Get started" → `/auth?next=/app` | "Subscribe" → `/auth?next=/pricing?checkout=pro` | "Subscribe" → `/auth?next=/pricing?checkout=ultra` |
| Logged in (Free) | "Current plan" (disabled) | "Upgrade" → billing | "Upgrade" → billing |
| Logged in (Pro) | "Downgrade" → billing | "Current plan" (disabled) | "Upgrade" → billing |
| Logged in (Ultra) | "Downgrade" → billing | "Downgrade" → billing | "Current plan" (disabled) |

> **Downgrades are supported.** A lower tier than the user's current plan renders an actionable "Downgrade" CTA (styled as a muted/secondary button, e.g. `border border-neutral-700 text-neutral-300 hover:bg-neutral-800`, to visually distinguish it from the primary "Upgrade"). It routes to billing with `?change=<tier>`. Backend already allows any tier transition via `apply_plan`.

### Page tree — `app/pricing/page.tsx`
```
PricingPage  (public, 'use client')
  ├─ <header> minimal nav: logo · "Log in" (→ /auth) | shown only when logged out
  ├─ <h1> "Simple, transparent pricing"
  ├─ CurrencyToggle                         (GBP/USD, shared component)
  ├─ PlanComparisonTable                    (shared; reused from UpgradeModal/billing)
  │     props: { currentTier?, onSubscribe(tier), variant: 'page' }
  └─ <footer> FAQ / "Prices in GBP, billed monthly" microcopy
```

`PlanComparisonTable` gains an optional `currentTier?: PlanTier` prop so it can mark the active tier and drive the per-card CTA labelling above. It is the **same** component used inside `UpgradeModal` (variant `'modal'`) and `/app/billing` (variant `'page'`) — only the wrapping chrome differs.

### Layout
- Desktop (≥1024): 3-column tier grid, `grid-cols-3 gap-6 max-w-5xl mx-auto`, Pro card visually elevated (`shadow-primary-glow scale-[1.03]`), Ultra card with the violet→cyan gradient border.
- Tablet (640–1024): `grid-cols-1 sm:grid-cols-3` collapses to a single scroll column below ~700px content width; keep cards `max-w-sm` centered.
- Mobile (<640): single column, Pro card first (most-recommended ordering), `CurrencyToggle` pinned above the stack.
- Page background matches the app dark theme (`bg-neutral-950`), cards `bg-neutral-900 border border-neutral-800`.

### Accessibility & SEO
- `/pricing` is public → render tier names, prices, and feature rows as real semantic content (`<table>` or definition lists) so it's crawlable and screen-reader friendly; the `CurrencyToggle` only swaps the price text node.
- Each Subscribe CTA is a real `<button>`/`<a>` with an accessible label including the tier and price (`aria-label="Subscribe to Pro, £12 per month"`).
- The "Current plan" disabled CTA uses `aria-disabled="true"` + `title="This is your current plan"`.

### Flow — logged-out subscribe (US-16)
1. Visitor on `/pricing` clicks **Subscribe** on Pro.
2. Not logged in → `router.push('/auth?next=' + encodeURIComponent('/pricing?checkout=pro'))`.
3. User registers or logs in; `auth/page.tsx` validates `next` and routes to `/pricing?checkout=pro`.
4. `/pricing` mounts, `useEffect` sees `?checkout=pro` **and** a now-present session → auto-pushes `/app/billing?checkout=pro` (checkout placeholder).
5. (Future Stripe) billing page calls `POST /subscriptions/checkout` and redirects to the Stripe URL.

### Flow — logged-in subscribe (US-17)
1. Logged-in user navigates to `/pricing` (cookie present, JS-readable).
2. `getCurrentUserOptional()` resolves their `effective_plan`; their current tier shows "Current plan".
3. Clicking **Subscribe** on a higher tier → straight to `/app/billing?checkout=<tier>`. No auth step.
