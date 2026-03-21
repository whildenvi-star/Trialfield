---
phase: 06-actuals-entry-and-enterprise-budget-view
plan: "02"
subsystem: api
tags: [actuals, budget, prisma, rbac, next-js]

dependency_graph:
  requires:
    - phase: 06-01
      provides: BudgetTab-component, actuals-schema-fields, budget-write-permission
  provides:
    - budget-summary-dual-computation
    - actual-cost-patch-routes
    - actual-yield-patch-route
    - unplanned-cost-post-route
  affects: [phase-06-03-ui, phase-07-sync]

tech-stack:
  added: []
  patterns: [dual-projected-actual-aggregation, enterprise-ownership-validation, null-means-not-entered]

key-files:
  created:
    - src/app/api/field-enterprises/[id]/applications/[recordId]/actual/route.ts
    - src/app/api/field-enterprises/[id]/seed-usage/[recordId]/actual/route.ts
    - src/app/api/field-enterprises/[id]/actual-yield/route.ts
    - src/app/api/field-enterprises/[id]/unplanned-cost/route.ts
  modified:
    - src/app/api/field-enterprises/[id]/budget-summary/route.ts

key-decisions:
  - "Projected totals include ALL operations (PLANNED + CONFIRMED) — full budget plan view"
  - "Actual operation cost uses CONFIRMED ops only — actual work performed"
  - "null = not-entered (not zero) for all actual fields — distinction between no data and zero spend"
  - "allActualsNull guard: actualTotalCost is null only when ALL three actual components are null"
  - "unplanned-cost uses material upsert by farmId+name for idempotent category material creation"
  - "Variance computed server-side only — no client-side variance math"

patterns-established:
  - "dual-projected-actual: budget-summary returns projected totals, actual totals, and variance side by side"
  - "ownership-check: findFirst with both id=recordId AND fieldEnterpriseId=enterpriseId before any write"
  - "null-clears-actual: PATCH body with null value reverts record to projected-only"

requirements-completed: [ACT-01, ACT-02, ACT-03, ACT-04, ACT-05]

duration: ~8min
completed: 2026-03-21
---

# Phase 6 Plan 02: Actuals API Layer Summary

**Budget-summary extended with dual projected/actual/variance computation; four new budget:write-gated PATCH/POST routes for saving per-record actuals and unplanned costs.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-21T04:25:34Z
- **Completed:** 2026-03-21T04:33:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Budget-summary GET now returns projected totals, actual totals, variance, per-line-item actuals, and unplanned costs array — resolves STATE.md blocker about mixed PLANNED/CONFIRMED computation
- Four new API routes created, all gated with `hasPermission(role, "budget:write")` — CREW cannot write actuals
- Enterprise ownership validated on all write routes before any DB mutation

## Task Commits

1. **Task 1: Extend budget-summary with dual projected/actual computation** - `c8b3593` (feat)
2. **Task 2: Create PATCH/POST routes for actuals entry** - `ce16ad1` (feat)

## Files Created/Modified
- `src/app/api/field-enterprises/[id]/budget-summary/route.ts` — Extended with actual/variance/unplanned sections; per-line-item actual fields added; financial stripping preserved
- `src/app/api/field-enterprises/[id]/applications/[recordId]/actual/route.ts` — PATCH saves `actualTotalCost` and optional `actualUnitCost` on MaterialUsage
- `src/app/api/field-enterprises/[id]/seed-usage/[recordId]/actual/route.ts` — PATCH saves `actualPricePerUnit` on SeedUsage
- `src/app/api/field-enterprises/[id]/actual-yield/route.ts` — PATCH saves `actualYieldPerAcre` and optional `actualYieldUnit` on FieldEnterprise
- `src/app/api/field-enterprises/[id]/unplanned-cost/route.ts` — POST creates MaterialUsage with `dataSource: ACTUAL`, `totalCost: null`

## Decisions Made
- Projected totals include ALL operations regardless of `passStatus` — this is the full budget plan (what was planned and committed)
- Actual operation cost uses CONFIRMED ops only, using `totalCost` since `FieldOperation` has no `actualTotalCost` field in schema — matches the plan spec
- `null` means "not entered yet" for all actual fields, not zero — prevents false variance when Sandy hasn't entered a value yet
- `actualTotalCost` is null only when ALL three actual components (seed, material, operation) are null — partial actuals produce a partial actual total
- Unplanned cost: category validated against fixed set (`Seed`, `Fertilizer`, `Chemical`, `Custom Application`, etc.) OR categories already used in the enterprise (flexible extension path)
- Material upsert uses `farmId_name` unique key for idempotent `Unplanned - {category}` material creation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- API layer complete for actuals entry — Plan 03 (UI) can now call all five endpoints
- `budget-summary` response shape is finalized; Plan 03 UI can destructure `actualSeedCost`, `actualMaterialCost`, `actualOperationCost`, `variance*`, `unplannedCosts` directly
- CREW role cannot call any actuals write endpoint (403 returned) — no UI guard needed at route level beyond what RBAC enforces

---
*Phase: 06-actuals-entry-and-enterprise-budget-view*
*Completed: 2026-03-21*

## Self-Check: PASSED

Files verified:
- FOUND: src/app/api/field-enterprises/[id]/budget-summary/route.ts
- FOUND: src/app/api/field-enterprises/[id]/applications/[recordId]/actual/route.ts
- FOUND: src/app/api/field-enterprises/[id]/seed-usage/[recordId]/actual/route.ts
- FOUND: src/app/api/field-enterprises/[id]/actual-yield/route.ts
- FOUND: src/app/api/field-enterprises/[id]/unplanned-cost/route.ts

Commits verified:
- c8b3593: feat(06-02): extend budget-summary with projected/actual/variance computation
- ce16ad1: feat(06-02): create PATCH/POST routes for actuals entry
