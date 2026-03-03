---
phase: 15-foundation-fixes-ecosystem-client-layer
plan: 01
subsystem: database
tags: [prisma, postgresql, organic-cert, migration, partial-index, typescript]

# Dependency graph
requires: []
provides:
  - "Crash-safe handleSyncRegistry using data.unchanged (not data.unmatched)"
  - "Field history API returns all enterprises without year truncation"
  - "Partial unique index on FieldEnterprise(fieldId, cropYear, crop) WHERE label IS NULL"
  - "Prisma migration baseline with init and partial index migration"
affects:
  - "16-field-enterprise-compile"
  - "17-input-seed-nop"
  - "18-rotation-harvest-pdf"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prisma migrate resolve --applied for baselining existing databases without migrations"
    - "Raw SQL partial index in Prisma migration file for NULL uniqueness enforcement"

key-files:
  created:
    - "organic-cert/prisma/migrations/20260303025441_init/migration.sql"
    - "organic-cert/prisma/migrations/20260303025533_add_partial_unique_enterprise_label_null/migration.sql"
  modified:
    - "organic-cert/src/app/(app)/fields/page.tsx"
    - "organic-cert/src/app/api/fields/[id]/history/route.ts"

key-decisions:
  - "Prisma baseline approach: migrate diff --from-empty generates init SQL, migrate resolve --applied marks it without touching DB"
  - "Partial index created as raw SQL in migration (Prisma schema.prisma syntax does not support partial indexes)"
  - "FIX-01 was a pre-existing bug (data.unmatched in handleSyncRegistry vs sync-registry response returning data.unchanged)"
  - "FIX-02 removal of cropYear filter returns all enterprise years — UI enterprisesByYear useMemo correctly groups all returned data"

patterns-established:
  - "Partial unique index pattern: supplement @@unique with raw SQL WHERE clause for NULL column enforcement"
  - "Prisma migration baselining: diff --from-empty + resolve --applied for existing databases"

requirements-completed:
  - FIX-01
  - FIX-02
  - FIX-03

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 15 Plan 01: Foundation Fixes Summary

**Three blocking organic-cert bugs fixed: sync-registry crash on data.unmatched, enterprise history truncation at 3-year window, and missing partial unique index for null-label FieldEnterprise rows**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-03T02:51:34Z
- **Completed:** 2026-03-03T02:56:36Z
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 migration)

## Accomplishments
- FIX-01: handleSyncRegistry now uses `data.unchanged?.length ?? 0` in up-to-date toast — eliminates crash from referencing `data.unmatched` which does not exist in sync-registry response
- FIX-02: Removed `where: { cropYear: { in: years } }` from `/api/fields/[id]/history` enterprises include — all years returned, no silent 3-year truncation
- FIX-03: Baselined Prisma migrations from existing deployed schema and created raw SQL migration adding partial unique index `FieldEnterprise_no_label_unique` — verified in database

## Task Commits

Each task was committed atomically in the organic-cert repo:

1. **Task 1: Fix FIX-01 and FIX-02** - `4336ec6` (fix)
2. **Task 2: Fix FIX-03 — partial unique index migration** - `4cb2f7b` (feat)

## Files Created/Modified
- `organic-cert/src/app/(app)/fields/page.tsx` - FIX-01: handleSyncRegistry uses data.unchanged, updated else-branch toast message
- `organic-cert/src/app/api/fields/[id]/history/route.ts` - FIX-02: removed cropYear enterprise filter, all enterprises returned
- `organic-cert/prisma/migrations/20260303025441_init/migration.sql` - Baseline migration generated from full schema (957 lines)
- `organic-cert/prisma/migrations/20260303025533_add_partial_unique_enterprise_label_null/migration.sql` - Partial index CREATE UNIQUE INDEX WHERE label IS NULL

## Decisions Made
- Prisma baselining approach: `npx prisma migrate diff --from-empty` generates clean SQL, `migrate resolve --applied` marks it without touching DB
- Partial index created as raw SQL (Prisma schema.prisma does not support partial index syntax)
- Init migration SQL needed `2>/dev/null` redirect to strip Prisma log output that was polluting the SQL file
- Used `prisma migrate deploy` (not `dev`) to apply partial index migration — avoids shadow DB drift errors on baselining flow

## Deviations from Plan

None — plan executed exactly as written. The Prisma baselining flow required slightly more steps than the plan anticipated (Prisma CLI wrote log output into SQL file requiring regeneration), but all actions stayed within the planned scope.

## Issues Encountered
- `npx prisma migrate diff ... --script` wrote Prisma config log output to stdout alongside SQL — fixed by redirecting stderr (`2>/dev/null`) and regenerating
- `prisma migrate dev --create-only` failed on shadow DB after init was modified — switched to creating migration directory/SQL manually then using `migrate deploy`
- `organic-cert/` is a nested git repo (has own `.git`) — committed Task 1 and Task 2 in the organic-cert repo, not the root project repo

## User Setup Required

None — no external service configuration required. Prisma migration applied directly to the development database.

## Next Phase Readiness
- FIX-01/02/03 complete — v3.0 compilation engine prerequisites satisfied
- Sync Acres on Fields page will no longer crash when all fields are already up to date
- Field history returns full enterprise data for all years (no 3-year cap)
- FieldEnterprise null-label uniqueness enforced at DB level
- Ready to proceed to Phase 15 Plan 02 (ecosystem client layer)

## Self-Check: PASSED

- FOUND: organic-cert/src/app/(app)/fields/page.tsx
- FOUND: organic-cert/src/app/api/fields/[id]/history/route.ts
- FOUND: organic-cert/prisma/migrations/20260303025441_init/migration.sql
- FOUND: organic-cert/prisma/migrations/20260303025533_add_partial_unique_enterprise_label_null/migration.sql
- FOUND commit: 4336ec6 (Task 1 — FIX-01 + FIX-02)
- FOUND commit: 4cb2f7b (Task 2 — FIX-03)

---
*Phase: 15-foundation-fixes-ecosystem-client-layer*
*Completed: 2026-03-03*
