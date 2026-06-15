# Phase 8: Farm-Wide Budget Summary - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the portal version of Sandy's Macro Rollup spreadsheet — a single page showing all enterprises for the current crop year with projected vs actual cost breakdowns and financial totals. One page, same layout for ADMIN and OFFICE. ADMIN sees financial columns (revenue, margin, profit); OFFICE sees the identical page minus those columns. This is VIEW-04 and VIEW-05.

</domain>

<decisions>
## Implementation Decisions

### Macro Rollup Layout
- Exact replica of the spreadsheet — Sandy should feel like she's looking at her Macro Rollup in the browser
- Enterprises as rows, budget category columns (Seed, Fertilizer, Chemical, Operations, Total)
- Per-acre cost view (not total dollars)
- Financial columns (revenue, margin, profit) are additional columns on the same table, visible to ADMIN only
- Column detail level for category breakdowns (projected vs actual per category) is Claude's discretion based on table width and readability

### Enterprise Grouping
- Primary split: Organic section, then Conventional section — never comingle
- Within each section: grouped by crop type, then sub-crop/variant
- Each enterprise is its own row (no rolling up Corn Organic + Corn Conventional)
- All enterprises are tagged organic or conventional — no untagged edge case
- Acres column on each enterprise row

### Summary Totals & Aggregation
- Section subtotals for Organic and Conventional
- Grand total row with weighted average cost/acre (weighted by acreage)
- Green/red variance color coding — same pattern as enterprise budget tab
- Enterprises with no actuals yet still appear with projected-only data

### Navigation & Access
- Top-level sidebar link (sidebar label is Claude's discretion)
- Click an enterprise row to drill into that enterprise's detailed budget tab
- Uses app's existing crop year context (no crop-year selector — deferred to v3.0 WF-03)

### Role Visibility
- One page, one layout for both ADMIN and OFFICE
- ADMIN sees full table including financial columns (revenue, margin, profit)
- OFFICE sees identical table minus financial columns
- Same RBAC pattern as existing budget views (budget:financial permission)

### Claude's Discretion
- Sidebar label naming (Budget Summary, Macro Rollup, Farm Budget, etc.)
- Column sub-structure for projected/actual/variance per category
- Table responsive behavior on smaller screens
- Loading and empty states

</decisions>

<specifics>
## Specific Ideas

- "If we can't comingle in the field, there's no reason to track dollars or acres together" — organic and conventional are fundamentally separate operations
- The existing enterprise budget tab's column structure (Item | Projected | Actual | Variance) and BudgetSummary API response shape are the building blocks — aggregate those across all enterprises
- Phase 6 summary notes: "Phase 8 will build on BudgetSummary response shape established here"

</specifics>

<deferred>
## Deferred Ideas

- Crop-year selector on farm-wide summary view — v3.0 WF-03
- Total dollars view toggle (in addition to per-acre) — could be a quick enhancement later

</deferred>

---

*Phase: 08-farm-wide-budget-summary*
*Context gathered: 2026-03-21*
