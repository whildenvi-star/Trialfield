---
phase: 27-fsa-data-foundation-migration
verified: 2026-03-05T14:00:00Z
status: gaps_found
score: 3/4 success criteria verified
re_verification: false
gaps:
  - truth: "All Express proxy route handlers respond with correct data and fall back gracefully when fsa-acres app is offline"
    status: failed
    reason: "No portal route handler proxies to fsa-acres (port 3002). The auto-populate-preview route handles farm-budget (port 3001) being offline, but the success criterion specifically says 'when fsa-acres app is offline'. Zero portal API routes fetch from localhost:3002. The migration reads fsa-acres/data/data.json directly as a file — not via the running Express app. If fsa-acres goes offline, nothing in the portal degrades because the portal never called it."
    artifacts:
      - path: "glomalin-portal/src/app/api/fsa/auto-populate-preview/route.ts"
        issue: "Proxies to farm-budget (localhost:3001) with correct 502 fallback, but the criterion specifies fsa-acres (localhost:3002) offline handling"
    missing:
      - "Clarification or rewrite of criterion 4: if the intent was 'farm-budget offline graceful degradation', this IS implemented and criterion should be reworded. If the intent was fsa-acres proxy routes, they were never built."
      - "If portal-to-fsa-acres proxy routes are intended, create GET /api/fsa/legacy-proxy/route.ts that fetches from localhost:3002 and returns 502 with 'FSA-acres app is offline' when unreachable"
human_verification:
  - test: "Navigate to /app/fsa-578 in the portal while logged in as a user with fsa-578 module access"
    expected: "4 stat cards render with real data: CLU Records, Total Acres, Crops Assigned, Unreported. Cards show non-zero values if migration was run."
    why_human: "Requires Supabase credentials (.env.local) and a running migration. Cannot verify live DB data programmatically."
  - test: "Call GET /api/fsa/validation while authenticated (with migration data in Supabase)"
    expected: "Returns { warnings: [...], recordCount: 444 } where warnings array contains entries with types: missing-crop, missing-date, unreported, no-insurance, missing-price"
    why_human: "Requires live Supabase with migrated data. Structural code is verified; runtime behavior with real data needs human confirmation."
  - test: "Call GET /api/fsa/auto-populate-preview while farm-budget (port 3001) is offline"
    expected: "Returns HTTP 502 with { error: 'Farm-budget is offline — auto-populate unavailable' }"
    why_human: "Runtime test requiring a running Next.js server with the farm-budget stopped."
  - test: "Run migration script twice: cd glomalin-portal && npx tsx scripts/migrate-fsa.ts (requires .env.local)"
    expected: "Both runs produce identical counts: clu_records: 444, insurance_pricing: 22, insurance_policies: 3, claims: 3, gcs_enrollments: 149"
    why_human: "Requires Supabase credentials. Idempotency cannot be verified without live database."
---

# Phase 27: FSA Data Foundation + Migration — Verification Report

**Phase Goal:** CLU records from fsa-acres live in Supabase and the portal can read, validate, and auto-populate FSA crop assignments from farm-budget
**Verified:** 2026-03-05T14:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open the portal fsa-578 module and see all CLU records from the 2026 crop year | HUMAN NEEDED | Page exists, queries clu_records, renders 4 stat cards — requires running migration with credentials |
| 2 | Validation logic runs server-side and returns structured warnings (missing-crop, missing-date, unreported) for the CLU dataset | VERIFIED | GET /api/fsa/validation exists, calls validateCluRecords via Promise.all with 3 Supabase queries, returns {warnings, recordCount} |
| 3 | User can trigger auto-populate from farm-budget macro rollup and see a preview before changes are committed | VERIFIED | GET /api/fsa/auto-populate-preview fetches localhost:3001 with AbortSignal.timeout(5000), returns proposals for ALL CLU records with matchConfidence field |
| 4 | All Express proxy route handlers respond with correct data and fall back gracefully when fsa-acres app is offline | FAILED | No portal route connects to fsa-acres (port 3002). The offline fallback built is for farm-budget (port 3001). The literal criterion is unaddressed. |

**Score:** 2 code-verified + 1 human-needed + 1 failed = 3/4 success criteria addressed in implementation (criterion 4 is a gap)

### Required Artifacts

#### Plan 27-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/scripts/migrate-fsa.ts` | Repeatable upsert migration from fsa-acres/data/data.json | VERIFIED | 527 lines, upserts all 5 tables with onConflict: 'legacy_id', batch chunks of 500, verifyMigration() post-check |
| `glomalin-portal/src/lib/modules.ts` | fsa-578 module registration | VERIFIED | Contains id: 'fsa-578', label: 'FSA 578', sublabel: 'Acreage Reporting', route: '/app/fsa-578' |
| `glomalin-portal/src/app/(protected)/app/fsa-578/page.tsx` | FSA 578 module page rendering CLU record count | VERIFIED | 82 lines, Server Component, queries clu_records from Supabase, renders 4 stat cards with soil design tokens |
| `glomalin-portal/src/app/api/fsa/clu-records/route.ts` | GET endpoint returning CLU records scoped by crop year | VERIFIED | Exports GET, auth check, year param (default 2026), ordered select from clu_records, returns {records, count, year} |

#### Plan 27-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/src/lib/fsa/calc.ts` | TypeScript port with all rollup, validation, summary, insurance functions | VERIFIED | 645 lines, 5 interfaces, TILLAGE_CODES + 11 exported functions, all snake_case properties |
| `glomalin-portal/src/app/api/fsa/validation/route.ts` | Validation API returning structured warnings | VERIFIED | 55 lines, exports GET, Promise.all for 3 Supabase queries, calls validateCluRecords, returns {warnings, recordCount} |
| `glomalin-portal/src/app/api/fsa/auto-populate-preview/route.ts` | Cross-app proxy returning crop diff proposals | VERIFIED | 237 lines, exports GET, AbortSignal.timeout(5000), exact offline error message, ALL CLU records in proposals |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| scripts/migrate-fsa.ts | Supabase clu_records table | upsert with onConflict: 'legacy_id' | VERIFIED | Lines 287, 307, 345, 434 — all 4 table upserts use onConflict: 'legacy_id' |
| api/fsa/clu-records/route.ts | Supabase clu_records | supabase.from('clu_records').select('*') | VERIFIED | Lines 28-33 — select with crop_year filter and ordered results |
| lib/modules.ts | middleware module_access check | fsa-578 ID matching module_access.module column | VERIFIED | Middleware extracts moduleId from /app/{moduleId} dynamically (line 25); no hardcoded IDs needed |
| api/fsa/validation/route.ts | lib/fsa/calc.ts | import { validateCluRecords } from '@/lib/fsa/calc' | VERIFIED | Line 3 import + line 49 call with real Supabase data |
| api/fsa/validation/route.ts | Supabase clu_records + insurance_pricing + insurance_policies | Promise.all with 3 queries | VERIFIED | Lines 20-24 — parallel fetch of all 3 tables |
| api/fsa/auto-populate-preview/route.ts | localhost:3001/api/dashboard | fetch with AbortSignal.timeout(5000) | VERIFIED | Line 202 — exact pattern from plan spec |
| api/fsa/auto-populate-preview/route.ts | Supabase clu_records | supabase.from('clu_records').select(...) | VERIFIED | Lines 216-219 — selective field fetch with crop_year filter |
| portal routes | fsa-acres (port 3002) | any proxy or fetch | NOT WIRED | No portal route fetches from localhost:3002. Migration reads data.json directly as file. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FSA-01 | 27-01 | User can see existing CLU records (migrated from fsa-acres) in the portal, scoped by crop year | SATISFIED | fsa-578 page queries clu_records from Supabase; API route GET /api/fsa/clu-records returns ordered records by crop_year |
| FSA-05 | 27-02 | User can see validation warnings (missing crop, date, unreported) with clickable links | SATISFIED | validateCluRecords produces 5 warning types (missing-crop/error, missing-date/error, unreported/warning, no-insurance/warning, missing-price/info) with filter fields for Phase 28 clickable links |
| FSA-06 | 27-02 | User can auto-populate CLU crop assignments from farm-budget macro rollup with preview | SATISFIED | auto-populate-preview returns proposals for ALL CLU records with matchConfidence (exact/suggested/none), read-only preview (no writes) |

All 3 requirement IDs from plan frontmatter are satisfied by code. REQUIREMENTS.md marks FSA-01, FSA-05, FSA-06 as complete and mapped to Phase 27.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scripts/migrate-fsa.ts | 369 | `return null` | Info | Legitimate logic: skips claim row if policy UUID lookup fails (logs warning). Not a stub. |
| src/lib/fsa/calc.ts | 113, 118 | `return null` | Info | Legitimate: findPrice() returns null for no-match. Not a stub. |

No blocking anti-patterns found. No TODO/FIXME/placeholder comments in any phase 27 artifacts.

### Calc Engine Verification

The plan requires 12 exports (11 functions + TILLAGE_CODES constant). Actual exports from calc.ts:

1. `TILLAGE_CODES` — constant
2. `rollupByFarm` — function
3. `rollupByCrop` — function
4. `rollupByField` — function
5. `rollupByTract` — function
6. `summaryMetrics` — function (returns dryAcres, irrigatedAcres, organicAcres, recordCount plus additional fields)
7. `computeInsurancePolicy` — function
8. `validateCluRecords` — function (5 warning types, corrected severities)
9. `reportingProgress` — function
10. `tillageSummary` — function
11. `coverCropSummary` — function
12. `gcsSummary` — function

All 12 exports present. Severity corrections confirmed:
- missing-crop: 'error' (was 'warning' in calc.js)
- missing-date: 'error' (was 'info' in calc.js)
- unreported: 'warning' (was 'info' in calc.js)
- no-insurance: 'warning' (unchanged)
- missing-price: 'info' (demoted from 'warning')

Note: Plan 27-02 frontmatter lists `summaryMetrics` but the plan task description omits it from the "Functions to port" list. The function IS present in calc.ts (line 306) with a slightly richer return shape (adds farmCount, coverCroppedAcres, reportedAcres). This is additive and not a gap.

### Source Data Verification

fsa-acres/data/data.json record counts (verified via Node.js):
- cluRecords: 444 (matches plan target)
- pricing: 22 (matches plan target)
- insurancePolicies: 3 (matches plan target)
- gcsEnrollments: 149 (matches plan target)
- settings.year: 2026

Migration script maps all 444 CLU records with complete camelCase-to-snake_case translation and handles the specific ins_482 corrupt-data flag.

### Git Commits Verified

| Commit | Description | Files |
|--------|-------------|-------|
| 95ed61e | feat(27-01): add FSA migration script and register fsa-578 module | migrate-fsa.ts, modules.ts, package.json |
| d690fc8 | feat(27-01): add fsa-578 module page and CLU records API route | fsa-578/page.tsx, clu-records/route.ts |
| fce021b | feat(27-02): TypeScript port of FSA calc engine to lib/fsa/calc.ts | calc.ts |
| a7d1982 | feat(27-02): validation API + auto-populate preview API for FSA module | validation/route.ts, auto-populate-preview/route.ts |

### Human Verification Required

#### 1. FSA-578 Module Page Renders Real Data

**Test:** Log into the portal as a user with fsa-578 module access. Navigate to /app/fsa-578.
**Expected:** Page renders with 4 stat cards showing non-zero values from Supabase (CLU Records, Total Acres, Crops Assigned, Unreported). No error state visible.
**Why human:** Requires running migration with Supabase credentials (.env.local not yet populated). 27-01 SUMMARY explicitly documents this as "User Setup Required."

#### 2. Validation Endpoint Returns All 5 Warning Types

**Test:** With migration data in Supabase, call GET /api/fsa/validation from an authenticated session.
**Expected:** Response contains { warnings: [...], recordCount: 444 } where warnings array includes entries with types: missing-crop, missing-date, unreported, no-insurance, missing-price.
**Why human:** Requires live Supabase with real CLU, pricing, and policy data. Cannot verify runtime behavior without database.

#### 3. Auto-Populate Preview Returns 502 When Farm-Budget Offline

**Test:** Stop the farm-budget Express app (port 3001). Call GET /api/fsa/auto-populate-preview from an authenticated portal session.
**Expected:** HTTP 502 with body { error: "Farm-budget is offline — auto-populate unavailable" }.
**Why human:** Requires running Next.js server with farm-budget intentionally stopped.

#### 4. Migration Idempotency

**Test:** Run `cd glomalin-portal && npx tsx scripts/migrate-fsa.ts` twice with credentials.
**Expected:** Both runs report identical counts: clu_records: 444, insurance_pricing: 22, insurance_policies: 3, claims: 3, gcs_enrollments: 149. No duplicates.
**Why human:** Requires Supabase credentials and live database connection.

### Gaps Summary

**One gap found affecting success criterion 4:**

Success criterion 4 states: "All Express proxy route handlers respond with correct data and fall back gracefully when fsa-acres app is offline."

The implementation does NOT include any portal route that proxies to fsa-acres (port 3002). The only cross-app proxy built in phase 27 is `auto-populate-preview` which fetches from farm-budget (port 3001) — and that proxy DOES handle the offline case correctly with a 502.

The plans (27-01, 27-02) never specified building a portal-to-fsa-acres proxy. The CONTEXT.md explicitly says "Legacy fsa-acres Express app stays running read-only on port 3002 as reference" — suggesting the portal never needs to call it. The migration reads data.json as a file.

**Most likely interpretation:** Criterion 4 was written loosely to mean "the portal's cross-app proxy routes handle upstream failures gracefully." Under that reading, the auto-populate-preview 502 behavior satisfies the spirit of the criterion and the gap is a wording issue.

**Stricter interpretation:** A portal route that calls fsa-acres was expected. None exists.

This ambiguity requires the planner or project owner to clarify whether criterion 4 needs a dedicated fsa-acres proxy route, or whether the farm-budget offline handling satisfies the criterion's intent.

---

_Verified: 2026-03-05T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
