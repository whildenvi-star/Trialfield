---
phase: 51-fsa-insurance-data-consolidation
plan: 01
subsystem: database
tags: [supabase, migration, fsa, typescript, tsx, json]

# Dependency graph
requires:
  - phase: 27-fsa-data-foundation
    provides: clu_records + insurance_pricing + insurance_policies tables in Supabase
  - phase: 49-canonical-field-ids
    provides: registryFieldId field on CLU records (preserved in migration)
provides:
  - Definitive one-time FSA migration script with pre-flight dedup detection and post-migration spot-check verification
  - GCS enrollment feature fully removed from fsa-acres (UI + API + JS file)
affects:
  - 51-02 (fsa-acres Supabase rewire — depends on confirmed data being in Supabase)
  - 51-03 (RMA price scraper — reads from insurance_pricing migrated here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-flight duplicate detection before any DB writes — detect, report, prompt/force"
    - "Batch upsert in chunks of 500 via legacy_id conflict key"
    - "Spot-check verification: 15 evenly-spaced records compared field-by-field after migration"
    - "Rename source file to .migrated after verified migration (not delete)"

key-files:
  created:
    - glomalin-portal/scripts/migrate-fsa-final.ts
  modified:
    - fsa-acres/server.js
    - fsa-acres/public/index.html
  deleted:
    - fsa-acres/public/gcs.js

key-decisions:
  - "GCS enrollments intentionally skipped in migration — program discontinued, not migrated to Supabase"
  - "ins_482 flagged as potentially corrupt in notes field (no farm/crop, actual=40000)"
  - "Duplicate detection key for CLU records: farmNumber+tractNumber+clu+crop composite"
  - "data.json renamed to data.json.migrated after verified migration (read-only backup, not deleted)"
  - "Claims skipped in migration — Phase 31 claims schema is incompatible with legacy format"
  - "gcs.js was untracked in git — clean removal with no git history to worry about"

patterns-established:
  - "Migration scripts: dry-run flag + force flag + pre-flight dedup + post-write verification = safe one-time migrations"

requirements-completed: [CONS-05]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 51 Plan 01: FSA Migration Script + GCS Removal Summary

**One-time FSA data migration script (444 CLU + 22 pricing + 3 policies → Supabase) with pre-flight duplicate detection, post-write spot-check verification, and complete removal of discontinued GCS enrollment feature from fsa-acres**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T12:04:41Z
- **Completed:** 2026-03-25T12:08:29Z
- **Tasks:** 2
- **Files modified:** 3 (+ 1 created, 1 deleted)

## Accomplishments
- Created `migrate-fsa-final.ts` (585 lines): reads fsa-acres/data/data.json, runs duplicate detection on composite keys before any writes, batch-upserts to Supabase in 500-record chunks, verifies row counts and spot-checks 15 random records, renames source file to data.json.migrated on success
- GCS enrollment feature completely removed: deleted gcs.js (151 lines), removed GCS tab/section from index.html, removed 5 GCS API routes from server.js
- Dry-run mode shows correct counts: 444 CLU, 22 pricing, 3 insurance, 0 GCS (skipped)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create enhanced migration script with duplicate detection and verification** - `f880a4f` (feat)
2. **Task 2: Remove GCS enrollment feature from fsa-acres** - `3569b77` (feat)

**Plan metadata:** (to follow — docs commit)

## Files Created/Modified
- `glomalin-portal/scripts/migrate-fsa-final.ts` - Definitive one-time FSA migration script; run: `cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts`
- `fsa-acres/server.js` - Removed GCS default store field, 5 GCS API routes, GCS from startup log
- `fsa-acres/public/index.html` - Removed GCS tab button, GCS section (lines 335-369), gcs.js script tag
- `fsa-acres/public/gcs.js` - DELETED (151 lines, program discontinued)

## Decisions Made
- GCS enrollments skipped in migration — program discontinued per user decision; not migrated to Supabase
- ins_482 record flagged as potentially corrupt in notes field (no farm/crop, actual=40000) — same pattern as existing migrate-fsa.ts
- Claims skipped in migration — Phase 31 claims schema (claim_stage enum) is incompatible with legacy format
- Pre-flight duplicate detection: one duplicate policy found (ins_478 and ins_482 both have empty policyNumber/farmNumber/crop); upsert-by-legacy_id handles this correctly since both records have distinct IDs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

Run the migration when ready:
```bash
cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts --dry-run  # preview
cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts             # execute
```

## Next Phase Readiness
- Migration script ready to run against production Supabase when desired
- GCS removal complete — no regressions in other fsa-acres tabs
- Phase 51-02 (fsa-acres Supabase rewire) can proceed: script confirms all records will land correctly

## Self-Check: PASSED

- migrate-fsa-final.ts: FOUND
- 51-01-SUMMARY.md: FOUND
- f880a4f (Task 1 commit): FOUND
- 3569b77 (Task 2 commit): FOUND

---
*Phase: 51-fsa-insurance-data-consolidation*
*Completed: 2026-03-25*
