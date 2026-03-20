# Architecture Research

**Domain:** Mobile PWA enhancements for Next.js 14 App Router farm operations portal
**Researched:** 2026-03-20
**Confidence:** HIGH (based on existing codebase analysis + verified Serwist/Next.js docs)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER / PWA SHELL                          │
├───────────────────────────────┬─────────────────────────────────────┤
│   Mobile Layout Layer         │   Desktop Layout Layer              │
│   (Tailwind responsive)       │   (existing layout unchanged)       │
│  ┌───────────────────────┐    │  ┌──────────────────────────────┐   │
│  │  MobileNav (bottom)   │    │  │  BannerSection (existing)    │   │
│  │  QuickDashboard       │    │  │  Module pages (existing)     │   │
│  │  TouchForm components │    │  │  EmbedFrame (existing)       │   │
│  └───────────────────────┘    │  └──────────────────────────────┘   │
├───────────────────────────────┴─────────────────────────────────────┤
│                        SERVICE WORKER (Serwist)                     │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │ Precache     │  │ Runtime Cache   │  │ Offline Queue Drain    │  │
│  │ (app shell)  │  │ (API responses) │  │ (on navigator.online)  │  │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                     OFFLINE LAYER (IndexedDB)                       │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐    │
│  │  operation-queue     │   │  crop-plan-cache + new stores    │    │
│  │  (existing)          │   │  (dashboard-cache, field-notes)  │    │
│  └──────────────────────┘   └──────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                    NEXT.JS APP ROUTER (server)                      │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────┐     │
│  │  Page Layer  │  │  API Layer    │  │  Auth / Middleware     │     │
│  │  (protected) │  │  /api/mobile/ │  │  (unchanged)          │     │
│  └──────────────┘  └───────────────┘  └───────────────────────┘     │
├─────────────────────────────────────────────────────────────────────┤
│                    SUPABASE (source of truth)                       │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────┐     │
│  │  Auth        │  │  DB + RLS     │  │  Realtime (optional)  │     │
│  └──────────────┘  └───────────────┘  └───────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `MobileNav` | Bottom navigation bar for mobile, hides on desktop | Layout layer only; reads module list from `modules.ts` |
| `QuickDashboard` | Condensed module-tile view for small screens | Supabase (module_access), `modules.ts` |
| `TouchFormWrapper` | Touch-friendly form shell (larger hit targets, stacked layout) | Wraps existing form components; no new data dependencies |
| `OfflineBanner` | Shows connectivity status and pending-sync count | IndexedDB operation-queue (read-only count) |
| `EmbedFrame` (enhanced) | Renders iframe for embedded modules; adds mobile fallback UI | modules.ts embedKey; Caddy proxy; navigator.onLine |
| `MobileInstallPrompt` | PWA install banner (beforeinstallprompt capture) | Browser install API only |
| Service Worker (`sw.ts`) | Precache app shell; runtime-cache API responses; listen for sync events | Serwist runtime; IndexedDB queue; /api/* endpoints |
| Offline sync (`crop-plan-sync.ts` + new peers) | Drain IndexedDB queue → POST to /api/mobile/* on reconnect | IndexedDB, /api/mobile/* |
| `src/lib/offline/db.ts` | IndexedDB singleton; schema for all offline stores | Called by sync modules and client components |
| `/api/mobile/*` routes | Accept queued writes from field; no module guard | Supabase server client; guard.ts (optional for some endpoints) |

---

## Recommended Project Structure

Only new/changed paths are shown. Existing paths stay where they are.

```
src/
├── app/
│   └── (protected)/
│       ├── layout.tsx              # ADD: mobile nav slot + responsive shell
│       ├── dashboard/
│       │   └── page.tsx            # MODIFY: responsive grid (existing tiles)
│       └── app/
│           └── [module]/
│               └── page.tsx        # MODIFY: mobile embed fallback UI
│
├── components/
│   ├── layout/
│   │   ├── MobileNav.tsx           # NEW: bottom nav for mobile
│   │   └── MobileShell.tsx         # NEW: viewport wrapper (safe-area insets)
│   ├── dashboard/
│   │   └── QuickDashboard.tsx      # NEW: condensed mobile tile grid
│   ├── pwa/
│   │   ├── InstallPrompt.tsx       # MODIFY: improve UX (existing file)
│   │   ├── OfflineBanner.tsx       # MODIFY: add pending-sync count (existing)
│   │   └── MobileInstallGuide.tsx  # NEW: add-to-home-screen instructions
│   ├── embed/
│   │   └── EmbedFallback.tsx       # NEW: mobile message for iframe modules
│   └── forms/
│       └── TouchField.tsx          # NEW: touch-optimized input wrapper
│
├── lib/
│   └── offline/
│       ├── db.ts                   # MODIFY: add field-notes + dashboard-cache stores
│       ├── types.ts                # MODIFY: add FieldNote, DashboardSnapshot types
│       ├── crop-plan-sync.ts       # EXISTS: already drains crop-plan queue
│       ├── field-notes-sync.ts     # NEW: drain field-notes queue → /api/mobile/notes
│       └── sync-manager.ts         # NEW: orchestrate all sync modules on reconnect
│
└── sw.ts                           # MODIFY: add runtime caching rules + sync listener
```

### Structure Rationale

- **`components/layout/`**: Mobile nav lives here beside existing `BannerSection`; both are layout concerns and the protected layout.tsx decides which to render.
- **`components/embed/`**: Separating the mobile embed fallback from `embed-frame.tsx` avoids inflating the existing component with device-detection logic.
- **`lib/offline/sync-manager.ts`**: A single entry point for all sync operations prevents the service worker from having to know about individual sync modules. The SW fires one event; sync-manager dispatches to all queues.
- **Mobile routes are not created** — responsive design handles layout differences. Separate `/mobile/*` routes would duplicate business logic, split middleware concerns, and require maintaining two route trees. The existing module structure is clean; Tailwind breakpoints are the right seam.

---

## Architectural Patterns

### Pattern 1: Responsive-First, Not Mobile-Separate Routes

**What:** Use Tailwind CSS breakpoints (`sm:`, `md:`, `lg:`) to render the correct UI in a single route, with conditional component rendering for structurally different mobile elements (e.g., bottom nav vs. top banner).

**When to use:** Always — for dashboard, module pages, forms, login. The only exception is the embed router (`[module]/page.tsx`), which renders an iframe full-screen; mobile gets a fallback message component instead.

**Trade-offs:** Pro — single source of truth per route, no logic duplication, auth/access control is unchanged. Con — some pages need non-trivial layout refactoring. Worth it: maintaining two parallel route trees is a maintenance trap.

**Example:**
```typescript
// src/app/(protected)/layout.tsx
// Render bottom nav on mobile, existing banner on desktop
export default function ProtectedLayout({ children }) {
  return (
    <div className="min-h-screen">
      <BannerSection className="hidden md:flex" />     {/* desktop */}
      <main className="pb-16 md:pb-0">{children}</main>
      <MobileNav className="flex md:hidden" />          {/* mobile */}
    </div>
  )
}
```

### Pattern 2: Foreground Queue + Online-Event Drain (not Background Sync API)

**What:** When a user submits field data offline, write immediately to IndexedDB operation-queue with status `pending`. On `navigator.online` event (foreground) or service worker `sync` event (background), call `sync-manager.ts` which drains all pending queues by POSTing to `/api/mobile/*`.

**When to use:** All field data writes — field notes, crop plan edits, equipment logs. The Background Sync API (`SyncManager`) is used as an enhancement layer over the existing foreground queue, not a replacement.

**Trade-offs:** Foreground queue is reliable and debuggable; Background Sync API provides retry-after-close on supporting browsers. Using both gives maximum coverage. The existing `crop-plan-sync.ts` already implements the foreground half — extend it rather than replace.

**Example:**
```typescript
// src/lib/offline/sync-manager.ts
export async function drainAllQueues() {
  await drainCropPlanQueue()    // existing
  await drainFieldNotesQueue()  // new
  // additional queues added here as features grow
}

// Called from both:
// 1. navigator.online event listener (client component)
// 2. service worker 'sync' event handler (sw.ts)
```

### Pattern 3: Serwist Runtime Caching — Network-First for API, CacheFirst for Static

**What:** The service worker uses two distinct caching strategies: `NetworkFirst` for `/api/mobile/*` (freshness critical, fall back to cache offline), `CacheFirst` for static assets and fonts (stability critical, never stale).

**When to use:** The existing `sw.ts` already uses Serwist. Add `runtimeCaching` entries — do not rewrite the SW from scratch.

**Trade-offs:** `NetworkFirst` adds latency when online (network round-trip before cache). For a farm ops portal on rural connectivity, the offline fallback value outweighs the latency cost. Stale-While-Revalidate is a second option for non-critical API responses (e.g., field lists that change infrequently).

**Example:**
```typescript
// src/sw.ts — runtime caching additions
defaultHandler: new NetworkFirst({
  cacheName: 'mobile-api-cache',
  matchOptions: { ignoreSearch: false },
  plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 })]
}),
runtimeCaching: [
  {
    matcher: /^\/api\/mobile\//,
    handler: new NetworkFirst({ cacheName: 'mobile-api' }),
  },
  {
    matcher: /\.(png|jpg|svg|woff2)$/,
    handler: new CacheFirst({ cacheName: 'static-assets' }),
  }
]
```

### Pattern 4: Iframe Modules — Graceful Mobile Degradation

**What:** Embedded modules (grain-tickets, farm-budget, etc.) use iframes proxied via Caddy at `/embed/*`. On mobile, iframes are problematic: Safari resizes them to content height regardless of CSS, touch events may not propagate correctly, and offline mode cannot cache cross-origin iframe content. The correct pattern is: detect mobile viewport in `EmbedFrame.tsx`, render a fallback message component instead of the iframe, and provide a button to open the embedded app in a new browser tab.

**When to use:** Any module where `module.type === 'embed'` and the viewport is mobile (`window.innerWidth < 768` or a CSS-based media query check via a hook).

**Trade-offs:** Mobile users cannot use embedded modules inline. This is the correct trade-off: a broken iframe experience (double scrollbars, unresponsive touch, iframe dancing) is worse than a clear "open in browser" call to action. Native modules are fully accessible on mobile. Embedded module mobile support is out of scope for this milestone per PROJECT.md.

**Example:**
```typescript
// src/components/embed/EmbedFallback.tsx
export function EmbedFallback({ module }: { module: Module }) {
  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <p>This module is best used on desktop.</p>
      <a href={module.embedUrl} target="_blank" rel="noopener noreferrer"
         className="btn-primary">
        Open {module.label} in browser
      </a>
    </div>
  )
}
```

---

## Data Flow

### Request Flow — Online

```
User action (mobile browser)
    ↓
React component (client)
    ↓
fetch() → /api/mobile/* or /api/{module}/*
    ↓
Middleware (auth check) → Route handler (guard check)
    ↓
Supabase DB query
    ↓
NextResponse.json → Component state update → Re-render
```

### Request Flow — Offline Write

```
User submits field note (no connectivity)
    ↓
Client detects navigator.onLine === false
    ↓
Write to IndexedDB operation-queue (status: 'pending')
    ↓
Optimistic UI update (show "saved locally")
    ↓
OfflineBanner shows pending count
    ↓
[connectivity restored]
    ↓
navigator 'online' event OR service worker 'sync' event
    ↓
sync-manager.ts → drainAllQueues()
    ↓
POST to /api/mobile/notes (or appropriate endpoint)
    ↓
200 OK → mark operation 'synced' in IndexedDB → banner clears
```

### State Management

```
Source of truth:  Supabase DB (server)
        ↓ (sync on reconnect)
Offline state:    IndexedDB (operation-queue, crop-plan-cache, field-notes-cache)
        ↓ (read for UI)
Client state:     React useState / server component initial props
        ↓ (ephemeral)
UI state:         localStorage (theme, text-scale — unchanged)
```

### Data Flow — Module Access (unchanged, shown for clarity)

```
User navigates to /app/{moduleId}
    ↓
middleware.ts → module_access table check
    ↓ (denied)              ↓ (granted)
redirect /dashboard     Server component fetches data
?denied={moduleId}          ↓
                        Render module page (responsive layout)
```

---

## Scaling Considerations

This is an internal tool for 2-5 users. Scaling is not a concern. Architecture should optimize for maintainability and offline reliability, not throughput.

| Scale | Architecture |
|-------|-------------|
| 2-5 users (current) | Single DigitalOcean Droplet + PM2 is correct. No changes needed. |
| 5-20 users | Same architecture. IndexedDB queue patterns hold fine. |
| 20+ users | Would need sync conflict resolution strategy (last-write-wins is fine for now; flag for later). |

### Scaling Priorities (if ever needed)

1. **First bottleneck:** Offline queue conflicts (two field team members editing same record offline). Mitigation: add `user_id` + `timestamp` to queue operations now; conflict resolution can be added later without schema changes.
2. **Second bottleneck:** Service worker cache size on low-storage devices. Mitigation: `ExpirationPlugin` with `maxEntries` limits already available in Serwist.

---

## Anti-Patterns

### Anti-Pattern 1: Separate `/mobile/*` Route Tree

**What people do:** Create `/mobile/dashboard`, `/mobile/app/fsa-578`, etc. as separate routes with mobile-specific page components.

**Why it's wrong:** Duplicates business logic, access control checks, and data fetching. Middleware module access guards must be replicated. Two trees drift apart. Auth callback and session handling becomes ambiguous.

**Do this instead:** Single route tree. Tailwind breakpoints for layout differences. Conditional component rendering for structurally divergent elements (bottom nav, condensed dashboard). The only "mobile-specific" code is layout and UI components — not routes.

### Anti-Pattern 2: Iframe Mobile "Fix" via CSS Hacks

**What people do:** Apply `height: 100vh !important`, `overflow: hidden`, `transform: scale()`, or postMessage resize hacks to make embedded Express apps work on mobile.

**Why it's wrong:** Mobile Safari ignores most iframe height constraints. Resize hacks cause "iframe dancing" (resize → scrollbar appears → content reflows → resize again). Touch events may not propagate to the iframe. This path leads to a broken, janky experience that undermines the PWA goal.

**Do this instead:** Detect mobile, render `EmbedFallback` with a link to open the Express app directly in a tab. Accept that embedded modules are desktop-only for this milestone.

### Anti-Pattern 3: Replacing the Existing Offline Layer

**What people do:** Scrap `crop-plan-sync.ts` and rewrite a unified offline system from scratch.

**Why it's wrong:** The existing offline layer works. `drainCropPlanQueue()` is tested, deployed, and running. Rewriting introduces regression risk with no user-facing benefit.

**Do this instead:** Extend `db.ts` with new stores. Add new sync modules alongside the existing one. Wire everything through `sync-manager.ts` as the single dispatch point. The existing code is composable — use it.

### Anti-Pattern 4: Using Background Sync API Exclusively

**What people do:** Replace the `navigator.online` foreground queue drain with `ServiceWorkerRegistration.sync.register()` only.

**Why it's wrong:** Background Sync API browser support is still incomplete (Safari added partial support only). In a rural farm setting where the portal must be reliable, betting everything on Background Sync API means failures on iOS devices. The foreground queue drain on `navigator.online` is the reliable baseline.

**Do this instead:** Use both. `navigator.online` event → foreground drain (always works). `ServiceWorkerRegistration.sync.register()` → background drain (enhancement for supporting browsers). The `sync-manager.drainAllQueues()` function is called by both paths.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Unchanged — cookie-based session via middleware | No mobile-specific changes needed |
| Supabase DB | Unchanged — server components + API routes | Mobile reads go through `/api/mobile/*` |
| Caddy proxy (`/embed/*`) | Unchanged — Express apps via reverse proxy | Mobile clients get `EmbedFallback` instead of iframe |
| DigitalOcean Droplet | Unchanged — PM2 from `/var/www/` | No infrastructure changes for this milestone |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `sw.ts` ↔ `sync-manager.ts` | Service worker fires `sync` event; client-side `sync-manager` drains queues | SW cannot import TS modules directly; queue drain logic stays in client-side lib |
| `MobileNav` ↔ `modules.ts` | Direct import of module registry | MobileNav reads only `live` modules the user has access; access state passed as prop from layout |
| `OfflineBanner` ↔ `db.ts` | Client component calls `getDb()` to count pending operations | Polling interval (5s) or IDBObserver pattern — polling is simpler and sufficient for this team size |
| `EmbedFrame` ↔ `EmbedFallback` | `EmbedFrame.tsx` conditionally renders one or the other | Device detection via `useIsMobile()` hook (window.matchMedia inside useEffect) — not user-agent string |
| Field-notes sync ↔ `/api/mobile/notes` | POST queued operations on drain | `/api/mobile/notes` route needs to be created as part of field-notes feature |

---

## Build Order Implications

Dependencies between components determine which must be built first:

**Phase 1 — Foundation (no dependencies on new code):**
1. `MobileShell.tsx` + safe-area CSS tokens — all other mobile layout depends on this
2. `MobileNav.tsx` — depends on MobileShell + modules.ts (already exists)
3. Responsive layout pass on `(protected)/layout.tsx` and `dashboard/page.tsx`

**Phase 2 — Offline Enhancement (depends on Phase 1 for UI feedback):**
1. Extend `db.ts` + `types.ts` with new stores — all new sync modules depend on this
2. `sync-manager.ts` — depends on updated db.ts
3. `field-notes-sync.ts` — depends on sync-manager
4. `OfflineBanner` pending-count enhancement — depends on db.ts read

**Phase 3 — Service Worker (depends on Phase 2 sync architecture):**
1. `sw.ts` runtime caching additions — depends on knowing which API routes to cache
2. Service worker `sync` event → sync-manager.drainAllQueues() wiring

**Phase 4 — Embed Handling (depends on Phase 1 layout):**
1. `EmbedFallback.tsx` + `useIsMobile()` hook
2. `EmbedFrame.tsx` modification to conditionally render fallback

**Phase 5 — PWA Install Experience (independent, can be done anytime after Phase 1):**
1. `MobileInstallGuide.tsx`
2. `InstallPrompt.tsx` improvements

---

## Sources

- Next.js official PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Serwist Next.js getting started: https://serwist.pages.dev/docs/next/getting-started
- Serwist runtime caching strategies: https://serwist.pages.dev/docs/serwist/runtime-caching/caching-strategies
- Serwist NetworkFirst strategy: https://serwist.pages.dev/docs/serwist/runtime-caching/caching-strategies/network-first
- MDN — Offline and background operation in PWAs: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- Foreground Queue vs Background Sync patterns: https://blog.tomaszgil.me/offline-support-in-web-apps-foreground-queue-vs-background-sync
- Offline sync conflict resolution patterns (Feb 2026): https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/
- PWA iframe handling patterns: https://pwafire.org/developer/codelabs/how-to-handle-iframes-in-pwa/
- Responsive iframe problems on mobile: https://www.andyshora.com/iframes-responsive-web-apps-tips.html
- Offline-first with Next.js, IndexedDB, Supabase (Jan 2026): https://medium.com/@oluwadaprof/building-an-offline-first-pwa-notes-app-with-next-js-indexeddb-and-supabase-f861aa3a06f9
- Advanced PWA: Offline, Push, Background Sync: https://rishikc.com/articles/advanced-pwa-features-offline-push-background-sync/
- Existing codebase: `/Users/glomalinguild/.planning/codebase/ARCHITECTURE.md` + `STRUCTURE.md` (HIGH confidence — direct analysis)

---
*Architecture research for: Mobile PWA enhancements — Next.js 14 App Router farm operations portal*
*Researched: 2026-03-20*
