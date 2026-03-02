---
phase: 10-migration-cutover
plan: "02"
subsystem: api
tags: [prisma, postgresql, express, grain-tickets, api-cutover, pwa]

# Dependency graph
requires:
  - phase: 10-migration-cutover
    plan: "01"
    provides: 527 tickets, 63 farms, 37 crop configs in PostgreSQL; data.json archived
provides:
  - All grain-tickets API routes read/write PostgreSQL via Prisma (not JSON flat-file)
  - service worker CACHE_NAME bumped to v3 — forces client JS cache invalidation
  - Server starts with PostgreSQL connection verified (ticket/farm/crop counts logged)
affects:
  - 11-buyers-tickets
  - 12-settlements
  - 13-reconciliation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dbTicketToJson: converts Prisma Ticket row (DateTime, nullable fields) to JSON shape expected by calc.js and client"
    - "dbFarmToJson: maps Farm.name -> farm field for client backward compatibility"
    - "buildCropConfigObject(cropYear): converts CropConfig rows to { cropName: { discount, testWeight, moistureShrink } } object shape"
    - "computeFarmSummaries: async function queries all tickets+farms+cropConfig then delegates to Calc.computeFarmSummaries"
    - "All routes wrapped in try/catch with P2025 (not found -> 404) and P2002 (unique violation -> 409) handling"
    - "getCropYear: extracts year from YYYY-MM-DD string, defaults to current year"

key-files:
  created: []
  modified:
    - grain-tickets/server.js
    - grain-tickets/public/sw.js

key-decisions:
  - "No in-memory caching of farm summaries — PostgreSQL query on 527 tickets is fast enough (per research); eliminates cache invalidation complexity"
  - "validateTicket and enrichTicket now receive cropConfig as parameter (not via store closure) — makes them pure functions compatible with async DB fetch"
  - "Farm.name maps to legacy farm field via dbFarmToJson — client backward compat preserved without schema change"
  - "buildCropConfigObject defaults to current year when no cropYear supplied — GET /api/crops always returns current season config"

patterns-established:
  - "Async route handler pattern: async (req, res) => { try { ... } catch (e) { console.error; res.status(500) } }"
  - "Prisma error codes: P2025 (record not found) -> 404, P2002 (unique constraint) -> 409"

requirements-completed: [DB-02, DB-04]

# Metrics
duration: 3min
completed: "2026-03-02"
---

# Phase 10 Plan 02: Server Cutover Summary

**All grain-tickets API routes rewritten from in-memory JSON store to Prisma PostgreSQL queries; service worker bumped to v3 for forced client cache refresh**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-03-02T05:06:15Z
- **Completed:** 2026-03-02T05:08:52Z
- **Tasks:** 2
- **Files modified:** 2 (server.js, public/sw.js)

## Accomplishments

- Removed all JSON store code: `loadData`, `saveData`, `withLock`, `fsp`, `DATA_FILE`, `MAX_BACKUPS`, `store`, `farmSummaryCache`, `invalidateFarmCache`, `getCachedFarmSummaries`, `ticketById`, `ticketByNo`, `rebuildTicketIndexes`, `migrateWhitespace`, `generateId`
- Added `prisma = require('./lib/db')` singleton import
- Added helpers: `getCropYear`, `buildCropConfigObject`, `dbTicketToJson`, `dbFarmToJson`
- Rewrote all 18 API routes to async Prisma queries with try/catch error handling
- Startup block uses `prisma.ticket.count()` / `prisma.farm.count()` / `prisma.cropConfig.count()` to verify DB connection on startup
- `GET /api/crops` returns object shape `{ cropName: { discount, testWeight, moistureShrink } }` — not an array — maintaining backward compatibility with client `Object.keys(refData.cropConfig)` usage
- `POST /api/scan` reads cropNames and farmNames from DB instead of in-memory store
- `computeFarmSummaries` is now async — queries DB, converts rows, delegates computation to `Calc.computeFarmSummaries` (no caching needed)
- Service worker CACHE_NAME bumped from `grain-tickets-v2` to `grain-tickets-v3`

## Task Commits

Each task committed atomically:

1. **Task 1: Rewrite server.js routes from JSON store to Prisma queries** - `f765283` (feat)
2. **Task 2: Bump service worker CACHE_NAME to v3** - `f6aa57a` (chore)

## Files Created/Modified

- `grain-tickets/server.js` - Full rewrite: all 18 routes now use Prisma; all JSON store code removed; helpers dbTicketToJson, dbFarmToJson, buildCropConfigObject, computeFarmSummaries, getCropYear added
- `grain-tickets/public/sw.js` - CACHE_NAME bumped from `grain-tickets-v2` to `grain-tickets-v3`

## Decisions Made

- **No farm summary caching:** The in-memory `farmSummaryCache` with `invalidateFarmCache()` callbacks is removed. PostgreSQL query on 527 tickets is fast enough per research recommendation. Eliminates cache invalidation complexity across every write route.
- **Pure function signatures:** `validateTicket(body, cropConfig)` and `enrichTicket(ticket, cropConfig)` now receive `cropConfig` as a parameter rather than reading from a closed-over store. This makes them pure functions compatible with async DB fetches.
- **Farm name mapping:** The Prisma Farm model uses `name` (enforced unique) but the existing client and calc.js expect `farm`. `dbFarmToJson` maps `name -> farm` preserving backward compat without a schema change.
- **buildCropConfigObject defaults to current year:** When no `cropYear` is supplied (e.g., GET /api/crops, GET /api/tickets list), the function uses `new Date().getFullYear()` so it always returns the current season's config.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The verification suite passed 19/19 checks on first attempt.

## User Setup Required

None. Server starts automatically once `DATABASE_URL` is set (from Phase 9).

## Self-Check

---

## Self-Check: PASSED

Files verified:
- `grain-tickets/server.js` — FOUND, contains all Prisma patterns, no JSON store code
- `grain-tickets/public/sw.js` — FOUND, contains `grain-tickets-v3`, no `grain-tickets-v2`

Commits verified:
- `f765283` — FOUND: feat(10-02): rewrite server.js from JSON store to Prisma queries
- `f6aa57a` — FOUND: chore(10-02): bump service worker CACHE_NAME from v2 to v3

---
*Phase: 10-migration-cutover*
*Completed: 2026-03-02*
