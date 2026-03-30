---
phase: 61-auto-field-propagation
plan: 02
subsystem: api
tags: [farm-budget, grain-tickets, glomalin-portal, webhook, idempotency, clu-records, express, nextjs]

# Dependency graph
requires:
  - phase: 61-auto-field-propagation (plan 01)
    provides: propagateField() dispatcher in farm-registry that calls these receivers
  - phase: 49-canonical-field-ids
    provides: registry field IDs that are stamped on downstream records
provides:
  - Idempotent POST /api/fields in farm-budget with registryFieldId duplicate guard
  - Idempotent POST /api/farms in grain-tickets with registryId duplicate guard + name-match wiring
  - Portal webhook route at /api/fsa/webhook/field-created for auto CLU record creation
affects:
  - Farm-registry propagateField() dispatcher (Plan 01) — all 3 targets now safely handle retries

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "idempotent webhook receiver: check by ID first, return 200 with existing record if found"
    - "name-match wiring: if no ID match but name matches and no registryId set, UPDATE to wire it in"
    - "service-role Supabase client for machine-to-machine webhook writes (bypasses RLS)"
    - "EMBED_TOKEN query param auth for Next.js webhook routes (skipped in dev if env not set)"

key-files:
  created:
    - glomalin-portal/src/app/api/fsa/webhook/field-created/route.ts
  modified:
    - farm-budget/server.js
    - grain-tickets/server.js

key-decisions:
  - "farm-budget idempotency guard uses registryFieldId exact match before creation — no name matching needed since farm-budget fields are more granular"
  - "grain-tickets name-match wiring updates registryId on existing farms with no registryId — avoids orphaned farms from before propagation was added"
  - "Portal webhook uses EMBED_TOKEN query param (skipped in dev) + service role Supabase client — no user session, pure machine-to-machine"
  - "CLU record created with placeholder farm_number=0 and tract_number=0 — user fills in real FSA numbers via portal UI later"

patterns-established:
  - "Pattern: idempotent webhook receiver — check by registryId first, return 200 if found, then create if not"
  - "Pattern: name-match upgrade — wire registryId onto existing records that predate propagation"

requirements-completed:
  - AUTO-01
  - AUTO-02
  - AUTO-03

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 61 Plan 02: Auto Field Propagation — Receivers Summary

**Idempotent webhook receivers added to farm-budget, grain-tickets, and glomalin-portal: duplicate fields return 200, portal auto-creates CLU records with registry_field_id pre-wired**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T00:34:52Z
- **Completed:** 2026-03-30T00:36:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- farm-budget POST /api/fields now returns 200 for duplicate registryFieldId instead of creating duplicate records
- grain-tickets POST /api/farms now returns 200 for duplicate registryId; also wires registryId onto name-matched farms that predate propagation
- Portal webhook endpoint at /api/fsa/webhook/field-created creates minimal CLU records with registry_field_id pre-wired and CURRENT_CROP_YEAR; idempotent on duplicate

## Task Commits

Each task was committed atomically:

1. **Task 1: Add idempotency guards to farm-budget and grain-tickets field creation endpoints** - `12791e2` (feat)
2. **Task 2: Create portal webhook endpoint for auto CLU record creation** - `0cfbb92` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `farm-budget/server.js` - Added registryFieldId duplicate guard at top of POST /api/fields; returns 200 with existing field if match found
- `grain-tickets/server.js` - Added registryId duplicate guard + name-match wiring at top of POST /api/farms; returns 200 for existing records
- `glomalin-portal/src/app/api/fsa/webhook/field-created/route.ts` - New Next.js route: EMBED_TOKEN auth, service role Supabase client, duplicate check by registry_field_id + crop_year, creates minimal CLU record placeholder

## Decisions Made
- farm-budget idempotency uses exact registryFieldId match — no name matching since fields can have the same name across different enterprises
- grain-tickets name-match upgrade wires registryId onto any farm matching by name that has no registryId — handles farms created before propagation was added in Plan 01
- Portal webhook skips EMBED_TOKEN auth in dev (if env var not set) so local development works without config
- CLU record uses farm_number=0, tract_number=0, clu=field_name as placeholders — these are the FSA bureaucratic numbers users must look up from their FSA paperwork

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no additional env vars required beyond what Plan 01 documented (EMBED_TOKEN, FARM_BUDGET_URL, GRAIN_TICKETS_URL, PORTAL_URL in farm-registry/.env).

The portal webhook route uses `SUPABASE_SERVICE_ROLE_KEY` which is already set in glomalin-portal/.env from prior phases.

## Next Phase Readiness
- All 3 downstream receivers are now idempotent — the Phase 61 Plan 01 dispatcher can safely retry without creating duplicates
- End-to-end flow complete: creating a field in farm-registry auto-creates records in farm-budget, grain-tickets, and portal (CLU placeholder)
- AUTO-01, AUTO-02, AUTO-03 requirements complete — Phase 61 finished

## Self-Check: PASSED

- FOUND: farm-budget/server.js (modified with registryFieldId duplicate guard)
- FOUND: grain-tickets/server.js (modified with registryId duplicate guard + name-match wiring)
- FOUND: glomalin-portal/src/app/api/fsa/webhook/field-created/route.ts (created)
- FOUND: .planning/phases/61-auto-field-propagation/61-02-SUMMARY.md
- FOUND commit 12791e2 (Task 1)
- FOUND commit 0cfbb92 (Task 2)
- FOUND commit cee6179 (docs metadata)

---
*Phase: 61-auto-field-propagation*
*Completed: 2026-03-30*
