# Phase 21: Farm-Budget Field Editor Polish - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the farm-budget field editor to show complete cost information at a glance (category subtotals, red negative profit), and activate the hidden Orders/Deliveries tabs with light UI polish. No new CRUD functionality — the Orders/Deliveries code already exists, just needs unhiding, bug-fixing, and visual consistency.

</domain>

<decisions>
## Implementation Decisions

### Preview layout & category totals
- Add group subtotals at the bottom of each group (Land, Inputs, Operations, Other) showing combined /ac and total
- Keep Spring Fert / Fall Fert as separate rows — the Inputs group subtotal combines them naturally
- Keep current grouping structure: Land (Rent), Inputs (Spring Fert, Fall Fert, Seed), Operations (Machinery, Labor, Overhead, Fuel), Other (Drying, Interest, Insurance)
- Income items (Crop Income, Insurance Income, AUX Payments) stay in the Totals section at the bottom — no separate Income group

### Orders & Deliveries activation
- Tab order: Fields → Dashboard → Hedging → Reference → Programs → Forecasts → Sales → **Orders → Deliveries** → Reports
- Empty state: show empty table with column headers and prominent "Create Order" / "New Delivery" button
- Unhide with light polish: remove `display:none`, test existing CRUD, fix bugs, apply visual consistency (matching button colors, tab styling, etc.)
- Link deliveries to orders: each delivery references an order, shows order # and lets you jump to it

### Profit display
- Verify red/green profit coloring is consistent across ALL views: field editor preview, dashboard crop rows, enterprise summary table, collapsed preview summary
- Zero profit uses default text color (no red or green)
- Negative profit: red text only — no background tint, no extra visual emphasis
- COP (Cost of Production) colored relative to selling price: red when COP > price per unit (producing at a loss), green when COP < price per unit

### Print & report formatting
- Group subtotals and red/green profit formatting carry over to print reports that show budget data
- Print negatives use BOTH red color AND accounting parentheses `(123.45)` for maximum clarity on any printer
- Verify Order Status and Delivery Receipt Log reports work correctly with newly-visible tab data
- Field-Level Input Plan report should match field editor preview layout (same group subtotals)

### Claude's Discretion
- Exact subtotal row styling (bold, separator line, indentation)
- How to handle existing Orders/Deliveries bugs found during testing
- Which specific reports need budget subtotal updates vs which don't show budget line items
- Print CSS adjustments for color support

</decisions>

<specifics>
## Specific Ideas

- The `profitClass` utility already returns `profit-neg`/`profit-pos` with red/green CSS — leverage this everywhere, don't reinvent
- `orders.js` and `deliveries.js` already exist with full CRUD — this is an activation task, not a build-from-scratch task
- Tab buttons are at `index.html:36-37` with `style="display:none"` — straightforward unhide
- COP color logic is new: compare `budget.cop` against `budget.pricePerUnit` and apply profitClass-style coloring

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-farm-budget-field-editor-polish*
*Context gathered: 2026-03-04*
