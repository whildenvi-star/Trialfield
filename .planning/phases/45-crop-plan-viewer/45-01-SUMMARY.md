---
phase: 45-crop-plan-viewer
plan: 01
subsystem: api
tags: [mobile, crop-plans, farm-budget, bff, ttl-cache, next.js]

# Dependency graph
requires:
  - phase: 44-pwa-infrastructure
    provides: IndexedDB offline data layer and CachedCropPlan types that these endpoints feed into

provides:
  - GET /api/mobile/crop-plans — field list endpoint with enterprise grouping, 60s TTL cache
  - GET /api/mobile/crop-plans/[fieldId] — field detail with inputs and planned pass checklist
  - fetchRegistryService helper in proxy.ts for farm-registry calls

affects:
  - 46-pass-confirmation
  - 47-offline-sync
  - 48-pwa-shell

# Tech tracking
tech-stack:
  added: []
  patterns: [BFF aggregation from farm-budget fields + enterprises, module-level TTL cache for mobile endpoints]

key-files:
  created:
    - glomalin-portal/src/app/api/mobile/crop-plans/route.ts
    - glomalin-portal/src/app/api/mobile/crop-plans/[fieldId]/route.ts
  modified:
    - glomalin-portal/src/app/api/mobile/_lib/proxy.ts

key-decisions:
  - "Module-level TTL cache (60s) in route.ts rather than shared cache utility — simple, zero-dependency, scoped to list endpoint"
  - "Planned passes sourced entirely from farm-budget machinery[] — organic-cert enrichment deferred to Phase 46"
  - "Detail endpoint does NOT cache — per-field detail is infrequent and staleness risk is higher"

patterns-established:
  - "BFF pattern: portal aggregates budget fields + enterprises in parallel, returns mobile-shaped response"
  - "Pass checklist shape: { id, type, passNumber, status: PLANNED, operationDate: null, operatorName: null }"
  - "Graceful degradation: 502 on upstream failure, 404 on missing field — never throw to client"

requirements-completed: [CPV-01]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 45 Plan 01: Crop Plan Viewer API Routes Summary

**BFF portal API for crop plan data — GET /api/mobile/crop-plans (TTL-cached field list) and /api/mobile/crop-plans/[fieldId] (full detail with inputs and planned pass checklist) aggregating farm-budget fields and enterprises**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T02:48:53Z
- **Completed:** 2026-03-20T02:51:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created GET /api/mobile/crop-plans returning enterprise-sorted field list from farm-budget with 60-second TTL cache, syncTimestamp, and graceful 502 on upstream failure
- Created GET /api/mobile/crop-plans/[fieldId] returning full crop plan detail: crop, variety, population, seed treatment, inputs with rates/units, and planned pass checklist from machinery entries
- Added fetchRegistryService (port 3005) to proxy.ts, following the same embed_session + 8s timeout pattern as existing helpers

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fetchRegistryService to proxy and create crop-plans list endpoint** - `54c1ade` (feat)
2. **Task 2: Create crop-plans field detail endpoint with inputs and pass checklist** - `0565db3` (feat)

## Files Created/Modified

- `glomalin-portal/src/app/api/mobile/_lib/proxy.ts` - Added REGISTRY_BASE constant and fetchRegistryService helper
- `glomalin-portal/src/app/api/mobile/crop-plans/route.ts` - Field list endpoint with parallel enterprise+field fetch, TTL cache, and enterprise sort
- `glomalin-portal/src/app/api/mobile/crop-plans/[fieldId]/route.ts` - Field detail endpoint with inputs filtering and machinery-to-pass mapping

## Decisions Made

- Module-level TTL cache placed directly in route.ts rather than a shared cache utility — sufficient for a single endpoint, zero additional dependencies
- All passes left as PLANNED with null dates — organic-cert confirmation is Phase 46's responsibility; Phase 45 establishes the shape
- Detail endpoint intentionally not cached — per-field requests are infrequent and stale detail (wrong inputs/rates) is a higher risk than stale list data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both endpoints compile cleanly (`npx tsc --noEmit` passes with no errors)
- Response shapes match CachedCropPlan interface from lib/offline/types.ts for direct offline cache storage
- Phase 46 (pass confirmation) can now read planned passes from /api/mobile/crop-plans/[fieldId] and POST completions to organic-cert
- fetchRegistryService is available in proxy.ts for any Phase 46+ routes that need farm-registry data

---
*Phase: 45-crop-plan-viewer*
*Completed: 2026-03-20*

## Self-Check: PASSED

- proxy.ts: FOUND
- crop-plans/route.ts: FOUND
- [fieldId]/route.ts: FOUND
- SUMMARY.md: FOUND
- Commit 54c1ade: FOUND
- Commit 0565db3: FOUND
