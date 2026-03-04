---
phase: 19-seed-input-inventory-redesign
plan: 01
subsystem: ui
tags: [express, vanilla-js, procurement, forecast, orders, deliveries, css-variables, day-night-theme]

requires:
  - phase: 16-field-enterprise-compilation
    provides: field+enterprise data model with inputs[] arrays and seed.variety
  - phase: farm-budget-core
    provides: Express server, crudRoutes factory, migrateData pattern, Calc module

provides:
  - GET /api/forecast — server-side aggregation of field inputs + seeds into procurement rows grouped by Seed/Fertilizer/Chemical/Other
  - GET/POST/PUT/DELETE /api/orders — PO lifecycle management persisted to data.json
  - GET/POST/PUT/DELETE /api/deliveries — delivery receipt tracking with auto-order status transition
  - migrateData extensions: store.orders[], store.deliveries[], product.category heuristic classification
  - Restructured navigation: Forecasts/Orders/Deliveries/Seeds/Reference (replaces Inputs/Seeds)
  - body.light CSS palette for day/night theme toggle
  - .pct-bar status bar and procurement card styles
  - 4 placeholder JS modules: inventory.js, orders.js, deliveries.js, reports.js

affects: [19-02, 19-03, farm-budget-wave2-ui]

tech-stack:
  added: []
  patterns:
    - "recalcOrderStatus() helper: every delivery POST/PUT/DELETE recalculates linked order status inline before saveData"
    - "Heuristic product category migration: fertPat/chemPat/seedPat regex applied once at startup, never overwrites user edits (p.category === undefined guard)"
    - "Forecast endpoint: server-side aggregation via productIndex + productMap, joins with orders/deliveries for orderedQty/deliveredQty"
    - "IIFE shell modules with tab-activate listener: Wave 1 stubs that load data and render minimal output, ready for Wave 2 enrichment"

key-files:
  created:
    - farm-budget/public/inventory.js
    - farm-budget/public/orders.js
    - farm-budget/public/deliveries.js
    - farm-budget/public/reports.js
  modified:
    - farm-budget/server.js
    - farm-budget/public/index.html
    - farm-budget/public/style.css
    - farm-budget/public/inputs-manager.js

key-decisions:
  - "Forecast endpoint is server-side (GET /api/forecast) — avoids re-implementing Calc.computeApplicationPrice client-side"
  - "Deliveries use custom routes (not crudRoutes factory) to enable recalcOrderStatus() on every write"
  - "Old Inputs Manager content moved to Reference tab — all element IDs preserved, inputs-manager.js listener updated from 'inputs' to 'reference'"
  - "4 JS placeholder shells loaded in Wave 1 — each has tab-activate listener and minimal render to prevent console errors"
  - "Sun/moon Unicode glyphs (U+263C/U+263E) replace [day]/[night] text in theme toggle button"
  - "body.light block defined in CSS with all custom properties for complete day palette override"
  - "Product category migration uses undefined check (never overwrites existing category field) — safe to re-run"

patterns-established:
  - "recalcOrderStatus: helper function pattern for auto-transitioning order status on delivery write"
  - "forecast aggregation: productMap keyed by original product name, seed:variety prefix avoids collision"

requirements-completed: [INV-01, INV-02, INV-04, INV-05]

duration: 6min
completed: 2026-03-04
---

# Phase 19 Plan 01: Seed & Input Inventory Redesign - Foundation Summary

**Procurement pipeline server foundation: GET /api/forecast aggregating field inputs by category, orders/deliveries CRUD with auto-status-transition, restructured nav (Forecasts/Orders/Deliveries/Seeds/Reference), body.light day palette, and 4 IIFE module shells**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T03:13:08Z
- **Completed:** 2026-03-04T03:19:12Z
- **Tasks:** 2
- **Files modified:** 8 (4 modified, 4 created)

## Accomplishments
- GET /api/forecast returns 4 categories (Seed/Fertilizer/Chemical/Other) with per-product farm-wide totals, supplier resolution, ordered/delivered quantities, and per-field breakdowns
- Orders CRUD via crudRoutes factory + deliveries custom CRUD with recalcOrderStatus() — delivery status auto-transitions verified (ordered → partial → complete)
- migrateData extended with orders[], deliveries[] collections and heuristic product.category classification (fertPat/chemPat/seedPat regex, never overwrites user edits)
- Navigation restructured from 2 tabs (Inputs/Seeds) to 5 tabs (Forecasts/Orders/Deliveries/Seeds/Reference) with all old Inputs content preserved in Reference tab
- body.light CSS palette with 20+ custom property overrides for green-on-light day mode
- Sun/moon Unicode toggle (U+263C/U+263E) replaces [day]/[night] text

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side data migration, forecast endpoint, orders/deliveries CRUD** - `b3d8c7d` (feat)
2. **Task 2: HTML navigation restructure, tab content sections, day/night CSS** - `0691d74` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `farm-budget/server.js` - forecast endpoint, orders/deliveries CRUD, migrateData extensions, recalcOrderStatus helper
- `farm-budget/public/index.html` - 5-tab nav restructure, new tab sections (forecasts/orders/deliveries/reference), sun/moon toggle
- `farm-budget/public/style.css` - body.light palette, .pct-bar status bar, procurement card/row styles
- `farm-budget/public/inputs-manager.js` - tab listener updated from 'inputs' to 'reference'
- `farm-budget/public/inventory.js` - NEW: Forecasts tab IIFE shell with forecast load + render
- `farm-budget/public/orders.js` - NEW: Orders tab IIFE shell with order list render
- `farm-budget/public/deliveries.js` - NEW: Deliveries tab IIFE shell with delivery list render
- `farm-budget/public/reports.js` - NEW: Reports module with printReport() utility and print CSS

## Decisions Made
- Forecast endpoint is server-side to avoid duplicating `Calc.computeApplicationPrice()` client-side
- Custom delivery routes (not crudRoutes factory) — needed for inline recalcOrderStatus() on every write
- Reference tab preserves all original element IDs (inp-table, impl-table, sup-table, lo-table) so inputs-manager.js works without changes beyond the listener rename
- Wave 1 module shells render minimal but functional read-only views — prevents console errors and unifies tab pattern for Wave 2 enrichment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API endpoints (forecast, orders, deliveries) verified and operational
- HTML shell with correct tab IDs ready for Wave 2 UI modules to wire into
- CSS classes (.pct-bar, .fc-row, .ord-card, .del-card) defined for Wave 2 rendering
- inventory.js, orders.js, deliveries.js, reports.js shells ready for Wave 2 enrichment

---
*Phase: 19-seed-input-inventory-redesign*
*Completed: 2026-03-04*
