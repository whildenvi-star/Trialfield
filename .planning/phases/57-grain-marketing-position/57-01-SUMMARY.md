---
phase: 57-grain-marketing-position
plan: 01
subsystem: database, api
tags: [supabase, grain-contracts, cbot, futures, marketing, next-js, typescript]

# Dependency graph
requires:
  - phase: 50-canonical-crop-registry
    provides: canonical crop names (Yellow Corn, Soybeans, Soft Red Winter Wheat, Oats) used in cbot-prices commodity map
  - phase: 52-yield-pipeline
    provides: estimated production bushels baseline for unpriced exposure calculation (Plan 02 UI)

provides:
  - grain_contracts Supabase table with all 6 contract types and RLS
  - GET/POST /api/marketing/contracts — list and create grain contracts
  - PATCH/DELETE /api/marketing/contracts/[id] — edit and remove contracts
  - GET /api/marketing/cbot-prices — live delayed or manual fallback CBOT futures prices
  - GrainContract, CbotPrice, MarketingPosition TypeScript interfaces in src/lib/marketing/types.ts

affects:
  - 57-02 marketing position UI (needs these API routes and types)
  - 60-settlement-summary (grain contracts table is the contract price source for variance reporting)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CBOT price endpoint with env-gated live/fallback pattern (BARCHART_API_KEY controls source)"
    - "Marketing module routes use requireModuleAccess('marketing') guard from existing guard.ts pattern"
    - "Contract types validated via VALID_CONTRACT_TYPES array guard in both GET filter and POST insert"

key-files:
  created:
    - glomalin-portal/scripts/migrate-57.ts
    - glomalin-portal/src/lib/marketing/types.ts
    - glomalin-portal/src/app/api/marketing/contracts/route.ts
    - glomalin-portal/src/app/api/marketing/contracts/[id]/route.ts
    - glomalin-portal/src/app/api/marketing/cbot-prices/route.ts
  modified: []

key-decisions:
  - "CBOT price endpoint returns manual-fallback when BARCHART_API_KEY not set — UI always works without an API key"
  - "Commodity canonical names match Phase 50 crop registry: Yellow Corn, Soybeans, Soft Red Winter Wheat, Oats"
  - "PATCH updated_at set server-side — consistent with Phase 56 APH decision, client cannot set arbitrary timestamps"
  - "DELETE returns 204 (no body) on success, 404 when record not found (empty Supabase response)"
  - "Barchart fallback catches all fetch errors (network, timeout, malformed response) — endpoint never returns 500 to the UI"
  - "revalidate = 900 (15 min) on cbot-prices — delayed quotes don't need real-time refresh"

patterns-established:
  - "marketing-api-fallback: CBOT price endpoint uses AbortSignal.timeout(8000) + catch → fallback for graceful degradation"
  - "contract-type-guard: VALID_CONTRACT_TYPES array used in both route.ts and [id]/route.ts to keep validation DRY-ish per file"

requirements-completed: [MKT-01, MKT-02, MKT-03]

# Metrics
duration: 2min
completed: 2026-03-29
---

# Phase 57 Plan 01: Grain Marketing Position — Data Layer Summary

**grain_contracts Supabase table + CRUD API + Barchart CBOT price fetch with manual fallback for all 6 grain contract types**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T17:17:28Z
- **Completed:** 2026-03-29T17:19:56Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Created grain_contracts table DDL with CHECK constraint enforcing all 6 contract types (cash, accumulator, hta, options, min-price, basis), RLS policies, and two indexes
- Built complete CRUD REST API: GET (filter by year/crop), POST (validated insert), PATCH (partial update, server-side updated_at), DELETE (204/404)
- CBOT futures price endpoint with Barchart OnDemand integration — gracefully falls back to hardcoded prices when API key absent, never returns 500 to the UI
- TypeScript types shared between API routes and future UI: GrainContract, CbotPrice, MarketingPosition

## Task Commits

Each task was committed atomically:

1. **Task 1: Grain contracts Supabase table and types** - `38c7c30` (feat)
2. **Task 2: Contract CRUD API and CBOT price fetch endpoint** - `e9401a7` (feat)

**Plan metadata:** (docs commit below)

## Files Created
- `glomalin-portal/scripts/migrate-57.ts` — Phase 57 migration: grain_contracts table with CHECK constraint, RLS, indexes; prints SQL for manual Supabase editor run
- `glomalin-portal/src/lib/marketing/types.ts` — GrainContract, CbotPrice, MarketingPosition TypeScript interfaces
- `glomalin-portal/src/app/api/marketing/contracts/route.ts` — GET (list by crop_year) and POST (create with contract_type validation)
- `glomalin-portal/src/app/api/marketing/contracts/[id]/route.ts` — PATCH (partial update) and DELETE (204/404)
- `glomalin-portal/src/app/api/marketing/cbot-prices/route.ts` — CBOT futures fetch with Barchart OnDemand, manual-fallback when key absent, 15min cache

## Decisions Made
- CBOT price endpoint always returns 200 with fallback prices on any error — the marketing position UI can always calculate with stale numbers rather than crash
- Commodity canonical names aligned to Phase 50 registry: Yellow Corn, Soybeans, Soft Red Winter Wheat, Oats
- PATCH updated_at set server-side, consistent with Phase 56 APH records precedent
- RLS policies use idempotent DO $$ IF NOT EXISTS $$ pattern from migrate-29.ts — safe to re-run

## Deviations from Plan

None — plan executed exactly as written.

## User Setup Required

To run the migration against Supabase:

```bash
cd glomalin-portal && npx tsx scripts/migrate-57.ts
```

To enable live CBOT prices, add to `glomalin-portal/.env.local`:
```
BARCHART_API_KEY=your_key_here
```
Free key available at https://www.barchart.com/ondemand/api. If not set, endpoint returns manual fallback prices with `source: "manual-fallback"` — the marketing UI works without it.

## Next Phase Readiness
- All data-layer requirements for Phase 57 Plan 02 (marketing position UI) are met
- grain_contracts table, CRUD API, and CBOT price endpoint are the two data sources the UI needs to calculate unpriced exposure
- Phase 60 settlement summary can reference grain_contracts for contract vs. actual price variance

---
*Phase: 57-grain-marketing-position*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: glomalin-portal/scripts/migrate-57.ts
- FOUND: glomalin-portal/src/lib/marketing/types.ts
- FOUND: glomalin-portal/src/app/api/marketing/contracts/route.ts
- FOUND: glomalin-portal/src/app/api/marketing/contracts/[id]/route.ts
- FOUND: glomalin-portal/src/app/api/marketing/cbot-prices/route.ts
- FOUND: commit 38c7c30 (Task 1)
- FOUND: commit e9401a7 (Task 2)
