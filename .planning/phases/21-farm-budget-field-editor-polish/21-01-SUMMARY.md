---
phase: 21-farm-budget-field-editor-polish
plan: 01
subsystem: farm-budget
tags: [ui, field-editor, print, pdf, profitability, coloring]
requirements: [BUD-01, BUD-02]

dependency_graph:
  requires: []
  provides:
    - "Group subtotal rows in field editor preview (Land/Inputs/Operations/Other)"
    - "Consistent profit/COP coloring across field editor, dashboard, enterprise module view"
    - "Print reports with accounting parentheses for negatives and red profit coloring"
    - "PDF reports with accounting parentheses negatives"
  affects:
    - farm-budget/public/field-editor.js
    - farm-budget/public/style.css
    - farm-budget/public/dashboard.js
    - farm-budget/public/enterprise.js
    - farm-budget/public/reports.js
    - farm-budget/public/pdf-report.js

tech_stack:
  added: []
  patterns:
    - "renderSubtotal() helper function for group subtotal rows"
    - "formatPrintMoney() helper: ($X.XX) parentheses for negatives in print reports"
    - "profitClass(val) for COP via sign of profitPerAcre (dashboard proxy)"
    - "copClass from cop vs pricePerUnit direct comparison (field editor + enterprise)"
    - "PDF money() returns ($X.XX) for negatives using accounting parentheses"
    - "print-color-adjust: exact for preserving profit colors in print output"

key_files:
  created: []
  modified:
    - farm-budget/public/field-editor.js
    - farm-budget/public/style.css
    - farm-budget/public/dashboard.js
    - farm-budget/public/enterprise.js
    - farm-budget/public/reports.js
    - farm-budget/public/pdf-report.js

decisions:
  - "Dashboard COP coloring uses profitPerAcre sign as proxy (no pricePerUnit in crop row object from computeDashboardByCrop) — profitPerAcre < 0 implies COP > price"
  - "Enterprise module view profitCls changed from hardcoded ternary to util.profitClass() for consistency with profitClass zero-case behavior"
  - "Field-Level Input Plan report rewritten to use _computed budget data from /api/fields for group subtotals, with original forecast product detail table preserved below"
  - "PDF money() globally changed to accounting parentheses — affects all money values shown in Enterprise PDF, not just profit rows"

metrics:
  duration_minutes: 4
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
  completed_date: "2026-03-04"
---

# Phase 21 Plan 01: Field Editor Polish — Group Subtotals and Profit Coloring Summary

**One-liner:** Group subtotals (Land/Inputs/Operations/Other) added to field editor preview with consistent red/green COP and profit coloring across all views, plus accounting parentheses ($X.XX) for print and PDF reports.

## What Was Built

### Task 1: Group Subtotals and COP Coloring (field-editor.js, style.css, dashboard.js, enterprise.js)

Added `renderSubtotal()` helper and group subtotal data to each budget group in `updatePreview()`:

- **Land subtotal**: rentPerCropAcre / rentTotal
- **Inputs subtotal**: springFert + fallFert + seed per acre and total
- **Operations subtotal**: machinery + labor + overhead + fuel per acre and total
- **Other subtotal**: drying + interest + cropInsurance per acre and total

Each group now calls `renderSubtotal(g.subtotalPerAcre, g.subtotalTotal)` after its items, producing a row with bold "SUBTOTAL" label and border-top separator.

**COP coloring logic:**
- Field editor: `copClass = budget.cop > budget.pricePerUnit ? 'profit-neg' : 'profit-pos'` (only when both > 0)
- Enterprise module view: `copCls = b.cop > b.pricePerUnit ? 'profit-neg' : 'profit-pos'`
- Dashboard: `copCls = util.profitClass(-row.profitPerAcre)` — uses negated profitPerAcre sign as proxy (since profitPerAcre = income - expense, negative profit implies COP exceeds price)

**Enterprise module view fix:** Changed hardcoded `(b.profitPerAcre || 0) >= 0 ? 'profit-pos' : 'profit-neg'` to `util.profitClass(b.profitPerAcre || 0)` for zero-case consistency.

**CSS added** (after existing `.prev-item` rules):
```css
.prev-group-subtotal {
  border-top: 1px solid var(--border);
  margin-top: 0.1rem; padding-top: 0.1rem;
}
.prev-group-subtotal .label { font-weight: 700; font-size: 0.68rem; text-transform: uppercase; }
.prev-group-subtotal .val { font-weight: 700; color: var(--text-bright); }
```
Plus light-mode overrides in `body.light` section.

### Task 2: Print Reports and PDF Accounting Parentheses (reports.js, pdf-report.js, style.css)

**`formatPrintMoney(n)` helper in reports.js:**
- Negative: `<span class="profit-neg">($X.XX)</span>`
- Zero: `$0.00`
- Positive: `$X.XX`

**Field-Level Input Plan rewritten** to show budget group subtotals per field (using `_computed` budget data from `/api/fields`). Layout: Land → Inputs → Operations → Other, each with group header row and subtotal row. Profit/AC and Profit (w/ Payments) use `formatPrintMoney()`. COP colored by cop-vs-pricePerUnit comparison. Original product inputs detail table preserved below the budget table.

**PRINT_CSS enhanced** with:
- `.subtotal-row td { font-weight: bold; border-top: 1px solid #666; background: #f5f5f5; }`
- `.group-header-row td { font-weight: bold; background: #e0e0e0; text-transform: uppercase; }`
- `.profit-neg { color: #cc0000 !important; }` and `.profit-pos { color: #1a6b10 !important; }`
- `@media print` with `print-color-adjust: exact` for both classes

**style.css @media print block updated:**
- `body` gets `-webkit-print-color-adjust: exact; print-color-adjust: exact;`
- `.profit-neg { color: #cc0000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`
- `.profit-pos { color: #1a6b10 !important; ... }`

**pdf-report.js `money()` updated** to return `($X.XX)` for negative values (accounting parentheses format throughout Enterprise PDF and Dashboard PDF).

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All 29 automated checks passed:
- Field editor preview: subtotal rows, renderSubtotal(), COP coloring, profitClass on profit rows
- CSS: .prev-group-subtotal styled, profit-neg/pos, print-color-adjust, @media print colors, light-mode overrides
- Dashboard: profitClass on profitPerAcre, copCls for COP
- Enterprise: util.profitClass() for profit, copCls for COP
- Reports: formatPrintMoney, accounting parens, group-header-row, subtotal-row, _computed data, Profit with formatPrintMoney
- PDF: profitColor, money() accounting parens, profit coloring applied

## Self-Check

Checking created/modified files and commits exist...

## Self-Check: PASSED

All 7 modified files found on disk. Both task commits verified in git history:
- `0cafd35` feat(21-01): add group subtotals and COP coloring to field editor preview
- `8d50252` feat(21-01): add budget group subtotals and accounting parentheses to print reports
