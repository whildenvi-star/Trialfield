---
phase: 11-buyer-registry-ticket-extensions
plan: 02
subsystem: ui, api
tags: [express, vanilla-js, grain-tickets, destinations, buyers, crop-year, filters, pwa]

# Dependency graph
requires:
  - phase: 11-01
    provides: "GrainBin model, /api/destinations, /api/grain-bins, buyer proxy, BuyerColumnMap routes"
provides:
  - Destination dropdown (buyers + grain bins in optgroups) in ticket entry form
  - Sticky last-used destination via localStorage
  - cropYear harvest-season logic: Jun-Dec = that year, Jan-May = prior year
  - Destination and crop year filters in ticket log
  - Destination column in ticket log table with resolved buyer/bin names
  - Buyer/destination breakdown per farm in Farm Summary
  - Server-side filter support: buyerId, grainBinId, cropYear query params on GET /api/tickets and GET /api/export/tickets
  - POST/PUT /api/tickets accept buyerId and grainBinId FK fields
  - Service worker cache bumped to v4
affects:
  - 12-settlement-import (tickets now have buyerId FK — settlement import can match by buyer)
  - 13-reconciliation (destination FK established for per-buyer reconciliation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite destination value (buyer:id / bin:id) encodes type + FK in a single select value"
    - "Sticky form field via localStorage — save on submit, restore on ref-data-loaded"
    - "Harvest-season cropYear derivation: Jan-May date maps to prior year (late delivery pattern)"
    - "Farm summary buyer breakdown: parallel fetch /api/farms + /api/tickets, group by destination FK"
    - "Crop year filter populated from ticket data (unique cropYear values, sorted descending)"

key-files:
  created: []
  modified:
    - grain-tickets/server.js
    - grain-tickets/public/index.html
    - grain-tickets/public/tickets.js
    - grain-tickets/public/farms.js
    - grain-tickets/public/app.js
    - grain-tickets/public/sw.js

key-decisions:
  - "Destination dropdown uses composite key (buyer:5 / bin:2) so client can distinguish type + id in one select value without hidden fields"
  - "Sticky destination: localStorage.setItem on submit success, restored in ref-data-loaded handler after dropdown population (survives form.reset())"
  - "Farm summary buyer breakdown uses simpler inline text approach (comma-separated in Destinations column) rather than collapsible row — fits existing table layout"
  - "Crop year filter populated client-side from ticket data — no new API endpoint needed"
  - "loadFarms() now fetches /api/tickets in parallel to compute buyerBreakdown — acceptable for 527 tickets, farm summary always reloads on tab activate"

patterns-established:
  - "Parallel fetch in loadFarms(): Promise.all([/api/farms, /api/tickets]) for buyer breakdown without extra round-trips"
  - "Farm summary Destinations column: compact inline text 'UE — 1,234 BU (15) | ADM — 2,345 BU (22)'"

requirements-completed: [BUY-02, TKT-01, TKT-02]

# Metrics
duration: 18min
completed: 2026-03-02
---

# Phase 11 Plan 02: Destination Dropdown, Filters & Farm Summary Buyer Breakdown

**Destination dropdown (buyers + grain bins) wired into ticket entry form with sticky localStorage, cropYear harvest-season derivation, Destination/CropYear filters in ticket log, Destination column in ticket table, buyer breakdown per farm in Farm Summary, and service worker bumped to v4**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-02T07:56:12Z
- **Completed:** 2026-03-02T08:14:41Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Ticket entry form has a required Destination dropdown populated from `/api/destinations` — bins shown in "Grain Bins" optgroup, buyers in "Buyers" optgroup, each option with composite value `buyer:id` or `bin:id`
- Sticky destination: `localStorage.lastDestination` saved on submit success, restored after dropdown is populated on `ref-data-loaded` (survives `form.reset()`)
- `getCropYear()` updated to harvest-season logic: Jan-May dates return `year - 1` (late delivery from prior harvest), Jun-Dec return that year
- `GET /api/tickets` now supports `buyerId`, `grainBinId`, `cropYear` query params — where clause built from parsed ints
- `POST /api/tickets` accepts `buyerId` and `grainBinId` from client, sets `destination: null` on new tickets (FK replaces free-text)
- `PUT /api/tickets/:id` accepts `buyerId` and `grainBinId` for editing destination on existing tickets
- `GET /api/export/tickets` supports `buyerId`, `grainBinId`, `cropYear` filter params for filtered CSV export
- Ticket log has Destination and Crop Year filter dropdowns; crop year populated from unique ticket `cropYear` values on load
- Destination column added to ticket table — resolves buyer shortCode or bin name from `refData.destinations`; falls back to legacy free-text `destination` field for old tickets
- Farm Summary `loadFarms()` fetches `/api/farms` and `/api/tickets` in parallel, computes `buyerBreakdown` per farm (grouped by `buyerId`/`grainBinId`)
- Farm Summary table has new Destinations column showing `"UE — 1,234.6 BU (15) | ADM — 2,345.7 BU (22)"` inline text per farm
- `app.js` startup loads `/api/destinations` in `Promise.all` alongside crops and farm names — `refData.destinations` available to all components at `ref-data-loaded`
- Service worker `CACHE_NAME` bumped from `grain-tickets-v3` to `grain-tickets-v4` to force JS cache invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Destination dropdown + cropYear logic + server route updates** - `401dd6a` (feat)
2. **Task 2: Destination/crop year filters + farm summary buyer breakdown + SW cache bump** - `6acdce9` (feat)

**Plan metadata:** committed in final docs commit

## Files Created/Modified

- `grain-tickets/server.js` - Updated getCropYear(), GET /api/tickets with where clause, POST /api/tickets with buyerId/grainBinId, PUT /api/tickets/:id with buyerId/grainBinId, GET /api/export/tickets with destination/cropYear params
- `grain-tickets/public/index.html` - Added destination dropdown to entry form, Dest column header in ticket table, filter-destination + filter-crop-year selects, Destinations column in farm summary table
- `grain-tickets/public/tickets.js` - Destination dropdown population with optgroups, sticky localStorage, form submit with FK parsing, filter logic for destination + crop year, crop year filter population, Destination column in renderTable(), CSV export with destination/cropYear params
- `grain-tickets/public/farms.js` - Parallel fetch for tickets, buyerBreakdown computation per farm, Destinations column in renderTable(), totals row colspan updated
- `grain-tickets/public/app.js` - Added /api/destinations to startup Promise.all, refData.destinations initialized
- `grain-tickets/public/sw.js` - CACHE_NAME bumped from grain-tickets-v3 to grain-tickets-v4

## Decisions Made

- Destination dropdown uses composite key (`buyer:5` / `bin:2`) so client can distinguish destination type and ID in a single select value — no hidden fields needed
- Sticky destination: save `localStorage.lastDestination` on submit success, restore in `ref-data-loaded` handler after dropdown is populated (re-applying the value after `form.reset()` clears it)
- Farm summary Destinations column uses simpler inline text approach rather than collapsible expand/collapse rows — compact text fits the existing table layout without adding toggle complexity
- `loadFarms()` fetches `/api/tickets` in parallel for buyer breakdown — no new endpoint needed; 527-ticket dataset is fast enough that parallel fetch has negligible overhead
- Crop year filter populated client-side from `allTickets` after load — eliminates the need for a dedicated `/api/crop-years` endpoint

## Deviations from Plan

None — plan executed exactly as written. Used the simpler "inline text Destinations column" approach for farm summary which was the plan's preferred fallback and fits the existing table structure better.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Service worker v4 will be picked up automatically on next page load/refresh.

## Next Phase Readiness

- Phase 12 (Settlement Import) can now match settlements to buyers via `buyerId` FK on tickets
- Phase 13 (Reconciliation) has the buyer/destination FK foundation needed for per-buyer weight matching
- All 527 existing tickets display correctly with null buyerId/grainBinId — Destination column shows empty or legacy free-text `destination` field value

---
*Phase: 11-buyer-registry-ticket-extensions*
*Completed: 2026-03-02*

## Self-Check: PASSED

All created/modified files verified to exist:
- FOUND: grain-tickets/server.js
- FOUND: grain-tickets/public/index.html
- FOUND: grain-tickets/public/tickets.js
- FOUND: grain-tickets/public/farms.js
- FOUND: grain-tickets/public/app.js
- FOUND: grain-tickets/public/sw.js
- FOUND: .planning/phases/11-buyer-registry-ticket-extensions/11-02-SUMMARY.md

Commits verified:
- FOUND: 401dd6a (Task 1: server + index.html + tickets.js)
- FOUND: 6acdce9 (Task 2: filters + farms + app.js + sw.js)
