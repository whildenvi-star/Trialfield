---
phase: 52-yield-pipeline
plan: 02
subsystem: api
tags: [grain-tickets, express, yield, insurance, supabase, farm-budget, dashboard, push-pipeline]

# Dependency graph
requires:
  - phase: 52-01
    provides: computeYieldSummaries(), pushYieldUpdates() placeholder, migration columns on insurance_policies

provides:
  - POST /api/insurance/yield-push in glomalin-portal — bulk yield receiver updating insurance_policies by registry IDs
  - POST/GET /api/yield-from-grain in farm-budget — in-memory yield cache for dashboard overlay
  - pushYieldUpdates() fully implemented in grain-tickets — parallel push to both endpoints
  - Green GT badge with hover timestamp in insurance-workspace.tsx
  - Actual yield vs budget variance display in farm-budget dashboard

affects:
  - glomalin-portal insurance module (actual yield + claim_alert auto-updated from grain tickets)
  - farm-budget dashboard (grain yield overlay with variance)
  - grain-tickets (pushYieldUpdates now sends live data on every ticket save)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server-to-server ecosystem token auth via x-ecosystem-token header (matches EMBED_TOKEN)
    - Promise.allSettled for parallel fire-and-forget push (portal + budget independent)
    - AbortSignal.timeout(5000) on all cross-app fetch calls
    - In-memory yield cache in farm-budget (_grainYields object, no persistence needed)
    - Group-hover CSS tooltip pattern for GT badge in insurance table
    - Crop-name matching in dashboard.js for grain yield overlay (cropRows have no registry IDs)

key-files:
  created:
    - glomalin-portal/src/app/api/insurance/yield-push/route.ts
  modified:
    - grain-tickets/server.js
    - grain-tickets/.env.example
    - farm-budget/server.js
    - farm-budget/public/dashboard.js
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx

key-decisions:
  - "Crop-name matching (not registry ID matching) used in farm-budget dashboard — cropRows are crop-level aggregates with no registryCropId; crop name string is the available join key"
  - "Farm-budget yields endpoint is unauthenticated GET — yield data is not sensitive (aggregates only), and auth would require token propagation from client which complicates the iframe context"
  - "GT badge uses CSS group-hover pattern (not title attribute) — enables formatted multi-line timestamp display vs plain-text title limit"
  - "ECOSYSTEM_TOKEN || EMBED_TOKEN checked in farm-budget yield-from-grain endpoint — allows future separation of ecosystem vs embed secrets"

# Metrics
duration: 16min
completed: 2026-03-25
---

# Phase 52 Plan 02: Yield Push Pipeline Summary

**End-to-end yield pipeline from grain-tickets to portal insurance policies and farm-budget dashboard — push on save, registry-ID matching with planted_acres denominator, green GT badge with hover timestamp, and budget variance display**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-25T18:07:42Z
- **Completed:** 2026-03-25T18:23:27Z
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments

- POST /api/insurance/yield-push receives bulk yield summaries from grain-tickets, matches insurance_policies by registry_field_id + registry_crop_id + policy_year, uses insurance planted_acres as denominator, recomputes claim_alert, updates actual + yield_synced_at + actual_synced_from_grain
- POST/GET /api/yield-from-grain in farm-budget stores summaries in memory as lookup map (keyed by registryFieldId|registryCropId) with cropName/farmName for client matching
- pushYieldUpdates() in grain-tickets fully wired: Promise.allSettled parallel push to portal and farm-budget, AbortSignal.timeout(5000), fire-and-forget with structured console.log result
- Insurance workspace shows green GT badge (bg-green-800/50 text-green-300) with group-hover tooltip showing "Synced from grain tickets" and formatted timestamp; muted dash with title attr when not synced
- Farm-budget dashboard fetches grain yields in parallel with dashboard data, overlays "Actual X bu/ac vs Budget Y (variance)" with green/amber coloring and GT indicator

## Task Commits

1. **Task 1: Yield push pipeline — portal endpoint + farm-budget cache + grain-tickets push** - `c85ee4a` (feat)
2. **Task 2: UI indicators — GT badge in insurance + yield variance in farm-budget dashboard** - `769b20c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `glomalin-portal/src/app/api/insurance/yield-push/route.ts` — NEW: POST endpoint, ecosystem token auth, service_role Supabase client, registry ID matching, planted_acres denominator, claim_alert recomputation
- `grain-tickets/server.js` — pushYieldUpdates() implemented with Promise.allSettled, AbortSignal.timeout(5000), PORTAL_ORIGIN + BUDGET_API_URL env vars
- `grain-tickets/.env.example` — BUDGET_API_URL documented
- `farm-budget/server.js` — POST/GET /api/yield-from-grain endpoints, _grainYields in-memory cache with cropName/farmName included
- `farm-budget/public/dashboard.js` — fetchGrainYields(), findGrainYieldForCrop(), loadDashboard updated for parallel fetch, renderCropTable overlays actual yield with variance
- `glomalin-portal/src/components/insurance/insurance-workspace.tsx` — GT badge with group-hover tooltip, muted dash with tooltip for unsynced policies

## Decisions Made

- Crop-name matching used in farm-budget dashboard — cropRows are aggregated by crop name, no registryCropId available at render time; crop name string is the practical join key
- CSS group-hover tooltip for GT badge — enables formatted multi-line timestamp, cannot be achieved with plain title attribute
- ECOSYSTEM_TOKEN || EMBED_TOKEN in farm-budget — forward-compatible if secrets are split later

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

No additional setup — EMBED_TOKEN already documented. BUDGET_API_URL added to grain-tickets .env.example with default `http://localhost:3001`.

For production: ensure `PORTAL_ORIGIN` in grain-tickets points to the correct portal URL (not localhost) and `BUDGET_API_URL` points to the correct farm-budget host.

## Next Phase Readiness

Phase 52 Plan 03 (if any) or phase 52 complete — all PIPE requirements delivered:
- PIPE-01: computeYieldSummaries engine (Plan 01)
- PIPE-02/03/04: push endpoints, portal UI, farm-budget UI (Plan 02)

---
*Phase: 52-yield-pipeline*
*Completed: 2026-03-25*

## Self-Check: PASSED

- glomalin-portal/src/app/api/insurance/yield-push/route.ts — FOUND
- farm-budget/server.js — FOUND
- grain-tickets/server.js — FOUND
- glomalin-portal/src/components/insurance/insurance-workspace.tsx — FOUND
- farm-budget/public/dashboard.js — FOUND
- .planning/phases/52-yield-pipeline/52-02-SUMMARY.md — FOUND
- Commit c85ee4a (Task 1) — FOUND
- Commit 769b20c (Task 2) — FOUND
