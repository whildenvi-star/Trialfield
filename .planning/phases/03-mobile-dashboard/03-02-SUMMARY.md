---
phase: 03-mobile-dashboard
plan: 02
subsystem: ui
tags: [react, nextjs, indexeddb, offline, idb, tailwind, dashboard, mobile]

# Dependency graph
requires:
  - phase: 02-offline-sync
    provides: offlineQueue.add() API and CachedCropPlan type in src/lib/offline/db.ts and types.ts
  - phase: 03-mobile-dashboard
    plan: 01
    provides: DashboardGrid shell that renders these card components as children
provides:
  - DashboardCard generic shell with Link, module name, chevron, subtitle, children slot
  - DashboardCardSkeleton animate-pulse placeholder matching card dimensions
  - CropPlanCard reading CachedCropPlan[] showing crop/variety/acres
  - FieldOpsCard showing pending passes with inline Mark Done quick-action that writes to offlineQueue and optimistically updates local state
affects:
  - 03-mobile-dashboard plan 03+ (DashboardGrid imports these)
  - any plan adding new card types (use DashboardCard as shell)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic state: write to offlineQueue first, then setLocalPlans — guarantees no data loss"
    - "e.preventDefault() on nested button inside Link — blocks navigation for inline quick-actions"
    - "plan.fieldId (not plan.fieldName) as fieldId in QueuedOperation — correct ID for server replay"
    - "DashboardCardSkeleton: no 'use client' directive needed for pure JSX with no hooks"

key-files:
  created:
    - src/components/dashboard/DashboardCard.tsx
    - src/components/dashboard/dashboard-card-skeleton.tsx
    - src/components/dashboard/CropPlanCard.tsx
    - src/components/dashboard/FieldOpsCard.tsx
  modified: []

key-decisions:
  - "plan.fieldId used as fieldId in offlineQueue.add — CachedCropPlan.fieldId is the farm-registry ID needed for server replay; fieldName is display only"
  - "operatorId/operatorName set to empty string in FieldOpsCard — client component has no user prop; sync engine fills in from auth session on replay"
  - "PendingPass typed as interface with plan + pass tuple — avoids any and gives handleMarkDone full type context for both plan.fieldId and pass.id/type"

patterns-established:
  - "Inline quick-action pattern: button with e.preventDefault() inside Link card, offlineQueue.add() then optimistic setState in same handler"
  - "Card skeleton: no 'use client', pure animate-pulse JSX, glomalin-* tokens only"

requirements-completed: [DASH-01, DASH-03]

# Metrics
duration: 9min
completed: 2026-05-23
---

# Phase 3 Plan 02: Dashboard Card Components Summary

**Four mobile dashboard cards: generic DashboardCard shell, CropPlanCard showing crop/variety/acres, FieldOpsCard with inline Mark Done that writes to IndexedDB queue and optimistically updates state, plus animate-pulse DashboardCardSkeleton**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-23T04:45:57Z
- **Completed:** 2026-05-23T04:55:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DashboardCard: reusable Link-wrapped card shell with glomalin-* tokens only, inline SVG chevron, optional subtitle and children slot
- DashboardCardSkeleton: animate-pulse placeholder matching card dimensions, server-renderable (no 'use client')
- CropPlanCard: reads CachedCropPlan[], surfaces first plan's crop/variety/acres as subtitle, "+N more fields" for multiple plans
- FieldOpsCard: flatMaps pending passes (status=PLANNED) across all plans, Mark Done button calls offlineQueue.add() then optimistically removes pass from localPlans state; e.preventDefault() blocks parent Link navigation; 44px touch targets

## Task Commits

Each task was committed atomically:

1. **Task 1: DashboardCard shell + DashboardCardSkeleton** - `c9f2e0f` (feat)
2. **Task 2: CropPlanCard + FieldOpsCard with Mark Done** - `d46d978` (feat)
3. **Auto-fix: use plan.fieldId for offlineQueue fieldId** - `0f5552a` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/dashboard/DashboardCard.tsx` - Generic card shell with Link, moduleName, chevron-right SVG, optional subtitle and children
- `src/components/dashboard/dashboard-card-skeleton.tsx` - Animate-pulse skeleton matching DashboardCard dimensions
- `src/components/dashboard/CropPlanCard.tsx` - Read-only crop plan summary card using DashboardCard as shell
- `src/components/dashboard/FieldOpsCard.tsx` - Pending pass list with Mark Done quick-action; offlineQueue + optimistic state

## Decisions Made
- plan.fieldId used as fieldId in offlineQueue.add — CachedCropPlan.fieldId is the farm-registry ID needed for server replay; fieldName is display only
- operatorId/operatorName set to empty string in FieldOpsCard — client component has no user prop; sync engine fills in from auth session on replay
- PendingPass typed as interface with plan + pass tuple — avoids any and gives handleMarkDone full type context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used plan.fieldId instead of plan.fieldName for offlineQueue fieldId**
- **Found during:** Task 2 (FieldOpsCard with Mark Done quick-action)
- **Issue:** Plan pseudocode used `fieldId: plan.fieldName` — fieldName is a display string, not the farm-registry ID needed for server replay; QueuedOperation.fieldId must be the actual field ID
- **Fix:** Changed to `fieldId: plan.fieldId` — the correct CachedCropPlan field that holds the farm-registry ID
- **Files modified:** src/components/dashboard/FieldOpsCard.tsx
- **Verification:** TypeScript compiles clean; linter confirmed the fix
- **Committed in:** 0f5552a

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Single line fix; no scope change. Prevents silent data errors in sync replay.

## Issues Encountered
None — plan executed cleanly. Existing stub files (CropPlanCard.tsx, FieldOpsCard.tsx) had already been created as TypeScript stubs by a prior planner; this plan replaced them with full implementations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four card components ready for DashboardGrid (Plan 01) to import and render
- FieldOpsCard Mark Done quick-action wired to offlineQueue; will sync via existing Background Sync service worker from Phase 02
- DashboardCard shell available for any future module-specific card variants

---
*Phase: 03-mobile-dashboard*
*Completed: 2026-05-23*
