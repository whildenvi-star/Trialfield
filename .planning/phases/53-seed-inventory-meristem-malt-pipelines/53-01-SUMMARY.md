---
phase: 53-seed-inventory-meristem-malt-pipelines
plan: 01
subsystem: api
tags: [seed-inventory, organic-cert, nop-compliance, seed-mapper, ecosystem-client]

# Dependency graph
requires:
  - phase: 17-input-seed-compilation
    provides: seed-mapper.ts and SeedPreviewRow types this plan extends
  - phase: 46-field-pass-logger
    provides: ecosystem client patterns (fetchWithTimeout, EcosystemError)
provides:
  - seed-inventory /api/organic/seed-lots enhanced with omriListed, supplierName, organicGround
  - getSeedLots() client function in organic-cert with typed SeedLotFromInventory interface
  - mapSeeds() fetches seed-inventory as primary NOP compliance source with farm-budget fallback
  - SeedPreviewRow includes lotNumber, organicCertNumber, omriListed, supplierName, sourceApp
  - SeedLot upsert populates certNumber and lotNumber from seed-inventory data
affects: [organic-cert seed compilation, NOP compliance workflow, seed lot records]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled for graceful multi-source fetch — seed-inventory down does not block compile"
    - "sourceApp provenance field on preview rows — tracks data origin (seed-inventory vs farm-budget)"
    - "Conditional upsert update — certNumber/lotNumber only overwritten when sourceApp=seed-inventory"

key-files:
  created:
    - organic-cert/src/lib/ecosystem/seed-inventory-client.ts (getSeedLots + SeedLotFromInventory)
  modified:
    - seed-inventory/server.js (enhanced /api/organic/seed-lots with 4 new fields)
    - organic-cert/src/lib/compile/seed-mapper.ts (seed-inventory as primary, farm-budget fallback)
    - organic-cert/src/lib/compile/types.ts (5 new fields on SeedPreviewRow)
    - organic-cert/src/app/api/compile/[year]/seeds/route.ts (certNumber+lotNumber in upsert)

key-decisions:
  - "seed-inventory is primary NOP compliance source; farm-budget seed catalog is fallback only"
  - "Promise.allSettled used so seed-inventory downtime never blocks organic-cert compilation"
  - "SeedLot certNumber/lotNumber only overwritten on update when sourceApp=seed-inventory — preserves user edits"
  - "siLotByKey built from inventory lots, keyed by normalized crop+variety with space/underscore variants; latest dateReceived wins when duplicate product"

patterns-established:
  - "Source provenance on compile rows: sourceApp field distinguishes ecosystem data from budget data"
  - "Conditional upsert update pattern: update block varies based on data source to protect user edits"

requirements-completed:
  - PIPE-05

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 53 Plan 01: Seed Inventory Pipeline Summary

**Organic-cert seed compilation rewired to use seed-inventory lot numbers, cert numbers, and OMRI status as primary NOP compliance source with graceful farm-budget fallback**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T20:31:08Z
- **Completed:** 2026-03-25T20:36:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Enhanced seed-inventory `/api/organic/seed-lots` with `omriListed`, `supplierName` (resolved from supplier ID), `productName`, and `organicGround` fields
- Added `getSeedLots()` client function to organic-cert with full `SeedLotFromInventory` typed interface and token auth support
- Rewired `mapSeeds()` to fetch from seed-inventory with `Promise.allSettled` — fallback to farm-budget if seed-inventory is unreachable
- `SeedPreviewRow` now carries `lotNumber`, `organicCertNumber`, `omriListed`, `supplierName`, and `sourceApp` fields
- `SeedLot` upsert populates `certNumber` and `lotNumber` on create from seed-inventory; conditional update block preserves user edits

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance seed-inventory API and add organic-cert client function**
   - Main repo: `e630ae4` (feat) — seed-inventory/server.js
   - Organic-cert repo: `ef1af68` (feat) — seed-inventory-client.ts

2. **Task 2: Rewire seed-mapper to use seed-inventory as primary source**
   - Organic-cert repo: `4d8ef68` (feat) — types.ts, seed-mapper.ts, seeds/route.ts

## Files Created/Modified
- `seed-inventory/server.js` — Enhanced `/api/organic/seed-lots`: supplier lookup map, omriListed, supplierName, productName, organicGround
- `organic-cert/src/lib/ecosystem/seed-inventory-client.ts` — New: SeedLotFromInventory interface + getSeedLots() function
- `organic-cert/src/lib/compile/types.ts` — Added 5 fields to SeedPreviewRow: lotNumber, organicCertNumber, omriListed, supplierName, sourceApp
- `organic-cert/src/lib/compile/seed-mapper.ts` — Promise.allSettled tri-fetch, siLotByKey lookup, merged preview rows with SI provenance
- `organic-cert/src/app/api/compile/[year]/seeds/route.ts` — uniqueSeeds map includes lot fields; conditional upsert update block

## Decisions Made
- seed-inventory is the primary NOP compliance source; farm-budget seed catalog is fallback only — eliminates double-entry of lot numbers and cert numbers
- Promise.allSettled used so seed-inventory downtime never blocks organic-cert compilation
- SeedLot certNumber/lotNumber only overwritten on update when sourceApp=seed-inventory — preserves user edits from the UI
- siLotByKey keyed by normalized crop+variety (space + underscore variants); latest dateReceived wins when duplicate receipts for same product

## Deviations from Plan

None — plan executed exactly as written.

**Discovery:** organic-cert has its own nested `.git` repository at `organic-cert/.git`. Commits to organic-cert files must be made inside that directory. The main project repo sees `organic-cert/` as a single untracked directory entry.

## Issues Encountered
- organic-cert is a nested git repo — `git add` from the root project silently did nothing for files inside it. Required committing inside `organic-cert/` with its own `git commit`.

## User Setup Required
None — no external service configuration required. seed-inventory runs locally on port 3006.

## Next Phase Readiness
- PIPE-05 complete. seed-inventory is now the authoritative NOP compliance source for seed lot data.
- Plan 02 (meristem-malt pipeline) can proceed independently.
- Organic-cert compile preview at `/api/compile/[year]/seeds` will return `sourceApp` field confirming data provenance.

---
*Phase: 53-seed-inventory-meristem-malt-pipelines*
*Completed: 2026-03-25*
