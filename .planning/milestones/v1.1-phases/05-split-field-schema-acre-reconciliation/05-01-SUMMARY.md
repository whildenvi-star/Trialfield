---
phase: 05-split-field-schema-acre-reconciliation
plan: 01
subsystem: database
tags: [prisma, postgresql, schema, split-field, fallow]

# Dependency graph
requires:
  - phase: 04-synced-harvest-croplot-wiring
    provides: "FieldEnterprise with CropLot wiring and report-assembler pipeline"
provides:
  - "FieldEnterprise model with label, isFallow, fallowCostAmount, fallowCostCategory fields"
  - "Composite unique constraint @@unique([fieldId, cropYear, crop, label])"
  - "Partial unique index FieldEnterprise_no_label_unique (WHERE label IS NULL)"
  - "Regenerated Prisma client with new fields"
  - "Forward-compatible EnterpriseWithOperations type in report-assembler"
affects: [phase-06-split-field-ui, phase-07-pdf-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Null-label pattern for single-enterprise backward compatibility (label IS NULL = legacy record)"
    - "Partial unique index for PostgreSQL NULL uniqueness enforcement alongside composite unique constraint"
    - "isFallow boolean over enum for binary fallow distinction (simpler, Claude discretion per research)"

key-files:
  created: []
  modified:
    - "organic-cert/prisma/schema.prisma"
    - "organic-cert/src/lib/report-assembler.ts"

key-decisions:
  - "Use label String? (nullable) not a required field — single-enterprise fields keep working with label=null, no migration needed"
  - "Use isFallow Boolean @default(false) not an enum — binary distinction is sufficient, avoids enum migration complexity"
  - "Fallow enterprises store acreage in plantedAcres — keeps acre math consistent (sum of all enterprise plantedAcres = total allocated)"
  - "Partial unique index FieldEnterprise_no_label_unique needed in addition to composite @@unique — PostgreSQL treats NULL as distinct in unique constraints"
  - "No query change needed in assembleReportData — uses include (not select), so Prisma auto-includes new fields"

patterns-established:
  - "Split-field schema pattern: null label = single enterprise (legacy), non-null label = named split enterprise"
  - "Fallow tracking: isFallow=true enterprise with optional cost fields, acreage in plantedAcres"

requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 5 Plan 1: Split-Field Schema & Acre Reconciliation Summary

**FieldEnterprise schema extended with label/isFallow/fallow-cost fields, partial unique index enforcing null-label uniqueness, and forward-compatible EnterpriseWithOperations type for Phase 6-7 consumption**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T16:57:06Z
- **Completed:** 2026-02-27T17:02:00Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- Added four new fields to `FieldEnterprise`: `label String?`, `isFallow Boolean @default(false)`, `fallowCostAmount Float?`, `fallowCostCategory String?`
- Changed unique constraint from `@@unique([fieldId, cropYear, crop])` to `@@unique([fieldId, cropYear, crop, label])` enabling multiple enterprises per field per season
- Created partial unique index `FieldEnterprise_no_label_unique` (WHERE label IS NULL) to enforce single null-label enterprise per field+year+crop combination
- Applied schema to live PostgreSQL database and regenerated Prisma client
- Updated `EnterpriseWithOperations` interface and data mapping in `report-assembler.ts` for Phase 6-7 forward compatibility

## Task Commits

Each task was committed atomically in the `organic-cert` sub-repository:

1. **Task 1: Evolve FieldEnterprise schema, push to DB, apply partial index** - `1dfe3fd` (feat)
2. **Task 2: Update EnterpriseWithOperations type for forward compatibility** - `972deb0` (feat)

## Files Created/Modified

- `organic-cert/prisma/schema.prisma` - Added label, isFallow, fallowCostAmount, fallowCostCategory fields; updated @@unique constraint to include label
- `organic-cert/src/lib/report-assembler.ts` - Added label, isFallow, fallowCostAmount, fallowCostCategory to EnterpriseWithOperations interface and data mapping

## Decisions Made

- **isFallow vs enterpriseType enum:** Chose `isFallow Boolean` — binary distinction is simpler and avoids adding an enum to the schema. An enum would require more migration surface area with no practical benefit since fallow is a boolean state.
- **Fallow acreage in plantedAcres:** Fallow enterprises store their acres in `plantedAcres` (not a separate field) so acre math is consistent — summing all enterprise `plantedAcres` always gives total allocated acres regardless of enterprise type.
- **Null-label = single enterprise:** Existing records keep `label = null` with zero data changes. The partial index enforces that only one null-label enterprise can exist per `[fieldId, cropYear, crop]`, while labeled enterprises can stack freely.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Out-of-scope issues found (deferred)

A pre-existing TypeScript error was discovered in `src/app/api/fields/sync-registry/route.ts` (untracked file): `TS2554: Expected 1 arguments, but got 3` for `logAudit()` call. Not caused by schema changes. Documented in `deferred-items.md`.

## Issues Encountered

- **PostgreSQL was not running:** Stale `postmaster.pid` file prevented service startup. Resolved by removing the stale PID and starting with `pg_ctl` directly. Not a code issue.
- **`organic-cert/` is a nested git repository:** The `organic-cert/` directory has its own `.git` — commits for code changes must be made in that sub-repo, not the parent `.planning` repo. Plan metadata commits go to the parent repo.
- **`prisma db execute --stdin` not supported:** This version of Prisma (6.19.2) requires `--file` for the `db execute` command. Used a temp file instead.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Schema foundation complete — FieldEnterprise now supports multiple enterprises per field per season
- Fallow tracking fields ready for use in Phase 6 UI forms
- `EnterpriseWithOperations` type includes all new fields — Phase 6 views and Phase 7 PDF reports can consume without breaking changes
- No blockers for Phase 5 Plan 2 (acre reconciliation API)

---
*Phase: 05-split-field-schema-acre-reconciliation*
*Completed: 2026-02-27*
