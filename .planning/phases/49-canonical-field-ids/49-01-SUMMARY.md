---
phase: 49-canonical-field-ids
plan: 01
subsystem: database
tags: [farm-registry, fsa-acres, farm-budget, supabase, field-ids, cross-app]

# Dependency graph
requires: []
provides:
  - registryFieldId field in farm-budget field updatable array (PUT /api/fields/:id)
  - registryFieldId accepted in fsa-acres CLU POST and PUT handlers via Object.assign
  - registry_field_id column on portal clu_records via migration 004
  - registry_field_id in portal clu-records ALLOWED_FIELDS (POST endpoint)
  - /api/fields/autocomplete endpoint on farm-registry (all active fields, filterable by ?q=)
  - grain-tickets Farm.registryId confirmed as canonical field ID linkage (no change needed)
affects: [49-02, 49-03, 50, 51, 52, 53, 54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "registry_field_id is null on existing records until backfill runs — no migration data needed"
    - "No FK constraint for cross-app registry IDs — farm-registry is a separate Express app"
    - "Autocomplete endpoint placed before :id param route to prevent Express shadowing"

key-files:
  created:
    - glomalin-portal/supabase/migrations/004-add-registry-field-id.sql
  modified:
    - farm-budget/server.js
    - fsa-acres/server.js
    - glomalin-portal/src/app/api/fsa/clu-records/route.ts
    - farm-registry/server.js

key-decisions:
  - "Migration numbered 004 (not 003) because 003-field-observations.sql already exists"
  - "fsa-acres CLU handlers use Object.assign without allowlist — registryFieldId accepted implicitly, documented with comments"
  - "grain-tickets Farm.registryId is the existing equivalent of registryFieldId — no schema change needed"
  - "Autocomplete returns all active fields with no result limit (56 fields — pagination unnecessary)"

patterns-established:
  - "Canonical field ID pattern: registryFieldId (JSON apps), registry_field_id (Supabase), registryId (grain-tickets Prisma)"

requirements-completed:
  - CONS-06

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 49 Plan 01: Canonical Field IDs Schema Foundation Summary

**Registry field ID schema added to all 4 apps: farm-budget updatable array, fsa-acres CLU handlers, portal Supabase migration, and farm-registry autocomplete endpoint for dropdown population**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T23:36:37Z
- **Completed:** 2026-03-24T23:46:00Z
- **Tasks:** 3
- **Files modified:** 4 modified, 1 created

## Accomplishments

- farm-budget now accepts `registryFieldId` on field update (added to updatable array in PUT /api/fields/:id)
- fsa-acres CLU records accept `registryFieldId` on create and update (documented via comments on Object.assign handlers)
- Portal `clu_records` table has `registry_field_id` column via migration 004, accepted by POST endpoint ALLOWED_FIELDS
- farm-registry exposes `/api/fields/autocomplete` returning all active fields with id, name, aliases — enables dropdown field selection across apps
- grain-tickets `Farm.registryId String?` confirmed as the existing canonical field ID linkage (no changes needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add registry_field_id to farm-budget and fsa-acres data models** - `b6f1861` (feat)
2. **Task 2: Add registry_field_id to portal clu_records and confirm grain-tickets schema** - `501c274` (feat)
3. **Task 3: Add farm-registry autocomplete endpoint for field selection** - `38f017e` (feat)

## Files Created/Modified

- `farm-budget/server.js` - Added `registryFieldId` to updatable fields array in PUT /api/fields/:id handler
- `fsa-acres/server.js` - Added comments documenting registryFieldId acceptance in CLU POST and PUT handlers
- `glomalin-portal/supabase/migrations/004-add-registry-field-id.sql` - ALTER TABLE adds registry_field_id column with index
- `glomalin-portal/src/app/api/fsa/clu-records/route.ts` - Added `registry_field_id` to ALLOWED_FIELDS Set
- `farm-registry/server.js` - Added GET /api/fields/autocomplete endpoint before :id param route

## Decisions Made

- Migration numbered 004 not 003 — `003-field-observations.sql` already exists. Deviation from plan spec but correct approach.
- fsa-acres CLU handlers already use `Object.assign` without an allowlist — registryFieldId is implicitly accepted. Added comments to make the pattern explicit rather than adding a separate allowlist.
- grain-tickets `Farm.registryId` is already the correct equivalent linkage field — schema confirmed, no change needed.
- Autocomplete returns all active fields without a result cap (56 fields total, pagination would add unnecessary complexity).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Naming] Migration file numbered 004 instead of 003**
- **Found during:** Task 2 (portal migration creation)
- **Issue:** Plan specified `003-add-registry-field-id.sql` but `003-field-observations.sql` already exists in the migrations directory
- **Fix:** Created `004-add-registry-field-id.sql` to avoid overwriting existing migration
- **Files modified:** glomalin-portal/supabase/migrations/004-add-registry-field-id.sql
- **Verification:** Migration file exists with correct ALTER TABLE statement
- **Committed in:** 501c274 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (naming conflict)
**Impact on plan:** Correct behavior — migration still applies registry_field_id column. No functional change to outcome.

## Issues Encountered

None.

## User Setup Required

The portal Supabase migration `004-add-registry-field-id.sql` must be applied to the Supabase database. Run via Supabase CLI:
```
supabase db push
```
Or apply manually in the Supabase SQL editor.

## Next Phase Readiness

- All apps now accept registry field IDs — schema foundation complete
- Ready for Phase 49 Plan 02: backfill scripts to populate registryFieldId from name-matching
- farm-registry autocomplete endpoint ready for dropdown UI integration

---
*Phase: 49-canonical-field-ids*
*Completed: 2026-03-24*

## Self-Check: PASSED

- farm-budget/server.js: FOUND (registryFieldId in updatable array)
- fsa-acres/server.js: FOUND (registryFieldId documented in CLU handlers)
- 004-add-registry-field-id.sql: FOUND (ALTER TABLE with index)
- clu-records/route.ts: FOUND (registry_field_id in ALLOWED_FIELDS)
- farm-registry/server.js: FOUND (/api/fields/autocomplete endpoint)
- 49-01-SUMMARY.md: FOUND
- Commit b6f1861: FOUND (Task 1)
- Commit 501c274: FOUND (Task 2)
- Commit 38f017e: FOUND (Task 3)
