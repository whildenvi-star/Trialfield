---
phase: 06-actuals-entry-and-enterprise-budget-view
plan: "01"
subsystem: budget-ui
tags: [refactor, schema, rbac, budget]
dependency_graph:
  requires: [05-02]
  provides: [BudgetTab-component, actuals-schema-fields, budget-write-permission]
  affects: [field-enterprises-detail-page, prisma-schema]
tech_stack:
  added: []
  patterns: [component-extraction, targeted-refresh-callback, schema-additive-only]
key_files:
  created:
    - src/components/budget/BudgetTab.tsx
  modified:
    - src/app/(app)/field-enterprises/[id]/page.tsx
    - src/lib/rbac.ts
    - prisma/schema.prisma
decisions:
  - refreshBudget targeted fetch avoids full page reload and scroll-jump on budget save
  - ACTUAL added to DataSource enum as additive change — no existing records modified
  - BudgetTabProps interface defined in BudgetTab.tsx (enterpriseId, budgetSummary, canSeeFinancial, onDataChanged)
metrics:
  duration: "~4 min"
  completed: "2026-03-21"
  tasks_completed: 2
  files_modified: 4
---

# Phase 6 Plan 01: BudgetTab Extraction and Actuals Schema Summary

BudgetTab.tsx extracted from 1760-line page.tsx; actuals fields added to schema; budget:write RBAC permission added for ADMIN and OFFICE roles.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extract BudgetTab component and add budget:write RBAC | 61f6882 | BudgetTab.tsx (created), page.tsx, rbac.ts |
| 2 | Schema migration for actuals tracking fields | 73d2552 | prisma/schema.prisma |

## What Was Built

### BudgetTab.tsx
New component at `src/components/budget/BudgetTab.tsx` (338 lines) containing all budget rendering logic previously inline in page.tsx. Accepts `BudgetTabProps`: enterpriseId, budgetSummary, canSeeFinancial, onDataChanged. The `canSeeFinancial` guard from Phase 5 is preserved exactly — Projected Revenue and Gross Margin cards, and the Revenue Projection section, only render when `canSeeFinancial` is true.

### page.tsx Updates
- Imports and renders `<BudgetTab>` in the budget TabsContent
- Added `refreshBudget` callback that only re-fetches `/api/field-enterprises/${id}/budget-summary` — passed as `onDataChanged` to avoid scroll-jump when budget data changes
- Removed ~240 lines of budget rendering logic
- Removed unused imports: TrendingUp, TrendingDown, fmtDate

### RBAC
`budget:write` added to ADMIN and OFFICE permission sets. CREW does not have this permission. Follows the existing pattern of `budget:read` and `budget:financial`.

### Schema
Additive-only changes — no existing fields modified:
- `MaterialUsage.actualTotalCost Float?` — Sandy's actual invoice amount
- `MaterialUsage.actualUnitCost Float?` — actual $/unit if different from projected
- `SeedUsage.actualPricePerUnit Float?` — actual purchase price (ACT-04)
- `FieldEnterprise.actualYieldPerAcre Float?` — actual harvest yield (ACT-03)
- `FieldEnterprise.actualYieldUnit String?` — matches targetYieldUnit from projected plan
- `DataSource.ACTUAL` — new enum value alongside MANUAL and SYNCED

Applied via `prisma db push`, client regenerated successfully.

## Verification

- `npx tsc --noEmit`: PASSED (no errors after both tasks)
- `npx prisma db push`: PASSED, database synced in 105ms
- BudgetTab.tsx: 338 lines, exists at expected path
- page.tsx: imports BudgetTab, delegates budget rendering via props
- rbac.ts: budget:write present in ADMIN and OFFICE sets
- schema.prisma: all 5 actuals fields + ACTUAL enum value present

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: /Users/glomalinguild/Desktop/my-project-one/organic-cert/src/components/budget/BudgetTab.tsx
- FOUND: import { BudgetTab } in page.tsx
- FOUND: budget:write in rbac.ts (ADMIN and OFFICE)
- FOUND: actualTotalCost, actualUnitCost, actualPricePerUnit, actualYieldPerAcre, ACTUAL in schema.prisma

Commits verified:
- 61f6882: feat(06-01): extract BudgetTab component and add budget:write RBAC
- 73d2552: feat(06-01): schema migration for actuals tracking fields
