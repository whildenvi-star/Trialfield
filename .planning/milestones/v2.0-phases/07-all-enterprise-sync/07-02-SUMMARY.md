---
phase: 07-all-enterprise-sync
plan: 02
subsystem: ui
tags: [react, nextjs, useeffect, date-fns, sync, budget]

# Dependency graph
requires:
  - phase: 07-all-enterprise-sync plan 01
    provides: EnterpriseType enum and type-aware sync-macro that processes all 7 enterprises

provides:
  - On-load background sync trigger when Budget tab activates (no manual button needed)
  - Stale indicator in BudgetTab showing "Unable to refresh — showing last known data" when farm-budget unreachable
  - Syncing spinner text ("Syncing...") visible during in-flight fetch

affects: [08-farm-wide-budget-summary, any phase touching BudgetTab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useEffect fires background sync on tab activation — render with existing data first, update after sync completes
    - syncState/syncedAt props flow from enterprise detail page into BudgetTab for display
    - Stale indicator is muted text only — no toasts/modals for sync failure (silent degradation)

key-files:
  created: []
  modified:
    - src/app/(app)/field-enterprises/[id]/page.tsx
    - src/components/budget/BudgetTab.tsx

key-decisions:
  - "Background sync never blocks initial render — Budget tab mounts with existing DB data immediately"
  - "Stale indicator uses muted text, not amber toast — sync failure is the exception not the norm"
  - "Manual sync button in fields/page.tsx preserved as admin escape hatch — not removed"

patterns-established:
  - "Tab-activation sync: useEffect on activeTab + canSeeBudget guard, fires triggerBudgetSync in background"
  - "syncState enum: idle | syncing | stale — passed as prop to display component"

requirements-completed: [SYNC-01, SYNC-02]

# Metrics
duration: ~5min
completed: 2026-03-21
---

# Phase 7 Plan 02: All-Enterprise Sync — On-Load Trigger Summary

**Background sync on Budget tab mount with stale indicator; human-verified end-to-end across all 7 enterprises (organic + conventional)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21
- **Completed:** 2026-03-21
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments

- Budget tab fires `triggerBudgetSync` automatically via `useEffect` when `activeTab === "budget"` — no manual sync button required
- BudgetTab renders with existing database data immediately; sync updates display only after completion
- Stale indicator shows "Unable to refresh — showing last known data" in amber when farm-budget service unreachable
- "Syncing..." muted text indicator visible during in-flight fetch
- Human verified: conventional enterprises appear, organic actuals preserved, stale indicator functional

## Task Commits

Each task was committed atomically:

1. **Task 1: Add on-load sync trigger and stale indicator to Budget tab** - `a7457fa` (feat)
2. **Task 2: Verify all-enterprise sync end-to-end** - Human-approved checkpoint (no code commit)

**Plan metadata:** (docs commit — this plan)

## Files Created/Modified

- `src/app/(app)/field-enterprises/[id]/page.tsx` - Added `syncState`/`syncedAt` state, `triggerBudgetSync` function, and `useEffect` on Budget tab activation; passes sync props to BudgetTab
- `src/components/budget/BudgetTab.tsx` - Added `syncState`/`syncedAt` props; renders syncing and stale indicators near tab header

## Decisions Made

- Background sync never blocks initial render — Budget tab mounts with existing DB data immediately; sync updates display after completion
- Stale indicator uses muted text only (no toast, no modal) — sync failure is the exception, not the norm
- Manual sync button in `fields/page.tsx` preserved as admin escape hatch — does not conflict with on-load sync

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 7 complete: EnterpriseType schema, sync-macro all-enterprise expansion, and on-load trigger all in place
- All 7 enterprises (3 conventional, 1 mixed, 3 organic) sync on Budget tab navigation
- Ready for Phase 8: Farm-Wide Budget Summary — can now aggregate across all enterprise types
- No blockers

---
*Phase: 07-all-enterprise-sync*
*Completed: 2026-03-21*
