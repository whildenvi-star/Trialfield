# Phase 6: Actuals Entry and Enterprise Budget View - Research

**Researched:** 2026-03-20
**Domain:** Inline editing UI patterns in Next.js/React, Prisma schema migrations for actuals, budget dual-column view
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Actuals entry interaction**
- Inline click-to-edit on the Actual cell — Sandy clicks, types value, saves on blur/Enter
- No confirmation dialog — saves immediately (per success criteria)
- Enter key saves and moves focus to the next editable cell below (spreadsheet behavior)
- Tab moves right if applicable; Esc cancels edit
- Page must never navigate away or scroll-jump on save — Sandy stays exactly where she is (critical pain point from current Macro Rollup workflow)
- Both one-at-a-time and batch entry workflows supported by the same inline pattern

**Field operation confirmation**
- Checkbox + date picker pattern: Sandy checks "Completed" checkbox, date picker appears defaulting to today
- She adjusts date if needed — saves automatically
- Status flips from PLANNED to CONFIRMED
- Can un-confirm (uncheck) to revert to PLANNED and clear actual date

**Harvest yield entry**
- Yield unit comes from the projected plan per crop (bu/ac for grain, tons/ac for hay, lbs/ac for tobacco, etc.)
- Unit is NOT hardcoded — matches whatever the farm-budget sync provides for that enterprise
- Sandy enters the numeric value, unit label is displayed but not editable

**Seed cost actuals**
- Claude's Discretion: match whatever unit convention the farm-budget data model already stores (per-unit or per-acre)

**Unplanned line items**
- Sandy CAN add rows for expenses not in the projected plan
- Entry requires: category (from fixed dropdown of existing budget categories) + amount only
- No free-text category names — dropdown matches existing cost categories from the budget
- Unplanned rows show dash in Projected column and no variance calculation

**Budget tab layout**
- Cost categories grouped to match farm-budget spreadsheet sections (Seed, Fertilizer, Chemical, Operations, etc.) — Sandy sees the structure she already knows
- All values shown as per-acre ($/ac) — how Sandy thinks about costs
- Collapsible sections, all expanded by default — Sandy can collapse sections she's not working on
- Summary row at top of tab showing Total Projected/ac, Total Actual/ac, and Total Variance

**Data source badges**
- Subtle inline pill badges next to values: "PROJ" (muted blue), "ACTUAL" (muted green)
- Both Projected and Actual columns always visible — entering an actual doesn't hide the projected value
- Unplanned rows get an "UNPLANNED" badge (amber/orange pill) distinct from regular ACTUAL
- Variance color coding: green = under budget (favorable), red = over budget (unfavorable) — standard accounting convention

**Entry feedback & validation**
- Instant save with subtle toast ("Saved") that fades after ~2s
- Network error: red toast "Couldn't save — try again", cell stays editable with Sandy's value preserved
- Sandy can click any actual cell again to re-edit or clear it at any time — no audit trail needed
- No warnings on large variances — trust Sandy, the red variance color is sufficient
- Numeric-only inputs for cost and yield fields; date picker for date fields; no free-text on the budget table
- Un-confirming a field operation reverts to PLANNED and clears actual date

### Claude's Discretion
- Actuals progress indicator (count of items entered vs total) — optional in summary area
- Exact seed cost unit convention (match farm-budget data model)
- Loading skeleton design
- Exact spacing, typography, and animation timing
- Error state handling beyond network errors

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACT-01 | OFFICE user can update material input costs with actual invoice amounts | `MaterialUsage.totalCost` and `MaterialUsage.unitCost` are nullable Float fields already in schema — use these for actuals; add `isActual` flag or use DataSource enum to track source |
| ACT-02 | OFFICE user can confirm planned field operations as completed with actual dates | `FieldOperation.passStatus` (PLANNED/CONFIRMED) and `operationDate` already exist; `/api/import-plan/confirm` route already implements this — reuse or extend with un-confirm support |
| ACT-03 | OFFICE user can enter actual harvest yield per acre | `HarvestEvent.yieldPerAcre` and `HarvestEvent.yieldUnit` already exist; need new "actual yield" path that doesn't trigger full harvest event creation |
| ACT-04 | OFFICE user can update seed costs with actual purchase prices | `SeedLot.purchasePrice` is the current cost field; updating it modifies the projected cost too — needs `SeedUsage`-level actual price field OR separate `actualPurchasePrice` on `SeedUsage` |
| ACT-05 | Actuals entries are recorded immediately without approval | Confirmed by existing pattern: operations/applications routes do immediate Prisma updates; no approval state machine needed |
| VIEW-01 | Enterprise Budget tab shows projected and actual columns side by side | Budget tab exists in `page.tsx` (lines 1050–1760); currently shows projected-only; needs dual-column redesign with actuals data from extended budget-summary API |
| VIEW-02 | Variance column shows difference with favorable/unfavorable color coding | Pure UI computation: `variance = projected - actual`; green if actual < projected (under budget = favorable), red if actual > projected (unfavorable) |
| VIEW-03 | DataSource badges on line items indicate whether data is projected (synced) or actual (entered) | `DataSource` enum exists (MANUAL/SYNCED); needs third value `ACTUAL` or separate `isActual` boolean; badge component pattern already used extensively in page.tsx |
| VIEW-06 | Financial columns (revenue, margin, profit) visible only to ADMIN on all views | Already enforced at API layer (PRIV-01 from Phase 5) and UI layer (`canSeeFinancial` guard in page.tsx); this phase must ensure new budget dual-view also respects the same guards |
</phase_requirements>

---

## Summary

Phase 6 builds on the existing enterprise detail page (`/app/(app)/field-enterprises/[id]/page.tsx`) and budget-summary API. The current Budget tab (lines 1050–1760 of a 1760-line file) shows projected cost data in a read-only table. This phase transforms it into a dual-column Projected / Actual / Variance layout with inline editing.

The key insight from reading the codebase: **no new data models are needed for most actuals — the existing fields accept actuals already.** `FieldOperation.passStatus` and `operationDate` are how confirmations are tracked. `MaterialUsage.totalCost`/`unitCost` and `HarvestEvent.yieldPerAcre` are already nullable fields ready to receive actual values. The critical schema gap is distinguishing "projected cost from farm-budget sync" vs "actual invoice cost entered by Sandy" — the current `DataSource` enum (MANUAL/SYNCED) doesn't cleanly map to this; a third state or a boolean flag is needed.

The STATE.md flags two architectural prerequisites: (1) the `BudgetTab.tsx` extraction — the page file is 1760 lines and the budget section is deeply embedded; extracting it into its own component is required before the dual-view redesign; (2) the budget-summary computation currently mixes PLANNED and CONFIRMED operations into the same `totalCostOfProduction` — this must be split before dual-column display is meaningful (a PLANNED operation should count toward Projected, a CONFIRMED operation's actual cost should count toward Actual).

**Primary recommendation:** Wave 0 of the plan must be: (1) extract BudgetTab into `src/components/budget/BudgetTab.tsx`, (2) add schema migration for actuals tracking fields, (3) split budget-summary API into projected vs actual computation paths. All other tasks build on this foundation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | App Router, API routes, client components | Project framework — already in use |
| react | 19.2.3 | Client component state for inline editing | Already in use |
| @prisma/client | 6.19.2 | Database access, schema migration | Already in use |
| next-auth | 5.0.0-beta.30 | Session/role check (`useSession`, `getAuthContext`) | Already in use; role guards needed for OFFICE write access |
| sonner | 2.0.7 | Toast feedback ("Saved" / "Couldn't save — try again") | Already in use in page.tsx; `toast.success` / `toast.error` pattern established |
| date-fns | 4.1.0 | Date formatting for date picker display | Already in use (`format`, `parseISO`) |
| tailwindcss | 4.x | Styling: green/red variance colors, PROJ/ACTUAL badges | Already in use |
| lucide-react | 0.575.0 | Icons: Check, X, ChevronDown for collapsible sections | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Badge` | (bundled) | PROJ / ACTUAL / UNPLANNED pill badges | Already imported in page.tsx |
| shadcn `Checkbox` | (bundled) | Confirmed checkbox for field operations | Already available via shadcn |
| shadcn `Input` | (bundled) | Inline numeric input for actual cost/yield | Already imported in page.tsx |
| shadcn `Collapsible` | (bundled) | Collapsible cost category sections | Available in shadcn; not yet used in page.tsx |
| shadcn `Separator` | (bundled) | Visual dividers between sections | Already imported in page.tsx |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `Collapsible` | useState-toggled div | Collapsible handles keyboard/accessibility automatically; no build cost since shadcn is already installed |
| Inline edit on the table cell | Separate "Edit Actuals" modal | CONTEXT.md locks inline; modal would cause scroll-jump on save, which is the pain point to eliminate |
| New `EnterpriseActual` model | Nullable fields on existing models | New model adds join complexity and migration overhead; existing nullable fields cover all cases except tracking provenance |

**Installation:**
No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── budget/
│       ├── BudgetTab.tsx          # Extracted from page.tsx — dual-column budget view
│       ├── ActualCell.tsx         # Inline editable cell component (click-to-edit)
│       ├── DataSourceBadge.tsx    # PROJ / ACTUAL / UNPLANNED pill badge
│       └── VarianceCell.tsx       # Variance value with green/red color coding
├── app/
│   └── api/
│       └── field-enterprises/[id]/
│           └── budget-summary/
│               └── route.ts       # Extended: returns projected + actual side by side
└── prisma/
    └── schema.prisma              # Migration: add actuals fields
```

### Pattern 1: BudgetTab Extraction (Wave 0 Prerequisite)

**What:** Extract the Budget tab section from `page.tsx` (lines 1050–1760) into `src/components/budget/BudgetTab.tsx`. The page file is 1760 lines and the budget section alone is ~710 lines — it must be a separate component before adding the dual-view logic.

**When to use:** Before any other Phase 6 work begins.

**Example:**
```typescript
// src/components/budget/BudgetTab.tsx
"use client";

interface BudgetTabProps {
  enterpriseId: string;
  budgetSummary: BudgetSummary | null;
  canSeeFinancial: boolean;
  onDataChanged: () => void;   // callback to trigger parent reload
}

export function BudgetTab({ enterpriseId, budgetSummary, canSeeFinancial, onDataChanged }: BudgetTabProps) {
  // All budget rendering + inline editing logic lives here
}
```

In `page.tsx`, replace the budget tab section with:
```typescript
{canSeeBudget && (
  <TabsContent value="budget">
    <BudgetTab
      enterpriseId={id}
      budgetSummary={budgetSummary}
      canSeeFinancial={canSeeFinancial}
      onDataChanged={load}
    />
  </TabsContent>
)}
```

### Pattern 2: Schema Migration for Actuals Tracking

**What:** The existing schema stores projected costs in `MaterialUsage.unitCost`/`totalCost`, `FieldOperation.costPerAcre`/`totalCost`, and `SeedUsage` links to `SeedLot.purchasePrice`. These fields are populated from the farm-budget sync. Phase 6 needs to track actual invoice amounts separately without overwriting the projected values.

**Schema additions needed:**
```prisma
model MaterialUsage {
  // ... existing fields ...
  actualTotalCost   Float?    // Sandy's actual invoice amount for this input
  actualUnitCost    Float?    // actual $/unit if different from projected
}

model SeedUsage {
  // ... existing fields ...
  actualPricePerUnit Float?   // actual purchase price (ACT-04)
}

model FieldEnterprise {
  // ... existing fields ...
  actualYieldPerAcre Float?   // actual harvest yield (ACT-03) — enterprise-level aggregate
  actualYieldUnit    String?  // matches targetYieldUnit
}
```

**DataSource enum extension:**
```prisma
enum DataSource {
  MANUAL    // hand-entered non-budget data
  SYNCED    // compiled from farm-budget service
  ACTUAL    // entered by OFFICE as an invoice/confirmed value
}
```

**Why not a separate `EnterpriseActual` table:** The unplanned items (new rows not in the projected plan) require new records anyway. Unplanned actuals can be stored as `MaterialUsage` records with `dataSource: ACTUAL` and no corresponding projected record (i.e., `unitCost = null`, `actualTotalCost` set).

### Pattern 3: Budget-Summary API — Dual Computation Paths

**What:** The current `budget-summary/route.ts` computes `totalCostOfProduction` as the sum of ALL operation costs regardless of `passStatus`. For Phase 6, the API needs to return both a projected total and an actual total.

**State.md blocker:** "Budget-summary computation mixes PLANNED and CONFIRMED operations — must split projected/actual computation paths before actuals entry goes live, or confirmed passes inflate projected totals."

**Extended API response shape:**
```typescript
// GET /api/field-enterprises/[id]/budget-summary
// New response shape (extends existing)
{
  // PROJECTED (existing, unchanged)
  seedCosts: [...],           // from farm-budget sync
  materialCosts: [...],       // projected from sync
  operationCosts: [...],      // all ops (PLANNED + CONFIRMED) with passStatus
  totalSeedCost: number,      // projected
  totalMaterialCost: number,  // projected
  totalOperationCost: number, // projected (ALL ops including PLANNED)
  totalCostOfProduction: number,  // projected total
  costPerAcre: number,        // projected $/ac

  // ACTUAL (new)
  actualSeedCost: number | null,       // sum of actualPricePerUnit entries
  actualMaterialCost: number | null,   // sum of actualTotalCost entries
  actualOperationCost: number | null,  // sum of CONFIRMED op actual costs
  actualYieldPerAcre: number | null,   // from FieldEnterprise.actualYieldPerAcre
  actualTotalCost: number | null,      // sum of all actuals
  actualCostPerAcre: number | null,    // actualTotalCost / acres

  // VARIANCE (computed server-side)
  varianceSeedCost: number | null,
  varianceMaterialCost: number | null,
  varianceOperationCost: number | null,
  varianceTotalCost: number | null,
  varianceCostPerAcre: number | null,

  // UNPLANNED (new rows Sandy added)
  unplannedCosts: { id: string; category: string; actualTotalCost: number }[],

  // existing financial fields (ADMIN only, unchanged)
  revenueProjection?: { ... }  // canSeeFinancial gate from Phase 5
}
```

### Pattern 4: Inline Editable ActualCell Component

**What:** Clicking an Actual cost cell toggles it from display mode to an input. On blur or Enter, the value is saved immediately via PATCH to the appropriate API route. On Esc, the value reverts.

```typescript
// src/components/budget/ActualCell.tsx
"use client";

interface ActualCellProps {
  value: number | null;       // current actual value (null = not yet entered)
  onSave: (value: number | null) => Promise<void>;
  placeholder?: string;       // "—" when not yet entered
}

export function ActualCell({ value, onSave, placeholder = "—" }: ActualCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
  }

  async function commit() {
    const parsed = draft === "" ? null : parseFloat(draft);
    if (draft !== "" && isNaN(parsed!)) { setEditing(false); return; }
    try {
      await onSave(parsed);
      setEditing(false);
    } catch {
      // cell stays editable with Sandy's value preserved (per CONTEXT.md)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); }
    // Tab: let browser handle natural focus movement
  }

  if (!editing) {
    return (
      <span
        onClick={startEdit}
        className="cursor-pointer px-2 py-1 rounded hover:bg-stone-100 text-stone-700 min-w-[60px] inline-block text-right"
      >
        {value != null ? `$${value.toFixed(2)}` : placeholder}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      type="number"
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="w-24 text-right border rounded px-2 py-0.5 text-sm focus:ring-1 focus:ring-stone-400"
    />
  );
}
```

**Save handler with toast feedback pattern:**
```typescript
// In BudgetTab.tsx — handler for saving a material actual
async function saveMaterialActual(materialUsageId: string, actualTotalCost: number | null) {
  const res = await fetch(`/api/field-enterprises/${enterpriseId}/applications/${materialUsageId}/actual`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actualTotalCost }),
  });
  if (!res.ok) {
    toast.error("Couldn't save — try again");
    throw new Error("Save failed");  // keeps cell editable
  }
  toast.success("Saved", { duration: 2000 });
  onDataChanged();
}
```

### Pattern 5: Field Operation Confirmation — Checkbox + Date Picker

**What:** The existing confirm flow uses a separate dialog (see `confirmPass` in page.tsx lines 306–320). CONTEXT.md locks the pattern as checkbox + date picker inline in the operations table, not a dialog. The existing `/api/import-plan/confirm` route handles PLANNED→CONFIRMED and must be extended to handle CONFIRMED→PLANNED (un-confirm).

```typescript
// In BudgetTab operations section
function OperationConfirmRow({ op, onChanged }: { op: OperationCost; onChanged: () => void }) {
  const [date, setDate] = useState(op.operationDate ?? new Date().toISOString().slice(0, 10));
  const isConfirmed = op.passStatus === "CONFIRMED";

  async function toggleConfirm(checked: boolean) {
    if (checked) {
      await fetch("/api/import-plan/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: op.id, operationDate: date }),
      });
    } else {
      // un-confirm: revert to PLANNED, clear date
      await fetch(`/api/field-enterprises/${enterpriseId}/operations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: op.id, passStatus: "PLANNED", operationDate: null }),
      });
    }
    onChanged();
  }
  // ...
}
```

**Note:** `/api/field-enterprises/[id]/operations` already has a PUT route that accepts arbitrary field updates including `passStatus` and `operationDate`. Un-confirm can use this existing route directly.

### Pattern 6: Per-Category Collapse with shadcn Collapsible

```typescript
// Source: shadcn/ui Collapsible docs
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function BudgetSection({ title, icon, total, children }: { ... }) {
  const [open, setOpen] = useState(true);  // expanded by default per CONTEXT.md

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full py-2">
          {icon}
          <span className="text-sm font-semibold text-stone-700">{title}</span>
          <span className="text-xs text-stone-400 ml-auto">{total}</span>
          <ChevronDown size={14} className={cn("transition-transform", open ? "rotate-0" : "-rotate-90")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
```

### Pattern 7: API Routes for Actuals — PATCH Pattern

Phase 6 needs new PATCH endpoints (not PUT — PATCH is the idiomatic verb for partial updates):

```
PATCH /api/field-enterprises/[id]/applications/[recordId]/actual
  body: { actualTotalCost: number | null }

PATCH /api/field-enterprises/[id]/seed-usage/[recordId]/actual
  body: { actualPricePerUnit: number | null }

PATCH /api/field-enterprises/[id]/actual-yield
  body: { actualYieldPerAcre: number | null }

POST  /api/field-enterprises/[id]/unplanned-cost
  body: { category: string; actualTotalCost: number }
```

The existing `[recordId]` sub-directory exists under applications: `src/app/api/field-enterprises/[id]/applications/[recordId]/` — add `actual/route.ts` there.

### Anti-Patterns to Avoid

- **Overwriting projected cost with actual:** Never write `actualTotalCost` into `MaterialUsage.totalCost` — that field holds the farm-budget projected value. Use the new `actualTotalCost` field.
- **Page navigation on save:** Never call `router.push()` or `router.refresh()` on save — only call `onDataChanged()` which triggers a targeted re-fetch without scroll position change.
- **Scroll-jumping refetch:** The `load()` function in page.tsx currently re-fetches all data including enterprise, materials, seeds, equipment, and budget-summary. A full `load()` call after an inline edit will cause scroll position reset. Use a targeted budget-summary re-fetch only: `fetch('/api/field-enterprises/${id}/budget-summary')`.
- **Recomputing variance client-side in the component tree:** Compute it in the API response. Keeps the component dumb, ensures consistency.
- **Mixing PLANNED and CONFIRMED in projected total:** The current `totalCostOfProduction` includes PLANNED operations. The projected column should include PLANNED operations (it's the budget plan). The actual column should include only CONFIRMED operations that have an `actualTotalCost`, or fall back to projected cost for confirmed ops without an actual.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast state | `sonner` (`toast.success`, `toast.error`) | Already imported in page.tsx; handles duration, stacking, dismissal |
| Date formatting | Manual `toLocaleDateString` | `date-fns` `format()` | Already in use; consistent with existing `fmtDate()` helper |
| Collapsible sections | `useState` + manual height animation | shadcn `Collapsible` | Handles keyboard, accessibility, animation; zero install cost |
| Input debounce for actuals | `setTimeout` / `lodash.debounce` | Save on blur/Enter only | CONTEXT.md specifies save-on-blur — no debounce needed |
| Field operation un-confirm | New API route | Existing PUT `/operations` route | Already accepts `passStatus` and `operationDate: null` updates |
| Badge component | `<span>` with custom classes | shadcn `Badge` variant | Already imported in page.tsx; consistent styling |

**Key insight:** This phase is about transforming an existing read-only view into an editable one. Nearly all infrastructure (API routes, schema fields, UI components) already exists — the work is wiring actuals fields through the stack, not building new systems.

---

## Common Pitfalls

### Pitfall 1: Scroll Position Reset on Save

**What goes wrong:** After Sandy enters an actual cost, the page scrolls back to the top and she loses her place in a long budget table.
**Why it happens:** Calling the full `load()` function (which re-fetches all data and calls `setEnt()`, `setMaterials()`, etc.) triggers a full React reconciliation that can reset scroll position. Also: `router.refresh()` causes full SSR re-render and absolutely resets scroll.
**How to avoid:** After an actuals save, re-fetch ONLY the budget-summary endpoint and call `setBudgetSummary(await res.json())`. Do not call `load()`, do not call `router.refresh()`. The rest of the page data (operations tab, applications tab) doesn't change when Sandy enters a budget actual.
**Warning signs:** Test by entering an actual while scrolled to the middle of the budget table — if the page scrolls up, a full `load()` or `router.refresh()` is being called.

### Pitfall 2: Overwriting Projected Costs

**What goes wrong:** Sandy enters an actual cost of $85/unit for seed, and the projected cost display also changes to $85 — losing the original plan value.
**Why it happens:** Writing the actual value into `SeedLot.purchasePrice` instead of a new `SeedUsage.actualPricePerUnit` field.
**How to avoid:** NEVER write actuals into the projected cost fields (`MaterialUsage.unitCost`, `MaterialUsage.totalCost`, `SeedLot.purchasePrice`, `FieldOperation.costPerAcre`). Only write to the new `actualTotalCost`/`actualPricePerUnit`/`actualYieldPerAcre` fields added in the migration.
**Warning signs:** If the Projected column value changes when Sandy saves an actual, the wrong field is being written.

### Pitfall 3: Budget-Summary Mixed Computation (STATE.md Blocker)

**What goes wrong:** The variance column shows nonsensical values because CONFIRMED operations are included in both the Projected total (already included in `totalCostOfProduction`) and the Actual total.
**Why it happens:** The current `budget-summary/route.ts` uses ALL `fieldOperations` regardless of `passStatus` when computing `totalOperationCost`. When an op is confirmed, its cost appears in both the projected and the actual column, making variance = $0.
**How to avoid:** Split the computation explicitly:
- Projected operation cost = sum of ALL operations' `costPerAcre * acresWorked` (the original plan, unchanged)
- Actual operation cost = sum of CONFIRMED operations only, using `actualTotalCost` if set, falling back to `totalCost` if not
**Warning signs:** Variance shows $0 for all confirmed operations even when Sandy entered a different actual cost.

### Pitfall 4: Seed Cost Unit Convention Ambiguity (ACT-04)

**What goes wrong:** Sandy enters "$145" for seed cost but the system interprets it as per-unit when it was per-acre, producing a wildly wrong total.
**Why it happens:** The farm-budget service stores seed cost differently for different crops — some in $/unit (corn), some in $/lb (tobacco, small grains). The `SeedLot.purchasePrice` field's unit is implied by `SeedLot.seedsPerUnit` — if `seedsPerUnit` is set, `purchasePrice` is per-unit; if not, it's per-lb or a flat rate.
**How to avoid:** The actual seed cost entry UI must display the same unit label that the projected cost uses. Read `seedsPerUnit` from the API response: if set, label is "$/unit"; if null, label is "$/lb" or match `SeedUsage.rateUnit`. This is "Claude's Discretion" per CONTEXT.md — match whatever the farm-budget data model stores.
**Warning signs:** Total cost for seed line item is off by 80,000x (seeds per unit) after entering actual price.

### Pitfall 5: Unplanned Items Missing from Variance

**What goes wrong:** Sandy adds an unplanned expense (e.g., emergency pesticide application not in the plan). It appears in the actual total but has no projected value, making the total variance calculation incorrect.
**Why it happens:** Unplanned items have `actualTotalCost` set but `projected = null`. Simple `projected - actual` math fails with null.
**How to avoid:** In variance computation: `variance = projected == null ? null : projected - (actual ?? 0)`. Unplanned items get `variance = null` (no projected to compare against). The summary row computes: `totalVariance = totalProjected - totalActual` where `totalActual` INCLUDES unplanned costs — this is correct behavior (unplanned items make the farm more expensive than budgeted).
**Warning signs:** Summary variance row doesn't equal sum of individual line variances.

### Pitfall 6: auth Guard Missing on New PATCH Routes

**What goes wrong:** Sandy can save actuals, but so can a CREW user who navigates directly to the budget tab.
**Why it happens:** The existing operations/applications routes don't have auth guards (they're missing `getAuthContext()` + permission checks — this is the pre-Phase-5 pattern). New PATCH routes must add guards.
**How to avoid:** All new API routes for actuals MUST follow the Phase 5 pattern: call `getAuthContext()`, check `budget:read` (or create `budget:write` permission), return 401/403 if failed. OFFICE users need write access; CREW must be blocked.
**Warning signs:** CREW user can POST to `/api/field-enterprises/[id]/applications/[recordId]/actual` and get a 200.

---

## Code Examples

### Dual-column table header pattern
```typescript
// Source: codebase conventions (page.tsx table patterns, lines 1133–1157)
// Projected | Actual | Variance columns with badge labels
<thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider">
  <tr>
    <th className="text-left px-3 py-2">Item</th>
    <th className="text-right px-3 py-2">
      <span className="inline-flex items-center gap-1">
        Projected
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-blue-600 border-blue-200">PROJ</Badge>
      </span>
    </th>
    <th className="text-right px-3 py-2">
      <span className="inline-flex items-center gap-1">
        Actual
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-green-600 border-green-200">ACT</Badge>
      </span>
    </th>
    <th className="text-right px-3 py-2">Variance</th>
  </tr>
</thead>
```

### Variance cell with color coding
```typescript
// Source: existing pattern in page.tsx (lines 1090–1118) — green/red for margin
function VarianceCell({ projected, actual }: { projected: number | null; actual: number | null }) {
  if (projected == null || actual == null) return <td className="px-3 py-2 text-right text-stone-300">—</td>;
  const variance = projected - actual;
  const favorable = variance >= 0;  // under budget = favorable
  return (
    <td className={cn("px-3 py-2 text-right font-medium", favorable ? "text-green-700" : "text-red-700")}>
      {favorable ? "" : "+"}{(-variance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </td>
  );
}
```

### PATCH route for material actual (new route)
```typescript
// src/app/api/field-enterprises/[id]/applications/[recordId]/actual/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { Role } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const user = await getAuthContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = user.role as Role;
  if (!hasPermission(role, "budget:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: enterpriseId, recordId } = await params;
  const { actualTotalCost } = await request.json();

  const existing = await prisma.materialUsage.findUnique({ where: { id: recordId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.fieldEnterpriseId !== enterpriseId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.materialUsage.update({
    where: { id: recordId },
    data: { actualTotalCost: actualTotalCost ?? null },
  });

  return NextResponse.json(updated);
}
```

### Summary row at top of Budget tab
```typescript
// Fixed summary row showing per-acre totals (per CONTEXT.md: "all values shown as $/ac")
const acres = budgetSummary.acres;
const projPerAcre = acres > 0 ? budgetSummary.totalCostOfProduction / acres : 0;
const actualPerAcre = budgetSummary.actualTotalCost != null && acres > 0
  ? budgetSummary.actualTotalCost / acres : null;
const variancePerAcre = actualPerAcre != null ? projPerAcre - actualPerAcre : null;

// Display: Total Projected/ac | Total Actual/ac | Total Variance/ac
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Budget tab: read-only projected costs | Budget tab: projected + actual + variance dual-column | Phase 6 | Sandy can enter actuals inline without navigating to a separate form |
| Confirm pass: dialog requiring 3 clicks | Confirm operation: inline checkbox + date defaulting to today | Phase 6 | Eliminates the Macro Rollup pain point of save-navigating-away |
| DataSource: MANUAL / SYNCED only | DataSource: MANUAL / SYNCED / ACTUAL | Phase 6 | Allows badges to correctly label projected-from-sync vs Sandy's actual entries |
| page.tsx: 1760-line monolith | BudgetTab extracted to `src/components/budget/BudgetTab.tsx` | Phase 6 Wave 0 | Enables collaborative editing, reduces merge conflicts, improves testability |

**Deprecated/outdated:**
- The existing confirm dialog flow (`confirmingOp` state + `confirmPass()` in page.tsx lines 303–320): Replace with inline checkbox pattern in BudgetTab. The `/api/import-plan/confirm` route remains valid and is reused.

---

## Open Questions

1. **Which RBAC permission governs writing actuals?**
   - What we know: Phase 5 added `budget:read` (ADMIN + OFFICE). ADMIN and OFFICE can read budget data. There is no `budget:write` permission yet.
   - What's unclear: Should actuals entry be gated on `budget:read` (i.e., anyone who can see the budget can edit actuals) or a new `budget:write` permission?
   - Recommendation: Add `budget:write` to `rbac.ts` for ADMIN + OFFICE. CREW has no `budget:read` so they can't see or edit. This follows the defense-in-depth pattern and is future-proof if the access model changes.

2. **Seed cost unit display for ACT-04**
   - What we know: `SeedLot.seedsPerUnit` and `SeedUsage.rateUnit` tell us the unit convention. If `seedsPerUnit` is set, cost is $/unit (80k seeds per bag of corn).
   - What's unclear: Whether Sandy thinks about seed cost as $/bag, $/unit, or $/lb. The farm-budget service likely provides the unit.
   - Recommendation: Display the unit label alongside the actual entry field, derived from the existing `SeedLot` data. Planner should include this as a verified detail in Wave 1.

3. **Targeted budget-summary re-fetch scope**
   - What we know: The `load()` callback in page.tsx (lines 329–350) fetches 5 endpoints simultaneously. Calling it after every actuals save would refetch enterprise, materials, seeds, and equipment unnecessarily.
   - What's unclear: Whether there are cases where saving an actual changes the enterprise data or reference data.
   - Recommendation: Create a separate `refreshBudget()` function that only fetches `/api/field-enterprises/${id}/budget-summary` and calls `setBudgetSummary()`. Pass it as `onDataChanged` prop to BudgetTab.

---

## Implementation Notes for Planner

### Codebase Reality

**App root:** `/Users/glomalinguild/Desktop/my-project-one/organic-cert/`

**Key files for Phase 6:**
- `src/app/(app)/field-enterprises/[id]/page.tsx` — 1760 lines; contains entire enterprise detail UI including budget tab to extract
- `src/app/api/field-enterprises/[id]/budget-summary/route.ts` — needs dual computation path (projected vs actual)
- `src/app/api/field-enterprises/[id]/operations/route.ts` — existing PUT route; handles un-confirm
- `src/app/api/import-plan/confirm/route.ts` — existing POST route; handles PLANNED→CONFIRMED
- `src/app/api/field-enterprises/[id]/applications/route.ts` — existing POST/PUT for material usages
- `src/app/api/field-enterprises/[id]/applications/[recordId]/route.ts` — exists; add `actual/` sub-route
- `src/lib/rbac.ts` — add `budget:write` permission to ADMIN + OFFICE sets
- `prisma/schema.prisma` — add `actualTotalCost`, `actualUnitCost` on MaterialUsage; `actualPricePerUnit` on SeedUsage; `actualYieldPerAcre`, `actualYieldUnit` on FieldEnterprise; ACTUAL to DataSource enum

**No test framework in organic-cert.** All verification is manual: browser DevTools + curl. (Confirmed in Phase 5 RESEARCH.md.)

**State.md Phase 6 blockers — both must be addressed in Wave 0:**
1. `BudgetTab.tsx` extraction from `[id]/page.tsx` — structural prerequisite
2. Budget-summary projected/actual computation split — logic prerequisite

**Existing `/applications/[recordId]/route.ts` structure:** There IS an `[recordId]` sub-directory under applications already (confirmed by `ls` output: `[recordId]` appears under applications). Add `actual/route.ts` inside it.

**Collapsible not yet imported in page.tsx.** The `shadcn Collapsible` component may need to be added via `npx shadcn@latest add collapsible`. Check the shadcn components directory first.

---

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` — Full schema read; confirmed PassStatus (PLANNED/CONFIRMED), DataSource (MANUAL/SYNCED), all relevant models and fields
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/[id]/budget-summary/route.ts` — Full route read; confirmed current computation logic and response shape
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` — Read lines 1–360 and 1050–1760; confirmed BudgetSummary interface, existing budget tab structure, role guards, confirm flow
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/[id]/operations/route.ts` — Full route read; confirmed PUT accepts passStatus/operationDate updates
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/import-plan/confirm/route.ts` — Full route read; confirmed PLANNED→CONFIRMED flow
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/[id]/harvest/route.ts` — Full route read; confirmed HarvestEvent creation and PUT update patterns
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/package.json` — Confirmed exact versions: next 16.1.6, react 19.2.3, sonner 2.0.7, date-fns 4.1.0, @prisma/client 6.19.2
- `.planning/STATE.md` — Confirmed two Phase 6 blockers: BudgetTab extraction and computation path split
- `.planning/phases/05-privacy-foundation/05-RESEARCH.md` — Confirmed auth pattern, rbac.ts structure, `budget:read`/`budget:financial` permissions

### Secondary (MEDIUM confidence)
- shadcn/ui Collapsible component — standard shadcn pattern; available in the project's shadcn installation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from package.json
- Architecture: HIGH — all patterns derived from reading actual source files
- Pitfalls: HIGH — all derived from direct codebase inspection; STATE.md blockers confirmed
- Schema migration plan: HIGH — based on reading existing schema and identifying gaps

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase; no fast-moving dependencies for this phase)
