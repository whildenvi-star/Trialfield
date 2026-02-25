---
phase: 02-field-records-history
plan: 01
subsystem: api
tags: [prisma, postgresql, nextjs, api-routes, croplot, field-history, datasource]

# Dependency graph
requires:
  - phase: 01-case-ih-api-integration
    provides: SyncedOperation approval flow (staged-ops route) and FieldOperation/HarvestEvent schema models to extend with DataSource
provides:
  - DataSource enum (MANUAL/SYNCED) on FieldOperation and HarvestEvent models
  - GET /api/fields/[id]/history — 3-year field operation history endpoint
  - GET /api/fields — upgraded with lastActivityDate and totalRecords per field
  - POST /api/admin/staged-ops/[id] — now tags approved records with dataSource SYNCED
  - POST /api/field-enterprises/[id]/harvest — now auto-creates CropLot with generated lot number
affects: [03-inspection-report-generation, field-history-ui, field-index-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Prisma db push (no migration history) — schema evolves via db push in dev
    - _count select pattern for efficient record counting without loading all rows
    - Lot number suffix collision handling via count + try/catch for race condition safety
    - Explicit dataSource annotation on all creates to document provenance intent

key-files:
  created:
    - organic-cert/src/app/api/fields/[id]/history/route.ts
  modified:
    - organic-cert/prisma/schema.prisma
    - organic-cert/src/app/api/fields/route.ts
    - organic-cert/src/app/api/admin/staged-ops/[id]/route.ts
    - organic-cert/src/app/api/field-enterprises/[id]/harvest/route.ts

key-decisions:
  - "db push used instead of migrate dev — no migration history existed; db push syncs schema without requiring baseline"
  - "CropLot lot number collision: count existing CropLots for enterprise, suffix -N for N > 0 harvests (e.g., 2025-CORN-KOPP-2)"
  - "Explicit dataSource: MANUAL on manual harvest creates — documents intent even though MANUAL is the default"
  - "History endpoint uses farmId tenant isolation via where: { id, farmId } — matches auth pattern from staged-ops"

patterns-established:
  - "Tenant isolation pattern: all findUnique/findFirst queries include farmId from session.user in where clause"
  - "Activity stats pattern: Prisma _count with select for counting child records, then JS reduce for cross-enterprise totals"
  - "CropLot auto-creation pattern: create harvest event first, then load enterprise+field, generate lot number, create lot in same request"

requirements-completed: [FIELD-01, FIELD-02, FIELD-03, FIELD-04, FIELD-06]

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 2 Plan 01: Field Records & History — Data Layer Summary

**DataSource enum added to schema, field history API created, field index upgraded with activity stats, CropLot auto-creation added to harvest POST, and staged-ops approval now tags records as SYNCED**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T23:13:32Z
- **Completed:** 2026-02-24T23:17:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `DataSource { MANUAL SYNCED }` enum to Prisma schema and applied via `db push`; both `FieldOperation` and `HarvestEvent` now carry `dataSource @default(MANUAL)`
- Created `GET /api/fields/[id]/history` with 3-year windowed query (parameterized by `offset`), auth guard, farmId tenant isolation, and full enterprise includes (operations, material usages, harvest events, fertility events)
- Upgraded `GET /api/fields` with Prisma `_count` for efficient activity stats per enterprise, computing `lastActivityDate` and `totalRecords` for each field in the list response
- Patched staged-ops approval to set `dataSource: "SYNCED"` on both `harvestEvent.create` and `fieldOperation.create` so synced-vs-manual distinction is captured going forward
- Added CropLot auto-creation to harvest POST: generates lot number from `generateLotNumber(cropYear, crop, fieldName)`, handles multi-harvest suffixing (-2, -3), race-condition-safe via try/catch unique constraint retry

## Task Commits

Each task was committed atomically (commits in organic-cert repo):

1. **Task 1: Add DataSource enum to schema and run migration** - `da97cdf` (feat)
2. **Task 2: Create history API route, upgrade field index API, and update staged-ops approval** - `6ab88aa` (feat)
3. **Task 3: Add CropLot auto-creation to harvest POST route** - `f1966e6` (feat)

## Files Created/Modified

- `organic-cert/prisma/schema.prisma` — Added `enum DataSource { MANUAL SYNCED }` and `dataSource DataSource @default(MANUAL)` field on `FieldOperation` and `HarvestEvent`
- `organic-cert/src/app/api/fields/[id]/history/route.ts` — New: GET handler returning 3-year field history with all operation sub-types, auth, and tenant isolation
- `organic-cert/src/app/api/fields/route.ts` — Extended GET to include enterprise `_count`, compute `lastActivityDate` and `totalRecords` per field
- `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts` — Added `dataSource: "SYNCED"` to both `harvestEvent.create` and `fieldOperation.create` in approve branch
- `organic-cert/src/app/api/field-enterprises/[id]/harvest/route.ts` — Extended POST with CropLot auto-creation, lot number generation, suffix collision handling, and explicit `dataSource: "MANUAL"`

## Decisions Made

- **db push over migrate dev:** No migration history existed in the database — `prisma migrate dev` detected drift and required reset. Used `db push` to sync the new DataSource enum and fields without data loss.
- **CropLot lot suffix strategy:** First harvest on an enterprise uses the base lot number (`2025-CORN-KOPP`); subsequent harvests increment a suffix (`-2`, `-3`, etc.) by counting existing CropLots before each create.
- **Explicit MANUAL annotation:** Even though `MANUAL` is the Prisma default, explicitly writing `dataSource: "MANUAL"` in harvest POST makes the provenance intent self-documenting and mirrors the pattern used in staged-ops.
- **Tenant isolation via farmId in where clause:** History endpoint uses `where: { id, farmId: session.user.farmId }` rather than loading then checking — matches the auth pattern established in Phase 1 staged-ops.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **db push required:** Plan specified `prisma migrate dev --name add-datasource-field` but the database was initialized via `db push` (no migrations folder/history). `migrate dev` detected full schema drift and would have required a destructive reset. Applied via `db push` instead — equivalent outcome, no data lost. Documented in decisions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DataSource tracking is live — all new records distinguish MANUAL vs SYNCED provenance
- History API endpoint is ready for field timeline UI (Phase 2 Plan 02)
- Field index API ready for enhanced field list view with activity stats
- CropLot auto-creation satisfies FIELD-06; downstream storage chain is fully traceable from harvest
- No blockers for Phase 2 Plan 02 (field history UI)

---
*Phase: 02-field-records-history*
*Completed: 2026-02-24*
