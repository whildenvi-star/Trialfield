---
phase: 50-canonical-crop-registry
plan: 02
subsystem: data-migration
tags: [backfill, crop-ids, farm-budget, grain-tickets, fsa-acres, glomalin-portal, canonical-data]

# Dependency graph
requires:
  - phase: 50-01
    provides: 38 canonical crop records with aliases in farm-registry /api/crops
provides:
  - farm-budget/backfill-crop-ids.js — matches fields[].crop and cropTypes[].subCrops[].name
  - fsa-acres/backfill-crop-ids.js — matches cluRecords[].crop with FSA non-crop category detection
  - grain-tickets/backfill-crop-ids.js — matches CropConfig.cropName, batch-updates Ticket.registryCropId
  - glomalin-portal/scripts/backfill-crop-ids.ts — matches clu_records.crop via Supabase service role
  - grain-tickets/prisma/schema.prisma — registryCropId String? on CropConfig and Ticket models
  - glomalin-portal/supabase/migrations/005-add-registry-crop-id.sql — registry_crop_id column on clu_records
affects:
  - 50-03 (consumer switchover can reference registryCropId after these backfills are run)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - self-contained backfill scripts — normalize+alias matching logic duplicated per app for independent runability
    - dry-run default, --commit flag to write changes
    - idempotent — skip records that already have registryCropId
    - backfill-crop-report.json written per app for audit trail
    - grain-tickets: Ticket.registryCropId bulk-updated by CropConfig.cropName match (not per-ticket lookup)
    - fsa-acres: non-crop FSA categories (NC, idle, gls) detected and flagged separately from real unmatched crops
    - portal: Supabase service role bypasses RLS, batched in groups of 50

key-files:
  created:
    - farm-budget/backfill-crop-ids.js
    - fsa-acres/backfill-crop-ids.js
    - grain-tickets/backfill-crop-ids.js
    - glomalin-portal/scripts/backfill-crop-ids.ts
    - glomalin-portal/supabase/migrations/005-add-registry-crop-id.sql
  modified:
    - grain-tickets/prisma/schema.prisma

key-decisions:
  - "farm-budget matches fields[].crop and cropTypes[].subCrops[].name — enterprises use cropTypeNames (category names like Corn/Soybeans) not individual crop strings, so enterprises are not targeted for crop ID backfill"
  - "fsa-acres FSA non-crop categories (NC, idle, gls, MIXED FORAGE/HAY) are detected and reported separately — expected to be unmatched, not errors"
  - "grain-tickets Ticket records updated in bulk by matching on crop string (same name used in CropConfig) — avoids per-ticket lookup round-trips"
  - "Prisma schema adds registryCropId to both CropConfig and Ticket; requires npx prisma db push before --commit"
  - "Portal migration 005 uses ADD COLUMN IF NOT EXISTS — safe to run repeatedly"

patterns-established:
  - "Crop backfill scripts follow same normalize+alias pattern as Phase 49 field backfill scripts"
  - "Non-crop FSA category detection prevents false-positive unmatched counts"
  - "Per-app backfill-crop-report.json for audit and coverage tracking"

requirements-completed: [CONS-11]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 50 Plan 02: Crop ID Backfill Scripts Summary

**4 self-contained backfill scripts — one per app — matching crop name strings to canonical registry crop IDs via alias lookup with dry-run/commit mode and per-app coverage reports**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T02:38:47Z
- **Completed:** 2026-03-25T02:43:02Z
- **Tasks:** 2
- **Files modified/created:** 6

## Accomplishments
- 4 backfill scripts covering all apps with crop data: farm-budget, fsa-acres, grain-tickets, glomalin-portal
- Each script: normalizes crop name strings, looks up aliases from /api/crops, reports matched/unmatched/skipped with full detail
- farm-budget script targets two sections: fields[].crop (field-level crop assignments) and cropTypes[].subCrops[].name (pricing config table)
- fsa-acres script intelligently detects non-crop FSA categories (NC, idle, gls, MIXED FORAGE/HAY) and reports them separately from genuinely unmatched crops
- grain-tickets script updates both CropConfig.registryCropId (by name) and Ticket.registryCropId (bulk update by crop name string)
- Prisma schema updated with registryCropId String? on both CropConfig and Ticket models, with index on Ticket for aggregation queries
- Supabase migration 005 adds registry_crop_id TEXT column with index to clu_records

## Task Commits

Each task was committed atomically:

1. **Task 1: Create farm-budget and fsa-acres crop ID backfill scripts** - `759a6e8` (feat)
2. **Task 2: Create grain-tickets and portal crop ID backfill scripts** - `b479131` (feat)

## Files Created/Modified
- `farm-budget/backfill-crop-ids.js` - Backfill fields[].crop and cropTypes[].subCrops[].name
- `fsa-acres/backfill-crop-ids.js` - Backfill cluRecords[].crop with FSA non-crop detection
- `grain-tickets/backfill-crop-ids.js` - Match CropConfig.cropName, bulk-update Ticket.registryCropId
- `grain-tickets/prisma/schema.prisma` - Added registryCropId String? to CropConfig and Ticket
- `glomalin-portal/scripts/backfill-crop-ids.ts` - Match clu_records.crop via Supabase service role
- `glomalin-portal/supabase/migrations/005-add-registry-crop-id.sql` - ADD COLUMN registry_crop_id TEXT

## Decisions Made
- farm-budget enterprises use `cropTypeNames` arrays (category names like "Corn", "Soybeans") rather than individual crop name strings, so enterprise records are not targeted for crop ID backfill. Only fields[].crop and cropTypes[].subCrops[].name contain matchable crop strings.
- fsa-acres has many non-crop FSA land-use codes (NC = non-crop, idle, gls = grass, MIXED FORAGE/HAY). These are expected to not match any registry crop and are flagged as "expected unmatched" to keep the unmatched count meaningful.
- grain-tickets Ticket records are bulk-updated using `updateMany` on the crop name string — more efficient than per-ticket lookup and correct since all tickets with the same crop name get the same registryCropId.
- Supabase migration uses `ADD COLUMN IF NOT EXISTS` for safety and `CREATE INDEX IF NOT EXISTS` for idempotency.

## User Setup Required (before --commit)
- grain-tickets: Run `npx prisma db push` in grain-tickets/ to apply schema changes
- glomalin-portal: Run migration 005-add-registry-crop-id.sql in Supabase dashboard or via `supabase db push`

## Deviations from Plan

None — plan executed exactly as written. One clarification resolved: farm-budget enterprises use `cropTypeNames` (not a `.crop` field), so the script targets `fields[].crop` and `cropTypes[].subCrops[].name` instead.

---
*Phase: 50-canonical-crop-registry*
*Completed: 2026-03-25*
