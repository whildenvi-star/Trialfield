---
phase: 56-structured-aph-database
verified: 2026-03-28T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 56: Structured APH Database — Verification Report

**Phase Goal:** Insurance APH records exist as a structured multi-year table with computed APH and automatically derived insurance guarantees — not as manually maintained spreadsheet values
**Verified:** 2026-03-28
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | APH records table exists in Supabase with year, actual yield, source tag, and disaster-year exclusion flag | VERIFIED | migrate-56.ts creates `aph_records` with all required columns including `source text NOT NULL DEFAULT 'manual'`, `is_disaster_year boolean NOT NULL DEFAULT false`, `UNIQUE(policy_id, crop_year)` |
| 2 | GET /api/insurance/aph returns APH records for a policy with computed APH average excluding disaster years | VERIFIED | route.ts calls `computeAphFromRecords(records)` and returns `{records, computedAph, includedCount, excludedCount, totalCount, guarantee, coverageLevel}` |
| 3 | POST /api/insurance/aph creates a new APH record with source tracking | VERIFIED | route.ts validates `policy_id`, `crop_year`, `actual_yield`, defaults `source` to `'manual'`, returns 201 with `{record}`, returns 409 on duplicate year |
| 4 | PATCH /api/insurance/aph/[id] can toggle disaster-year exclusion and update yield | VERIFIED | [id]/route.ts accepts partial body, patches only provided fields, sets `updated_at` server-side |
| 5 | DELETE /api/insurance/aph/[id] removes an APH record | VERIFIED | [id]/route.ts deletes by id, returns 200 `{deleted: true}` on success, 404 if no rows matched |
| 6 | Computed APH is a simple average of non-excluded non-zero years | VERIFIED | `computeAphFromRecords` in calc.ts filters `!r.is_disaster_year && r.actual_yield > 0`, computes `round2(sum / includedCount)` |
| 7 | Insurance guarantee is derived from computed APH multiplied by coverage level | VERIFIED | `computeGuarantee(aph, coverageLevel)` returns `round2(aph * (coverageLevel / 100))` |
| 8 | Clicking a policy row reveals an APH panel showing a year-by-year table of actual yields with source badges | VERIFIED | aph-panel.tsx renders full table with Year / Actual Yield / Source / Disaster Year / Actions columns; insurance-workspace.tsx renders `<AphPanel>` when `selectedPolicy !== null` |
| 9 | Each APH row shows crop year, actual yield, source tag, and a disaster-year toggle | VERIFIED | Table rows render `SourceBadge` (GT=green, IMP=blue, MAN=gray), checkbox toggle calling PATCH, delete "x" button |
| 10 | Toggling disaster-year exclusion immediately recalculates the displayed APH average | VERIFIED | `handleToggleDisaster` calls PATCH then `fetchData()`, which updates `computedAph` and `guarantee` state, triggering `onGuaranteeChange` callback |
| 11 | User can add a new APH year record inline and delete an existing one | VERIFIED | Form below table POSTs to `/api/insurance/aph`; 409 shows "Year already exists" inline; delete button confirms then DELETEs |
| 12 | The guarantee column in the policy table auto-updates when APH changes | VERIFIED | `handleGuaranteeChange` in insurance-workspace.tsx calls `setPolicies(prev => prev.map(...))` to update the matching policy's `guarantee` field in local state |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/scripts/migrate-56.ts` | Supabase migration creating aph_records table | VERIFIED | 244 lines; full CREATE TABLE, UNIQUE constraint, index, RLS, verify-select pattern; dry-run flag |
| `glomalin-portal/src/app/api/insurance/aph/route.ts` | GET (list + computed APH) and POST (create) endpoints | VERIFIED | 137 lines; exports `GET` and `POST`; imports `computeAphFromRecords` and `computeGuarantee` from calc.ts |
| `glomalin-portal/src/app/api/insurance/aph/[id]/route.ts` | PATCH and DELETE endpoints for individual APH records | VERIFIED | 91 lines; exports `PATCH` and `DELETE`; partial-update pattern with `updated_at` |
| `glomalin-portal/src/lib/insurance/calc.ts` | computeAphFromRecords and computeGuarantee pure functions | VERIFIED | 216 lines; exports `AphRecord` interface, `computeAphFromRecords`, `computeGuarantee`; correct filter logic |
| `glomalin-portal/src/components/insurance/aph-panel.tsx` | APH management panel — year table, source badges, disaster toggle, add/delete, computed APH display | VERIFIED | 401 lines (exceeds 100 min); full 'use client' component with all required features |
| `glomalin-portal/src/components/insurance/insurance-workspace.tsx` | APH panel wired into policy selection flow | VERIFIED | Imports `AphPanel`; renders in "APH History" section between policy table and Coverage Matrix; `handleGuaranteeChange` updates policy state |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `aph/route.ts` | `supabase.from('aph_records')` | Supabase query | WIRED | `.from('aph_records').select('*').eq('policy_id', policyId).order(...)` |
| `aph/route.ts` | `src/lib/insurance/calc.ts` | import computeAphFromRecords | WIRED | `import { computeAphFromRecords, computeGuarantee } from '@/lib/insurance/calc'` — both functions called in GET handler |
| `aph-panel.tsx` | `/api/insurance/aph` | fetch calls for CRUD | WIRED | `fetch('/api/insurance/aph?policyId=...')` (GET), `fetch('/api/insurance/aph', {method:'POST',...})`, `fetch('/api/insurance/aph/${id}', {method:'PATCH'})`, `fetch('/api/insurance/aph/${id}', {method:'DELETE'})` |
| `insurance-workspace.tsx` | `aph-panel.tsx` | import and render AphPanel | WIRED | `import { AphPanel } from './aph-panel'`; rendered at line 518 with `onGuaranteeChange={handleGuaranteeChange}` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| APH-01 | 56-01, 56-02 | APH records table stores 4-10 years of actual yield per farm/unit/crop with source tracking | SATISFIED | `aph_records` table with `source` column (manual/grain-tickets/import), `UNIQUE(policy_id, crop_year)`, full CRUD API, source badges visible in UI |
| APH-02 | 56-01, 56-02 | APH computed from yield history using simple average (excluding zero-yield disaster years) | SATISFIED | `computeAphFromRecords` filters `!is_disaster_year && actual_yield > 0`, computes simple average; disaster rows shown with strikethrough + "excluded" count in UI |
| APH-03 | 56-01, 56-02 | Insurance guarantee auto-calculated from computed APH × coverage level | SATISFIED | `computeGuarantee(aph, coverageLevel)` returns `round2(aph * coverageLevel / 100)`; GET endpoint returns `guarantee`; AphPanel calls `onGuaranteeChange` after every CRUD op; policy table updates via `setPolicies` callback |

---

### Anti-Patterns Found

None detected. The two `placeholder` matches in aph-panel.tsx are HTML input `placeholder=""` attributes (not stub patterns). No TODO/FIXME/empty implementations found in any modified file.

---

### Human Verification Required

#### 1. Disaster-year visual feedback

**Test:** Add an APH record, then toggle its disaster-year checkbox.
**Expected:** The yield cell gains strikethrough styling, the row becomes muted, and the computed APH value above the table decreases immediately (refetch completes). The "excluded" count increments.
**Why human:** CSS class application and visual state transition cannot be confirmed programmatically.

#### 2. Coverage level slider → guarantee update

**Test:** Open the insurance workspace, select a policy, view the APH panel showing a computed APH, then change the policy's coverage level via the coverage slider (if present in the workspace).
**Expected:** The guarantee displayed in AphPanel updates to reflect the new coverage level without requiring a page reload.
**Why human:** The AphPanel receives `coverageLevel` as a prop from the parent; verifying the prop flows live from a slider change requires runtime observation. Note: the panel displays the guarantee from the API response which uses the DB coverage level — if the slider only updates local state and does not pass through to AphPanel props, this could be a gap worth checking.

#### 3. Grain-tickets sync source tag

**Test:** Create a record with `source: 'grain-tickets'` via POST /api/insurance/aph and confirm it displays the green "GT" badge in the table.
**Expected:** GT badge renders with green background; manual records show gray "MAN"; import records show blue "IMP".
**Why human:** Badge color rendering requires browser/visual confirmation.

---

### Gaps Summary

No gaps. All 12 must-have truths verified. All 6 required artifacts exist with substantive, non-stub implementations. All 4 key links are wired (imports present and called). All 3 requirement IDs (APH-01, APH-02, APH-03) are satisfied with direct code evidence.

The phase goal — "Insurance APH records exist as a structured multi-year table with computed APH and automatically derived insurance guarantees" — is achieved. The system no longer relies on manually maintained spreadsheet values: APH is computed dynamically from the `aph_records` table at query time, disaster years are excluded programmatically, and the guarantee is derived from computed APH and the policy's coverage level.

---

_Verified: 2026-03-28_
_Verifier: Claude (gsd-verifier)_
