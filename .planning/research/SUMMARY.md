# Project Research Summary

**Project:** W. Hughes Farms Glomalin Portal — Mobile PWA Enhancements
**Domain:** Mobile PWA for internal farm operations team (2-5 users, Next.js 14 / Supabase)
**Researched:** 2026-03-20
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project enhances an existing Next.js 14 farm operations portal to become genuinely usable in the field on mobile. The portal already has meaningful PWA scaffolding in place — manifest, service worker registration, IndexedDB offline layer for crop plans, Supabase auth, and Tailwind CSS — but it was built desktop-first and is effectively unusable on a phone. Research across stack tooling, competitor features, architecture patterns, and known pitfalls converges on a clear path: make the existing foundations production-quality rather than adding new infrastructure. The recommended approach is responsive-first layout via Tailwind breakpoints (no separate mobile routes), extended offline sync via the existing IndexedDB queue pattern, Serwist for service worker management, and web-push for push notifications — all self-hosted on the existing DigitalOcean droplet.

The critical risks are concentrated in two areas: offline data integrity and iOS Safari behavior. Rural cellular connectivity makes `navigator.onLine` an unreliable sync trigger; a reachability probe and exponential backoff are required. iOS Safari requires PWA home-screen installation before Web Push works, does not fire `beforeinstallprompt`, and has historically inconsistent service worker behavior. The existing operation queue pattern is solid but must be extended with conflict metadata (`device_id`, `client_version`) before it is applied to any module beyond crop plans — silent last-write-wins data loss on a 2-5 person team is recoverable only if it surfaces visibly.

The feature set for a v1 that a field crew will actually adopt is narrow: responsive layouts, touch-friendly forms, offline read access, visible sync status, and a working install prompt. Everything else — field observation submission, push notifications, high-contrast mode, photo attachments — belongs in v1.x and v2+ once daily mobile use is validated. Commercial farm management apps (Farmbrite, Agworld) solve this with native apps; the PWA approach is appropriate for a small internal team at zero app-store overhead, with the explicit tradeoff that embedded iframe modules are desktop-only for this milestone.

---

## Key Findings

### Recommended Stack

The portal's existing PWA scaffolding should be migrated from the abandoned `next-pwa` package to `@serwist/next` (^9.5.7), the actively maintained Workbox-based successor explicitly recommended in Next.js's official PWA guide (updated Feb 2026). The existing `idb`-based crop-plan sync should stay; `dexie` (^4.x) is recommended for any new offline stores where reactive queries (`useLiveQuery`) and schema versioning are needed. TanStack Query v5 with `persistQueryClient` adds offline-first server state management. Push notifications are handled server-side with `web-push` (^3.6.7) and stored subscriptions in a Supabase `push_subscriptions` table — no third-party service required. Mobile UI uses `konsta` for touch-optimized native-feeling components (selectively, not wholesale) and `sonner` for toast notifications.

**Core technologies:**
- `@serwist/next` ^9.5.7: Service worker with Workbox precaching — actively maintained, Next.js 14 compatible, replaces abandoned `next-pwa`
- `web-push` ^3.6.7: Server-side VAPID push notifications — self-hosted, no Google/Firebase dependency
- `dexie` ^4.x: IndexedDB for new offline stores — `useLiveQuery` hook, schema versioning; add alongside existing `idb`
- `@tanstack/react-query` ^5.x: Offline-first server state, `networkMode: 'offlineFirst'`, `persistQueryClient`
- `konsta` ^2.x: Touch-optimized mobile components (bottom sheets, form inputs) built with Tailwind
- `sonner` ^1.x: Toast notifications for sync status and offline/online state
- `@playwright/test` + `@lhci/cli`: E2E mobile testing with offline simulation and PWA audit scoring

**Critical version notes:** `@serwist/next` requires webpack, not Turbopack. `web-push` is server-side only — never import in client components. `@tanstack/react-query` v5 is a breaking change from v4; audit current portal for v4 before installing.

### Expected Features

The feature boundary for a field crew to prefer this tool over paper and text messages is narrower than it feels. The dependency chain is strict: responsive layouts are the prerequisite for everything; offline write queue and sync status indicator must ship together (without visible sync state, crews submit forms twice and generate duplicates); PWA install must precede push notifications on iOS.

**Must have (table stakes):**
- Mobile-responsive layouts for all native module pages (FSA 578, Insurance, Claims, Macro Rollup) — without this the portal is functionally unusable on phones
- Touch-friendly form controls — min 44px tap targets, single-column, large labels, `text-base` minimum
- Sync status indicator (online/offline banner + pending queue count) — critical trust signal, must ship with any write capability
- Offline read access for dashboard + crop plan data — extend existing IndexedDB caching
- PWA install prompt improvement — Android `beforeinstallprompt` UX + explicit iOS Safari instructions (Share > Add to Home Screen)

**Should have (v1.x after validation):**
- Field observation submission form with offline queue — once crew uses portal daily
- Optimistic UI + submission confirmation toasts — once crew reports uncertainty after submit
- Push notifications for deadline alerts (insurance, claims)
- One-tap quick actions on dashboard cards
- Service worker update notification UI (before promoting install prompt)

**Defer (v2+):**
- High-contrast / outdoor display mode
- Photo attachments on field observations (file upload queue adds significant complexity)
- Per-module offline views beyond crop plans
- Real-time collaborative editing (CRDT complexity, not needed for 2-5 person team)
- Native iOS/Android app (contradicts project constraints)

### Architecture Approach

The architecture is additive to what exists: a single route tree with Tailwind breakpoints for responsive layout (no separate `/mobile/*` routes), a bottom nav component rendered conditionally in the protected layout, a `sync-manager.ts` orchestrator that drains all IndexedDB queues on reconnect (extending the existing `crop-plan-sync.ts` pattern), and Serwist runtime caching rules added to the existing `sw.ts`. Embedded iframe modules get a graceful `EmbedFallback` component on mobile — it is architecturally impossible for the parent service worker to cache cross-origin iframe content, and iframe CSS hacks on iOS Safari produce scroll traps and layout breaks worse than showing a fallback.

**Major components:**
1. `MobileShell.tsx` + `MobileNav.tsx` — safe-area viewport wrapper and bottom navigation bar; all other mobile layout depends on this
2. `OfflineBanner.tsx` (enhanced) — connectivity state + pending-queue count; reads IndexedDB operation-queue directly
3. `sync-manager.ts` — single dispatch point for all queue drains; called by both `navigator.online` event and service worker `sync` event
4. `db.ts` (extended) — add `field-notes` and `dashboard-cache` stores; schema versioning via `DB_VERSION` increment
5. `EmbedFallback.tsx` — mobile fallback for iframe modules; detect mobile via `useIsMobile()` hook (window.matchMedia), not user-agent
6. `InstallPrompt.tsx` + `MobileInstallGuide.tsx` — improved Android install UX and explicit iOS step-by-step instructions
7. `sw.ts` (extended) — add `NetworkFirst` for `/api/mobile/*`, `CacheFirst` for static assets; wire `sync` event to sync-manager

### Critical Pitfalls

1. **Offline sync conflict silently overwrites field data** — add `device_id` + `client_version` to every queued operation before extending sync to any module beyond crop plans; server returns 409 Conflict rather than silently accepting last-write-wins; surface conflicts in UI, never silent.

2. **Service worker caches Next.js RSC payloads as stale HTML** — never use `stale-while-revalidate` or `cache-first` for `/app/*` routes; use `NetworkFirst` for all dynamic routes and API endpoints; stale claim deadlines and insurance data served from cache are a real operational risk.

3. **`navigator.onLine` is unreliable on rural LTE** — implement a reachability probe (HEAD request to `/api/health`) before attempting queue drain; add exponential backoff (1s → 2s → 4s → max 60s); process queue in batches of 3-5, not one burst, so a mid-sync connection drop leaves queue partially drained rather than corrupted.

4. **Service worker update strands installed PWA users on old version** — implement an update notification banner (`navigator.serviceWorker.waiting` → "New version available — tap to update") with explicit user confirmation before `skipWaiting()`; do not auto-skip while sync may be in flight.

5. **iOS Safari requires PWA install for push notifications and does not fire `beforeinstallprompt`** — build explicit in-app install instructions for iOS before any push notification opt-in flow; track install state in localStorage; defer Android install prompt until after first meaningful user action.

---

## Implications for Roadmap

Based on the dependency chain in FEATURES.md, the build order in ARCHITECTURE.md, and the phase-to-pitfall mapping in PITFALLS.md, five phases emerge. The ordering is non-negotiable: layout is the prerequisite, offline data integrity must be hardened before it's extended, and the install/push experience comes last because it depends on the rest working reliably.

### Phase 1: Mobile Layout Foundation

**Rationale:** All other mobile features depend on responsive layouts. The current portal is desktop-first; until basic navigation and module pages render correctly on a phone, nothing else matters. This phase has the clearest scope and fewest dependencies.

**Delivers:** A portal that is navigable and readable on mobile; bottom nav; touch-friendly layouts for all native module pages; safe-area insets; embedded module graceful degradation.

**Addresses (from FEATURES.md):** Mobile-responsive layouts (P1), touch-friendly form controls (P1), module-aware dashboard (P2 prerequisite).

**Avoids (from PITFALLS.md):** Iframe mobile CSS hacks (use `EmbedFallback` instead), desktop scroll tables breaking on mobile (audit `overflow-x-auto` + CLU virtualization), touch targets too small (44px minimum audit).

**Stack:** Tailwind CSS (existing), `konsta` for new form components, `MobileShell.tsx` + `MobileNav.tsx` new components.

### Phase 2: Offline Sync Hardening

**Rationale:** The existing offline layer works but has known gaps: no conflict metadata on the operation queue, `navigator.onLine` as sole connectivity signal, no exponential backoff verification, and no audit of service worker caching strategies. These must be fixed before the queue pattern is extended to field observations or other modules. Shipping with these gaps and then extending the pattern locks in the debt permanently.

**Delivers:** Hardened offline queue with conflict metadata, reachability probe replacing raw `navigator.onLine`, verified exponential backoff, `sync-manager.ts` orchestrator wiring all queue drains, enhanced `OfflineBanner` with pending count, IndexedDB stores extended for dashboard cache.

**Addresses (from FEATURES.md):** Offline read access (P1), sync status indicator (P1), offline write queue with sync-on-reconnect (P1 prerequisite for field observations).

**Avoids (from PITFALLS.md):** Silent data loss from conflict overwrites (add `device_id` + `client_version` now), `navigator.onLine` unreliability in rural LTE (reachability probe), queue corruption from burst sync (batch processing), IndexedDB data persisting after logout (clear on logout).

**Stack:** Extend `src/lib/offline/db.ts`, add `sync-manager.ts`, `dexie` for new stores, `sonner` for sync toasts.

### Phase 3: Service Worker and Caching Strategy

**Rationale:** The service worker must be migrated from `next-pwa` (abandoned) to Serwist and properly configured with caching strategies before the offline experience is promoted to users. RSC payload staling and unbounded cache growth are deployment-time risks, not development-time risks — they surface after install in production. This phase must complete before any install prompt improvements.

**Delivers:** `@serwist/next` migration, `NetworkFirst` for all API and dynamic routes, `CacheFirst` for static assets with `ExpirationPlugin` size limits, service worker update notification UI, RSC payload exclusion from page cache.

**Addresses (from FEATURES.md):** Offline read access reliability, PWA installability prerequisites.

**Avoids (from PITFALLS.md):** Stale RSC payloads served from cache after deploy, service worker update stranding users, unbounded cache growth evicting entire PWA on iOS storage pressure.

**Stack:** `@serwist/next` ^9.5.7, `serwist` (dev dep), `next dev --experimental-https` for local testing, Playwright for offline simulation verification.

### Phase 4: PWA Install and Field Data Entry

**Rationale:** Once the layout, offline layer, and service worker are solid, the install experience can be promoted and field data entry can be added. These ship together because field observation submission requires the offline write queue (Phase 2), and push notifications require the install experience (iOS). This is also the first phase that adds net-new user-facing functionality beyond making existing features mobile-accessible.

**Delivers:** Improved Android install prompt (deferred until meaningful engagement), explicit iOS install instructions component, `MobileInstallGuide.tsx`, field observation submission form with offline queue, optimistic UI with toasts, one-tap quick actions on dashboard.

**Addresses (from FEATURES.md):** PWA install prompt improvement (P1), field observation submission (P2), optimistic UI + toasts (P2), one-tap actions (P2).

**Avoids (from PITFALLS.md):** Install prompt shown before trust is established (defer until post-engagement), iOS install prompt not firing `beforeinstallprompt` (explicit instructions instead), form submitting offline with no feedback (detect offline state pre-submit, queue immediately with confirmation).

**Stack:** `MobileInstallGuide.tsx` (new), `InstallPrompt.tsx` (enhanced), `sonner` toasts, field-notes offline queue + `/api/mobile/notes` API route.

### Phase 5: Push Notifications

**Rationale:** Push notifications are last because they depend on the install experience (Phase 4) being solid on iOS, the service worker being properly configured (Phase 3), and a Supabase webhook or edge function trigger being designed. They also have the most iOS-specific complexity and testing overhead. Push delivers outsized value for deadline alerts (insurance, claims) but should not be attempted until the core PWA is stable.

**Delivers:** VAPID key generation, `push_subscriptions` Supabase table, browser subscribe flow, server-side `web-push` send from Server Actions or API routes, notification trigger for deadline alerts (insurance, claims deadlines).

**Addresses (from FEATURES.md):** Push notifications for deadline alerts (P2).

**Avoids (from PITFALLS.md):** Push on iOS requiring PWA install first (enforced by Phase 4 ordering), service role key used in mobile API routes (replace with user-scoped auth tokens before this phase).

**Stack:** `web-push` ^3.6.7, VAPID keys in env vars, Supabase `push_subscriptions` table, Next.js Server Actions.

---

### Phase Ordering Rationale

- Layout (Phase 1) is the strict prerequisite: no other mobile work is testable or usable without it.
- Offline hardening (Phase 2) must precede field data entry: extending a broken queue pattern to new modules locks in data-loss risk.
- Service worker migration (Phase 3) must precede promoting install: a misconfigured SW serving stale data to an installed PWA is harder to recover from than a misconfigured SW in a browser tab.
- Install + field data (Phase 4) are coupled: field observation forms need the offline queue (Phase 2) and install instructions are needed before push (Phase 5).
- Push notifications (Phase 5) are last by dependency: iOS requires install, SW must be stable, and backend webhook triggers need planning.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Service Worker):** Serwist configuration for Next.js App Router RSC payloads is nuanced; audit the existing `sw.ts` and `layout.tsx` service worker registration code before designing the migration. The `@serwist/turbopack` alpha is out of scope but flag if Turbopack migration is planned.
- **Phase 5 (Push Notifications):** Supabase edge function vs. webhook trigger design for deadline alerts needs investigation against actual module data schemas. iOS Safari push permission UX is evolving rapidly; verify current behavior on iOS 18.x before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Mobile Layout):** Tailwind responsive patterns are extremely well-documented; Konsta UI has a Next.js integration guide; no novel patterns required.
- **Phase 2 (Offline Sync Hardening):** The existing queue pattern is the right foundation; extension is additive; Dexie and TanStack Query have mature documentation.
- **Phase 4 (Install + Field Data):** Install prompt patterns and iOS install instruction UX are well-documented; field observation form is standard CRUD with offline queue.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | `@serwist/next` 9.5.7 and `web-push` verified via official Next.js PWA guide (Feb 2026). Dexie v4 and TanStack Query v5 verified via official docs. Konsta UI version resolved from npm, not independently pinned. `@tanstack/query-sync-storage-persister` version pattern from docs, not independently version-verified. |
| Features | MEDIUM | Competitor feature analysis from commercial sources (Farmbrite, Agworld, FarmKeep) is MEDIUM confidence marketing-level data. Core feature priorities derived from MDN PWA best practices (HIGH) and agriculture UX research (MEDIUM). Anti-features well-reasoned from project constraints. |
| Architecture | HIGH | Based on direct analysis of existing codebase (`src/lib/offline/`, `src/app/api/mobile/`, `src/middleware.ts`) plus verified Serwist and Next.js docs. Build order is dependency-derived, not speculative. |
| Pitfalls | MEDIUM | Core pitfalls (stale RSC payloads, iOS Safari behavior, `navigator.onLine` unreliability) verified via official Next.js GitHub discussions and MDN. Conflict resolution risk is inferred from current queue schema — not confirmed by direct code audit of server-side handler behavior. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Server-side conflict handler behavior:** PITFALLS.md flags that the server-side queue drain handler likely applies writes in arrival order without conflict detection, but this was inferred, not confirmed by code audit. Audit `src/app/api/mobile/` and any Supabase RPC functions before Phase 2.
- **Existing service worker caching strategies:** The current SW registration in `src/app/layout.tsx` and any existing `sw.ts` runtime caching config need direct audit before Phase 3 — specifically, whether RSC payload routes are currently under `stale-while-revalidate` (the `next-pwa` default).
- **TanStack Query current version in portal:** If portal currently has TanStack Query v4, a v5 migration is a breaking change that needs a dedicated task in Phase 2 planning.
- **Supabase `push_subscriptions` table design:** The exact schema (multi-device per user, platform metadata) needs to be designed against the existing Supabase DB schema before Phase 5 planning.
- **CLU workspace virtualization scope:** PITFALLS.md flags 1000+ CLU records as a mobile performance crisis. Whether this is in scope for Phase 1 or a separate track needs a decision before Phase 1 planning begins.

---

## Sources

### Primary (HIGH confidence)
- [Next.js PWA Official Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — Serwist recommendation, web-push integration, HTTPS requirement, iOS install instructions (verified Feb 2026)
- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started) — version 9.5.7, webpack requirement
- [TanStack Query v5 persistQueryClient](https://tanstack.com/query/v5/docs/react/plugins/persistQueryClient) — offline-first patterns, `networkMode: 'offlineFirst'`
- [MDN — Offline and background operation in PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — Background Sync API browser support, Push API behavior
- [Background Sync API — Can I Use](https://caniuse.com/background-sync) — Safari unsupported as of March 2026
- [Next.js discussions: stale data with service worker](https://github.com/vercel/next.js/discussions/52024) — RSC payload staling confirmed
- [Playwright device emulation](https://playwright.dev/docs/emulation) — offline simulation, iOS/Android profiles
- Project codebase: `src/lib/offline/`, `src/app/api/mobile/`, `.planning/codebase/` — direct analysis

### Secondary (MEDIUM confidence)
- [Serwist runtime caching strategies](https://serwist.pages.dev/docs/serwist/runtime-caching/caching-strategies) — NetworkFirst, CacheFirst strategy details
- [Konsta UI Next.js integration](https://konstaui.com/react/next-js) — install guide and component overview
- [Dexie.js](https://dexie.org/) — v4, `useLiveQuery` React hook
- [Offline sync conflict resolution — Sachith Dassanayake (Feb 2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) — conflict resolution architecture
- [Farmbrite Product Features](https://www.farmbrite.com/product) — competitor feature baseline
- [MDN PWA Best Practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices) — offline-first, install prompt patterns
- [Agriculture app design guide — Gapsy Studio](https://gapsystudio.com/blog/agriculture-app-design/) — 7:1 contrast ratio, touch-first form patterns
- [Mobile form usability — UX Planet](https://uxplanet.org/mobile-form-usability-2279f672917d) — 44px touch target standards
- [IndexedDB Safari issues — pesterhazy gist](https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a) — transaction behavior on iOS

### Tertiary (LOW confidence — validate before relying on)
- [Agritech Mobile App Trends — Farmonaut](https://farmonaut.com/blogs/agritech-mobile-apps-top-7-agriculture-mobile-app-trends) — industry trends (marketing source)
- [PWA 2026 Performance Guide — digitalapplied.com](https://www.digitalapplied.com/blog/progressive-web-apps-2026-pwa-performance-guide) — single source, verify independently

---

*Research completed: 2026-03-20*
*Ready for roadmap: yes*
