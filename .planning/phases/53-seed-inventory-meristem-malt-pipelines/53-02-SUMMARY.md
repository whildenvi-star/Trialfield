---
phase: 53-seed-inventory-meristem-malt-pipelines
plan: 02
subsystem: api
tags: [express, grain-tickets, meristem-malt, settlement-prices, sync, pricing, vanilla-js]

# Dependency graph
requires:
  - phase: 52-yield-pipeline
    provides: settlement data with matched/manual lines and prices in grain-tickets Prisma schema
provides:
  - GET /api/settlement-prices endpoint in grain-tickets returning avg price per crop from matched settlement lines
  - POST /api/grain-prices/sync endpoint in meristem-malt fetching settlement prices and updating pricing store
  - GET /api/grain-prices/status endpoint returning pricingSync metadata
  - PUT /api/grain-prices/override/:key endpoint toggling manual override per pricing key
  - Pricing table UI with sync button, GT badge, Manual badge, and per-row override toggle
affects: meristem-malt pricing, grain-tickets API surface, platform data pipelines

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pricingSync store pattern: lastSyncedAt + syncedPrices + manualOverrides tracked in JSON store"
    - "GRAIN_TICKETS_URL env var + gtUrl() helper for server-to-server calls with optional token"
    - "Manual override prevents sync overwrite — explicit flag per pricing key"
    - "Auto-enable manual override when user edits a price cell directly"

key-files:
  created: []
  modified:
    - grain-tickets/server.js
    - meristem-malt/server.js
    - meristem-malt/public/app.js
    - meristem-malt/public/index.html
    - meristem-malt/public/style.css
    - meristem-malt/.env.example

key-decisions:
  - "gtUrl() helper builds server-to-server URLs with optional GRAIN_TICKETS_TOKEN (defaults to EMBED_TOKEN) — avoids separate token config"
  - "Crop name mapping (hybrid barley -> barley, srww/hrw -> wheat) handles grain-tickets naming conventions at sync time"
  - "Manual override auto-set when user edits price cell — no separate confirmation needed, transparent UX"
  - "Sync failure returns 502 with error message — manual prices remain unchanged, graceful degradation"
  - "pricingSync migration added to loadData() — existing stores without pricingSync field get defaults on next load"

patterns-established:
  - "Sync bar pattern: button + status span rendered via renderSyncBar() above the affected table"
  - "Badge pattern: GT badge (green #7A9E7E) for synced prices, Manual badge (muted #6a5a4a) for overridden"

requirements-completed:
  - PIPE-07
  - PIPE-08

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 53 Plan 02: Meristem-Malt Grain Price Sync Summary

**Settlement price pipeline from grain-tickets to meristem-malt: new API endpoints, store migration, and pricing table with GT/Manual badges and override toggle**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T20:31:45Z
- **Completed:** 2026-03-25T20:38:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- grain-tickets exposes GET /api/settlement-prices returning avg price per crop from matched/manual settlement lines (supports cropYear and buyerName filters)
- meristem-malt sync pipeline: POST /api/grain-prices/sync fetches from grain-tickets, maps crop names to pricing keys, stores synced prices while respecting manual overrides
- Pricing table UI shows "Sync from Grain Tickets" button, GT badge on synced rows, Manual badge on overridden rows, and lock/unlock per-row toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Add settlement price API in grain-tickets and sync endpoint in meristem-malt** - `1e98315` (feat)
2. **Task 2: Add synced indicator and manual override UI to meristem-malt pricing table** - `a6c7762` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `grain-tickets/server.js` - Added GET /api/settlement-prices endpoint (after /api/yield-summaries block)
- `meristem-malt/server.js` - Added GRAIN_TICKETS_URL/TOKEN constants, gtUrl() helper, pricingSync store field, loadData migration, POST /api/grain-prices/sync, GET /api/grain-prices/status, PUT /api/grain-prices/override/:key
- `meristem-malt/public/app.js` - Added pricingSync state, api.post() helper, renderSyncBar(), updated renderPricing() with badges and override toggles, updated startPricingEdit() to auto-set manual override, updated init() to load sync status
- `meristem-malt/public/index.html` - Added pricing-sync-bar div and extra table header columns for Source and override toggle
- `meristem-malt/public/style.css` - Added .badge-gt and .badge-manual CSS classes
- `meristem-malt/.env.example` - Documented GRAIN_TICKETS_URL and GRAIN_TICKETS_TOKEN variables

## Decisions Made
- gtUrl() helper defaults GRAIN_TICKETS_TOKEN to EMBED_TOKEN so no extra config is needed in single-token setups
- Crop name mapping (hybrid barley -> barley, srww/hrw -> wheat) handles grain-tickets naming conventions at sync time — no canonical crop registry ID needed for this cross-app data flow
- Manual override auto-set when user edits price cell — provides implicit lock without extra UI step
- pricingSync migration in loadData() covers existing data.json files without pricingSync field

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Optional: set `GRAIN_TICKETS_URL` in meristem-malt `.env` if grain-tickets runs on a non-default port or host. Defaults to `http://localhost:3007`.

## Next Phase Readiness
- PIPE-07 and PIPE-08 complete — meristem-malt grain cost now reflects actual settlement prices
- Phase 53 Plans 01 and 02 complete (PIPE-05..08 combined phase)
- Ready for Phase 54 (UXN improvements)

---
*Phase: 53-seed-inventory-meristem-malt-pipelines*
*Completed: 2026-03-25*
