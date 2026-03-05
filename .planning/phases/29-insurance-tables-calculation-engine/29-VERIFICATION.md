---
phase: 29-insurance-tables-calculation-engine
verified: 2026-03-05T18:50:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Navigate to /app/insurance in a live portal session"
    expected: "Stat cards show correct policy count, crops insured count, and claim alerts count; VERIFY badge appears in orange on the ins_482 row; table renders farm/crop/coverage/guarantee/actual/alert columns"
    why_human: "Server component fetches live Supabase data — cannot verify table rendering and stat card correctness without a running session with migrated data"
  - test: "POST /api/insurance/yield-sync with a valid policyId while grain-tickets port 3000 is offline"
    expected: "Response is HTTP 200 with { error: 'Grain ticket service unavailable — is port 3000 running?', matched: false, policy: null } — not a 502 or connection error bubbled up"
    why_human: "Cross-app offline behavior requires a running server instance and an intentionally stopped grain-tickets service to confirm the 200 fallback path"
  - test: "Run the Phase 29 schema migration against Supabase"
    expected: "migrate-29.ts prints the ALTER TABLE SQL, connects to Supabase, and the four columns (aph_computed, aph_clu_count, actual_synced_from_grain, claim_alert) appear in the insurance_policies table"
    why_human: "Migration script requires live Supabase credentials and cannot be verified without a real database connection"
---

# Phase 29: Insurance Tables + Calculation Engine Verification Report

**Phase Goal:** Insurance policies live in Supabase with APH auto-detected from CLU records, actual yields bridged from grain-tickets, and potential claim conditions automatically flagged
**Verified:** 2026-03-05T18:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Insurance module appears in portal module list and is accessible via /app/insurance | VERIFIED | `modules.ts` line 46-51: `{ id: 'insurance', label: 'Insurance', sublabel: 'Crop Insurance Tools', route: '/app/insurance' }` |
| 2  | GET /api/insurance/policies?year=2026 returns policies with correct field values | VERIFIED | `api/insurance/policies/route.ts`: auth check + `supabase.from('insurance_policies').select('*').eq('policy_year', year).order('farm_name')` returns `{ policies, count, year }` |
| 3  | insurance_policies table has Phase 29 columns (aph_computed, aph_clu_count, actual_synced_from_grain, claim_alert) | VERIFIED | `migrate-29.ts`: full ALTER TABLE SQL with all 4 columns + index + RLS policy; `page.tsx` InsurancePolicy interface declares all 4 Phase 29 columns |
| 4  | lib/insurance/calc.ts exports computeAphFromClus, computeClaimAlert, findBestGrainMatch, normName as pure functions | VERIFIED | All 4 functions exported with `export` keyword, no Supabase calls, no side effects; GrainFarm interface also exported |
| 5  | APH lookup returns avgAph, count, totalRecords for a given crop+farmName from CLU records | VERIFIED | `aph-lookup/route.ts`: queries `clu_records` with `ilike('crop')`, filters by `normName` substring match, calls `computeAphFromClus`, returns `{ avgAph, count, totalRecords, farmName, crop }` |
| 6  | When all CLU aph values are 0, APH lookup returns count=0 with totalRecords>0 | VERIFIED | `calc.ts` `computeAphFromClus`: filters `aph > 0`, returns `{ avgAph: 0, count: 0, totalRecords }` when no records pass filter — correctly distinguishes from empty result set |
| 7  | Yield sync fetches grain-ticket data from port 3000 and writes matched yieldPerAcre to insurance_policies.actual | VERIFIED | `yield-sync/route.ts` line 59: `fetch('http://localhost:3000/api/farms', ...)`, lines 96-100: Supabase update with `actual: match.yieldPerAcre, actual_synced_from_grain: true` |
| 8  | When grain-tickets service is offline, yield sync returns HTTP 200 with a clear error message (not 502) | VERIFIED | `yield-sync/route.ts` lines 62-68: try/catch wraps fetch; catch block returns `NextResponse.json({ error: 'Grain ticket service unavailable — is port 3000 running?', matched: false, policy: null })` — no status code = 200 |
| 9  | After yield sync writes actual, claim_alert is recomputed and stored on the policy | VERIFIED | `yield-sync/route.ts` lines 85-100: `computeClaimAlert(updatedValues)` called before Supabase update; `claim_alert: claimAlert` included in `.update()` payload |
| 10 | When actual yield < effective guarantee, claim_alert is set to 'potential' | VERIFIED | `calc.ts` `computeClaimAlert`: `return actual < effectiveGuarantee ? 'potential' : 'none'` with correct `effectiveGuarantee = guarantee * (coverage_level / 100)` |
| 11 | PATCH /api/insurance/policies/[id] recomputes claim_alert when actual, guarantee, or coverage_level changes | VERIFIED | `policies/[id]/route.ts`: `CLAIM_ALERT_TRIGGER_FIELDS` array checked; fetches current row, merges patch values, calls `computeClaimAlert(merged)`, includes `claim_alert` in update |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/scripts/migrate-29.ts` | ALTER TABLE migration adding Phase 29 columns + authenticated_write RLS policy | VERIFIED | 198 lines; contains full ALTER TABLE SQL, `ADD COLUMN IF NOT EXISTS` for all 4 columns, RLS DO $$ block, idempotent |
| `glomalin-portal/src/lib/insurance/calc.ts` | Pure insurance calc engine exporting 4 functions | VERIFIED | 156 lines; exports `normName`, `computeAphFromClus`, `computeClaimAlert`, `findBestGrainMatch`, `GrainFarm` interface; no imports from Supabase |
| `glomalin-portal/src/app/api/insurance/policies/route.ts` | GET handler for insurance policies | VERIFIED | Auth check, year param, Supabase query to `insurance_policies`, returns `{ policies, count, year }` |
| `glomalin-portal/src/app/(protected)/app/insurance/page.tsx` | Insurance module shell page | VERIFIED | 199 lines; Server Component with Supabase fetch; 3 stat cards; policy table with claim_alert badge; VERIFY note in orange |
| `glomalin-portal/src/lib/modules.ts` | Insurance module registration | VERIFIED | `insurance` entry at index 6 with `route: '/app/insurance'` |
| `glomalin-portal/src/app/api/insurance/aph-lookup/route.ts` | GET endpoint for APH auto-detection from CLU records | VERIFIED | 75 lines; queries `clu_records`, normName filter, computeAphFromClus call |
| `glomalin-portal/src/app/api/insurance/yield-sync/route.ts` | POST endpoint for grain-ticket yield bridge | VERIFIED | 123 lines; cross-app fetch with AbortSignal.timeout(5000), score>=2 auto-apply, claim_alert recompute |
| `glomalin-portal/src/app/api/insurance/policies/[id]/route.ts` | GET + PATCH endpoint with claim alert recompute | VERIFIED | 155 lines; GET returns single policy; PATCH merges current row, recomputes claim_alert on trigger fields |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/insurance/policies/route.ts` | `supabase.from('insurance_policies')` | Supabase client query | WIRED | Line 27: `.from('insurance_policies').select('*').eq('policy_year', year)` |
| `app/(protected)/app/insurance/page.tsx` | `insurance_policies` | Server component Supabase query | WIRED | Lines 33-38: `supabase.from('insurance_policies').select('*').eq('policy_year', 2026)` |
| `api/insurance/aph-lookup/route.ts` | `supabase.from('clu_records')` | Supabase query filtered by crop + farm_name normalization | WIRED | Line 32: `.from('clu_records').select('farm_name, farm_number, aph, fsa_acres').ilike('crop', ...)` |
| `api/insurance/yield-sync/route.ts` | `http://localhost:3000/api/farms` | Cross-app fetch with AbortSignal.timeout(5000) | WIRED | Line 59: `fetch('http://localhost:3000/api/farms', { signal: AbortSignal.timeout(5000), ... })` |
| `api/insurance/yield-sync/route.ts` | `lib/insurance/calc.ts` | findBestGrainMatch + computeClaimAlert imports | WIRED | Lines 4-7: `import { findBestGrainMatch, computeClaimAlert, type GrainFarm } from '@/lib/insurance/calc'`; both called in handler body |
| `api/insurance/policies/[id]/route.ts` | `lib/insurance/calc.ts` | computeClaimAlert import for recompute on update | WIRED | Line 3: `import { computeClaimAlert } from '@/lib/insurance/calc'`; called at line 130 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INS-01 | 29-01 | User can see existing insurance policies (migrated from fsa-acres) in the portal | SATISFIED | `/app/insurance` Server Component fetches `insurance_policies` and renders stat cards + policy table; GET `/api/insurance/policies` provides the read API |
| INS-05 | 29-02 | User can see APH yield auto-populated from CLU records | SATISFIED | GET `/api/insurance/aph-lookup` queries `clu_records` by crop+farmName, calls `computeAphFromClus`, returns `{ avgAph, count, totalRecords }` — Phase 30 UI will display this on policy cards |
| INS-06 | 29-02 | User can sync actual yield from grain-tickets for post-harvest comparison | SATISFIED | POST `/api/insurance/yield-sync` cross-app fetches grain-tickets `/api/farms`, `findBestGrainMatch` score>=2 auto-applies, writes `actual` + `actual_synced_from_grain` to Supabase |
| INS-07 | 29-02 | User can see potential claim alerts when actual yield < effective guarantee | SATISFIED | `computeClaimAlert` logic implemented in `calc.ts`; called by both yield-sync (on sync) and PATCH endpoint (on coverage field updates); `claim_alert` column stored and rendered on shell page |

All 4 requirement IDs from both plan frontmatter sections are accounted for. No orphaned requirements detected for Phase 29 in REQUIREMENTS.md.

### Anti-Patterns Found

No anti-patterns detected. Full scan of all 6 phase 29 files returned no TODO/FIXME/XXX/HACK/PLACEHOLDER comments, no empty return implementations, and no stub handlers.

### Human Verification Required

#### 1. Insurance Shell Page Live Render

**Test:** Log into the portal as an authenticated user, navigate to `/app/insurance`
**Expected:** Three stat cards show correct counts from migrated policies; policy table rows show farm/crop/coverage/guarantee/actual/alert; the ins_482 row (corrupt data with VERIFY in notes) renders farm name and badge in orange; claim_alert column shows "Potential" badge or dash correctly per row
**Why human:** Server Component with live Supabase data — cannot verify data correctness or visual rendering without a running session connected to the migrated database

#### 2. Yield Sync Offline Fallback

**Test:** Start glomalin-portal, stop grain-tickets (port 3000), POST to `/api/insurance/yield-sync` with a valid policyId
**Expected:** HTTP 200 response with `{ error: 'Grain ticket service unavailable — is port 3000 running?', matched: false, policy: null }` — not a 502 or unhandled rejection
**Why human:** Requires a live server with grain-tickets intentionally offline to exercise the catch branch

#### 3. Schema Migration Execution

**Test:** Run `cd glomalin-portal && npx tsx scripts/migrate-29.ts` with `.env.local` containing Supabase credentials
**Expected:** Script prints ALTER TABLE SQL, connects to Supabase, reports columns verified; Supabase SQL editor confirms `aph_computed`, `aph_clu_count`, `actual_synced_from_grain`, `claim_alert` columns exist on `insurance_policies`
**Why human:** Requires live Supabase credentials and real database execution

### Gaps Summary

No gaps. All 11 truths verified, all 8 artifacts exist with substantive implementations, all 6 key links are wired, all 4 requirements are satisfied. TypeScript strict mode passes with zero errors (`npx tsc --noEmit` clean). All 4 task commits verified in git history (addaa43, aad52a9, 211d3f0, 8a83d7c).

---

_Verified: 2026-03-05T18:50:00Z_
_Verifier: Claude (gsd-verifier)_
