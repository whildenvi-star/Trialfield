---
phase: 52-yield-pipeline
plan: 01
subsystem: api
tags: [grain-tickets, express, yield, insurance, supabase, migration, prisma]

# Dependency graph
requires:
  - phase: 50-canonical-crop-registry
    provides: registryCropId on tickets, canonical crop IDs across all apps
  - phase: 49-canonical-field-ids
    provides: Farm.registryId for canonical field ID linkage in grain-tickets
  - phase: 27-fsa-data
    provides: insurance_policies table in Supabase

provides:
  - computeYieldSummaries() function in grain-tickets/server.js grouping tickets by registryFieldId + registryCropId
  - GET /api/yield-summaries endpoint returning per-field per-crop yield totals
  - pushYieldUpdates() fire-and-forget trigger after every ticket CRUD
  - USDA_TEST_WEIGHTS constant in grain-tickets/public/calc.js
  - migrate-52.ts adding registry_field_id, registry_crop_id, yield_synced_at, actual_synced_from_grain to insurance_policies

affects:
  - 52-02 (yield push pipeline — consumes computeYieldSummaries and writes to insurance_policies)
  - glomalin-portal insurance module (registry columns enable yield sync match)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - computeYieldSummaries groups by `${registryFieldId}::${registryCropId}` composite key
    - pushYieldUpdates fires after res.json() (fire-and-forget, never blocks HTTP response)
    - USDA_TEST_WEIGHTS in calc.js as shared constant accessible from browser and server
    - Migration follows established migrate-29.ts pattern (manual .env parse, exec_sql RPC, verify select)

key-files:
  created:
    - glomalin-portal/scripts/migrate-52.ts
  modified:
    - grain-tickets/server.js
    - grain-tickets/public/calc.js

key-decisions:
  - "Weight basis for yield is netWeight (net pounds after buyer deductions) — already stored on tickets, consistent with context decision"
  - "Acre denominator for yieldPerAcre uses Farm.acres from grain-tickets; Plan 02 will use insurance planted_acres for the insurance push"
  - "One console.warn per unique farm/crop name — deduped via warnedFarms/warnedCrops maps to avoid log spam"
  - "Composite index on (registry_field_id, registry_crop_id) added to insurance_policies — Plan 02 match pattern"

patterns-established:
  - "Yield computation: group by registryFieldId::registryCropId composite key, exclude tickets missing either ID with deduped warning"
  - "Fire-and-forget async after HTTP response: res.json(...); asyncFn().catch(err => console.error(...))"

requirements-completed: [PIPE-01]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 52 Plan 01: Yield Pipeline Foundation Summary

**computeYieldSummaries() engine in grain-tickets grouping per-field per-crop net pounds/bushels by registry IDs, with GET /api/yield-summaries endpoint and Supabase migration adding registry linkage columns to insurance_policies**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T18:07:42Z
- **Completed:** 2026-03-25T18:12:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- computeYieldSummaries() groups all tickets for a crop year by Farm.registryId + Ticket.registryCropId, computing totalNetLbs, totalNetBU (via existing Calc.computeTicket), yieldPerAcre, and ticketCount per field/crop combo
- GET /api/yield-summaries returns yield summaries with optional ?cropYear param plus excludedTickets counts for tickets missing field ID or crop ID
- pushYieldUpdates() fires after every POST/PUT/DELETE ticket response (fire-and-forget), ready for Plan 02 to add actual push logic
- USDA_TEST_WEIGHTS constant added to calc.js (available in both browser and Node.js)
- migrate-52.ts adds four registry columns to insurance_policies: registry_field_id, registry_crop_id, yield_synced_at, actual_synced_from_grain — idempotent with composite index for Plan 02 matching

## Task Commits

Each task was committed atomically:

1. **Task 1: Yield computation engine and API endpoint in grain-tickets** - `2e4c953` (feat)
2. **Task 2: Supabase migration adding registry columns to insurance_policies** - `3552ac9` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `grain-tickets/public/calc.js` - Added USDA_TEST_WEIGHTS constant (wheat=60, corn=56, soybeans=60, oats=32, barley=48, rye=56, sorghum=56, sunflower=28, flax=56, peas=60)
- `grain-tickets/server.js` - Added computeYieldSummaries(), pushYieldUpdates(), GET /api/yield-summaries, hooked pushYieldUpdates into POST/PUT/DELETE ticket handlers
- `glomalin-portal/scripts/migrate-52.ts` - ALTER TABLE migration for insurance_policies registry columns, follows migrate-29.ts pattern

## Decisions Made

- Weight basis uses netWeight (net pounds already stored on tickets) — matches context decision; gross weight would be inconsistent across buyers
- Acre denominator for yieldPerAcre in computeYieldSummaries uses Farm.acres; Plan 02 will use insurance planted_acres when pushing to portal (where the insurance yield comparison matters)
- One console.warn per unique farm/crop name — deduped via warnedFarms/warnedCrops maps to avoid log flooding when many tickets share the same unlinked farm

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

migrate-52.ts must be run manually to add columns to Supabase:
```
cd glomalin-portal && npx tsx scripts/migrate-52.ts
```
If exec_sql RPC is unavailable, the script prints the SQL for manual execution in the Supabase SQL editor.

## Next Phase Readiness

- Plan 02 (yield push pipeline) can now:
  - Call computeYieldSummaries() to get fresh summaries
  - Match insurance_policies on registry_field_id + registry_crop_id (columns exist after migration)
  - Write actual yield, yield_synced_at, actual_synced_from_grain=true
- USDA_TEST_WEIGHTS available in browser for any client-side display needs
- pushYieldUpdates() is already called on every ticket save — Plan 02 just adds the push logic inside it

---
*Phase: 52-yield-pipeline*
*Completed: 2026-03-25*

## Self-Check: PASSED

- grain-tickets/public/calc.js — FOUND
- grain-tickets/server.js — FOUND
- glomalin-portal/scripts/migrate-52.ts — FOUND
- .planning/phases/52-yield-pipeline/52-01-SUMMARY.md — FOUND
- Commit 2e4c953 (Task 1) — FOUND
- Commit 3552ac9 (Task 2) — FOUND
