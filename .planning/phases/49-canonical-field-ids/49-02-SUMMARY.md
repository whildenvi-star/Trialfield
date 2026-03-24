---
phase: 49-canonical-field-ids
plan: 02
subsystem: database
tags: [farm-registry, farm-budget, fsa-acres, grain-tickets, supabase, field-ids, backfill, cross-app]

# Dependency graph
requires:
  - phase: 49-01
    provides: "registryFieldId columns in farm-budget, fsa-acres, portal clu_records; Farm.registryId in grain-tickets; farm-registry /api/fields/autocomplete endpoint"
provides:
  - farm-budget/backfill-field-ids.js: dry-run/commit script for fields[] and rent[] arrays
  - fsa-acres/backfill-field-ids.js: dry-run/commit script for cluRecords[] array
  - grain-tickets/backfill-field-ids.js: Prisma-based dry-run/commit for Farm.registryId
  - glomalin-portal/scripts/backfill-field-ids.ts: Supabase service-role dry-run/commit for clu_records.registry_field_id
  - Per-app backfill-report.json coverage reports
  - Idempotent fix cycle: run dry-run, review report, add aliases, re-run until 100%
affects: [49-03, 50, 51, 52, 53, 54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backfill dry-run-first workflow: default dry-run shows matches, --commit writes changes"
    - "Normalize function: trim + collapse whitespace to single space + toLowerCase — applied to both record names and registry aliases"
    - "Lookup map: normalized alias string -> [{fieldId, fieldName}] array — empty array = unmatched, length 1 = match, length >1 = ambiguous"
    - "Idempotent: records with existing registryFieldId/registryId/registry_field_id skipped on every run"
    - "Supabase updates batched in groups of 50 to avoid rate limits"

key-files:
  created:
    - farm-budget/backfill-field-ids.js
    - fsa-acres/backfill-field-ids.js
    - grain-tickets/backfill-field-ids.js
    - glomalin-portal/scripts/backfill-field-ids.ts
  modified: []

key-decisions:
  - "Each script self-contained — shared normalization logic duplicated across 4 files (not a shared module) for simpler ops"
  - "grain-tickets script loads .env file manually (no dotenv dep) to get DATABASE_URL for Prisma"
  - "portal script loads .env.local then .env — prefers .env.local where Supabase credentials live"
  - "fsa-acres unmatched list deduplicates on unique field names since many CLU records share a fieldName"

patterns-established:
  - "Backfill pattern: fetch registry -> build alias map -> match records -> dry-run report -> --commit writes"
  - "Coverage report: stats to console + full results to app-dir/backfill-report.json"
  - "Fix workflow: add aliases in farm-registry, re-run backfill — no manual ID editing needed"

requirements-completed:
  - CONS-08

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 49 Plan 02: Canonical Field IDs Backfill Scripts Summary

**Four idempotent backfill scripts (one per app) mapping existing field name strings to farm-registry IDs via alias lookup, with dry-run-first workflow and per-app coverage reports**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T23:41:29Z
- **Completed:** 2026-03-24T23:44:30Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- All 4 backfill scripts created with consistent dry-run/commit pattern
- farm-budget script processes both fields[] (field.name) and rent[] (rent.fieldName) arrays
- fsa-acres script handles lowercase field names (e.g., "daun" -> fld_011 "Daun") via case-insensitive matching
- grain-tickets script uses Prisma to query Farm.registryId and update Farm records in PostgreSQL
- portal script uses Supabase service role key to bypass RLS, batches updates in groups of 50
- All scripts idempotent — skips records with existing IDs on every run
- Comprehensive coverage reports (JSON) written to each app directory for iterative fix cycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared matching logic and farm-budget + fsa-acres backfill scripts** - `d47df52` (feat)
2. **Task 2: Create grain-tickets and portal backfill scripts** - `b3b24cf` (feat)

## Files Created/Modified

- `farm-budget/backfill-field-ids.js` - Dry-run/commit backfill for fields[] and rent[] arrays; writes backfill-report.json
- `fsa-acres/backfill-field-ids.js` - Dry-run/commit backfill for cluRecords[]; deduplicates unmatched names in output
- `grain-tickets/backfill-field-ids.js` - Prisma-based backfill for Farm.registryId; loads .env manually without dotenv dep
- `glomalin-portal/scripts/backfill-field-ids.ts` - TypeScript Supabase service-role backfill for clu_records.registry_field_id; batched updates

## Decisions Made

- Scripts are self-contained — the normalize+alias matching logic is duplicated in each of the 4 scripts rather than shared via a module. This makes each script independently runnable without path dependencies.
- grain-tickets script reads .env file manually (regex line parse) to get DATABASE_URL without needing `dotenv` as a dependency.
- portal script checks `.env.local` first, then `.env`, matching Next.js env file precedence.
- fsa-acres unmatched list deduplicates by unique fieldName (many CLU records share the same fieldName string; showing duplicates in the report would be noisy).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. farm-registry unavailability during verification is expected (external service not running in dev); scripts produce clear actionable error messages.

## User Setup Required

To run the backfill scripts, farm-registry must be running:
```
cd farm-registry && npm start
```

Then from the project root:
```
# Dry-run (review matches before committing)
node farm-budget/backfill-field-ids.js
node fsa-acres/backfill-field-ids.js
node grain-tickets/backfill-field-ids.js
cd glomalin-portal && npx tsx scripts/backfill-field-ids.ts

# Commit (writes IDs to data files / databases)
node farm-budget/backfill-field-ids.js --commit
node fsa-acres/backfill-field-ids.js --commit
node grain-tickets/backfill-field-ids.js --commit
cd glomalin-portal && npx tsx scripts/backfill-field-ids.ts --commit
```

For grain-tickets: DATABASE_URL must be set in grain-tickets/.env.
For portal: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in glomalin-portal/.env.local.

## Next Phase Readiness

- All 4 backfill scripts ready to run once farm-registry is started
- Fix cycle: run dry-run -> review backfill-report.json -> add missing aliases in farm-registry -> re-run until 100% coverage
- Phase 49 Plan 03 (registry field ID UI dropdowns) can proceed in parallel with the backfill workflow

---
*Phase: 49-canonical-field-ids*
*Completed: 2026-03-24*
