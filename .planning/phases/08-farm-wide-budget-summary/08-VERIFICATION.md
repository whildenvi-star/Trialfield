---
phase: 08-farm-wide-budget-summary
verified: 2026-03-21T00:00:00Z
status: human_needed
score: 12/12 automated must-haves verified
human_verification:
  - test: "Navigate to /budget-summary as ADMIN and confirm organic/conventional grouping matches actual farm data"
    expected: "Enterprises grouped correctly — organic section first, conventional second; per-acre numbers match individual enterprise Budget tabs when cross-referenced"
    why_human: "Data correctness requires comparing rendered values against known farm records; cannot verify arithmetic accuracy without live DB and real crop data"
  - test: "Confirm variance color coding is visible and directionally correct"
    expected: "Green text for favorable (actual < projected / under budget); red text for unfavorable (over budget); dash shown for enterprises with no actuals"
    why_human: "Color rendering and visual appearance requires browser inspection"
  - test: "Log in as OFFICE role (Sandy) and confirm financial columns are absent"
    expected: "Revenue/Ac and Margin/Ac columns are not rendered; all other columns remain visible"
    why_human: "Role-conditional rendering must be confirmed in a real authenticated session — cannot verify RBAC gate behavior from source alone"
  - test: "Click an enterprise row and confirm navigation to enterprise detail"
    expected: "Browser navigates to /field-enterprises/{enterpriseId} landing on the Budget tab"
    why_human: "Client-side router.push behavior and tab-targeting requires browser interaction"
---

# Phase 08: Farm-Wide Budget Summary — Verification Report

**Phase Goal:** ADMIN can view all enterprises for a crop year in a single aggregated page that mirrors the Macro Rollup layout, showing projected vs actual totals across the full farm operation
**Verified:** 2026-03-21
**Status:** human_needed — all automated checks pass; four items require browser/session verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn from the combined must_haves of 08-01-PLAN.md and 08-02-PLAN.md.

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GET /api/budget-summary returns enterprises grouped by enterpriseType (organic first, conventional) | VERIFIED | `route.ts:439-440` — filters rows into `organic` and `conventional` arrays; response shape includes both |
| 2  | Each enterprise row includes projected and actual per-acre cost breakdowns for Seed, Fertilizer, Chemical, Operations | VERIFIED | `route.ts:379-396` — six per-acre values computed per enterprise; all four categories present in FarmBudgetRow interface |
| 3  | Section subtotals and grand total use weighted averages by acreage, not simple averages | VERIFIED | `route.ts:72-136` — `computeSubtotal` divides by `totalAcres` (sum of `r.acres`); actual subtotals use `dataAcres` from filtered rows only |
| 4  | Financial fields (revenue, margin) are present only when caller has budget:financial permission | VERIFIED | `route.ts:151,401-413` — `canSeeFinancial = hasPermission(role, "budget:financial")`; `financialFields` spread only when `canSeeFinancial` is true |
| 5  | Enterprises with no actuals return null for actual and variance fields, not zero | VERIFIED | `route.ts:370-398` — `allActualsNull` guard; `actualTotalPerAcre` and `varianceTotalPerAcre` return `null`, not `0` |
| 6  | Unauthenticated requests return 401; users without budget:read return 403 | VERIFIED | `route.ts:143-150` — `getAuthContext()` null → 401; `hasPermission(role, "budget:read")` false → 403 |
| 7  | ADMIN can navigate to /budget-summary from sidebar | VERIFIED | `sidebar.tsx:32` — `{ href: "/budget-summary", label: "budget summary", icon: BarChart2 }` present in `navItems` |
| 8  | Enterprises grouped into Organic and Conventional sections with subtotals and grand total | VERIFIED | `page.tsx:337-386` — organic section, conventional section, and grand total row all rendered conditionally |
| 9  | Each enterprise row shows Acres, Seed, Fertilizer, Chemical, Operations, Total with Proj and Act per-acre | VERIFIED | `page.tsx:91-127` — EnterpriseRow renders all 14 (or 16 with financial) cells; sub-header row labels Proj/Act for each category |
| 10 | Variance color coding: green for favorable (under budget), red for unfavorable | VERIFIED | `page.tsx:67-81` — `fmtVariance` uses `text-green-600` when `variance >= 0`, `text-red-500` when negative |
| 11 | Enterprises with no actuals show dashes for actual/variance columns | VERIFIED | `page.tsx:62-65` — `fmt()` returns `"—"` when value is `null`; `fmtVariance` returns `<span className="text-stone-500">—</span>` when null |
| 12 | Clicking an enterprise row navigates to that enterprise's detailed page | VERIFIED | `page.tsx:345,366` — `onClick={() => router.push(\`/field-enterprises/${row.enterpriseId}\`)}` on both organic and conventional rows |

**Automated score: 12/12 truths verified**

---

### Required Artifacts

| Artifact | Expected | Lines | Status | Details |
|----------|----------|-------|--------|---------|
| `src/app/api/budget-summary/route.ts` | Farm-wide budget aggregation endpoint | 464 | VERIFIED | Exports `GET`; full arithmetic; auth/RBAC; weighted subtotals |
| `src/app/(app)/budget-summary/page.tsx` | Farm-wide budget summary page | 393 | VERIFIED | Client component; fetches API; renders grouped table; RBAC financial columns |
| `src/components/layout/sidebar.tsx` | Sidebar with budget-summary nav link | 83 | VERIFIED | `budget-summary` href present; `BarChart2` icon imported and used |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/budget-summary/route.ts` | `prisma.fieldEnterprise` | `findMany` with seed/material/operation includes | WIRED | `route.ts:168` — full `findMany` with `include: { field, seedUsages, materialUsages, fieldOperations }` |
| `src/app/api/budget-summary/route.ts` | `src/lib/rbac.ts` | `hasPermission` for `budget:read` and `budget:financial` | WIRED | `route.ts:148,151` — both permission checks present and gate the correct code paths |
| `src/app/(app)/budget-summary/page.tsx` | `/api/budget-summary` | `fetch` in `useEffect` on mount | WIRED | `page.tsx:206` — `fetch("/api/budget-summary")`; response consumed via `setData(json)` at line 212 |
| `src/app/(app)/budget-summary/page.tsx` | `useSession` | derive `canSeeFinancial` for column rendering | WIRED | `page.tsx:195-197` — `useSession()` → `role` → `canSeeFinancial = role === "ADMIN"` |
| `src/components/layout/sidebar.tsx` | `/budget-summary` | `navItems` entry | WIRED | `sidebar.tsx:32` — entry present, `BarChart2` imported at line 22 |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VIEW-04 | 08-01, 08-02 | Farm-wide budget summary page aggregates all enterprises for a crop year | SATISFIED | API endpoint aggregates all enterprises via single Prisma query; page renders grouped result |
| VIEW-05 | 08-01, 08-02 | Farm-wide view mirrors Macro Rollup layout stylistically | SATISFIED (human confirm) | Two-row column headers (category group + Proj/Act sub-headers), section rows, subtotal rows, grand total — matches Macro Rollup structure; visual fidelity requires human confirmation |

No orphaned requirements — both VIEW-04 and VIEW-05 are claimed by both plans and both plans have delivered supporting artifacts.

---

### Anti-Patterns Found

No blockers, warnings, or notable anti-patterns detected.

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| All three files | TODO/FIXME/placeholder | — | None found |
| `route.ts`, `page.tsx` | Empty returns (`return null`, `return {}`) | — | None found (null returns are semantically correct actual values, not stub returns) |

TypeScript compilation: **clean** — `npx tsc --noEmit` produced no output (zero errors).

Commits verified in git history:
- `27b1fc8` — feat(08-01): create GET /api/budget-summary aggregation endpoint
- `f6e00c1` — feat(08-02): build farm-wide budget summary page and sidebar link

---

### Human Verification Required

#### 1. Data accuracy cross-reference

**Test:** Log in as ADMIN, navigate to `/budget-summary`, pick 2-3 enterprise rows and compare their per-acre values against the same enterprise's individual Budget tab.
**Expected:** Numbers match — projected seed/fert/chem/ops per-acre on the summary page equal those shown in the per-enterprise Budget tab.
**Why human:** Arithmetic correctness against live DB data cannot be verified from source inspection alone.

#### 2. Variance color rendering

**Test:** Identify an enterprise with actuals entered. Confirm the Var column shows green text when actual < projected and red text when actual > projected.
**Expected:** Green = under budget (favorable); red = over budget (unfavorable); dash for enterprises with no actuals.
**Why human:** Color rendering requires browser inspection; cannot confirm from Tailwind class names alone.

#### 3. OFFICE role — financial column suppression

**Test:** Log in as Sandy (OFFICE role), navigate to `/budget-summary`.
**Expected:** Revenue/Ac and Margin/Ac columns are absent from the table; all other columns visible.
**Why human:** Role-conditional rendering requires an authenticated OFFICE session in the running app.

#### 4. Enterprise row click navigation

**Test:** On the budget summary page, click any enterprise row.
**Expected:** Browser navigates to `/field-enterprises/{id}` showing the enterprise detail page.
**Why human:** `router.push` behavior and correct enterprise ID resolution requires browser interaction.

---

### Gaps Summary

No gaps. All automated must-haves pass at all three levels (exists, substantive, wired). The four items above require a human with browser access and test credentials to confirm. The SUMMARY.md documents that human verification was completed by the user during plan execution (Task 2 checkpoint, approved without adjustments) — these items are listed here for completeness as they cannot be re-verified programmatically.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
