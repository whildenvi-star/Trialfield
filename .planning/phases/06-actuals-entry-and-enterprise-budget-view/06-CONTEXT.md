# Phase 6: Actuals Entry and Enterprise Budget View - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Sandy can record actual invoice costs, field operation confirmations, and harvest yields against the projected crop plan for an enterprise. The enterprise Budget tab shows projected and actual values side by side with variance. Financial columns (revenue, margin, profit) are visible only to ADMIN. This phase does NOT include farm-wide aggregation (Phase 8) or syncing new enterprises (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Actuals entry interaction
- Inline click-to-edit on the Actual cell — Sandy clicks, types value, saves on blur/Enter
- No confirmation dialog — saves immediately (per success criteria)
- Enter key saves and moves focus to the next editable cell below (spreadsheet behavior)
- Tab moves right if applicable; Esc cancels edit
- **Page must never navigate away or scroll-jump on save** — Sandy stays exactly where she is (critical pain point from current Macro Rollup workflow)
- Both one-at-a-time and batch entry workflows supported by the same inline pattern

### Field operation confirmation
- Checkbox + date picker pattern: Sandy checks "Completed" checkbox, date picker appears defaulting to today
- She adjusts date if needed — saves automatically
- Status flips from PLANNED to CONFIRMED
- Can un-confirm (uncheck) to revert to PLANNED and clear actual date

### Harvest yield entry
- Yield unit comes from the projected plan per crop (bu/ac for grain, tons/ac for hay, lbs/ac for tobacco, etc.)
- Unit is NOT hardcoded — matches whatever the farm-budget sync provides for that enterprise
- Sandy enters the numeric value, unit label is displayed but not editable

### Seed cost actuals
- Claude's Discretion: match whatever unit convention the farm-budget data model already stores (per-unit or per-acre)

### Unplanned line items
- Sandy CAN add rows for expenses not in the projected plan
- Entry requires: category (from fixed dropdown of existing budget categories) + amount only
- No free-text category names — dropdown matches existing cost categories from the budget
- Unplanned rows show dash in Projected column and no variance calculation

### Budget tab layout
- Cost categories grouped to match farm-budget spreadsheet sections (Seed, Fertilizer, Chemical, Operations, etc.) — Sandy sees the structure she already knows
- All values shown as per-acre ($/ac) — how Sandy thinks about costs
- Collapsible sections, all expanded by default — Sandy can collapse sections she's not working on
- Summary row at top of tab showing Total Projected/ac, Total Actual/ac, and Total Variance

### Data source badges
- Subtle inline pill badges next to values: "PROJ" (muted blue), "ACTUAL" (muted green)
- Both Projected and Actual columns always visible — entering an actual doesn't hide the projected value
- Unplanned rows get an "UNPLANNED" badge (amber/orange pill) distinct from regular ACTUAL
- Variance color coding: green = under budget (favorable), red = over budget (unfavorable) — standard accounting convention

### Entry feedback & validation
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

</decisions>

<specifics>
## Specific Ideas

- **Spreadsheet-like flow is critical**: Sandy's current pain with the Macro Rollup is that saving navigates away from where she's working, requiring menu diving to get back. The portal must eliminate this — save-in-place with cursor advancing to next cell.
- Enter = save + move down, Tab = save + move right, Esc = cancel — standard spreadsheet keyboard shortcuts
- Structure should feel familiar to Sandy based on her existing farm-budget spreadsheet sections

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-actuals-entry-and-enterprise-budget-view*
*Context gathered: 2026-03-20*
