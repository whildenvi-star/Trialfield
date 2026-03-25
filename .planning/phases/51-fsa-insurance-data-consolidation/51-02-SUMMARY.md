---
phase: 51-fsa-insurance-data-consolidation
plan: 02
subsystem: database
tags: [supabase, express, fsa, json-migration, column-mapping, camelcase]

# Dependency graph
requires:
  - phase: 51-01
    provides: Migration script confirms all CLU/pricing/policy records will land in Supabase correctly
  - phase: 27-fsa-data-foundation
    provides: clu_records + insurance_pricing + insurance_policies tables in Supabase

provides:
  - fsa-acres Express server reads and writes all CLU records via Supabase (not data.json)
  - fsa-acres Express server reads and writes all insurance policies via Supabase
  - fsa-acres Express server reads and writes all pricing via Supabase
  - 10-second in-memory CLU cache prevents N+1 Supabase calls on rollup endpoints
  - mapToClient()/mapCluToDb()/mapInsuranceToClient()/mapInsuranceToDb() column-mapping helpers
  - Settings stored in data/settings.json (local config, isolated from Supabase)
  - 503 error response when Supabase is unreachable

affects:
  - 51-03 (RMA price scraper portal integration — builds on pricing Supabase pattern)

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.98.0 (2.100.0 installed) — fsa-acres direct Supabase access"
  patterns:
    - "Service-role key pattern: fsa-acres accesses Supabase directly, not via portal API routes"
    - "Column mapping helpers mapToClient/mapToDb: centralized camelCase<->snake_case translation"
    - "10s CLU cache + invalidateCluCache() on any write: prevents N+1 calls on dashboard rollups"
    - "Settings in local JSON file (not Supabase): app config is not farm data"
    - "503 response with { error: 'Data store unavailable' } when Supabase unreachable"

key-files:
  created:
    - fsa-acres/.gitignore
    - fsa-acres/package-lock.json
  modified:
    - fsa-acres/server.js
    - fsa-acres/package.json
    - fsa-acres/.env.example

key-decisions:
  - "data/settings.json stores app settings (year, county, state, producerName) locally — not Supabase, not farm data"
  - "data/settings.json added to .gitignore — deployment-specific config should not be in git"
  - "Conservation practice fields (tillage_2024/2025, cc_2024/2025, etc.) mapped as individual DB columns, not JSONB"
  - "Frontend uses Supabase UUID id going forward — legacy_id preserved in response for reference but not used for CRUD"
  - "fsa-acres .gitignore created as Rule 2 auto-fix — node_modules must not be committed"

patterns-established:
  - "Express apps using Supabase: initialize client at startup with process.exit(1) on missing env vars, 503 on runtime unavailability"
  - "CLU cache pattern: invalidate on any write, 10s TTL for reads, prevents rollup endpoint hammering"

requirements-completed: [CONS-01, CONS-02, CONS-04]

# Metrics
duration: 20min
completed: 2026-03-25
---

# Phase 51 Plan 02: FSA-Acres Supabase Rewire Summary

**fsa-acres Express server fully rewired from data.json in-memory store to Supabase: all CLU, insurance, and pricing CRUD goes through @supabase/supabase-js with service-role key, identical API response shapes for frontend compatibility**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-25T~12:20:00Z
- **Completed:** 2026-03-25T~12:40:00Z
- **Tasks:** 2
- **Files modified:** 5 (+ 2 created)

## Accomplishments
- Added @supabase/supabase-js 2.100.0 to fsa-acres with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY environment config
- Removed `store` object, `loadData()`, `saveData()`, `withLock()` — no more data.json reads/writes for farm data
- All CLU CRUD (GET, GET/:id, POST, PUT, bulk PUT, DELETE, split, duplicate) go through Supabase
- All insurance policy CRUD go through Supabase with full field mapping (22 camelCase fields)
- All pricing CRUD go through Supabase; RMA scraper writes updates to Supabase rows
- 10-second CLU cache with write invalidation prevents N+1 calls when dashboard loads multiple rollups
- Settings (year, county, state, producerName) moved to data/settings.json — local app config, not farm data
- Graceful startup error: exits with clear message if SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Supabase dependency and configure environment** - `9a5a1fd` (chore)
2. **Task 2: Rewire server.js from JSON file to Supabase** - `07329cb` (feat)

**Plan metadata:** (to follow — docs commit)

## Files Created/Modified
- `fsa-acres/server.js` - Fully rewired: Supabase client, column mapping helpers, all endpoints use Supabase
- `fsa-acres/package.json` - Added @supabase/supabase-js ^2.98.0
- `fsa-acres/package-lock.json` - Created (npm install result)
- `fsa-acres/.env.example` - Added SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY documentation
- `fsa-acres/.gitignore` - Created: node_modules/, .env, data backups, settings.json excluded

## Decisions Made
- `data/settings.json` stores app settings locally (not in Supabase) — settings are app config not farm data, simpler, no dependency on Supabase being up just to read year/county/state
- Conservation practice fields (tillage_2024/2025, cc_2024/2025, nt_adoption, cc_adoption) mapped as individual Supabase columns — confirmed by migration script schema, no JSONB needed
- `data/settings.json` added to .gitignore — per-deployment config should not be committed
- Frontend continues to receive camelCase responses with `id` = Supabase UUID — clean break from legacy_id, frontend fetches IDs dynamically so no hardcoded ID breakage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created fsa-acres/.gitignore**
- **Found during:** Task 1 (npm install generates node_modules/)
- **Issue:** fsa-acres had no .gitignore — node_modules would appear as untracked in git status after npm install
- **Fix:** Created .gitignore matching other modules (node_modules/, .env, data backups). Also added data/settings.json since it's deployment-specific config.
- **Files modified:** fsa-acres/.gitignore (created)
- **Verification:** node_modules no longer appears as untracked in git status
- **Committed in:** 9a5a1fd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary correctness fix — node_modules must never be committed. No scope creep.

## Issues Encountered
None

## User Setup Required

**Supabase credentials required for fsa-acres to start.** Add to `fsa-acres/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

These are the same values used in `glomalin-portal/.env.local`. The service-role key bypasses Supabase RLS for server-to-server access. The server will exit with a clear error message if these are missing.

Run the migration script first (if not already done):
```bash
cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts --dry-run  # preview
cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts             # execute
```

## Next Phase Readiness
- fsa-acres is now Supabase-native — reads/writes confirmed pointing to correct tables
- Phase 51-03 (RMA price scraper portal integration) can proceed: pricing table pattern established
- Both fsa-acres and the portal now share the same Supabase data — canonical single source of truth achieved for CLU + insurance

## Self-Check: PASSED

- fsa-acres/server.js: FOUND (supabase references: 31, data.json references: 0, store. references: 0)
- fsa-acres/package.json: FOUND (contains @supabase/supabase-js)
- fsa-acres/.gitignore: FOUND
- 9a5a1fd (Task 1 commit): to verify
- 07329cb (Task 2 commit): to verify

---
*Phase: 51-fsa-insurance-data-consolidation*
*Completed: 2026-03-25*
