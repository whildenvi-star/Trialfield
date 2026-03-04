# Phase 19: Seed & Input Inventory Redesign - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace standalone Supplier/Product/Seeds CRUD in farm-budget with a procurement pipeline: Forecasts (rolled up from Macro Roll-Up field edit tabs) → Orders → Deliveries → Reports. Eliminate redundant Supplier and Product tabs. Seeds tab stays for variety management. All within farm-budget Express + vanilla JS SPA.

</domain>

<decisions>
## Implementation Decisions

### Forecast Hub Design
- Grouped by category first: Seed, Fertilizer, Chemical — top-level sections
- Each row shows farm-wide total with expandable field breakdown (click to see which fields use the product and how much)
- Re-computes live from Macro Roll-Up data on every page load — no stale cache, no manual refresh
- Columns per row: Product, Supplier, Amount, Unit, Unit Cost, Total Cost, Ordered, Remaining, plus a visual % Ordered status bar (showing ordered/delivered/remaining)
- Only products with amount > 0 appear in forecast

### Order-to-Delivery Workflow
- Orders created by selecting product rows from forecast checkboxes → "Create Order" button → pre-fills PO form grouped by supplier
- Multiple deliveries per order — order stays open until fully delivered, shows delivered/remaining per line item
- 3-step auto-transitioning statuses: Ordered → Partial (first delivery arrives) → Complete (all items fully received)
- No separate return entity — returns handled as notes/flags on delivery records with adjusted quantities

### Report Types & Format
- All reports rendered as print-optimized HTML with print CSS (Ctrl+P to print) — no server-side PDF generation
- All 5 reports are essential for launch:
  1. **Agronomist/Supplier Order Sheet:** Products grouped by supplier — product, amount, unit, unit cost, total cost, and which fields. Full detail for ordering.
  2. **Field-Level Input Plan:** Per-field breakdown of all planned inputs. For field use or sharing with applicator.
  3. **Forecast Summary:** Full farm forecast with costs. Overview for budgeting/planning meetings.
  4. **Order Status Report:** Current order statuses across all suppliers.
  5. **Delivery Receipt Log:** Delivery history with dates, quantities, ticket numbers.
- Page-break-friendly tables, professional layout

### Navigation & Tab Structure
- Replace existing tab bar in-place — new tabs: Forecasts, Orders, Deliveries, Seeds
- Eliminate: Supplier tab, Products tab (data flows from Macro Roll-Up)
- Keep Seeds tab for managing varieties, pricing, seeds-per-unit — forecast pulls seed data from it

### Day/Night Mode
- Sun/moon toggle icon in the header bar
- CSS variables switch between light and dark palettes
- Persisted in localStorage
- Applies to inventory page only — rest of farm-budget stays unchanged

### Claude's Discretion
- Exact CSS variable palette for day/night themes
- Status bar visual design (colors, animation)
- Empty state design for each tab (no orders yet, no deliveries yet)
- Table sorting and pagination approach
- Touch/tablet responsiveness details
- Data model structure for orders/deliveries in data.json

</decisions>

<specifics>
## Specific Ideas

- Forecast hub should be the "home tab" — the first thing you see, the procurement command center
- The % ordered status bar gives an at-a-glance view of procurement progress without clicking into orders
- Agronomist order sheet should be something you can print and hand to a supplier rep in person
- Field-level input plan is for taking to the field or sharing with a custom applicator
- Consistent design language with existing Macro Roll-Up — not a totally different look
- Touch-friendly for tablet use in the shop or field

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-seed-input-inventory-redesign*
*Context gathered: 2026-03-03*
