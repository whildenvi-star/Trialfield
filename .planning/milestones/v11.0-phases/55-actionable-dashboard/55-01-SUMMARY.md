---
phase: 55-actionable-dashboard
plan: 01
subsystem: api
tags: [nextjs, supabase, action-items, dashboard, promise.allsettled, graceful-degradation]

# Dependency graph
requires:
  - phase: 48-grain-tickets-pwa-dashboard-caching
    provides: Dashboard summary API route and proxy.ts pattern for server-side Express fetches
  - phase: 51-fsa-insurance-data-consolidation
    provides: clu_records, insurance_policies, claims Supabase tables
provides:
  - GET /api/dashboard/action-items endpoint aggregating 5 data sources
  - ActionItem, ActionItemGroup, ActionItemsResponse TypeScript types
  - MODULE_SOURCES display metadata constant
  - fetchGrainService proxy helper for grain-tickets Express app (port 3007)
affects: [56-aph-tracking, 57-grain-marketing, 55-actionable-dashboard-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled for all 5 sources — Supabase + Express — guarantees partial success"
    - "offline flag per ActionItemGroup: Express failures set offline: true, items stay empty"
    - "proxy.ts extended with GT_BASE constant and fetchGrainService alongside existing helpers"

key-files:
  created:
    - glomalin-portal/src/lib/action-items.ts
    - glomalin-portal/src/app/api/dashboard/action-items/route.ts
  modified:
    - glomalin-portal/src/app/api/mobile/_lib/proxy.ts

key-decisions:
  - "Supabase query failures silently skip the group — Supabase outages are rare and showing an offline badge for Supabase would be confusing vs Express apps which can genuinely be down during dev"
  - "Empty online groups are excluded from response — only groups with items OR offline state are included to keep the response clean"
  - "Budget delivery shortfall uses productId ?? productName ?? product key chain — farm-budget API uses inconsistent field names across endpoints"

patterns-established:
  - "Action item IDs are scoped to module: fsa-unreported, ins-claim-alerts, claims-open, claims-overdue, gt-unmatched, budget-delivery-shortfall"
  - "fetchGrainService follows identical pattern to fetchBudgetService — embed_session cookie with GT_BASE constant"

requirements-completed: [DASH-01, DASH-03]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 55 Plan 01: Actionable Dashboard Summary

**GET /api/dashboard/action-items aggregating 5 sources (3 Supabase + 2 Express) with Promise.allSettled graceful degradation and per-group offline flags**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T12:40:49Z
- **Completed:** 2026-03-28T12:42:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created action-items.ts with full TypeScript types (ActionItem, ActionItemGroup, ActionItemsResponse) and MODULE_SOURCES display metadata for 5 modules
- Extended proxy.ts with fetchGrainService for grain-tickets Express app (port 3007), following existing fetchBudgetService pattern
- Built GET /api/dashboard/action-items aggregating CLU unreported count, insurance claim alerts, open/overdue claims (Supabase), unmatched grain settlements, and input delivery shortfalls (Express) — all via Promise.allSettled

## Task Commits

Each task was committed atomically:

1. **Task 1: Action item types and grain-tickets proxy** - `c6977f2` (feat)
2. **Task 2: Action-items API route with Promise.allSettled degradation** - `2b37b1b` (feat)

## Files Created/Modified
- `glomalin-portal/src/lib/action-items.ts` - Severity, ActionItem, ActionItemGroup, ActionItemsResponse types and MODULE_SOURCES constant
- `glomalin-portal/src/app/api/mobile/_lib/proxy.ts` - Added GT_BASE constant and fetchGrainService export
- `glomalin-portal/src/app/api/dashboard/action-items/route.ts` - GET endpoint with 5-source aggregation, auth guard, and graceful offline degradation

## Decisions Made
- Supabase query failures silently skip the group — Supabase outages are rare; showing an offline badge would be confusing vs Express apps that can genuinely be down during development
- Empty online groups excluded from response — only groups with items OR offline state included, keeping the response payload clean for UI consumers
- Budget delivery shortfall key-chain: `productId ?? productName ?? product` — farm-budget API uses inconsistent field names across forecast and deliveries endpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Action-items API complete; Phase 55 UI plans can now build the dashboard widget consuming GET /api/dashboard/action-items
- TypeScript compiles clean, no blockers for next plan

---
*Phase: 55-actionable-dashboard*
*Completed: 2026-03-28*
