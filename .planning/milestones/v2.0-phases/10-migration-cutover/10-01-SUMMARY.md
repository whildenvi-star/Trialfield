---
phase: 10-migration-cutover
plan: "01"
subsystem: database
tags: [prisma, postgresql, migration, grain-tickets, nodejs]

# Dependency graph
requires:
  - phase: 09-database-foundation
    provides: Prisma schema with Ticket, Farm, CropConfig models and grain_tickets PostgreSQL database
provides:
  - 527 grain tickets in PostgreSQL with hbtBinNo and truckId extracted from notes
  - 63 farms in PostgreSQL with all metadata fields (acres, crop, coverage, driver, etc.)
  - 37 crop configs in PostgreSQL with cropYear=2025
  - data.json archived to data.json.archive (server cannot start without DB now)
  - migrate-json.js standalone migration script for reference/rollback documentation
affects:
  - 11-buyers-tickets
  - 12-settlements
  - 13-reconciliation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration script creates its own PrismaClient — does not import the singleton from lib/db.js"
    - "Noon UTC date anchoring (T12:00:00.000Z) for date-only strings avoids timezone shift"
    - "Fail-fast migration: row count mismatches or calc.js parity failures abort before archiving"
    - "extractHbtBinNo/extractTruckId: regex extraction copies data into first-class columns without removing notes text"

key-files:
  created:
    - grain-tickets/migrate-json.js
    - grain-tickets/data/data.json.archive
  modified: []

key-decisions:
  - "Noon UTC anchoring (T12:00:00.000Z) for date-only strings ensures date value is stable across all timezone offsets"
  - "Migration script is standalone (own PrismaClient, not singleton) — one-time script outside server process lifecycle"
  - "Data anomalies (zero weight, empty farm names) migrate as-is per prior user decision — warnings emitted but no data rejected"
  - "HBT bin extraction: 504/527 tickets have HBT# pattern; notes field preserved intact alongside extracted columns"

patterns-established:
  - "Fail-fast migration pattern: verify row counts at each step, parity-test before archiving, process.exit(1) on any mismatch"
  - "Dry-run mode as first-class feature: --dry-run reports all expected outcomes without touching DB"

requirements-completed: [DB-01, DB-03]

# Metrics
duration: 2min
completed: "2026-03-02"
---

# Phase 10 Plan 01: Migration Cutover Summary

**527 grain tickets, 63 farms, and 37 crop configs migrated from JSON flat-file to PostgreSQL with HBT bin and truck ID extraction, calc.js parity verification, and atomic data.json archival**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-03-02T05:01:05Z
- **Completed:** 2026-03-02T05:03:09Z
- **Tasks:** 2
- **Files modified:** 2 created (migrate-json.js, data.json.archive)

## Accomplishments

- 527 tickets migrated with hbtBinNo (504 extracted) and truckId (508 extracted) from notes field using regex patterns
- 63 farms and 37 crop configs migrated with all numeric and string metadata fields preserved
- calc.js parity verified on 10 random tickets — JSON source and PostgreSQL results are byte-for-byte identical via JSON.stringify comparison
- data.json atomically renamed to data.json.archive; all 5 .bak files deleted
- --dry-run mode previews migration counts and sample extractions without any DB writes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migrate-json.js with full migration pipeline** - `9d8d268` (feat)
2. **Task 2: Run migration and verify data integrity** - `0037f99` (feat)

## Files Created/Modified

- `grain-tickets/migrate-json.js` - Standalone CommonJS migration script with --dry-run mode, extraction helpers, parity verification, and archive step
- `grain-tickets/data/data.json.archive` - Renamed original data.json (527 tickets, 63 farms, 37 crop configs preserved as rollback source)

## Decisions Made

- **Noon UTC anchoring:** Used `new Date(dateStr + 'T12:00:00.000Z')` for date-only strings. Plain `new Date('2025-07-22')` gives midnight UTC which shifts to July 21 in negative-offset timezones. Noon UTC is stable across all zones.
- **Standalone PrismaClient:** Script creates its own `new PrismaClient()` rather than importing `lib/db.js` singleton. The singleton pattern exists to prevent hot-reload connection churn in the server process — the migration script is a one-shot process with its own lifetime.
- **Migrate-as-is for anomalies:** Data anomalies (zero weight tickets, empty farm names) are logged as warnings but migrated unchanged. Rejecting or transforming bad historical data was explicitly out of scope per plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The migration completed on first run without errors. All row counts matched exactly, calc.js parity passed 10/10, and the archive step completed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 527 tickets are in PostgreSQL and queryable via Prisma
- hbtBinNo and truckId are first-class columns ready for Phase 11 buyer/ticket UI
- Farms and CropConfigs are normalized and indexed
- server.js still reads from data.json (which no longer exists) — Phase 11 will wire server.js to PostgreSQL queries
- Blocker: grain-tickets server.js will crash on startup now that data.json is archived — Phase 11 must update server routes to use Prisma before the server can be used again

---
*Phase: 10-migration-cutover*
*Completed: 2026-03-02*
