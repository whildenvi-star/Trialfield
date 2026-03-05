---
phase: 29-insurance-tables-calculation-engine
plan: 02
subsystem: api
tags: [supabase, typescript, next-app-router, insurance, aph, yield-sync, claim-alert]

# Dependency graph
requires:
  - phase: 29-01
    provides: lib/insurance/calc.ts (normName, computeAphFromClus, computeClaimAlert, findBestGrainMatch, GrainFarm), insurance_policies schema with aph_computed/actual_synced_from_grain/claim_alert columns, GET /api/insurance/policies

provides:
  - glomalin-portal/src/app/api/insurance/aph-lookup/route.ts — GET endpoint for APH auto-detection from CLU records (INS-05)
  - glomalin-portal/src/app/api/insurance/yield-sync/route.ts — POST endpoint for grain-ticket yield bridge (INS-06)
  - glomalin-portal/src/app/api/insurance/policies/[id]/route.ts — GET + PATCH endpoint with claim alert recompute (INS-07)

affects: [30-insurance-policy-ui, phase-31-claims]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "yield-sync wraps cross-app fetch in try/catch and returns 200 with error message on offline (not 502) — same pattern recommended in plan context"
    - "PATCH endpoint fetches current row before recompute when trigger fields present — merge-then-compute avoids stale partial values"
    - "Next.js App Router dynamic route params typed as Promise<{ id: string }> and awaited (required since Next.js 15)"

key-files:
  created:
    - glomalin-portal/src/app/api/insurance/aph-lookup/route.ts
    - glomalin-portal/src/app/api/insurance/yield-sync/route.ts
    - glomalin-portal/src/app/api/insurance/policies/[id]/route.ts
  modified: []

key-decisions:
  - "yield-sync returns HTTP 200 (not 502) when grain-tickets is offline — offline is expected during development; 502 would confuse API consumers into thinking the insurance service itself failed"
  - "PATCH fetches current row before computing claim_alert — ensures merged values (not just patch delta) are used for correct threshold comparison"
  - "policies/[id] PATCH only stores claim_alert flag (not computed indemnity dollars) — aligns with insurance-as-decision-support architecture, avoids storing derived financials"
  - "Next.js App Router params typed as Promise and awaited — required for dynamic routes in Next.js 15+ (breaking change from Next.js 14 sync params)"

patterns-established:
  - "Pattern: offline cross-app service returns 200 with { error, matched: false, policy: null } — consistent with yield-sync, extendable to other cross-app bridges"
  - "Pattern: PATCH trigger-field list (CLAIM_ALERT_TRIGGER_FIELDS) as typed array — explicit, extensible when more fields affect claim alert"

requirements-completed: [INS-05, INS-06, INS-07]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 29 Plan 02: APH Lookup + Yield Sync + Policy PATCH Summary

**Three insurance API endpoints wiring APH auto-detection from CLU records, grain-ticket yield bridging with offline fallback, and claim alert recomputation on policy updates — all building cleanly with TypeScript strict mode.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-05T18:32:10Z
- **Completed:** 2026-03-05T18:34:35Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- GET `/api/insurance/aph-lookup` queries clu_records by crop (ilike) + farm_name (normName substring match in both directions), calls `computeAphFromClus`, returns `{ avgAph, count, totalRecords, farmName, crop }` — correctly signals "no CLUs found" vs "CLUs found but no APH" for Phase 30 UX
- POST `/api/insurance/yield-sync` cross-app fetches grain-tickets `/api/farms` with `AbortSignal.timeout(5000)`, falls back to `{ error, matched: false, policy: null }` with HTTP 200 when offline, auto-applies score >= 2 matches and recomputes `claim_alert` before writing
- GET `/api/insurance/policies/[id]` returns single policy with auth check
- PATCH `/api/insurance/policies/[id]` accepts partial updates, auto-recomputes `claim_alert` when `actual`, `guarantee`, or `coverage_level` is in payload by fetching current row, merging, then calling `computeClaimAlert`
- All 4 insurance routes appear in `next build` output; `tsc --noEmit` passes with no errors

## Task Commits

1. **Task 1: APH lookup endpoint + grain-ticket yield sync endpoint** - `211d3f0` (feat)
2. **Task 2: Policy PATCH endpoint with claim alert recompute** - `8a83d7c` (feat)

## Files Created

- `glomalin-portal/src/app/api/insurance/aph-lookup/route.ts` — GET handler; ilike crop filter + normName farm_name substring match + computeAphFromClus
- `glomalin-portal/src/app/api/insurance/yield-sync/route.ts` — POST handler; cross-app fetch with timeout; findBestGrainMatch score>=2 auto-apply; computeClaimAlert recompute before write
- `glomalin-portal/src/app/api/insurance/policies/[id]/route.ts` — GET + PATCH handler; PATCH merges current row before claim alert recompute; rejects empty/unrecognized bodies with 400

## Decisions Made

- `yield-sync` returns HTTP 200 (not 502) when grain-tickets is offline — offline grain-tickets is expected during development and the insurance service itself is healthy; 502 would imply this service failed
- PATCH fetches current policy before computing `claim_alert` — ensures merged values (not just the patch delta) are used for the threshold comparison; a partial update of only `actual` would incorrectly use 0 for `guarantee` without the fetch
- Only `claim_alert` flag is stored on policy (not indemnity dollars) — consistent with insurance-as-decision-support architecture decision from v6.0 planning
- Next.js App Router dynamic route `params` typed as `Promise<{ id: string }>` and awaited — required for Next.js 15+ (breaking change from synchronous params in Next.js 14)

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

```
npx tsc --noEmit   → 0 errors
npx next build     → build succeeded, all 4 insurance routes in output:
  /api/insurance/aph-lookup
  /api/insurance/policies
  /api/insurance/policies/[id]
  /api/insurance/yield-sync
```

## Next Phase Readiness

- Phase 30 (Insurance Policy UI) can call all 3 new endpoints:
  - GET `/api/insurance/aph-lookup?crop=&farmName=` for APH badge on policy cards
  - POST `/api/insurance/yield-sync` for sync button on policy detail
  - PATCH `/api/insurance/policies/[id]` for inline edits with automatic claim alert refresh
- `claim_alert` column is auto-maintained on both yield sync and PATCH — Phase 30 stat card reads it directly from `insurance_policies` via `GET /api/insurance/policies`

---
*Phase: 29-insurance-tables-calculation-engine*
*Completed: 2026-03-05*
