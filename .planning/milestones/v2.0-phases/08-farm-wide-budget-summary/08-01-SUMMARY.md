---
phase: 08-farm-wide-budget-summary
plan: "01"
subsystem: api
tags: [prisma, nextjs, rbac, budget, aggregation, weighted-average]

# Dependency graph
requires:
  - phase: 06-actuals-entry-and-enterprise-budget-view
    provides: Per-enterprise budget-summary route with proven seed/material/operation arithmetic
  - phase: 07-all-enterprise-sync
    provides: enterpriseType field on FieldEnterprise for organic/conventional grouping

provides:
  - GET /api/budget-summary — farm-wide aggregation endpoint with organic/conventional grouping, per-acre projected+actual+variance, weighted-average subtotals, and RBAC-gated financial fields

affects: [09-summary-page, plan-02-budget-summary-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Weighted-average subtotals by acreage (not simple average) for per-acre rollup rows
    - allActualsNull guard — actualTotal is null if no actuals entered across any category; never returns zero when data is absent
    - Spread-conditional financial fields — projectedRevPerAcre/projectedMarginPerAcre absent from JSON keys when canSeeFinancial is false
    - Operations column absorbs other-material and fallow costs (non-seed, non-fertilizer, non-chemical)

key-files:
  created:
    - src/app/api/budget-summary/route.ts
  modified: []

key-decisions:
  - "Operations column covers all non-seed, non-fertilizer, non-chemical costs (other materials, fallow) — matches BudgetTab.tsx visual grouping"
  - "Actual fertilizer/chemical/operations per-acre are null independently — a null seed actual does not force null fertilizer actual"
  - "Grand total weighted average spans ALL rows (organic + conventional combined)"

patterns-established:
  - "Per-acre actual: null when underlying cost total is null; computed only when at least one actual entry exists for that category"
  - "Category keyword matching: identical to BudgetTab.tsx — fertilizer/fert, chemical/chem/pesticide/herbicide/insecticide"

requirements-completed: [VIEW-04, VIEW-05]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 08 Plan 01: Farm-Wide Budget Summary API

**Single-query farm-wide budget aggregation endpoint — organic/conventional sections, per-acre projected/actual/variance per category, RBAC-gated financials, weighted-average subtotals**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-21T23:42:06Z
- **Completed:** 2026-03-21T23:43:58Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `GET /api/budget-summary` — single Prisma query fetches all enterprises for the current crop year with all related seed/material/operation data, avoiding N+1 API calls
- Replicates proven per-enterprise arithmetic from `field-enterprises/[id]/budget-summary/route.ts` inline; category bucketing matches `BudgetTab.tsx` keyword logic exactly
- Weighted-average subtotals by acreage for organic section, conventional section, and farm-wide grand total
- Financial fields (`projectedRevPerAcre`, `projectedMarginPerAcre`) spread-conditionally absent from JSON when caller lacks `budget:financial` permission
- Full auth chain: `getAuthContext()` → 401, `hasPermission(budget:read)` → 403, `cropYear` query param or auto-resolved from max DB value

## Task Commits

1. **Task 1: Create GET /api/budget-summary aggregation endpoint** - `27b1fc8` (feat)

## Files Created/Modified
- `src/app/api/budget-summary/route.ts` — Farm-wide budget aggregation endpoint (464 lines)

## Decisions Made
- Operations column absorbs other-material costs and fallow costs (anything not fertilizer/chemical), matching BudgetTab.tsx column layout so the UI summary page can render without re-categorizing
- Actual per-acre values are null independently per category — a null seed actual does not force null fertilizer actual; only actualTotalPerAcre uses the allActualsNull guard
- Weighted-average grand total spans all rows (organic + conventional combined) — no simple sum across subtotals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. `npx tsc --noEmit` passed with zero errors on first compile.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `GET /api/budget-summary` is ready for the farm-wide summary page (Plan 02)
- Response shape includes `organic[]`, `conventional[]`, `organicSubtotal`, `conventionalSubtotal`, `grandTotal` with all per-acre columns the UI needs
- TypeScript interface `FarmBudgetRow` defined in route — Plan 02 can either re-declare or import as needed

---
*Phase: 08-farm-wide-budget-summary*
*Completed: 2026-03-21*
