---
phase: 11-buyer-registry-ticket-extensions
plan: 01
subsystem: database, api, ui
tags: [prisma, postgresql, express, grain-tickets, farm-budget, grain-bins, buyers, column-mapping]

# Dependency graph
requires:
  - phase: 10-migration-cutover
    provides: "527 grain tickets migrated to PostgreSQL with buyerId FK and Ticket model"
  - phase: 09-database-foundation
    provides: "Prisma schema with Ticket, Farm, Buyer, BuyerColumnMap, Settlement models"
provides:
  - GrainBin Prisma model with migration (name, capacity, notes, tickets[] relation)
  - GrainBin CRUD API routes (GET/POST/PUT/DELETE /api/grain-bins)
  - Buyer proxy route (GET /api/buyers) fetching from farm-budget with 5s timeout
  - Merged destinations endpoint (GET /api/destinations) with type: buyer|bin
  - BuyerColumnMap upsert routes (GET/PUT/DELETE /api/buyers/:id/column-maps)
  - Admin UI sections for Grain Bins (CRUD), Buyers (read-only), Column Mapping (per-buyer)
  - shortCode field on all 5 farm-budget buyers in data.json
affects:
  - 11-02 (ticket entry form needs destinations list and grain bin FK)
  - 12-settlement-import (BuyerColumnMap stores settlement column config)
  - 13-reconciliation (buyer/bin FK on tickets for matching)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-app fetch proxy with AbortController 5s timeout and graceful fallback"
    - "Merged endpoints with Promise.allSettled for multi-source aggregation"
    - "BuyerColumnMap upsert on compound unique buyerId_fieldName"
    - "Delete protection: count referencing tickets before allowing bin delete"
    - "Cache-Control: no-store on filter-sensitive endpoints"

key-files:
  created:
    - grain-tickets/prisma/migrations/20260302073000_add_grain_bin/migration.sql
  modified:
    - grain-tickets/prisma/schema.prisma
    - grain-tickets/server.js
    - grain-tickets/public/admin.html
    - farm-budget/data/data.json

key-decisions:
  - "Grain bins are local to grain-tickets (not synced from farm-budget) — they represent on-farm storage, not external buyers"
  - "Buyer proxy returns raw farm-budget JSON array (or {_source: unavailable, buyers: []} object) — client checks _source field"
  - "GET /api/destinations sorts bins first then buyers alphabetically — client handles display prefix labels"
  - "Cache-Control: no-store on /api/tickets and /api/destinations to prevent stale filter results"
  - "shortCode patched directly in farm-budget/data/data.json since farm-budget uses file-backed store"

patterns-established:
  - "Cross-app fetch proxy: AbortController timeout + error logging + graceful [] fallback (never crash server)"
  - "Admin inline-edit: dblclick on td.editable, input blur/enter saves, escape cancels, re-renders on success"
  - "Grain bin delete protection: check ticket count first, return 409 with descriptive count message"

requirements-completed: [BUY-01, BUY-03]

# Metrics
duration: 8min
completed: 2026-03-02
---

# Phase 11 Plan 01: Buyer Registry & Ticket Extensions Summary

**GrainBin Prisma model + migration, CRUD API for bins, buyer proxy from farm-budget, merged /api/destinations endpoint, BuyerColumnMap upsert routes, and admin.html sections for Grain Bins/Buyers/Column Mapping**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-02T07:28:37Z
- **Completed:** 2026-03-02T07:35:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GrainBin model added to Prisma schema with migration applied — table created in PostgreSQL with unique name constraint and SET NULL FK from Ticket
- 5 new API route groups added to server.js: GrainBin CRUD (with delete protection), buyer proxy, merged destinations, BuyerColumnMap get/upsert/delete
- admin.html extended with Grain Bins (full CRUD), Buyers (read-only with availability status), Column Mapping (8 standard settlement fields per buyer)
- All 5 farm-budget buyers patched with shortCode values (UE, DLC, FCB, ALC, DLA) in data.json
- dbTicketToJson now emits buyerId, grainBinId, destination, cropYear fields

## Task Commits

Each task was committed atomically:

1. **Task 1: GrainBin model + CRUD routes + buyer proxy + destinations + BuyerColumnMap routes** - `6020ad4` (feat)
2. **Task 2: Add Buyers, Grain Bins, and Column Mapping sections to admin.html** - `5a3433d` (feat)

**Plan metadata:** committed in final docs commit

## Files Created/Modified

- `grain-tickets/prisma/schema.prisma` - Added GrainBin model, grainBinId FK on Ticket, onDelete: SetNull on both buyer/grainBin relations, @@index([grainBinId])
- `grain-tickets/prisma/migrations/20260302073000_add_grain_bin/migration.sql` - Migration adding GrainBin table, grainBinId column, FK constraint with SET NULL
- `grain-tickets/server.js` - Added GrainBin CRUD, buyer proxy, /api/destinations, BuyerColumnMap routes, updated dbTicketToJson, Cache-Control: no-store
- `grain-tickets/public/admin.html` - Added Grain Bins, Buyers, Column Mapping sections with CRUD and inline-edit patterns
- `farm-budget/data/data.json` - Added shortCode field to all 5 buyer records

## Decisions Made

- GrainBin model is local to grain-tickets (not proxied from an external service) — grain bins represent on-farm storage, a concept that only exists in grain-tickets
- Buyer proxy returns the raw farm-budget array OR an object with `_source: 'unavailable'` marker — the client checks this to show the status message
- Merged /api/destinations sorts bins first, then buyers alphabetically — the UI can add display prefix labels (e.g. "[BIN]") client-side
- Cache-Control: no-store added to /api/tickets and /api/destinations to prevent browser from caching stale filter results when user switches destination filters
- shortCode patched directly in farm-budget/data/data.json using Edit tool since farm-budget uses a file-backed JSON store; server restart picks up the changes

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- PostgreSQL service was not running at execution start (brew services showed `none` status). Started it with `brew services start postgresql@16`. This is expected in a development environment. (Deviation rule 3: blocking issue, auto-resolved.)
- Farm-budget was running but returned old buyer data without shortCode because it caches data.json at startup. The data.json edit is correct — shortCodes will appear after farm-budget restarts. This is a known limitation of the file-backed store pattern.

## User Setup Required

None — no external service configuration required. farm-budget restart will pick up shortCode values from data.json automatically.

## Next Phase Readiness

- Plan 11-02 can now wire the ticket entry form to use /api/destinations for the destination dropdown, and set buyerId/grainBinId on ticket create/update
- Phase 12 (Settlement Import) can use /api/buyers/:id/column-maps to read per-buyer CSV column config
- GrainBin table is empty — user should create bins via admin.html before Phase 11-02 ticket entry testing

---
*Phase: 11-buyer-registry-ticket-extensions*
*Completed: 2026-03-02*

## Self-Check: PASSED

All created files verified to exist:
- FOUND: grain-tickets/prisma/schema.prisma
- FOUND: grain-tickets/server.js
- FOUND: grain-tickets/public/admin.html
- FOUND: grain-tickets/prisma/migrations/20260302073000_add_grain_bin/migration.sql
- FOUND: farm-budget/data/data.json
- FOUND: .planning/phases/11-buyer-registry-ticket-extensions/11-01-SUMMARY.md

Commits verified:
- FOUND: 6020ad4 (Task 1: schema + server routes)
- FOUND: 5a3433d (Task 2: admin.html)
- FOUND: 3c23b8a (docs: summary + state updates)
