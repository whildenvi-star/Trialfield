---
phase: 19-seed-input-inventory-redesign
plan: 02
subsystem: ui
tags: [vanilla-js, forecast, orders, procurement, iife, checkbox-selection, inline-edit, pct-bar]

requires:
  - phase: 19-01
    provides: /api/forecast, /api/orders, /api/deliveries, HTML tab shells, CSS classes (.pct-bar, .fc-row, .ord-card)

provides:
  - Forecast Hub tab: category tables, expandable field breakdown, checkbox selection, Create Order flow, % status bars
  - Orders tab: order cards, status badges, expandable detail, PO/notes inline edit, line items with delivered qty, delete

affects: [19-03, farm-budget-wave2-ui]

tech-stack:
  added: []
  patterns:
    - "Set-based checkbox selection: selectedProducts = new Set(), add/delete on change, drives Create Order button state"
    - "Delivery aggregation on order expand: fetch /api/deliveries?orderId=X, sum deliveredQty per productName, cache per session"
    - "Double-click inline edit: replace display span with input, save on blur/Enter via api.put, restore on Escape"
    - "Print dropdown: dynamically created dropdown div appended to wrapper span, dispatches print-report custom events"
    - "forecast-changed cross-tab refresh: both inventory.js and orders.js listen for this event and reload when their tab is active"

key-files:
  created: []
  modified:
    - farm-budget/public/inventory.js
    - farm-budget/public/orders.js

key-decisions:
  - "Forecast reloads on every tab-activate (no loaded guard) — live procurement data, must always reflect latest delivery changes"
  - "Create Order navigates to Orders tab via location.hash + manual tab-activate dispatch — no tight coupling to app.js internals"
  - "Delivery cache keyed by orderId, invalidated on qty edit or forecast-changed — avoids stale totals in expanded rows"
  - "Print dropdown built dynamically (not in HTML) — keeps index.html clean, self-contained in inventory.js"

metrics:
  duration: 173s
  completed: 2026-03-04
  tasks: 2
  files_modified: 2
---

# Phase 19 Plan 02: Seed & Input Inventory Redesign - Forecast Hub & Orders UI Summary

**Forecast Hub and Orders tab fully implemented: category-grouped product tables with expandable field breakdown, checkbox-driven Create Order flow, % status bars, and full order management with expandable detail, inline editing, and delivery-aware remaining quantities.**

## Performance

- **Duration:** 173s (~3 min)
- **Started:** 2026-03-04T03:22:36Z
- **Completed:** 2026-03-04T03:25:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Forecast Hub (`inventory.js`): category-grouped product tables (Seed/Fertilizer/Chemical/Other), each with collapsible header, product count badge, and cost total. Expandable field breakdown per product with caret toggle and `max-height`-compatible CSS. Checkbox selection per product plus Select All / Clear per category. `% ordered` status bars (`.pct-bar-fill.complete` / `.over`). Create Order groups selected products by `supplierId`, POSTs one order per supplier, shows toast, reloads forecast, navigates to Orders tab. Print Reports dropdown dispatches `print-report` custom events for Plan 03.
- Orders tab (`orders.js`): order cards sorted newest-first with status badge color-coding (ordered/partial/complete), expandable detail with editable PO number and notes (blur-save via `api.put`). Line items table shows forecast qty, ordered qty, delivered qty (aggregated from `/api/deliveries?orderId=`), and remaining (red if negative). Double-click inline edit for ordered qty with Enter/Escape. Delete order with `confirm()`. Record Delivery button dispatches `start-delivery` event. Status filter dropdown with filtered/total count.
- Both modules listen for `forecast-changed` and reload when their tab is active, keeping status bars and delivery data fresh after delivery saves.

## Task Commits

Each task was committed atomically:

1. **Task 1: Forecast Hub tab UI** - `55257fe` (feat)
2. **Task 2: Orders tab UI** - `8325d8e` (feat)

## Files Created/Modified

- `farm-budget/public/inventory.js` — replaced Wave 1 shell with full 374-line Forecast Hub: category tables, expandable rows, checkboxes, Create Order, print dropdown, forecast-changed refresh
- `farm-budget/public/orders.js` — replaced Wave 1 shell with full 355-line Orders tab: order cards, expandable detail, PO/notes inline edit, line items with delivery aggregation, inline qty edit, delete

## Decisions Made

- Forecast reloads on every tab-activate (no `loaded` guard) — live procurement data must always reflect latest delivery changes
- Create Order navigates to Orders tab via `location.hash = 'orders'` plus a manual `tab-activate` dispatch — avoids tight coupling to `app.js` internals
- Delivery cache per orderId, cleared on qty edit or `forecast-changed` event — prevents stale totals in expanded rows during same session
- Print dropdown built dynamically (not in index.html) — self-contained in `inventory.js`, no HTML changes needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `print-report` custom event wired and dispatching from Forecast Hub — Plan 03 (reports.js) can add listeners immediately
- `start-delivery` event dispatching from Orders tab — Plan 02 deliveries.js can handle pre-selection
- All status bars, order counts, and delivery totals derive from live API data — no seed data required for testing

## Self-Check: PASSED

- FOUND: farm-budget/public/inventory.js (374 lines, all 11 code checks pass)
- FOUND: farm-budget/public/orders.js (355 lines, all 10 code checks pass)
- FOUND: .planning/phases/19-seed-input-inventory-redesign/19-02-SUMMARY.md
- FOUND commit: 55257fe (feat: Forecast Hub tab UI)
- FOUND commit: 8325d8e (feat: Orders tab UI)

---
*Phase: 19-seed-input-inventory-redesign*
*Completed: 2026-03-04*
