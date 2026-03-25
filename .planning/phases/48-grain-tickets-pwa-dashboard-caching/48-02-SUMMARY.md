---
phase: 48-grain-tickets-pwa-dashboard-caching
plan: "02"
subsystem: ui
tags: [pwa, service-worker, offline, caching, dashboard, nextjs, react]

requires:
  - phase: 47-offline-sync-engine
    provides: SW infrastructure, IndexedDB patterns, serwist setup in src/sw.ts
  - phase: 48-01
    provides: grain-tickets offline patterns established

provides:
  - Portal service worker dashboard response caching (stale-while-revalidate)
  - /api/dashboard/summary JSON endpoint for SW-cacheable summary data
  - OfflineSummaryCards client component with offline/staleness indicators
  - 24-hour staleness warning, auto-refresh on reconnect, offline banner

affects:
  - dashboard — summary cards now client-side with offline state
  - sw.ts — dashboard-cache layer added alongside Background Sync code

tech-stack:
  added: []
  patterns:
    - Stale-while-revalidate via fetch event listener in src/sw.ts
    - Timestamp companion entries in Cache API for staleness tracking
    - Server component pre-fetches initial data, client component handles offline
    - navigator.onLine + online/offline events for connectivity detection
    - 2-second reconnect delay before background refresh

key-files:
  created:
    - glomalin-portal/src/app/api/dashboard/summary/route.ts
    - glomalin-portal/src/components/dashboard/offline-summary-cards.tsx
  modified:
    - glomalin-portal/src/sw.ts
    - glomalin-portal/src/app/(protected)/dashboard/page.tsx

key-decisions:
  - "Dashboard API route (/api/dashboard/summary) created so SW can cache a single cacheable JSON endpoint rather than intercepting Supabase SSR calls"
  - "Server component pre-fetches initial data for SSR; OfflineSummaryCards client component takes over post-hydration — avoids layout shift"
  - "SW dashboard-cache is separate from serwist precache/runtime caches — independently manageable and cleanable"
  - "Timestamp companion entries stored as {url}__timestamp in same cache — avoids separate IDB store for dashboard timing"
  - "48-hour cleanup window in activate event — generous buffer beyond 24h staleness threshold"

patterns-established:
  - "SW timestamp companion pattern: store {url}__timestamp alongside each cached response for staleness checks"
  - "SSR initial data prop pattern: server component passes pre-fetched data as prop to offline-aware client component"

requirements-completed: [GTP-02]

duration: 25min
completed: 2026-03-25
---

# Phase 48 Plan 02: Dashboard Caching Summary

**Portal dashboard caches FSA/insurance/claims summary data via service worker stale-while-revalidate, showing last-known data with staleness indicators when offline**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Extended portal `src/sw.ts` with a named `dashboard-cache` implementing stale-while-revalidate for 6 dashboard URL patterns (portal API + cross-origin Express apps)
- Created `/api/dashboard/summary` JSON endpoint that returns FSA/insurance/claims counts — designed to be SW-cacheable
- Created `OfflineSummaryCards` client component with full offline-state tracking: offline banner, 24h staleness warning, "Last updated X ago" timestamp, auto-refresh on reconnect, "no cached data" fallback
- Dashboard page.tsx now passes SSR pre-fetched data to the client component as an initial prop, avoiding layout shift while still enabling client-side offline detection

## Task Commits

1. **Task 1: Portal service worker dashboard response caching** - `21c3513` (feat)
2. **Task 2: Offline-aware dashboard page with staleness indicators** - `4bf011a` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `glomalin-portal/src/sw.ts` — Added DASHBOARD_CACHE_NAME, isDashboardRequest(), storeDashboardResponse(), handleDashboardFetch(), fetch/activate/message event listeners
- `glomalin-portal/src/app/api/dashboard/summary/route.ts` — New GET route returning FSA/insurance/claims counts + cachedAt timestamp
- `glomalin-portal/src/components/dashboard/offline-summary-cards.tsx` — Client component with isOnline state, stale detection, amber banners, reconnect refresh
- `glomalin-portal/src/app/(protected)/dashboard/page.tsx` — Replaced SummaryCards import with OfflineSummaryCards, added initialSummary prop construction

## Decisions Made

- Created a dedicated `/api/dashboard/summary` route rather than relying on the SW to intercept Supabase client-side calls. The existing dashboard is server-side rendered via Supabase SSR — there are no browser fetch requests for the SW to intercept. The new JSON endpoint is the cacheable surface.
- Server component still pre-fetches data for SSR initial render; the client OfflineSummaryCards component receives it as a prop and then takes over for client-side state management. This avoids a blank flash during hydration.
- Dashboard-cache uses a separate named cache from serwist's precache/runtime caches so it can be cleared independently via the `clear-dashboard-cache` message.
- Timestamp companion entries stored as `{url}__timestamp` within the same cache — no additional IDB store needed, consistent with the existing cache management patterns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created /api/dashboard/summary API route**
- **Found during:** Task 1 (analyzing existing dashboard architecture)
- **Issue:** The existing dashboard is a Server Component querying Supabase SSR — no browser fetch requests exist for the service worker to intercept. Without a client-fetchable API route, the SW cannot cache dashboard data.
- **Fix:** Created `/api/dashboard/summary` route that returns the same FSA/insurance/claims counts as JSON, plus a `cachedAt` timestamp. The SW caches this endpoint. The dashboard client component fetches from it.
- **Files modified:** `glomalin-portal/src/app/api/dashboard/summary/route.ts` (new)
- **Verification:** TypeScript compiles clean, endpoint returns correct JSON shape
- **Committed in:** `21c3513` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical infrastructure)
**Impact on plan:** Essential for the caching architecture to work. Server-side Supabase queries are not interceptable by a service worker — a client-fetchable endpoint is required.

## Issues Encountered

None — the architectural gap (server-side Supabase vs SW-interceptable fetch) was handled as a Rule 2 auto-fix.

## User Setup Required

None — no external service configuration required. The SW changes take effect on next service worker activation (hard refresh or version bump).

## Self-Check

- [x] `glomalin-portal/src/sw.ts` — contains `dashboard-cache` (4 occurrences), `cachedAt` (4), `stale` (1)
- [x] `glomalin-portal/src/app/api/dashboard/summary/route.ts` — exists
- [x] `glomalin-portal/src/components/dashboard/offline-summary-cards.tsx` — exists
- [x] `glomalin-portal/src/app/(protected)/dashboard/page.tsx` — contains `offline` (4 occurrences)
- [x] Commits `21c3513` and `4bf011a` exist in git log

## Self-Check: PASSED

## Next Phase Readiness

- v9.0 Phase 48 is now complete (Plan 01: grain-tickets offline entry, Plan 02: dashboard caching)
- v9.0 phases 44-48 are all done — mobile PWA + field operations logger milestone complete
- v10.0 consolidation work (phases 49-53) is already complete and was running in parallel
- Next: Phase 54 (UXN-04..09 — unified UX/navigation improvements)

---
*Phase: 48-grain-tickets-pwa-dashboard-caching*
*Completed: 2026-03-25*
