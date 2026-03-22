---
phase: 07-all-enterprise-sync
plan: 01
subsystem: database
tags: [prisma, postgresql, sync, enterprise, organic, conventional]

# Dependency graph
requires:
  - phase: 06.1-phase-6-defect-fixes
    provides: stable actuals-entry foundation; auth guard, seed $/ac formula, category alignment
provides:
  - EnterpriseType enum (ORGANIC, CONVENTIONAL) in Prisma schema with @default(ORGANIC)
  - FieldEnterprise.enterpriseType field — registry-derived type classification
  - Updated @@unique([fieldId, cropYear, crop, label, enterpriseType]) — prevents match key collision
  - sync-macro route that processes ALL budget enterprises (not organic-only)
  - Type-aware upsert: enterpriseType in findFirst where clause and create data
affects:
  - 07-all-enterprise-sync (subsequent plans for UI changes showing conventional enterprises)
  - any plan querying FieldEnterprise with enterprise type filtering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-derived type flag: enterpriseType comes from matchedField.organicStatus, NOT the budget enterprise category field"
    - "Additive enum with default: EnterpriseType @default(ORGANIC) preserves all existing records without backfill"
    - "Type-aware match key: findFirst includes enterpriseType to prevent collision between same crop on same field for different types"

key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/app/api/fields/sync-macro/route.ts

key-decisions:
  - "enterpriseType derived from matchedField.organicStatus (registry source of truth), not budget enterprise category — a conventional enterprise can contain organic-certified fields"
  - "EnterpriseType @default(ORGANIC) avoids backfill migration — all existing FieldEnterprise records are organic"
  - "@@unique extended to include enterpriseType — resolves STATE.md flagged blocker about match key collision"
  - "organicStatus on create set to match enterpriseType — consistent dual-field state for records created by sync"

patterns-established:
  - "Type-aware upsert: always include enterpriseType in findFirst where clause to avoid cross-type collisions"
  - "Registry as source of truth for organic status: never trust budget service category for certifiability decisions"

requirements-completed: [SYNC-01, SYNC-02]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 7 Plan 01: All-Enterprise Sync Summary

**EnterpriseType enum added to Prisma schema and sync-macro expanded to pull all 7 enterprises using registry-derived organic status for type classification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T15:36:20Z
- **Completed:** 2026-03-21T15:38:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `EnterpriseType` enum (ORGANIC, CONVENTIONAL) to `schema.prisma` with `@default(ORGANIC)` so existing records are preserved without backfill
- Updated `FieldEnterprise.@@unique` to include `enterpriseType` — resolves the match key collision blocker logged in STATE.md
- Removed the organic-only enterprise filter from sync-macro; now iterates all fields from farm-budget
- Added `organicStatus` to the local field select and derive `enterpriseType` from `matchedField.organicStatus` (registry source of truth)
- Added `enterpriseType` to both `findFirst` where clause and `create` data for type-aware, idempotent upserts
- `prisma db push` applied schema to database and Prisma client regenerated; TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EnterpriseType enum and update FieldEnterprise unique constraint** - `9fe9f88` (feat)
2. **Task 2: Expand sync-macro to process all enterprises with type-aware upsert** - `8dd9758` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `prisma/schema.prisma` - Added `EnterpriseType` enum, `enterpriseType` field on `FieldEnterprise`, updated `@@unique` constraint
- `src/app/api/fields/sync-macro/route.ts` - Removed organic filter, added `organicStatus` to field select, derive `enterpriseType` from registry, type-aware `findFirst` and `create`

## Decisions Made

- `enterpriseType` derived from `matchedField.organicStatus` (registry source of truth), not budget enterprise `category` — a conventional enterprise like "Conv/Org Canning" can contain organic-certified fields
- `EnterpriseType @default(ORGANIC)` avoids a backfill migration; all existing FieldEnterprise records are from the previous organic-only sync
- `@@unique` extended to include `enterpriseType`; this was a blocker tracked in STATE.md — resolves it
- `organicStatus` on create set to match `enterpriseType` to keep both fields consistent (both present for historical reasons; `enterpriseType` is the canonical type field going forward)

## Deviations from Plan

None - plan executed exactly as written.

The one deviation worth noting: `prisma db push` emitted a data-loss warning about adding the new unique constraint. This was expected and safe — all existing records have `enterpriseType=ORGANIC` (the default), so no duplicates exist. Used `--accept-data-loss` flag to proceed.

## Issues Encountered

None — schema validation, `db push`, `prisma generate`, and `tsc --noEmit` all passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Database foundation is in place: `EnterpriseType` enum, `enterpriseType` field, updated unique constraint
- sync-macro will now create FieldEnterprise records for ALL 56 fields across 7 enterprises on next sync run
- Existing organic actuals data (actualYieldPerAcre, SeedUsage.actualPricePerUnit, MaterialUsage.actualTotalCost) is untouched — update path does not modify actuals fields
- Ready for subsequent Phase 7 plans: UI changes to display conventional enterprises in the budget view

## Self-Check: PASSED

- FOUND: prisma/schema.prisma
- FOUND: src/app/api/fields/sync-macro/route.ts
- FOUND: .planning/phases/07-all-enterprise-sync/07-01-SUMMARY.md
- Commit 9fe9f88 verified in git log
- Commit 8dd9758 verified in git log

---
*Phase: 07-all-enterprise-sync*
*Completed: 2026-03-21*
