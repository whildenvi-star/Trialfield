---
phase: 45-crop-plan-viewer
verified: 2026-03-19T00:00:00Z
status: gaps_found
score: 10/12 must-haves verified
re_verification: false
gaps:
  - truth: "Tapping a field card navigates to a detail page with crop, variety, population, inputs with rates, and pass checklist"
    status: partial
    reason: "Population and seed treatment are returned by the API but not stored in CachedCropPlan (types.ts omits these fields). The detail page hardcodes 'Not specified' and 'None' for both with a comment acknowledging the gap. Variety does display correctly."
    artifacts:
      - path: "glomalin-portal/src/lib/offline/types.ts"
        issue: "CachedCropPlan interface missing population and seedTreatment fields"
      - path: "glomalin-portal/src/app/(protected)/crop-plans/[fieldId]/page.tsx"
        issue: "Lines 218-229 hardcode 'Not specified' and 'None' for population and seedTreatment regardless of API data"
    missing:
      - "Add population?: string | null and seedTreatment?: string | null to CachedCropPlan in types.ts"
      - "Update detail page to render plan.population and plan.seedTreatment from the CachedCropPlan"
      - "Update syncCropPlanDetail to map population/seedTreatment from API response into the cache write (the API already returns both fields)"

  - truth: "GET /api/mobile/crop-plans/[fieldId] returns full field detail including inputs (product, rate, unit) and passes (type, status, date, operator)"
    status: partial
    reason: "API correctly returns population and seedTreatment in the JSON response, but these fields are silently dropped when the response is stored via cropPlanCache.put() because CachedCropPlan does not define them. Data loss occurs at the cache layer."
    artifacts:
      - path: "glomalin-portal/src/lib/offline/types.ts"
        issue: "CachedCropPlan interface does not include population or seedTreatment"
      - path: "glomalin-portal/src/lib/offline/crop-plan-sync.ts"
        issue: "syncCropPlanDetail casts API response directly to CachedCropPlan — extra fields (population, seedTreatment) are silently dropped by TypeScript's structural typing"
    missing:
      - "Extend CachedCropPlan with population and seedTreatment"
human_verification:
  - test: "Offline field list renders from cache"
    expected: "With network disabled (airplane mode or DevTools offline), reload /crop-plans — field list should appear from IndexedDB with amber Offline banner"
    why_human: "IndexedDB behavior and navigator.onLine cannot be verified without a browser"
  - test: "Pull-to-refresh triggers sync"
    expected: "Pull down from the top of the field list on a touch device — a new sync fires and the Last Synced badge updates"
    why_human: "Touch events require physical or emulated touch interaction"
  - test: "Last Synced badge aging colors"
    expected: "After 24h without sync the badge turns amber; after 48h it turns red"
    why_human: "Requires time manipulation or waiting — cannot be verified statically"
  - test: "48px touch targets"
    expected: "All field cards, buttons, and back navigation are easy to tap with work gloves (48px minimum)"
    why_human: "Visual/tactile UX quality check"
---

# Phase 45: Crop Plan Viewer Verification Report

**Phase Goal:** Field operators can see every field's crop plan and pass status on a mobile screen, and that data remains readable when they lose signal
**Verified:** 2026-03-19
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/mobile/crop-plans returns fields array with fieldId, fieldName, crop, variety, acres, enterprise, syncTimestamp | VERIFIED | route.ts lines 57-65: response object has all fields; TTL cache at line 63 |
| 2 | GET /api/mobile/crop-plans/[fieldId] returns crop, variety, population, seedTreatment, inputs, passes, syncTimestamp | PARTIAL | API returns all fields; population/seedTreatment dropped at cache layer due to missing CachedCropPlan fields |
| 3 | Data aggregates from farm-budget fields + enterprises in parallel | VERIFIED | Promise.all([fetchBudgetService('/api/enterprises'), fetchBudgetService('/api/fields?all=true')]) |
| 4 | Response includes syncTimestamp ISO string | VERIFIED | Both routes return syncTimestamp: new Date().toISOString() |
| 5 | 502 returned when farm-budget unreachable | VERIFIED | catch block returns NextResponse.json({ error: 'Farm-budget service unavailable' }, { status: 502 }) |
| 6 | 60-second in-memory TTL cache in list endpoint | VERIFIED | Module-level `let cached` variable with 60_000ms expiry at route.ts line 63 |
| 7 | Operator sees enterprise-grouped field list with field name and crop on each card | VERIFIED | groupedFields useMemo + sortedEnterpriseKeys render, each card shows fieldName + crop/variety |
| 8 | Search box filters field list by field name in real time | VERIFIED | filteredFields useMemo filters on fieldName.toLowerCase().includes(searchQuery.toLowerCase()) |
| 9 | Tapping a field card navigates to detail page with crop, variety, population, inputs, pass checklist | PARTIAL | Variety renders; population always shows "Not specified" (hardcoded); inputs and passes render correctly |
| 10 | Last Synced badge visible with amber/red aging thresholds | VERIFIED | getSyncBadgeClass helper: >48h red-600, >24h amber-600, default muted-foreground |
| 11 | Offline banner appears and field list renders from IndexedDB cache | VERIFIED (code path) | OfflineBanner renders null when online / amber banner when offline; doSync falls back to getCachedCropPlans() on failure or offline |
| 12 | Pull-to-refresh triggers fresh sync | VERIFIED (code path) | handleTouchMove: when delta > 60px and scrollY === 0, doSync() fires |

**Score:** 10/12 truths verified (2 partial due to same root cause)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `glomalin-portal/src/app/api/mobile/crop-plans/route.ts` | — | 72 | VERIFIED | Exports GET, TTL cache, parallel fetch, enterprise sort, 502 fallback |
| `glomalin-portal/src/app/api/mobile/crop-plans/[fieldId]/route.ts` | — | 80 | VERIFIED | Exports GET, auth, parallel fetch, inputs filter, machinery-to-pass map, 404/502 handling |
| `glomalin-portal/src/app/api/mobile/_lib/proxy.ts` | — | 49 | VERIFIED | fetchRegistryService added (REGISTRY_BASE port 3005, embed_session + 8s timeout) |

### Plan 02 Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `glomalin-portal/src/app/(protected)/crop-plans/page.tsx` | 100 | 320 | VERIFIED | Full implementation: state, sync, search, grouping, pull-to-refresh, scroll restore, skeleton |
| `glomalin-portal/src/app/(protected)/crop-plans/[fieldId]/page.tsx` | 80 | 309 | PARTIAL | Full implementation except population/seedTreatment hardcoded as "Not specified"/"None" |
| `glomalin-portal/src/lib/offline/crop-plan-sync.ts` | 40 | 98 | VERIFIED | All 5 exports present with SSR guards; cropPlanCache.put/get/getAll/getLastSyncTime wired |
| `glomalin-portal/src/components/pwa/offline-banner.tsx` | 20 | 42 | VERIFIED | Client component, mounted guard, online/offline event listeners, amber banner |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| crop-plans/route.ts | farm-budget /api/enterprises and /api/fields | fetchBudgetService | WIRED | Lines 31-34: Promise.all([fetchBudgetService('/api/enterprises'), fetchBudgetService('/api/fields?all=true')]) |
| [fieldId]/route.ts | organic-cert /api/field-enterprises/[id]/operations | fetchCertService | NOT WIRED | Plan noted this as intentional deferral to Phase 46 — passes sourced from farm-budget machinery[] only |
| crop-plans/page.tsx | /api/mobile/crop-plans | fetch via crop-plan-sync | WIRED | syncCropPlans called in doSync(); fetch('/api/mobile/crop-plans') in crop-plan-sync.ts line 29 |
| crop-plan-sync.ts | db.ts cropPlanCache | cropPlanCache.put/getAll/getLastSyncTime | WIRED | All three methods used: put() in syncCropPlans and syncCropPlanDetail, getAll() in getCachedCropPlans, getLastSyncTime() in getLastSyncTime |
| [fieldId]/page.tsx | /api/mobile/crop-plans/[fieldId] | fetch via syncCropPlanDetail | WIRED | syncCropPlanDetail(token, fieldId) in loadPlan(); fetch('/api/mobile/crop-plans/${fieldId}') in crop-plan-sync.ts line 67 |

**Note on fetchCertService link:** The plan explicitly documented that organic-cert enrichment is deferred to Phase 46. All passes are returned as PLANNED status, which is the correct MVP behavior for this phase.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CPV-01 | 45-01-PLAN.md | Portal API route aggregating field + enterprise + input + seed + planned pass data from farm-budget with 60s TTL cache and graceful fallback | SATISFIED | Both routes exist and implement TTL cache, parallel fetch, 502 fallback. Organic-cert enrichment deferred to Phase 46 per plan. |
| CPV-02 | 45-02-PLAN.md | Mobile-optimized field list with search/filter, big tap targets, grouped by crop/enterprise | SATISFIED | Enterprise-grouped list with 72px cards, 48px search input, real-time useMemo filter |
| CPV-03 | 45-02-PLAN.md | Field detail page showing crop, variety, population, planned inputs with rates, and planned pass checklist with pass status | PARTIAL | Crop, variety, inputs, and passes display correctly. Population and seedTreatment always show "Not specified"/"None" — API returns them but CachedCropPlan type doesn't carry them through. |
| CPV-04 | 45-02-PLAN.md | Crop plan data cached in IndexedDB on each successful sync, displayed from cache when offline; stale-data indicator shows last sync time | SATISFIED | cropPlanCache.put() called in both sync functions; offline fallback to getCachedCropPlans()/getCachedCropPlan(); Last Synced badge with 24h/48h color thresholds |

**Orphaned requirements:** None. All four CPV requirements declared in REQUIREMENTS.md map to Phase 45 plans and are accounted for.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| [fieldId]/page.tsx | 218-228 | Hardcoded "Not specified" and "None" for population/seedTreatment with comment "CachedCropPlan doesn't have population" | Warning | Population and seed treatment data from farm-budget is silently discarded — visible to operator as always-empty fields on detail page |
| page.tsx | 259 | `placeholder="Search fields..."` | Info | Standard HTML placeholder attribute, not a stub |

---

## Human Verification Required

### 1. Offline field list renders from cache

**Test:** Disable network (DevTools offline or airplane mode) and reload /crop-plans
**Expected:** Field list renders from IndexedDB; amber "Offline - showing cached data" banner appears at top
**Why human:** IndexedDB behavior and navigator.onLine state cannot be verified statically

### 2. Pull-to-refresh triggers sync

**Test:** On a touch device or DevTools touch emulation, pull down from the top of the field list more than 60px
**Expected:** A sync fires and the Last Synced badge updates to the current time
**Why human:** Touch events require physical or emulated interaction

### 3. Last Synced badge aging colors

**Test:** With a cache entry older than 24 hours, load /crop-plans
**Expected:** Badge text is amber; after 48 hours the badge turns red
**Why human:** Requires time manipulation or waiting

### 4. 48px touch targets

**Test:** Open /crop-plans on a mobile screen or DevTools mobile view; attempt to tap field cards, search input, sync button, and back button
**Expected:** All interactive elements are easy to tap without precise finger placement
**Why human:** Visual and tactile UX quality, cannot be verified from source alone

---

## Gaps Summary

There is one root-cause gap blocking full CPV-03 satisfaction: `CachedCropPlan` in `types.ts` does not include `population` or `seedTreatment` fields. The API (`[fieldId]/route.ts`) already returns both fields in its JSON response. However, when `syncCropPlanDetail` casts the response to `CachedCropPlan` and calls `cropPlanCache.put()`, TypeScript's structural assignment silently drops these unrecognized fields. The detail page then reads from the cache and finds no population or seedTreatment, so it hardcodes fallback text.

The fix is contained to three files: extend the `CachedCropPlan` interface, update `syncCropPlanDetail` to explicitly map the new fields, and update the detail page to render them. The API route itself requires no changes.

All other must-haves are fully implemented and verified. The offline caching, IndexedDB wiring, enterprise grouping, search, sync badge color aging, and graceful degradation logic are all substantive and correctly connected.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
