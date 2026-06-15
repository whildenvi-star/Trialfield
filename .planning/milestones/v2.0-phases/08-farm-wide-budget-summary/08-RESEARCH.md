# Phase 8: Farm-Wide Budget Summary - Research

**Researched:** 2026-03-21
**Domain:** Next.js App Router · Prisma · React client components · RBAC-gated table aggregation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Macro Rollup Layout**
- Exact replica of the spreadsheet — Sandy should feel like she's looking at her Macro Rollup in the browser
- Enterprises as rows, budget category columns (Seed, Fertilizer, Chemical, Operations, Total)
- Per-acre cost view (not total dollars)
- Financial columns (revenue, margin, profit) are additional columns on the same table, visible to ADMIN only
- Column detail level for category breakdowns (projected vs actual per category) is Claude's discretion based on table width and readability

**Enterprise Grouping**
- Primary split: Organic section, then Conventional section — never comingle
- Within each section: grouped by crop type, then sub-crop/variant
- Each enterprise is its own row (no rolling up Corn Organic + Corn Conventional)
- All enterprises are tagged organic or conventional — no untagged edge case
- Acres column on each enterprise row

**Summary Totals & Aggregation**
- Section subtotals for Organic and Conventional
- Grand total row with weighted average cost/acre (weighted by acreage)
- Green/red variance color coding — same pattern as enterprise budget tab
- Enterprises with no actuals yet still appear with projected-only data

**Navigation & Access**
- Top-level sidebar link (sidebar label is Claude's discretion)
- Click an enterprise row to drill into that enterprise's detailed budget tab
- Uses app's existing crop year context (no crop-year selector — deferred to v3.0 WF-03)

**Role Visibility**
- One page, one layout for both ADMIN and OFFICE
- ADMIN sees full table including financial columns (revenue, margin, profit)
- OFFICE sees identical table minus financial columns
- Same RBAC pattern as existing budget views (budget:financial permission)

### Claude's Discretion
- Sidebar label naming (Budget Summary, Macro Rollup, Farm Budget, etc.)
- Column sub-structure for projected/actual/variance per category
- Table responsive behavior on smaller screens
- Loading and empty states

### Deferred Ideas (OUT OF SCOPE)
- Crop-year selector on farm-wide summary view — v3.0 WF-03
- Total dollars view toggle (in addition to per-acre) — could be a quick enhancement later
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-04 | Farm-wide budget summary page aggregates all enterprises for a crop year | New API endpoint fetches all enterprises for current year, computes per-row summary; client page renders grouped table |
| VIEW-05 | Farm-wide view mirrors Macro Rollup layout stylistically | Same column structure (Seed, Fertilizer, Chemical, Operations, Total cost/acre, Variance); section headers for Organic/Conventional; same green/red variance styling as BudgetTab |
</phase_requirements>

---

## Summary

Phase 8 adds a single new page (`/budget-summary`) plus a supporting API endpoint. The API endpoint queries all `FieldEnterprise` records for the current crop year across both `enterpriseType` values (ORGANIC and CONVENTIONAL), then for each enterprise re-runs the same budget arithmetic already proven in `GET /api/field-enterprises/[id]/budget-summary/route.ts`. The page renders a grouped table: Organic section first, then Conventional, each enterprise as a row, with section subtotals and a grand total. The financial columns (revenue, margin, profit) are conditionally included for ADMIN only via the existing `canSeeFinancial` / `budget:financial` pattern.

The "current crop year" is resolved at runtime from the data: take the maximum `cropYear` value across all `FieldEnterprise` records that belong to the farm. There is no `activeCropYear` field on the `Farm` model — this is the correct inference strategy and avoids any schema change.

The architectural pattern is straightforward: a new "client page + data fetch on mount" pattern identical to `field-enterprises/page.tsx`, a new `GET /api/budget-summary` route that aggregates across all enterprises, and a new `FarmBudgetSummary.tsx` component in `src/components/budget/`. The planner should structure this as 2 plans: Plan 01 builds the API endpoint and data shape; Plan 02 builds the page component and wires navigation.

**Primary recommendation:** Build the aggregation in a single new API endpoint (`GET /api/budget-summary?cropYear=YYYY`) that returns all enterprises pre-grouped, with per-row summaries pre-computed server-side (including financial fields only if `canSeeFinancial`). The client page is read-only — no mutations, no forms.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | (project version) | Route file at `src/app/(app)/budget-summary/page.tsx` | Matches all other app pages |
| Prisma | (project version) | Query `FieldEnterprise` with `include` for related costs | Existing ORM throughout project |
| next-auth / `useSession` | (project version) | Derive `canSeeFinancial` from session role client-side | Same pattern as enterprise detail page |
| Tailwind CSS | (project version) | Table styling, color coding | All UI uses Tailwind |
| Lucide React | (project version) | Icons (BarChart2, Wheat, etc.) | Existing icon library |
| sonner | (project version) | Toast on fetch error | Existing toast library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | (project version) | Not needed for this phase | Only if date formatting needed |
| `cn` (clsx/tailwind-merge) | (project version) | Conditional class names for color coding | Same as VarianceCell usage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side aggregation in API | Client-side aggregation from N individual budget-summary calls | N individual calls is O(enterprises) requests vs 1 — don't do this |
| Single new endpoint | Reusing `/api/field-enterprises` + N budget-summary calls | Much more network overhead; aggregation belongs server-side |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (app)/
│   │   └── budget-summary/
│   │       └── page.tsx          # Client page — fetch on mount, render table
│   └── api/
│       └── budget-summary/
│           └── route.ts          # GET — aggregate all enterprises for current year
│
└── components/
    └── budget/
        └── FarmBudgetSummary.tsx  # Table component (optional — could inline in page)
```

### Pattern 1: Client Page with Fetch-on-Mount (existing pattern)

**What:** Page is `"use client"`, fetches data via `useEffect` + `fetch`, derives `canSeeFinancial` from `useSession()`.

**When to use:** This is the established pattern for all app pages in this project. The enterprise detail page (`/field-enterprises/[id]/page.tsx`) uses this exact approach.

**Example (from existing codebase):**
```typescript
"use client";
// Source: src/app/(app)/field-enterprises/[id]/page.tsx lines 262–265
const { data: session } = useSession();
const role = (session?.user as any)?.role ?? null;
const canSeeBudget = role === "ADMIN" || role === "OFFICE";
const canSeeFinancial = role === "ADMIN";
```

### Pattern 2: Single Aggregating API Endpoint

**What:** One `GET /api/budget-summary` route fetches all `FieldEnterprise` records for the current crop year, computes per-enterprise cost summaries inline (seed / material / operation), applies `canSeeFinancial` stripping, groups by `enterpriseType`, and returns a structured response ready for direct rendering.

**When to use:** Aggregation always belongs server-side. The existing per-enterprise `budget-summary` route proves the arithmetic — replicate it in a loop, not via N client requests.

**Current crop year resolution:**
```typescript
// No activeCropYear on Farm model — derive from data
const maxYear = await prisma.fieldEnterprise.aggregate({
  _max: { cropYear: true },
  where: { field: { farmId } },
});
const cropYear = maxYear._max.cropYear ?? new Date().getFullYear();
```

**API response shape:**
```typescript
interface FarmBudgetRow {
  enterpriseId: string;
  crop: string;
  variety: string | null;
  label: string | null;
  acres: number;
  enterpriseType: "ORGANIC" | "CONVENTIONAL";
  // Projected category totals (per-acre)
  projectedSeedPerAcre: number;
  projectedFertilizerPerAcre: number;
  projectedChemicalPerAcre: number;
  projectedOperationsPerAcre: number;
  projectedTotalPerAcre: number;
  // Actual category totals (per-acre, null if no actuals)
  actualSeedPerAcre: number | null;
  actualFertilizerPerAcre: number | null;
  actualChemicalPerAcre: number | null;
  actualOperationsPerAcre: number | null;
  actualTotalPerAcre: number | null;
  // Variance (projected - actual, null if no actuals)
  varianceTotalPerAcre: number | null;
  // Financial — only present if canSeeFinancial
  projectedRevPerAcre?: number | null;
  projectedMarginPerAcre?: number | null;
}

interface FarmBudgetSummaryResponse {
  cropYear: number;
  organic: FarmBudgetRow[];
  conventional: FarmBudgetRow[];
  organicSubtotal: SubtotalRow;
  conventionalSubtotal: SubtotalRow;
  grandTotal: SubtotalRow;
}
```

### Pattern 3: RBAC Financial Column Gating (existing pattern)

**What:** `canSeeFinancial` is derived client-side from session role. Financial columns are conditionally rendered using `{canSeeFinancial && <td>...</td>}`. The API also strips financial fields server-side (defense-in-depth).

**Example (from existing codebase):**
```typescript
// Source: src/app/api/field-enterprises/[id]/budget-summary/route.ts line 246
...(canSeeFinancial && revenueProjection ? { revenueProjection } : {}),
```

### Pattern 4: Sidebar Navigation (existing pattern)

**What:** Add a new entry to the `navItems` array in `src/components/layout/sidebar.tsx`.

**Example (from existing codebase):**
```typescript
// Source: src/components/layout/sidebar.tsx lines 23–36
const navItems = [
  { href: "/dashboard", label: "dashboard", icon: LayoutDashboard },
  // ... existing items ...
  // ADD:
  { href: "/budget-summary", label: "budget summary", icon: BarChart2 },
];
```

### Pattern 5: Section Subtotals (weighted average for per-acre)

**What:** Section subtotals compute total-cost-weighted average per-acre values. A simple arithmetic average would be wrong — enterprises with more acres carry more weight.

**Formula:**
```typescript
// Weighted average cost/acre for a group
const totalAcres = rows.reduce((s, r) => s + r.acres, 0);
const weightedTotalProjected = rows.reduce((s, r) => s + r.projectedTotalPerAcre * r.acres, 0);
const subtotalProjectedPerAcre = totalAcres > 0 ? weightedTotalProjected / totalAcres : 0;
```

### Anti-Patterns to Avoid

- **N+1 budget fetches:** Do NOT call `/api/field-enterprises/[id]/budget-summary` once per enterprise from the client. One server-side aggregation query is the correct approach.
- **Client-side variance math:** Variance is always computed server-side (established in 06-02 decisions). The API must emit `varianceTotalPerAcre`, not raw projected + actual for the client to subtract.
- **Simple average for subtotals:** Simple average of per-acre values produces wrong numbers when enterprises have different acreages. Use weighted average (weighted by acres).
- **Crop year hardcoded:** Do not hardcode `new Date().getFullYear()`. Derive from data max, or accept a query param that defaults to the data max.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Budget arithmetic per enterprise | Custom aggregation logic | Replicate the proven arithmetic from `budget-summary/route.ts` | Arithmetic is already validated and handles null/partial actuals correctly |
| Variance coloring | Custom color logic | `VarianceCell` component already handles favorable/unfavorable display | Already handles null, edge cases, display format |
| Financial field stripping | Custom middleware | Existing `canSeeFinancial` pattern + spread-conditional | Defense-in-depth pattern established in Phase 5 |
| Session role reading | Custom auth hook | `useSession()` from next-auth, same as enterprise detail page | Established project pattern |

**Key insight:** The per-enterprise budget arithmetic in `budget-summary/route.ts` is the ground truth for this phase. The farm-wide API loops over enterprises and applies the same arithmetic, grouped by enterpriseType.

---

## Common Pitfalls

### Pitfall 1: Material Category Bucketing for Fertilizer / Chemical Columns

**What goes wrong:** The Macro Rollup groups materials into Fertilizer and Chemical columns. The `materialCosts` in the budget-summary API include a `category` field from the Material model. The grouping must match how the existing budget tab groups materials — by keyword matching against the category string (e.g., "fertilizer", "chemical").

**Why it happens:** Category values are free-text from the Material reference table. The existing code uses keyword matching (`BUDGET_CATEGORIES` array in BudgetTab.tsx) rather than enum-enforced categories.

**How to avoid:** In the farm-wide API, bucket `materialCosts` into Fertilizer vs Chemical vs Other by matching the `material.category` field against known category keywords (same logic as `06-03` decisions: fertilizer, chemical, custom keyword matching). The "Operations" column maps to `operationCosts`.

**Warning signs:** Fertilizer and Chemical columns show $0 when data exists, or all materials collapse into "Other".

### Pitfall 2: Weighted Average vs Simple Average for Subtotals

**What goes wrong:** Section subtotals show incorrect per-acre values because a simple average (sum / count) was used instead of a weighted average (total dollars / total acres).

**Why it happens:** It feels intuitive to average the per-acre column. But a 500-acre enterprise and a 50-acre enterprise should not have equal weight.

**How to avoid:** Always compute subtotals as `sum(perAcre * acres) / sum(acres)`.

**Warning signs:** Subtotal per-acre value doesn't match what you'd get manually checking a two-enterprise case with very different acreages.

### Pitfall 3: Enterprises with No Actuals Show as "Missing"

**What goes wrong:** Early-season enterprises have no actual data yet. If the null-check isn't handled, they might render as blank rows or be excluded from the table.

**Why it happens:** The `allActualsNull` guard in the budget-summary API returns `null` for `actualTotalCost` when no actuals exist. The table must render these rows with projected data and dashes for actual/variance columns.

**How to avoid:** Treat `actualTotalPerAcre === null` as "no actuals yet" — render projected data normally, render actual and variance columns as `—`. The `VarianceCell` component already handles `null` gracefully.

**Warning signs:** Corn enterprise planted in March shows no row because harvest hasn't happened yet.

### Pitfall 4: Crop Year Staleness After Phase 7

**What goes wrong:** Phase 7 added on-load sync. If a new enterprise syncs in mid-session and the farm-wide summary page was loaded before the sync, it won't reflect the new enterprise.

**Why it happens:** The client fetches data once on mount. New enterprises added after page load won't appear.

**How to avoid:** The farm-wide summary is a planning view — Sandy reads it, she doesn't act on it. A simple "Refresh" button or note that data reflects the time the page loaded is sufficient. No real-time refresh requirement for this phase.

### Pitfall 5: Column Count Mismatch Between ADMIN and OFFICE

**What goes wrong:** Column headers and data cells fall out of alignment when financial columns are conditionally removed for OFFICE users, if headers and rows are managed in separate arrays.

**Why it happens:** Financial columns are added at the end of the header row but also need to be absent from every data row and subtotal row.

**How to avoid:** Render financial columns in a single `{canSeeFinancial && (...)}` block consistently across: (a) column headers, (b) every enterprise row, (c) subtotal rows, (d) grand total row. Test both roles explicitly.

---

## Code Examples

Verified patterns from the existing codebase:

### Aggregate FieldEnterprise Records for a Crop Year

```typescript
// Source: adapted from src/app/api/field-enterprises/[id]/budget-summary/route.ts pattern
// and src/app/api/field-enterprises/route.ts
const enterprises = await prisma.fieldEnterprise.findMany({
  where: { cropYear, field: { farmId } },
  include: {
    field: true,
    seedUsages: { include: { seedLot: true } },
    materialUsages: { include: { material: true }, orderBy: { applicationDate: "asc" } },
    fieldOperations: { orderBy: { operationDate: "asc" } },
  },
  orderBy: [{ enterpriseType: "asc" }, { crop: "asc" }, { label: "asc" }],
});
```

### RBAC Check Pattern (server-side)

```typescript
// Source: src/app/api/field-enterprises/[id]/budget-summary/route.ts lines 12–21
const user = await getAuthContext();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const role = user.role as Role;
if (!hasPermission(role, "budget:read")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
const canSeeFinancial = hasPermission(role, "budget:financial");
```

### Client-Side Financial Flag (client page pattern)

```typescript
// Source: src/app/(app)/field-enterprises/[id]/page.tsx lines 262–265
const { data: session } = useSession();
const role = (session?.user as any)?.role ?? null;
const canSeeFinancial = role === "ADMIN";
```

### Variance Color Coding

```typescript
// Source: src/components/budget/VarianceCell.tsx
// Reuse <VarianceCell projected={row.projectedTotalPerAcre} actual={row.actualTotalPerAcre} />
// For subtotal/total rows, replicate inline:
const favorable = varianceTotalPerAcre >= 0;
<span className={cn("text-sm font-medium", favorable ? "text-green-700" : "text-red-700")}>
  {favorable ? "-" : "+"}${Math.abs(varianceTotalPerAcre).toFixed(2)}
</span>
```

### Sidebar Navigation Entry

```typescript
// Source: src/components/layout/sidebar.tsx lines 23–36
// Add to navItems array:
{ href: "/budget-summary", label: "budget summary", icon: BarChart2 },
// BarChart2 from lucide-react — fits financial overview context
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Organic-only sync | All enterprises (Phase 7) | Farm-wide summary now has organic + conventional data |
| Per-enterprise budget API | New farm-wide aggregating API | Phase 8 adds a new endpoint; per-enterprise endpoint remains unchanged |

**No deprecated approaches relevant to this phase.**

---

## Open Questions

1. **Material category keyword matching — confirmed values**
   - What we know: BudgetTab groups by keywords matching material category (fertilizer, chemical, custom). The `BUDGET_CATEGORIES` const in BudgetTab.tsx is the reference list.
   - What's unclear: Exact category strings stored in the database for the W. Hughes Farms data. The Macro Rollup column "Chemical" might map to "chemical" or "Chemical" — case sensitivity matters.
   - Recommendation: In the API, use `category.toLowerCase().includes("fertilizer")` etc., matching the same convention. Confirm with Sandy's existing material data if needed.

2. **Farm-wide summary access for OFFICE role**
   - What we know: Context says "one page, one layout for both ADMIN and OFFICE" with financial columns hidden for OFFICE.
   - What's unclear: Does OFFICE need a sidebar link, or is this ADMIN-only navigation?
   - Recommendation: Both roles get the sidebar link — OFFICE sees cost data (which they can already access on the per-enterprise page), ADMIN additionally sees financial columns. This aligns with the CONTEXT decision.

3. **Weighted average for actual subtotals — partial actuals**
   - What we know: Some enterprises have actuals, some don't. Section subtotal for "actual cost/acre" must handle a mix.
   - What's unclear: Does the subtotal show a weighted average of only enterprises with actuals, or is it null if any enterprise lacks actuals?
   - Recommendation: Show the weighted average of enterprises that DO have actuals, with a note or visual indicator that it's partial. This is more useful than hiding the number. But this is Claude's discretion — planner should decide.

---

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/[id]/budget-summary/route.ts` — complete budget arithmetic, RBAC pattern, field stripping
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/components/budget/BudgetTab.tsx` — `BudgetSummary` type definition, `BUDGET_CATEGORIES`, variance coloring
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/components/budget/VarianceCell.tsx` — variance display component
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/components/layout/sidebar.tsx` — sidebar navItems pattern
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/rbac.ts` — permission matrix confirming `budget:financial` is ADMIN-only
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` — `FieldEnterprise` model, `EnterpriseType` enum, `Farm` model (no activeCropYear)
- `.planning/phases/08-farm-wide-budget-summary/08-CONTEXT.md` — locked user decisions

### Secondary (MEDIUM confidence)
- STATE.md accumulated decisions for phases 5–7 — confirms variance server-side only, null = not-entered pattern, canSeeFinancial client-side pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns already in use in the codebase
- Architecture: HIGH — new endpoint + new page follows exact existing patterns; arithmetic verified against production budget-summary route
- Pitfalls: HIGH — material bucketing and weighted averages are genuine gotchas identified from the actual codebase; RBAC column alignment is a real rendering concern

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack; no fast-moving dependencies)
