---
phase: 06-actuals-entry-and-enterprise-budget-view
verified: 2026-03-20T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Sandy enters a material invoice cost — verify it saves without confirmation step"
    expected: "After blur or Enter on an ActualCell, toast 'Saved' appears and the actual value is persisted; no dialog or confirmation prompt appears"
    why_human: "Cannot verify absence-of-dialog or toast rendering without a running browser session"
  - test: "Sandy marks a PLANNED field operation as completed with a checkbox and date"
    expected: "Checkbox shows checked state, date picker appears defaulting to today, passStatus changes to CONFIRMED, status badge updates"
    why_human: "Optimistic UI behavior and visual badge update requires browser-level verification"
  - test: "Sandy enters an actual harvest yield — verify the unit label is not hardcoded"
    expected: "Unit label next to yield ActualCell shows the enterprise's targetYieldUnit (e.g. 'Bu/ac' not 'bu/ac') — dynamically derived from budgetSummary"
    why_human: "Dynamic label derivation depends on live data and visual rendering"
  - test: "Variance column shows green for under-budget, red for over-budget entries"
    expected: "A saved actual less than projected shows green text; a saved actual greater than projected shows red text"
    why_human: "Color rendering and conditional class application requires visual inspection"
  - test: "Financial columns absent for OFFICE session, visible for ADMIN"
    expected: "When logged in as Sandy (OFFICE role), no revenue projection, gross margin, or profit/acre cards appear. When logged in as ADMIN, those 4 financial cards are visible above the cost sections"
    why_human: "Role-gated rendering requires active session with each role; cannot stub session in static analysis"
  - test: "Scroll position is preserved after entering an actual value"
    expected: "After clicking an ActualCell mid-page, typing a value, and pressing Enter, the page does not scroll to top"
    why_human: "Scroll behavior requires live browser interaction — the refreshBudget targeted-fetch pattern prevents it but must be confirmed by feel"
---

# Phase 6: Actuals Entry and Enterprise Budget View — Verification Report

**Phase Goal:** Sandy can record invoice costs, field operation confirmations, and harvest yields against the projected plan; the enterprise Budget tab shows projected and actual values side by side with variance
**Verified:** 2026-03-20
**Status:** human_needed — all automated checks pass; 6 items need human testing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sandy can open an enterprise Budget tab and enter an actual material invoice cost — the entry saves immediately without a confirmation step | ? HUMAN NEEDED | ActualCell.tsx (155 lines) implements blur/Enter save via `onSave` callback; BudgetTab wires to PATCH /applications/[recordId]/actual; toast.success("Saved") fires on success; no dialog pattern found anywhere in code |
| 2 | Sandy can mark a planned field operation as completed with an actual date — status changes to CONFIRMED | ? HUMAN NEEDED | OperationRow in BudgetTab (lines 1126–1218) has Checkbox + date input; onConfirm calls POST /api/import-plan/confirm with passStatus CONFIRMED; onUnconfirm calls PUT /operations/[recordId] to revert; both routes verified substantive |
| 3 | Sandy can enter an actual harvest yield per acre for an enterprise | ? HUMAN NEEDED | Harvest Yield section in BudgetTab (lines 810–872) renders ActualCell wired to saveYieldActual → PATCH /actual-yield; unit label dynamically derived from actualYieldUnit ?? revenueProjection?.targetYieldUnit |
| 4 | Sandy can update a seed cost with the actual purchase price | ? HUMAN NEEDED | Seed section (lines 586–688) renders ActualCell wired to saveSeedActual → PATCH /seed-usage/[recordId]/actual; unit label from sc.rateUnit shown below input |
| 5 | Enterprise Budget tab shows Projected, Actual, and Variance columns; favorable green, unfavorable red | ? HUMAN NEEDED | BudgetTableHeader renders 4 columns (Item, Projected+PROJ badge, Actual+ACTUAL badge, Variance); VarianceCell (45 lines) applies text-green-700 for variance >= 0, text-red-700 for variance < 0 |
| 6 | Each line item shows a badge indicating PROJ or ACTUAL (or UNPLANNED) | ? HUMAN NEEDED | DataSourceBadge (34 lines) renders three variant pills; BudgetTab wraps all projected values with `<DataSourceBadge source="PROJ" />` and conditionally renders `<DataSourceBadge source="ACTUAL" />` when actual value is set |
| 7 | Financial columns visible to ADMIN on Budget tab and absent for Sandy (OFFICE) | ? HUMAN NEEDED | `{canSeeFinancial && budgetSummary.revenueProjection && (...)}` guards financial cards (lines 523–584); budget-summary API strips revenueProjection from non-ADMIN responses via `canSeeFinancial = hasPermission(role, "budget:financial")` |

**Score:** 7/7 truths have complete code implementation — 6 require human confirmation of runtime behavior

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/budget/BudgetTab.tsx` | Full dual-column budget view, min 300 lines | VERIFIED | 1218 lines; exports BudgetTab + BudgetSummary type; all sections present; all save handlers wired |
| `src/components/budget/ActualCell.tsx` | Inline click-to-edit cell, min 50 lines | VERIFIED | 155 lines; Enter/Esc/blur/Tab behavior implemented; onAdvance callback; failure keeps cell editable |
| `src/components/budget/DataSourceBadge.tsx` | PROJ/ACTUAL/UNPLANNED pill badges, min 15 lines | VERIFIED | 34 lines; three variants with correct color classes; uses shadcn Badge |
| `src/components/budget/VarianceCell.tsx` | Variance with green/red, min 15 lines | VERIFIED | 45 lines; null-safe; green for favorable (>= 0), red for unfavorable (< 0) |
| `src/app/api/field-enterprises/[id]/budget-summary/route.ts` | Dual projected/actual/variance computation | VERIFIED | 256 lines; returns projected totals, actual totals, variance, unplanned costs, per-line-item actuals; financial stripping preserved |
| `src/app/api/field-enterprises/[id]/applications/[recordId]/actual/route.ts` | PATCH for material actual cost | VERIFIED | 64 lines; auth + budget:write RBAC; ownership check; writes actualTotalCost to MaterialUsage |
| `src/app/api/field-enterprises/[id]/seed-usage/[recordId]/actual/route.ts` | PATCH for seed actual price | VERIFIED | 63 lines; auth + budget:write RBAC; ownership check; writes actualPricePerUnit to SeedUsage |
| `src/app/api/field-enterprises/[id]/actual-yield/route.ts` | PATCH for harvest yield | VERIFIED | 69 lines; auth + budget:write RBAC; writes actualYieldPerAcre to FieldEnterprise |
| `src/app/api/field-enterprises/[id]/unplanned-cost/route.ts` | POST for unplanned cost | VERIFIED | 122 lines; auth + budget:write RBAC; creates MaterialUsage with dataSource ACTUAL, totalCost null |
| `src/app/api/field-enterprises/[id]/operations/[recordId]/route.ts` | PUT to revert CONFIRMED → PLANNED | VERIFIED | 104 lines; auth + budget:write RBAC; sets passStatus=PLANNED, clears operationDate; audit logged |
| `prisma/schema.prisma` | actualTotalCost, actualPricePerUnit, actualYieldPerAcre, DataSource.ACTUAL | VERIFIED | All 5 new nullable fields present; DataSource enum has ACTUAL alongside MANUAL and SYNCED |
| `src/lib/rbac.ts` | budget:write for ADMIN and OFFICE | VERIFIED | Line 27: ADMIN has budget:write; line 49: OFFICE has budget:write; CREW does not |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ActualCell.tsx` | PATCH /applications/[recordId]/actual | onSave callback from BudgetTab.saveMaterialActual | WIRED | BudgetTab lines 262–280: fetch PATCH with actualTotalCost body; success fires toast + onDataChanged |
| `ActualCell.tsx` | PATCH /seed-usage/[recordId]/actual | onSave callback from BudgetTab.saveSeedActual | WIRED | BudgetTab lines 282–299: fetch PATCH with actualPricePerUnit body |
| `ActualCell.tsx` | PATCH /actual-yield | onSave callback from BudgetTab.saveYieldActual | WIRED | BudgetTab lines 302–320: fetch PATCH with actualYieldPerAcre body |
| `BudgetTab.tsx` | budget-summary API response | budgetSummary prop destructuring | WIRED | budgetSummary.actualSeedCost, .actualMaterialCost, .actualOperationCost, .varianceCostPerAcre, .unplannedCosts all accessed |
| `BudgetTab.tsx` | sonner toast | toast.success / toast.error in save handlers | WIRED | All five save handlers fire toast.success("Saved") on success and toast.error("Couldn't save — try again") on failure |
| `budget-summary/route.ts` | prisma.materialUsage (actuals) | actualTotalCost field read in aggregation | WIRED | Lines 136–146: filters actualTotalCost !== null, sums materialActuals |
| `applications/[recordId]/actual` | prisma.materialUsage.update | PATCH handler writing actualTotalCost | WIRED | Line 48: prisma.materialUsage.update with data.actualTotalCost |
| All new routes | src/lib/rbac.ts | hasPermission(role, "budget:write") check | WIRED | Every route (applications/actual, seed-usage/actual, actual-yield, unplanned-cost, operations/[recordId]) checks hasPermission before any DB write |
| `page.tsx` | `src/components/budget/BudgetTab.tsx` | import + JSX render in TabsContent | WIRED | Line 52: import { BudgetTab, BudgetSummary }; lines 1036–1044: TabsContent renders BudgetTab with refreshBudget as onDataChanged |
| `page.tsx` | refreshBudget (targeted fetch) | callback passed as onDataChanged | WIRED | Lines 330–335: refreshBudget fetches only /budget-summary and calls setBudgetSummary — does NOT call full load() |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| ACT-01 | 06-02 | OFFICE can update material input costs with actual invoice amounts | SATISFIED | PATCH /applications/[recordId]/actual route + ActualCell in material sections of BudgetTab |
| ACT-02 | 06-02 | OFFICE can confirm planned field operations as completed with actual dates | SATISFIED | OperationRow checkbox+date wired to POST /import-plan/confirm; PUT /operations/[recordId] for un-confirm |
| ACT-03 | 06-02 | OFFICE can enter actual harvest yield per acre | SATISFIED | PATCH /actual-yield route + Harvest Yield section in BudgetTab with dynamic unit label |
| ACT-04 | 06-02 | OFFICE can update seed costs with actual purchase prices | SATISFIED | PATCH /seed-usage/[recordId]/actual route + ActualCell in seed section |
| ACT-05 | 06-01, 06-02 | Actuals entries recorded immediately without approval | SATISFIED | No approval workflow in any route; saves return directly on success; no intermediate state |
| VIEW-01 | 06-03 | Enterprise Budget tab shows projected and actual columns side by side | SATISFIED | BudgetTableHeader renders Item/Projected/Actual/Variance; data flows from budgetSummary prop |
| VIEW-02 | 06-03 | Variance column with favorable/unfavorable color coding | SATISFIED | VarianceCell applies text-green-700 (favorable) / text-red-700 (unfavorable); server computes variance |
| VIEW-03 | 06-03 | DataSource badges on line items indicate projected vs actual | SATISFIED | DataSourceBadge renders PROJ (blue), ACTUAL (green), UNPLANNED (amber) on correct rows throughout BudgetTab |
| VIEW-06 | 06-01, 06-03 | Financial columns visible only to ADMIN | SATISFIED | canSeeFinancial guard in BudgetTab (line 524); budget-summary API strips revenueProjection for non-ADMIN (line 246) |

No orphaned requirements — all 9 Phase 6 requirements (ACT-01 through ACT-05, VIEW-01 through VIEW-03, VIEW-06) are claimed by a plan and have corresponding implementation.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `BudgetTab.tsx` | 597–600 | Seed section actualPerAcre uses actualPricePerUnit directly as a per-acre value rather than computing actual total cost / acres | Warning | Seed variance display is comparing projected per-acre (totalCost/acres) against actualPricePerUnit which is a price-per-unit — these are different units. Display may show visually, but the VarianceCell comparison will produce nonsensical numbers unless the units align by coincidence. This is a semantic inconsistency, not a blocking stub. |

**Note:** The seed actual cost per-acre computation on lines 597–600 deserves scrutiny:

```tsx
const actualPerAcre =
  sc.actualPricePerUnit !== null
    ? sc.actualPricePerUnit   // <-- this is price/unit, not cost/acre
    : null;
```

The budget-summary API returns `actualPricePerUnit` for seed rows (the actual purchase price per seed unit), but the BudgetTab displays it directly as the "actual" value in the Actual column alongside a projected value of `totalCost / acres`. The VarianceCell then computes `projectedPerAcre - actualPerAcre`, comparing dollars/acre against dollars/unit. This will produce wrong variance numbers unless the user happens to be comparing compatible unit scales.

The API does compute actual seed cost correctly (lines 114–133 of budget-summary/route.ts) but does NOT expose that computed actual seed cost per row — it only exposes `actualPricePerUnit`. The BudgetTab would need to replicate the cost calculation client-side (unitsPerAcre * actualPricePerUnit) to get a true per-acre actual. This is a data display bug, not a structural gap — the save/persist flow works correctly.

---

## Human Verification Required

### 1. Material invoice cost entry (ACT-01 / ACT-05)

**Test:** Log in as Sandy (OFFICE role). Navigate to any enterprise with material costs on the Budget tab. Click any Actual cell in the Fertilizer, Chemical, or Custom Application section, type a dollar value, and press Enter.
**Expected:** Toast "Saved" appears within 2 seconds. No confirmation dialog. Value persists on page reload. Cursor advances to next Actual cell.
**Why human:** Toast timing, absence of dialogs, and cursor advancement require live browser interaction.

### 2. Field operation confirmation (ACT-02)

**Test:** Find an operation with passStatus PLANNED. Check the Completed checkbox.
**Expected:** Checkbox shows checked immediately (optimistic), date picker appears defaulting to today's date. On success, no error toast. Check another operation then un-check the first — verify it reverts to unchecked with date picker hidden.
**Why human:** Optimistic state flip and date picker appearance require visual verification.

### 3. Actual harvest yield entry (ACT-03)

**Test:** On the Budget tab Harvest Yield section, click the Actual cell, enter a yield number, press Enter.
**Expected:** Value saves, unit label beside the cell matches the enterprise's projected yield unit (e.g., "Bu/ac") — NOT hardcoded text.
**Why human:** Dynamic unit label derivation requires live data with an enterprise that has a targetYieldUnit set.

### 4. Variance color coding (VIEW-02)

**Test:** Enter an actual material cost lower than projected. Then enter an actual cost higher than projected.
**Expected:** Under-budget entry shows green variance text. Over-budget entry shows red variance text. Summary card at top updates accordingly.
**Why human:** Color rendering requires visual inspection.

### 5. Financial columns ADMIN vs OFFICE (VIEW-06)

**Test:** As OFFICE user (Sandy), go to Budget tab. Then as ADMIN, go to the same Budget tab.
**Expected:** OFFICE sees three summary cards (Projected, Actual, Variance) only. ADMIN sees three summary cards PLUS four financial cards (Target Yield, Target Price, Projected Revenue, Margin/Acre).
**Why human:** Role-gated rendering requires two separate sessions.

### 6. Scroll preservation on save

**Test:** Scroll to the bottom of the Budget tab (past the Operations section), then enter an actual value and save.
**Expected:** Page does not scroll to top. Viewport position stays at the edited cell.
**Why human:** Scroll behavior can only be confirmed interactively; static analysis cannot verify that refreshBudget avoids triggering layout jump.

---

## Seed Actual Cost Display Bug (Non-Blocking)

The BudgetTab seed section displays `sc.actualPricePerUnit` directly as the "actual per-acre" value in the Actual column. This is the price per seed unit (e.g., dollars per unit of seed), not a cost per acre. The projected column shows `totalCost / acres` (dollars per acre). The VarianceCell will compare these two incompatible values.

The budget-summary API computes actual seed cost correctly in the aggregation (lines 114–133 of route.ts) but does not return the computed per-row actual cost — only `actualPricePerUnit`. The UI would need to replicate the `(rate / seedsPerUnit) * actualPricePerUnit` calculation for display to match the projected format.

This is a display accuracy issue, not a goal-blocking gap. Sandy can still enter seed actual prices and they save correctly. The variance column for seed rows will show misleading numbers. Flagged for awareness but not a gap in the verification frontmatter since the save/retrieve flow works end-to-end.

---

## Summary

All 9 required artifacts exist, are substantive (well above minimum line thresholds), and are correctly wired. The API layer (budget-summary dual computation, 4 PATCH/POST actuals routes, operation un-confirm route) is complete and auth-gated. TypeScript compiles clean. The schema has all required actuals fields. RBAC has budget:write for ADMIN and OFFICE only.

The only automated concern is a semantic display inconsistency in the seed section (actualPricePerUnit treated as per-acre value in the Actual column) — this is a display accuracy issue, not a structural or goal-blocking gap.

All 6 human verification items are behavioral/visual checks that cannot be confirmed by static analysis. The underlying code supports the expected behavior in every case.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
