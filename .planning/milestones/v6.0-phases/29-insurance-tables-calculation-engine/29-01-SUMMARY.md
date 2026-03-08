---
phase: 29-insurance-tables-calculation-engine
plan: 01
subsystem: api
tags: [supabase, typescript, next-app-router, insurance, calc-engine, migration]

# Dependency graph
requires:
  - phase: 27-fsa-data-foundation-migration
    provides: insurance_policies table (migrated from fsa-acres), migrate-fsa.ts pattern, lib/fsa/calc.ts calc engine pattern
  - phase: 28-fsa-planting-workflow-ui
    provides: fsa-578 page.tsx pattern, API route auth-check pattern

provides:
  - glomalin-portal/scripts/migrate-29.ts — ALTER TABLE migration adding Phase 29 columns to insurance_policies + authenticated_write RLS policy
  - glomalin-portal/src/lib/insurance/calc.ts — pure TypeScript calc engine: normName, computeAphFromClus, computeClaimAlert, findBestGrainMatch, GrainFarm interface
  - glomalin-portal/src/app/api/insurance/policies/route.ts — GET /api/insurance/policies with year param and auth check
  - glomalin-portal/src/app/(protected)/app/insurance/page.tsx — insurance module shell page with stat cards and policy table
  - glomalin-portal/src/lib/modules.ts — insurance module registered in MODULES array

affects: [29-02, 30-insurance-policy-ui, phase-31-claims]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lib/insurance/calc.ts mirrors lib/fsa/calc.ts — pure TypeScript calc engine, no Supabase, no side effects"
    - "scripts/migrate-29.ts uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS for idempotent schema additions (no table recreate)"
    - "insurance module shell page is a Server Component fetching directly from Supabase (not via API route)"

key-files:
  created:
    - glomalin-portal/scripts/migrate-29.ts
    - glomalin-portal/src/lib/insurance/calc.ts
    - glomalin-portal/src/app/api/insurance/policies/route.ts
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx
  modified:
    - glomalin-portal/src/lib/modules.ts

key-decisions:
  - "computeClaimAlert guards against corrupt data by requiring both actual > 0 AND guarantee > 0 before flagging potential — prevents false alerts from ins_482 (actual=40000, guarantee=0)"
  - "computeAphFromClus distinguishes totalRecords=0 (no matching CLUs) from totalRecords>0/count=0 (CLUs found but no APH values) — enables correct UX message in Phase 30"
  - "findBestGrainMatch score >= 2 required for auto-apply; score=1 (farm-only) returned but not auto-applied — prevents low-confidence yield overrides"
  - "migrate-29.ts is a separate script from migrate-fsa.ts — only runs ALTER TABLE additions, does not re-run full Phase 27 data migration"

patterns-established:
  - "Pattern: ALTER TABLE migration in separate script per phase (not accumulating in migrate-fsa.ts)"
  - "Pattern: Insurance calc engine exports pure functions from lib/insurance/calc.ts (mirroring lib/fsa/calc.ts)"
  - "Pattern: VERIFY note in policy notes field rendered in orange with badge in the policy table"

requirements-completed: [INS-01]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 29 Plan 01: Insurance Tables + Calculation Engine Summary

**ALTER TABLE migration for Phase 29 insurance columns, pure TypeScript calc engine with APH/claim-alert/grain-match functions, GET /api/insurance/policies endpoint, and insurance module shell page with stat cards — all building cleanly.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-05T18:21:26Z
- **Completed:** 2026-03-05T18:24:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Insurance module registered in portal with dedicated route `/app/insurance` — visible in module navigation after Phase 30 RBAC wiring
- Pure calc engine (`lib/insurance/calc.ts`) exports 4 functions + 1 interface: `normName`, `computeAphFromClus`, `computeClaimAlert`, `findBestGrainMatch`, `GrainFarm` — ready for Plan 29-02 APH lookup and yield sync routes
- GET `/api/insurance/policies` endpoint returns `{ policies, count, year }` with auth check, following exact pattern from `/api/fsa/clu-records/route.ts`
- Insurance shell page shows 3 stat cards (Policies, Crops Insured, Claim Alerts) + policy table with coverage/guarantee/actual/claim_alert — VERIFY note rows highlighted in orange for ins_482 corrupt data
- `migrate-29.ts` prints full ALTER TABLE SQL to console so it can also be run manually in Supabase SQL editor

## Task Commits

1. **Task 1: Schema migration script + insurance calc engine + module registration** - `addaa43` (feat)
2. **Task 2: GET /api/insurance/policies endpoint + insurance module shell page** - `aad52a9` (feat)

**Plan metadata:** (pending — in final commit)

## Files Created/Modified

- `glomalin-portal/scripts/migrate-29.ts` — idempotent ALTER TABLE migration adding aph_computed, aph_clu_count, actual_synced_from_grain, claim_alert to insurance_policies + authenticated_write RLS policy
- `glomalin-portal/src/lib/insurance/calc.ts` — pure TypeScript calc engine porting normName, computeAphFromClus, computeClaimAlert, findBestGrainMatch from fsa-acres/public/insurance.js reference
- `glomalin-portal/src/app/api/insurance/policies/route.ts` — GET handler with ?year= param, auth check, returns policies ordered by farm_name
- `glomalin-portal/src/app/(protected)/app/insurance/page.tsx` — Server Component shell with stat cards, policy table, orange VERIFY highlighting, insurance decision-support disclaimer
- `glomalin-portal/src/lib/modules.ts` — insurance module added after fsa-578 entry

## Decisions Made

- `computeClaimAlert` requires both `actual > 0` AND `guarantee > 0` to avoid false positives from ins_482 (which has actual=40000, guarantee=0 — effective guarantee is 0, so no false alert, but future edits to guarantee could trigger incorrectly without this guard)
- `computeAphFromClus` returns `{ avgAph, count, totalRecords }` to distinguish "no CLUs matched" from "CLUs matched but all aph=0" — critical for Phase 30 UX since all 444 CLU records currently have aph=0
- `findBestGrainMatch` score threshold >= 2 for auto-apply (crop match required); score=1 farm-only matches returned but callers must not auto-apply them — prevents yield overrides based on farm name alone
- Separate `migrate-29.ts` script rather than modifying `migrate-fsa.ts` — keeps each phase's schema additions isolated and avoids re-running Phase 27 data migration unnecessarily

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` after the first Next.js build showed stale `.next/types/` errors because `.next/types/app/(protected)/app/` directory existed but was empty (build had not yet populated the type stubs for new pages). Running `next build` a second time regenerated the stubs and `tsc --noEmit` then passed cleanly. This is a known Next.js behavior when `.next/types` exists from a prior build but new pages were added since the last build generation.

## User Setup Required

Run in Supabase SQL editor to add Phase 29 columns to insurance_policies:

```sql
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS aph_computed              numeric(10,2),
  ADD COLUMN IF NOT EXISTS aph_clu_count             integer,
  ADD COLUMN IF NOT EXISTS actual_synced_from_grain  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claim_alert               text NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS insurance_policies_claim_alert_idx
  ON insurance_policies(claim_alert);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'insurance_policies'
      AND policyname = 'authenticated_write'
  ) THEN
    CREATE POLICY "authenticated_write" ON insurance_policies
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;
```

Or run `cd glomalin-portal && npx tsx scripts/migrate-29.ts` (requires `.env.local` with Supabase credentials).

## Next Phase Readiness

- Plan 29-02 can proceed immediately: `lib/insurance/calc.ts` exports all functions Plan 29-02 needs (computeAphFromClus, computeClaimAlert, findBestGrainMatch, normName)
- GET /api/insurance/policies is the read foundation for Plan 29-02 APH lookup and yield sync routes
- Schema migration script is ready for the user to run — Plan 29-02 routes will write to the new columns (aph_computed, actual_synced_from_grain, claim_alert)
- Phase 30 (Insurance Policy UI) can rely on the shell page structure and stat card pattern established here

---
*Phase: 29-insurance-tables-calculation-engine*
*Completed: 2026-03-05*
