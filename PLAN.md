# Feature: Progressive Web App (PWA)

## Goal

Make the SDLC Orchestrator installable as a Progressive Web App on iOS and Android so that users can add it to their home screen, use it from a native-feeling shell without a browser chrome, and have the UI shell cached for fast startup. The entire implementation is frontend-only — no backend changes required. Deployment remains on Netlify via `@netlify/plugin-nextjs`.

---

## User Stories

- [ ] **US-1** As a mobile user, I want to install the app on my home screen so that I can open it like a native app without navigating to a URL.
- [ ] **US-2** As an iOS user, I want the app to feel native (no Safari browser bar, themed status bar) so that it doesn't look like a website when launched from the home screen.
- [ ] **US-3** As a mobile user, I want all pages to be readable and usable on a small screen so that I don't have to pinch-zoom or scroll horizontally.
- [ ] **US-4** As a user on a slow or intermittent connection, I want the app shell to load instantly on repeat visits so that I'm not blocked waiting for the network.
- [ ] **US-5** As a user who loses connection mid-session, I want a friendly offline page instead of the browser's default error so that I know the app is still installed and working.
- [ ] **US-6** As a first-time mobile visitor, I want to see an "Add to Home Screen" prompt so that I know I can install the app.

---

## Acceptance Criteria

### US-1 — Installable manifest
- [ ] `app/manifest.ts` exports a `MetadataRoute.Manifest` with `name`, `short_name`, `start_url: "/app"`, `display: "standalone"`, `background_color`, `theme_color`, and at least three icon sizes (192×192, 384×384, 512×512 PNG).
- [ ] Icons exist in `public/icons/` — generated from the app's existing colour scheme (dark background, primary accent).
- [ ] Chrome/Edge on Android shows the native install prompt (three-dot → "Install app") after two visits.
- [ ] The manifest passes Chrome DevTools → Application → Manifest validation with no errors.

### US-2 — iOS meta tags
- [ ] `app/layout.tsx` includes `<link rel="apple-touch-icon" href="/icons/icon-192.png" />`.
- [ ] `<meta name="apple-mobile-web-app-capable" content="yes" />` is set.
- [ ] `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />` is set.
- [ ] `<meta name="theme-color" content="#0a0a0a" />` matches `background_color` in the manifest.
- [ ] When added to iOS home screen via Safari "Add to Home Screen", the app opens without Safari navigation UI.

### US-3 — Mobile-responsive UI
- [ ] All pages render without horizontal scroll on a 375 px viewport (iPhone SE baseline).
- [ ] Navigation / header collapses to a hamburger or bottom tab bar on `sm` breakpoint.
- [ ] Project list cards stack to full-width on mobile.
- [ ] Project dashboard: phase tracker scrolls horizontally or collapses to a vertical stepper on mobile; agent cards stack; task feed is full-width.
- [ ] Task output drawer is full-screen on mobile (not a side panel).
- [ ] Settings, billing, pricing pages are single-column on mobile.
- [ ] All tap targets are ≥ 44 × 44 px.
- [ ] Text is legible at default zoom (no sub-12 px body text).

### US-4 — Service worker / shell caching
- [ ] `@ducanh2912/next-pwa` is installed and wired into `next.config.js`.
- [ ] Service worker is registered automatically and visible in DevTools → Application → Service Workers.
- [ ] App shell (layout, fonts, main JS chunks) is pre-cached on install.
- [ ] `/api/*` routes are **not** cached by the service worker (always network-first).
- [ ] Second load of the app with network throttled to "offline" shows the shell instantly (no blank screen).

### US-5 — Offline fallback
- [ ] `public/offline.html` (or `app/offline/page.tsx`) renders a branded message: "You're offline — reconnect to continue working."
- [ ] Navigating to any page while offline shows the fallback instead of the browser's default error.

### US-6 — Install prompt component
- [ ] `components/InstallPrompt.tsx` listens for the `beforeinstallprompt` event (Chrome/Edge/Android).
- [ ] When the event fires, a dismissible banner appears at the bottom of the screen: "Install Orchestrator — Add to home screen for the best experience" + "Install" button + "×" dismiss.
- [ ] Clicking "Install" calls `prompt()` on the deferred event.
- [ ] Dismissed state is saved in `localStorage` so the banner does not re-appear after dismissal.
- [ ] The component is `"use client"` and rendered in the root layout only on mobile (`navigator.standalone === false` guard for iOS).
- [ ] The banner does not appear on desktop browsers.

---

## Technical Scope

### Frontend (Next.js)

**New files**
- `app/manifest.ts` — Next.js 14 App Router manifest route (replaces a static `manifest.json`)
- `app/offline/page.tsx` — branded offline fallback page
- `components/InstallPrompt.tsx` — "Add to Home Screen" banner component
- `public/icons/icon-192.png`, `icon-384.png`, `icon-512.png` — PWA icons (generated programmatically or via sharp during build, or committed as static PNGs)
- `public/offline.html` — static fallback served by the service worker for navigation requests when offline

**Modified files**
- `next.config.js` (or `next.config.ts`) — wrap with `withPWA({ dest: "public", … })`
- `app/layout.tsx` — add iOS meta tags, `<link rel="manifest">` (handled automatically by Next.js manifest route), `InstallPrompt` component
- All page/layout files below — responsive Tailwind classes

**Responsive redesign targets** (Tailwind `sm:` / `md:` breakpoints)
| File | Changes |
|---|---|
| `app/app/page.tsx` | Project list cards → full-width on mobile; header → single row |
| `app/app/projects/[id]/page.tsx` | Phase tracker → horizontal scroll; agent cards → 1-col; task drawer → full-screen sheet on mobile |
| `app/app/agents/page.tsx` | Agent template list → single column |
| `app/app/projects/[id]/agents/page.tsx` | Same |
| `app/app/settings/page.tsx` | Already narrow (max-w-3xl) — minor padding tweaks |
| `app/app/billing/page.tsx` | Tier cards → stack vertically |
| `app/pricing/page.tsx` | Tier comparison → horizontal scroll or stacked cards |
| `app/auth/page.tsx` | Already centered card — minor padding |
| Shared nav/header component | Mobile hamburger or bottom nav strip |

### Backend (FastAPI)
- **None** — no backend changes required.

### Data Models
- **None.**

### Dependencies (frontend)
- `@ducanh2912/next-pwa` — maintained Next.js 14 App Router–compatible PWA wrapper
- `sharp` (already a Next.js transitive dep) — used optionally for icon generation script

---

## Out of Scope
- Push notifications (requires a notification backend and service worker `push` handler — future feature)
- Background sync / offline write queue (agents require live API calls)
- React Native or Capacitor wrapper (PWA approach is sufficient)
- App Store / Play Store submission
- Offline-capable project creation or agent runs (read-only shell caching only)
- Dark/light mode toggle (app is dark-only)

---

## Open Questions
- None — scope is well-defined.
