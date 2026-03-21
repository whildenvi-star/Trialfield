---
phase: 06-actuals-entry-and-enterprise-budget-view
plan: "03"
subsystem: ui
tags: [actuals, budget, react, inline-editing, keyboard-navigation, shadcn, collapsible]

dependency_graph:
  requires:
    - phase: 06-02
      provides: budget-summary-dual-computation, actual-cost-patch-routes, actual-yield-patch-route, unplanned-cost-post-route
  provides:
    - ActualCell-inline-edit-component
    - DataSourceBadge-PROJ-ACTUAL-UNPLANNED
    - VarianceCell-green-red-color-coding
    - BudgetTab-dual-column-layout
    - operation-confirmation-checkbox-datepicker
    - unplanned-expense-inline-add-row
  affects: [phase-07-sync, phase-08-farm-wide-budget]

tech-stack:
  added: [shadcn/collapsible]
  patterns: [enter-to-advance-ref-registry, inline-optimistic-ui, collapsible-cost-sections]

key-files:
  created:
    - src/components/budget/ActualCell.tsx
    - src/components/budget/DataSourceBadge.tsx
    - src/components/budget/VarianceCell.tsx
    - src/app/api/field-enterprises/[id]/operations/[recordId]/route.ts
  modified:
    - src/components/budget/BudgetTab.tsx
    - src/app/(app)/field-enterprises/[id]/page.tsx

key-decisions:
  - "Enter-to-advance uses ordered ref array in BudgetTab — ActualCell fires onAdvance callback, BudgetTab focuses next registered ref"
  - "PUT /operations/[recordId] added to revert CONFIRMED to PLANNED — clears operationDate, sets passStatus=PLANNED"
  - "BudgetSummary type exported from BudgetTab.tsx — enterprise detail page imports it to prevent drift"
  - "Material costs grouped by category keyword matching (fertilizer, chemical, custom) with otherMaterialRows fallback"
  - "Per-acre display: all line items divide by acres before rendering; actual save converts back to total (v * acres)"
  - "Unplanned ActualCell saves total cost (per-acre * acres) to match API expectation"

patterns-established:
  - "inline-edit-with-advance: ActualCell cellRef + onAdvance callback enables spreadsheet-style Enter navigation"
  - "optimistic-checkbox: OperationRow flips checked state immediately, reverts on API failure"
  - "category-keyword-grouping: materialCosts split into Fertilizer/Chemical/CustomApp/Other by string includes"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03]

duration: ~10min
completed: 2026-03-21
---

# Phase 6 Plan 03: Budget Tab UI Summary

**Dual-column Projected/Actual/Variance Budget tab with inline click-to-edit cells, Enter-to-advance keyboard navigation, collapsible cost sections, checkbox operation confirmation, and PROJ/ACTUAL/UNPLANNED badges — awaiting human verification.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-21T04:25:00Z
- **Completed:** 2026-03-21T04:34:57Z (checkpoint reached — tasks 1-2 complete)
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- Three new sub-components: ActualCell (inline edit with keyboard nav), DataSourceBadge (PROJ/ACTUAL/UNPLANNED pills), VarianceCell (green/red color-coded $/ac)
- BudgetTab fully rewritten: dual-column layout with collapsible Seed, Fertilizer, Chemical, Custom App, Operations, Harvest, and Unplanned sections
- Operation confirmation via Checkbox + date-picker; un-checking reverts to PLANNED and clears date
- Unplanned expense inline add-row with category Select and amount input
- Summary cards at top showing Total Projected/ac, Total Actual/ac, Total Variance/ac
- Financial sections (revenue projection, margin) wrapped in canSeeFinancial for ADMIN-only visibility
- PUT /operations/[recordId] route added (was missing — required for un-confirm flow)

## Task Commits

1. **Task 1: Create ActualCell, DataSourceBadge, and VarianceCell components** - `7bd260f` (feat)
2. **Task 2: Build dual-column BudgetTab with inline editing, collapsible sections, and operation confirmation** - `478fd84` (feat)
3. **Task 3: Human verification** — checkpoint pending

## Files Created/Modified
- `src/components/budget/ActualCell.tsx` — Inline click-to-edit cell with Enter/Esc/blur save, onAdvance for spreadsheet navigation, failure keeps cell editable
- `src/components/budget/DataSourceBadge.tsx` — PROJ (blue), ACTUAL (green), UNPLANNED (amber) pill badges using shadcn Badge outline
- `src/components/budget/VarianceCell.tsx` — Green for favorable (under budget), red for unfavorable; null-safe with muted placeholder
- `src/components/budget/BudgetTab.tsx` — Full dual-column layout rewrite with all section types and save handlers
- `src/app/api/field-enterprises/[id]/operations/[recordId]/route.ts` — Added PUT handler to revert CONFIRMED operations to PLANNED
- `src/app/(app)/field-enterprises/[id]/page.tsx` — Updated to import BudgetSummary type from BudgetTab (removed duplicate local definition)

## Decisions Made
- Enter-to-advance implemented via ordered `cellRefs` array in BudgetTab; each ActualCell receives an `onAdvance` callback that calls `advanceToNext(idx)`. Index is captured at render time via `nextCellIdx()` counter.
- PUT /operations/[recordId] was missing from the API; added with RBAC guard (budget:write required), ownership validation against fieldEnterpriseId, and operationDate clearing.
- BudgetSummary exported as named type from BudgetTab.tsx so enterprise detail page stays in sync automatically.
- Per-acre conversions: display values are `total / acres`; save converts back with `v * acres` before sending to PATCH endpoints.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added PUT /operations/[recordId] to revert CONFIRMED to PLANNED**
- **Found during:** Task 2 (BudgetTab build)
- **Issue:** The plan specified unchecking an operation reverts to PLANNED via `PUT /operations`, but no PUT route existed — only DELETE. Without the endpoint, the un-confirm flow would fail with 405.
- **Fix:** Added PUT handler in `/api/field-enterprises/[id]/operations/[recordId]/route.ts` with RBAC (budget:write), ownership validation, sets passStatus=PLANNED and clears operationDate.
- **Files modified:** src/app/api/field-enterprises/[id]/operations/[recordId]/route.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 478fd84 (Task 2 commit)

**2. [Rule 1 - Bug] Updated enterprise detail page to import BudgetSummary type from BudgetTab**
- **Found during:** Task 2 (TypeScript check after BudgetTab rewrite)
- **Issue:** Enterprise detail page had its own local BudgetSummary interface that no longer matched the expanded type from BudgetTab.tsx — tsc reported TS2322 type mismatch on 13 missing fields.
- **Fix:** Imported `BudgetSummary` from `@/components/budget/BudgetTab`, removed the now-redundant local interface definition.
- **Files modified:** src/app/(app)/field-enterprises/[id]/page.tsx
- **Verification:** `npx tsc --noEmit` exits cleanly with no output
- **Committed in:** 478fd84 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical route, 1 type mismatch bug)
**Impact on plan:** Both auto-fixes required for correctness. No scope creep.

## Issues Encountered
None beyond the two deviations documented above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All VIEW-01/02/03 requirements satisfied at code level — awaiting human verification
- Phase 7 (All-Enterprise Sync) can proceed once verification passes
- Phase 8 (Farm-Wide Budget Summary) will build on BudgetSummary response shape established here

---
*Phase: 06-actuals-entry-and-enterprise-budget-view*
*Completed: 2026-03-21 (checkpoint pending)*

## Self-Check: PASSED

Files verified:
- FOUND: src/components/budget/ActualCell.tsx
- FOUND: src/components/budget/DataSourceBadge.tsx
- FOUND: src/components/budget/VarianceCell.tsx
- FOUND: src/components/budget/BudgetTab.tsx
- FOUND: src/app/api/field-enterprises/[id]/operations/[recordId]/route.ts
- FOUND: src/app/(app)/field-enterprises/[id]/page.tsx

Commits verified:
- 7bd260f: feat(06-03): create ActualCell, DataSourceBadge, and VarianceCell components
- 478fd84: feat(06-03): build dual-column BudgetTab with inline editing and collapsible sections
