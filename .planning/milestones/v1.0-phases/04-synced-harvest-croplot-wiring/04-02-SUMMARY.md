---
phase: 04-synced-harvest-croplot-wiring
plan: 02
subsystem: api
tags: [prisma, nextjs, react, pdf, report, croplot, harvest]

# Dependency graph
requires:
  - phase: 04-01
    provides: atomic CropLot creation in staged-ops approve handler with isNew flag in response
provides:
  - Harvest log PDF shows lot numbers for all synced HarvestEvents (not just the first one)
  - Bulk approve toast reports HarvestEvent count, new CropLot count, updated CropLot count
  - Single approve toast shows lot number and created/updated state
  - No-enterprise error shows actionable "Create Enterprise" toast button
affects: [report-generation, fieldops-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - enterpriseLotMap fallback: build Map<enterpriseId, lotNumber> before harvest loop for O(1) fallback resolution
    - actionable toast: sonner toast.error with action.onClick for router.push navigation

key-files:
  created: []
  modified:
    - organic-cert/src/lib/report-assembler.ts
    - organic-cert/src/app/(app)/admin/fieldops/review/page.tsx

key-decisions:
  - "enterpriseLotMap built from all cropLots across all harvests before the flatten loop — first lot per enterprise wins, consistent with one-CropLot-per-enterprise invariant from 04-01"
  - "Bulk toast wording: 'N HarvestEvents approved, M new CropLots created, K existing CropLots updated' — matches user decision from plan context"
  - "No-enterprise actionable error routes to /field-enterprises via useRouter.push inside sonner action.onClick"

patterns-established:
  - "enterpriseLotMap pattern: pre-compute enterprise-level derived data before flattening loops to avoid O(n^2) lookups and handle sparse joins"
  - "CropLot-aware toast: parse json.cropLot.isNew from approve response to give admin meaningful feedback without extra queries"

requirements-completed: [RPT-03, RPT-04]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 4 Plan 02: Synced Harvest CropLot Wiring — Report Fix Summary

**enterpriseLotMap fallback in report assembler ensures all synced HarvestEvents show lot numbers in PDF; bulk approve toast now reports CropLot creation and update counts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T17:41:52Z
- **Completed:** 2026-02-26T17:44:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed harvest log lot number resolution: SYNCED HarvestEvents that updated an existing CropLot (instead of creating one) previously showed "—" in the PDF because `harvest.cropLots` was empty; now all harvests for an enterprise resolve via enterprise-level fallback map
- Updated bulk approve toast to report "N HarvestEvents approved, M new CropLots created, K existing CropLots updated" instead of just approved count
- Updated single approve toast to include lot number and action ("lot ABC-2026-1 created")
- Added actionable "Create Enterprise" toast button when approve fails due to missing enterprise, routing to /field-enterprises

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix report assembler harvest log lot number fallback** - `ce11c27` (feat)
2. **Task 2: Update review page toast and no-enterprise error handling** - `b46ff15` (feat)

**Plan metadata:** committed below (docs: complete plan)

## Files Created/Modified
- `organic-cert/src/lib/report-assembler.ts` - Added enterpriseLotMap pre-loop and updated lot number resolution to `harvest.cropLots[0]?.lotNumber ?? enterpriseLotMap.get(enterprise.id) ?? null`
- `organic-cert/src/app/(app)/admin/fieldops/review/page.tsx` - Added useRouter, actionable no-enterprise toast, lot-aware single approve toast, newLots/updatedLots counters in bulk approve

## Decisions Made
- enterpriseLotMap: first lot found per enterprise wins — matches invariant from 04-01 (one CropLot per FieldEnterprise for synced data)
- Bulk toast wording uses "HarvestEvents" and "CropLots" (full model names) per user decision in plan context for clarity in admin UI
- No changes to mass balance section — confirmed it queries `prisma.cropLot.findMany()` directly, so it works automatically once CropLots exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `organic-cert/` has its own git repository (separate from root `.planning/` repo). Code commits go to `organic-cert/.git`, planning doc commits go to root `.git`. This is consistent with how 04-01 was executed.
- Pre-existing TypeScript error in `src/app/api/fields/sync-registry/route.ts(94)` — "Expected 1 arguments, but got 3" — present before this plan's changes and out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 4 gap closure is complete. Both plans delivered:
- 04-01: Atomic CropLot creation/update in approve flow (yield converter + $transaction handler)
- 04-02: PDF report lot number fix + toast improvements for admin feedback

The synced harvest CropLot wiring is fully wired end-to-end. No blockers for future phases.

## Self-Check: PASSED

- FOUND: organic-cert/src/lib/report-assembler.ts
- FOUND: organic-cert/src/app/(app)/admin/fieldops/review/page.tsx
- FOUND: .planning/phases/04-synced-harvest-croplot-wiring/04-02-SUMMARY.md
- FOUND commit: ce11c27 (feat(04-02): fix harvest log lot number fallback via enterpriseLotMap)
- FOUND commit: b46ff15 (feat(04-02): update review page toast with CropLot counts and no-enterprise error)

---
*Phase: 04-synced-harvest-croplot-wiring*
*Completed: 2026-02-26*
