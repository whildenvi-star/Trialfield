---
phase: 27-fsa-data-foundation-migration
plan: 02
subsystem: api
tags: [typescript, next-js, supabase, fsa, validation, calc-engine]

# Dependency graph
requires:
  - phase: 27-01
    provides: clu_records + insurance_pricing + insurance_policies tables in Supabase, GET /api/fsa/clu-records

provides:
  - lib/fsa/calc.ts: TypeScript port of FSA calc engine with all rollup, validation, summary, and insurance functions
  - GET /api/fsa/validation: Structured warnings for the 2026 CLU dataset with corrected severity levels
  - GET /api/fsa/auto-populate-preview: Cross-app crop diff proposals from farm-budget with 502 on offline

affects:
  - 28-fsa-ui (Phase 28 FSA card UI — consumes validation warnings and auto-populate proposals)
  - 29-insurance-data (computeInsurancePolicy in calc.ts is the payout simulator engine)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Array.from(map/set) required for TypeScript targets without --downlevelIteration"
    - "Promise.all for parallel Supabase queries in a single route handler"
    - "AbortSignal.timeout(5000) for cross-app fetch with explicit offline error"
    - "revalidate:0 on cross-app fetch via typed fetchOptions cast to any — prevents stale data"
    - "buildAutoPopulateProposals as route-local helper (integration logic, not pure business logic)"

key-files:
  created:
    - glomalin-portal/src/lib/fsa/calc.ts
    - glomalin-portal/src/app/api/fsa/validation/route.ts
    - glomalin-portal/src/app/api/fsa/auto-populate-preview/route.ts
  modified: []

key-decisions:
  - "computeInsurancePolicy signature is (policy, pricing) not (policy, cluRecords, pricing) — CLU-based FSA acres sum not needed for UI payout simulator; pricing lookup only"
  - "tillageSummary and coverCropSummary return multi-year arrays (both 2024+2025) not single-year — matches Phase 28 UI needs better than original single-year API"
  - "buildAutoPopulateProposals included in route file not calc.ts — integration function (depends on budgetData shape) not pure business logic"
  - "Auto-populate proposes for ALL CLU records per locked decision — records with existing matching crop get matchConfidence:exact, no-match gets none"
  - "no-insurance warning emits per-crop (not one combined warning) — Phase 28 UI can link each warning to specific filter"

requirements-completed: [FSA-05, FSA-06]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 27 Plan 02: Calc Engine Port + Validation + Auto-Populate Summary

**TypeScript port of 383-line FSA calc.js to lib/fsa/calc.ts with snake_case Supabase types, GET /api/fsa/validation returning 5-type structured warnings with corrected severity levels, and GET /api/fsa/auto-populate-preview returning normalized crop diff proposals from farm-budget**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T13:26:03Z
- **Completed:** 2026-03-05T13:30:22Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Created `src/lib/fsa/calc.ts` — complete TypeScript port of `fsa-acres/public/calc.js`; 5 interfaces (CluRecord, PricingEntry, InsurancePolicy, GcsEnrollment, ValidationWarning), TILLAGE_CODES constant, 11 exported functions, all property names translated to snake_case Supabase column convention
- Corrected validation severity levels from original calc.js (missing-crop: warning→error, missing-date: info→error, unreported: info→warning, missing-price: warning→info per locked plan spec)
- Created `src/app/api/fsa/validation/route.ts` — auth check, parallel Promise.all for 3 Supabase tables (clu_records/insurance_pricing/insurance_policies), calls validateCluRecords, returns { warnings, recordCount }
- Created `src/app/api/fsa/auto-populate-preview/route.ts` — auth check, fetches farm-budget with AbortSignal.timeout(5000), returns 502 with exact error message when offline, generates crop proposals for ALL CLU records using normalized enterprise-level matching
- Portal build verified: both new routes appear in Next.js build output with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript port of calc.js to lib/fsa/calc.ts** - `fce021b` (feat)
2. **Task 2: Validation API + auto-populate preview API** - `a7d1982` (feat)

## Files Created/Modified

- `glomalin-portal/src/lib/fsa/calc.ts` (645 lines) — TypeScript calc engine: all pure functions using snake_case property names, severity-corrected validateCluRecords, typed interfaces matching Supabase schema
- `glomalin-portal/src/app/api/fsa/validation/route.ts` (55 lines) — GET handler: parallel fetch of 3 datasets, validateCluRecords call, structured response
- `glomalin-portal/src/app/api/fsa/auto-populate-preview/route.ts` (237 lines) — GET handler: farm-budget proxy with offline 502, CLU fetch, buildAutoPopulateProposals helper, proposal array for all records

## Decisions Made

- **computeInsurancePolicy signature simplified:** Uses `(policy, pricing)` not `(policy, cluRecords, pricing)` — the CLU-based FSA acres summation is handled at the UI layer (Phase 28); the calc engine only needs pricing lookup for the payout simulator
- **tillageSummary/coverCropSummary return multi-year arrays:** Both 2024 and 2025 combined in one call — Phase 28 UI can render tabs without two separate API calls
- **buildAutoPopulateProposals in route file:** This function is integration logic (depends on farm-budget API shape), not pure business logic — it stays in the route, not calc.ts
- **no-insurance emits per-crop warnings:** One warning per uninsured crop (not one combined), enabling Phase 28 clickable filter links per crop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Set/Map iteration TypeScript errors**
- **Found during:** Task 1 (calc.ts) and Task 2 (auto-populate route)
- **Issue:** TypeScript complained about `for...of` on Set and Map without `--downlevelIteration` or explicit target — the tsconfig.json has no `target` field (defaults to ES3)
- **Fix:** Wrapped all Set/Map iterations with `Array.from()` — `for (const x of Array.from(mySet))` and `for (const [k, v] of Array.from(myMap))`
- **Files modified:** glomalin-portal/src/lib/fsa/calc.ts, glomalin-portal/src/app/api/fsa/auto-populate-preview/route.ts
- **Verification:** `npx tsc --noEmit` passes with no errors

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope change. Fix is idiomatic TypeScript and does not affect runtime behavior.

## Self-Check: PASSED

All artifacts verified:
- FOUND: glomalin-portal/src/lib/fsa/calc.ts
- FOUND: glomalin-portal/src/app/api/fsa/validation/route.ts
- FOUND: glomalin-portal/src/app/api/fsa/auto-populate-preview/route.ts
- FOUND: commit fce021b (Task 1)
- FOUND: commit a7d1982 (Task 2)
- TypeScript compiles: PASS (npx tsc --noEmit)
- Next.js build: PASS (both routes in build output)
- 11 exported functions in calc.ts: CONFIRMED
- severity 'error' for missing-crop and missing-date: CONFIRMED
- AbortSignal.timeout(5000) in auto-populate: CONFIRMED
- "Farm-budget is offline — auto-populate unavailable" message: CONFIRMED

---
*Phase: 27-fsa-data-foundation-migration*
*Completed: 2026-03-05*
