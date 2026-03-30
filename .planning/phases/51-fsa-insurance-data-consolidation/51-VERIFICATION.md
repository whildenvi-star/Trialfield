---
phase: 51-fsa-insurance-data-consolidation
verified: 2026-03-25T14:00:00Z
status: gaps_found
score: 3/4 success criteria verified
re_verification: false
gaps:
  - truth: "Migration script has been executed — fsa-acres/data/data.json renamed to data.json.migrated and records exist in Supabase"
    status: failed
    reason: "data.json still exists at fsa-acres/data/data.json (not renamed to .migrated). The migration script (migrate-fsa-final.ts) is fully built and correct, but has not been executed against a live Supabase instance. The phase goal states Portal Supabase is the single data store — that is only true once the data is actually moved. Currently fsa-acres server.js reads from an empty or stale Supabase clu_records table."
    artifacts:
      - path: "fsa-acres/data/data.json"
        issue: "File still present as active source data; should be data.json.migrated after successful migration"
    missing:
      - "Run: cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in glomalin-portal/.env.local)"
      - "Confirm output shows 444 CLU records, 22 pricing, 3 policies upserted"
      - "Confirm data.json renamed to data.json.migrated after successful run"
human_verification:
  - test: "Verify fsa-acres features work end-to-end after migration"
    expected: "Seasonal dashboard, reports, FSA entry, insurance — all show correct data pulled from Supabase (not zero results from empty tables)"
    why_human: "Cannot confirm Supabase has data without running the migration; feature correctness requires live data round-trip"
---

# Phase 51: FSA/Insurance Data Consolidation Verification Report

**Phase Goal:** Portal Supabase is the single data store for FSA CLU records and insurance policies — fsa-acres Express app is a consumer, not an owner, and no data lives in two places
**Verified:** 2026-03-25
**Status:** gaps_found — code fully wired, migration script not yet executed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migration script exists, reads data.json, detects duplicates, upserts to Supabase, verifies, renames on success | ? PARTIAL | `glomalin-portal/scripts/migrate-fsa-final.ts` (586 lines) fully implements all behaviors — but data.json still present at fsa-acres/data/data.json, confirming the script has not been executed yet |
| 2 | fsa-acres reads/writes CLU, insurance, pricing through Supabase — no data.json reads for farm data | ✓ VERIFIED | server.js uses `createClient(@supabase/supabase-js)`, `getCluRecords()` queries `clu_records`, `getInsurancePolicies()` queries `insurance_policies`, `getPricing()` queries `insurance_pricing`. No `loadData()`/`saveData()`/`store.` references. Only `fs.readFileSync` is for `settings.json` (app config, not farm data) |
| 3 | Portal has RMA scraper endpoint, staleness badge in insurance UI, manual refresh button | ✓ VERIFIED | `glomalin-portal/src/app/api/insurance/pricing/scrape/route.ts` (175 lines) exists, auth-gated, fetches from `public-rma.fpac.usda.gov`, upserts to `insurance_pricing`. `PricingStalenessBadge` (90 lines) imported and rendered in `insurance-workspace.tsx` line 284. `lastScraped` wired from `insurance/page.tsx` server query → workspace prop → badge |
| 4 | GCS enrollment feature completely removed from fsa-acres (UI + API + JS file) | ✓ VERIFIED | `fsa-acres/public/gcs.js` deleted (no file found). Zero `gcs`/`GCS` matches in `fsa-acres/public/index.html`. Zero `gcsEnrollments` references in `fsa-acres/server.js` |
| 5 | All fsa-acres rollup/export/season/validation endpoints read from Supabase, not JSON | ✓ VERIFIED | All rollup endpoints (`/api/rollup/by-farm`, `/api/rollup/by-crop`, etc.) call `getCluRecords()`. Exports (`/api/export/fsa`, `/api/export/insurance`) call `getCluRecords()` + `getInsurancePolicies()`. Season dashboard calls `getCluRecords()` + `getInsurancePolicies()`. Validation calls both + `getPricing()` |

**Score:** 4/5 truths pass automated checks (Truth 1 blocked by unexecuted migration)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/scripts/migrate-fsa-final.ts` | Migration script with dedup + verification | ✓ VERIFIED (substantive) | 586 lines. Reads `fsa-acres/data/data.json`. Duplicate detection on composite key (farmNumber+tractNumber+clu+crop). Batch upserts in 500-record chunks via `legacy_id` conflict key. Spot-checks 15 evenly-spaced records. `--dry-run` and `--force` flags. Renames file to `.migrated` on success. NOT YET EXECUTED. |
| `fsa-acres/server.js` | Express server using Supabase instead of JSON | ✓ VERIFIED (substantive) | 1,610 lines. `createClient` at line 10. `getCluRecords()`, `getInsurancePolicies()`, `getPricing()` helpers query Supabase. `mapToClient()`/`mapCluToDb()`/`mapInsuranceToDb()` column-mapping helpers. 10s CLU cache. 503 on Supabase unavailability. Settings-only `readFileSync` for `data/settings.json`. |
| `fsa-acres/package.json` | Contains @supabase/supabase-js | ✓ VERIFIED | `"@supabase/supabase-js": "^2.98.0"` present |
| `glomalin-portal/src/app/api/insurance/pricing/scrape/route.ts` | POST endpoint that scrapes USDA RMA | ✓ VERIFIED (substantive) | 175 lines. Auth-gated via `requireModuleAccess('insurance')`. Fetches from `public-rma.fpac.usda.gov`. Respects `manual_override`. Upserts to `insurance_pricing` on `crop` conflict key. Graceful failure handling (status 200 on error). |
| `glomalin-portal/src/components/insurance/pricing-staleness-badge.tsx` | Badge showing stale pricing warning | ✓ VERIFIED (substantive) | 90 lines. 7-day stale threshold. Amber warning vs green fresh states. "Refresh Prices" button with loading spinner. Inline feedback auto-clears after 6s. Calls `POST /api/insurance/pricing/scrape`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `migrate-fsa-final.ts` | `fsa-acres/data/data.json` | `fs.readFileSync` | ✓ WIRED | Line 88: `JSON.parse(fs.readFileSync(dataPath, 'utf8'))`. Path resolves to `../../fsa-acres/data/data.json` |
| `migrate-fsa-final.ts` | Supabase `clu_records` | `supabase.from().upsert()` | ✓ WIRED | Line 305: `supabase!.from('clu_records').upsert(chunk, { onConflict: 'legacy_id' })` |
| `fsa-acres/server.js` | Supabase `clu_records` | `supabase.from('clu_records')` | ✓ WIRED | `getCluRecords()` at line 265, plus direct queries in split/duplicate/bulk-update endpoints |
| `fsa-acres/server.js` | Supabase `insurance_policies` | `supabase.from('insurance_policies')` | ✓ WIRED | `getInsurancePolicies()` at line 275, plus CRUD endpoints |
| `fsa-acres/server.js` | Supabase `insurance_pricing` | `supabase.from('insurance_pricing')` | ✓ WIRED | `getPricing()` at line 282, plus pricing CRUD endpoints |
| `scrape/route.ts` | USDA RMA Price Discovery API | `fetch` to `public-rma.fpac.usda.gov` | ✓ WIRED | Line 39: URL constructed; line 43: `await fetch(rmaUrl, ...)` |
| `scrape/route.ts` | Supabase `insurance_pricing` | `supabase.from('insurance_pricing').upsert()` | ✓ WIRED | Line 158: `.from('insurance_pricing').upsert(rowsToUpsert, { onConflict: 'crop' })` |
| `pricing-staleness-badge.tsx` | `POST /api/insurance/pricing/scrape` | `fetch` in `handleRefresh` | ✓ WIRED | Line 26: `fetch('/api/insurance/pricing/scrape', { method: 'POST' })` |
| `insurance/page.tsx` | `insurance_pricing.last_scraped` | Supabase server query | ✓ WIRED | Lines 21-27: queries `insurance_pricing` for latest `last_scraped`, passes to `InsuranceWorkspace` as `lastScraped` prop |
| `insurance-workspace.tsx` | `PricingStalenessBadge` | import + render | ✓ WIRED | Line 10: import. Line 284: `<PricingStalenessBadge lastScraped={lastScraped} />` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONS-01 | 51-02 | Portal Supabase is single store for FSA CLU records — fsa-acres reads/writes through Supabase | ✓ SATISFIED (code) | `fsa-acres/server.js` rewired; all CLU CRUD uses `supabase.from('clu_records')`. NOTE: data not yet migrated. |
| CONS-02 | 51-02 | Portal Supabase is single store for insurance policies and pricing — fsa-acres reads/writes through Supabase | ✓ SATISFIED (code) | `getInsurancePolicies()` and `getPricing()` both query Supabase. All CRUD endpoints wired. |
| CONS-03 | 51-03 | USDA RMA price scraper available in portal and updates `insurance_pricing` table | ✓ SATISFIED | `POST /api/insurance/pricing/scrape` exists, fetches from RMA, upserts to `insurance_pricing`. |
| CONS-04 | 51-02 | fsa-acres seasonal dashboard, reports, GCS features continue working after consolidation | ✓ SATISFIED (GCS removed per design; others wired to Supabase) | Season dashboard uses `getCluRecords()` + `getInsurancePolicies()`. All rollup/export/validation endpoints use Supabase helpers. GCS removal was correct per user decision — not a regression. |
| CONS-05 | 51-01 | One-time data migration script with duplicate detection and verification | PARTIAL — script built, not executed | `migrate-fsa-final.ts` (586 lines) implements full spec: dedup, batch upsert, spot-check, rename. Dry-run confirmed working. Live migration NOT YET RUN — `data.json` still present at `fsa-acres/data/data.json`. |

All 5 CONS requirements mapped to plans. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scrape/route.ts` | 4-6 | TODO comment for daily cron job | ℹ️ Info | Explicitly deferred to future phase per plan decision. No impact on current functionality. |

No stubs, empty implementations, or blockers found in any artifact.

### Human Verification Required

#### 1. Execute migration and confirm data lands in Supabase

**Test:** With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in `glomalin-portal/.env.local`, run: `cd glomalin-portal && npx tsx scripts/migrate-fsa-final.ts --dry-run` (preview), then `npx tsx scripts/migrate-fsa-final.ts` (execute)
**Expected:** Output shows 444 CLU records, 22 pricing, 3 insurance policies upserted. Spot checks all pass. `fsa-acres/data/data.json` renamed to `data.json.migrated`. `fsa-acres` app then returns real data from Supabase.
**Why human:** Requires live Supabase credentials and network access to run. Cannot verify programmatically.

#### 2. fsa-acres features post-migration end-to-end

**Test:** After migration, start fsa-acres with Supabase env vars set. Visit the FSA Entry tab, Insurance tab, Reports tab, and Season Dashboard.
**Expected:** All tabs show data matching the original 444 CLU records and 3 insurance policies. No visible regressions. Season dashboard cross-app aggregation works correctly.
**Why human:** Feature correctness with real data round-trip cannot be verified statically.

### Gaps Summary

The code delivery for Phase 51 is complete and correct. All three plans produced substantive, wired artifacts:

- `migrate-fsa-final.ts` — full migration script ready to run
- `fsa-acres/server.js` — fully rewired from JSON to Supabase (1,610 lines)
- Portal RMA scraper endpoint + staleness badge — both implemented and wired

**The one remaining gap is execution:** `data.json` is still present at `fsa-acres/data/data.json`, confirming the one-time migration has not been run. Until the migration executes successfully, the phase goal — "Portal Supabase is the single data store" — is technically incomplete. The fsa-acres server will return empty results (or errors) for any endpoint because Supabase has no CLU records yet.

This is a deployment/run-time action, not a code gap. The migration script is safe to run (dry-run validated per 51-01-SUMMARY). No code changes are required — only execution of `npx tsx scripts/migrate-fsa-final.ts` with valid Supabase credentials.

---
_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
