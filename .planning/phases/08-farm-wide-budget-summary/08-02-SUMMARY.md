---
phase: 08-farm-wide-budget-summary
plan: "02"
subsystem: ui
tags: [nextjs, react, tailwind, rbac, budget, table, sidebar]

# Dependency graph
requires:
  - phase: 08-farm-wide-budget-summary
    plan: "01"
    provides: GET /api/budget-summary endpoint with organic/conventional groups, per-acre projected/actual/variance, weighted-average subtotals, RBAC-gated financials

provides:
  - /budget-summary page — farm-wide Macro Rollup table with grouped enterprises, projected/actual/variance columns, section subtotals, grand total, and RBAC-gated financial columns
  - Sidebar navigation link to /budget-summary visible to ADMIN and OFFICE

affects: [v2.0-milestone-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useSession for role-derived canSeeFinancial — same RBAC pattern as enterprise detail page
    - Horizontally scrollable table container for wide budget tables
    - Section headers as full-width colspan rows inside the same table (no nested tables)
    - Clickable enterprise rows with router.push to detail page

key-files:
  created:
    - src/app/(app)/budget-summary/page.tsx
  modified:
    - src/components/layout/sidebar.tsx

key-decisions:
  - "Simplified column layout: Seed/Fert/Chem/Ops each show Proj and Act per-acre only; no per-category variance columns — full detail available by clicking into enterprise"
  - "Favorable variance = actual < projected (lower cost is better); green for favorable, red for unfavorable, dash when no actuals"

patterns-established:
  - "Budget summary table: section header row spans all columns, subtotal rows use bg-stone-800/30, grand total uses bg-stone-800/60"
  - "Null-actual guard: show — for all actual/variance cells when actualTotalPerAcre is null"

requirements-completed: [VIEW-04, VIEW-05]

# Metrics
duration: ~10min
completed: 2026-03-21
---

# Phase 08 Plan 02: Farm-Wide Budget Summary Page

**Macro Rollup-style `/budget-summary` page with organic/conventional grouped enterprise table, per-acre projected/actual/variance, RBAC-gated financial columns, clickable rows, and sidebar nav link — human-verified by user**

## Performance

- **Duration:** ~10 min (including human verification checkpoint)
- **Started:** 2026-03-21T23:44:00Z
- **Completed:** 2026-03-21 (post-checkpoint approval)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Created `src/app/(app)/budget-summary/page.tsx` — 393-line client page that fetches `/api/budget-summary` and renders the Macro Rollup table layout Sandy uses in spreadsheets, replacing it with live data
- Added "budget summary" sidebar link (`BarChart2` icon) in `src/components/layout/sidebar.tsx` giving ADMIN and OFFICE one-click access
- ADMIN sees Revenue/Ac and Margin/Ac financial columns; OFFICE sees the same page without those columns (canSeeFinancial from session role)
- Enterprise rows are clickable — `router.push(/field-enterprises/${enterpriseId})` navigates to that enterprise's detailed Budget tab
- Human verification confirmed: organic/conventional grouping correct, subtotals and grand total present, variance colors correct, OFFICE role financial columns hidden

## Task Commits

Each task was committed atomically:

1. **Task 1: Build farm-wide budget summary page and sidebar link** - `f6e00c1` (feat)
2. **Task 2: Human verification checkpoint** - approved, no code changes

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/app/(app)/budget-summary/page.tsx` — Farm-wide Macro Rollup page (393 lines): fetches API, renders organic section, conventional section, subtotals, grand total, RBAC financial columns, clickable rows
- `src/components/layout/sidebar.tsx` — Added "budget summary" nav entry with BarChart2 icon

## Decisions Made
- Simplified column layout: Seed/Fert/Chem/Ops each show Proj+Act per-acre; no per-category variance (full detail available via row click) — keeps table readable without horizontal overflow on typical screens
- Favorable variance defined as actual < projected (lower cost is better); matches existing VarianceCell.tsx coloring convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. TypeScript compiled clean on first pass. Human verification passed without any requested adjustments.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v2.0 milestone is now complete: Sandy can view the full farm budget summary from the sidebar, see projected vs actual costs for all enterprises, and drill into individual enterprises for detail
- No blockers for any subsequent work
- Phase 08 is fully complete (2 of 2 plans done)

---
*Phase: 08-farm-wide-budget-summary*
*Completed: 2026-03-21*
