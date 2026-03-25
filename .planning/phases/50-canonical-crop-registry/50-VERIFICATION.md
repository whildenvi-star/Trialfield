---
phase: 50-canonical-crop-registry
verified: 2026-03-24T00:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Start farm-registry and all consumer apps; open each app's crop dropdown"
    expected: "Dropdowns populate from registry data — categories like Corn, Soybeans, Wheat, Rye visible; organic crops display with Organic prefix where applicable"
    why_human: "Cannot verify live HTTP responses or UI rendering programmatically"
  - test: "Bring farm-registry down; reload crop dropdowns in farm-budget, grain-tickets, fsa-acres, portal, organic-cert"
    expected: "farm-budget, grain-tickets, portal, organic-cert show visible error states; fsa-acres shows empty autocomplete with no error message (known deviation — see anti-patterns)"
    why_human: "Runtime failure behavior requires manual testing"
  - test: "Create a grain ticket with crop 'Organic Soft Red Winter Wheat'; run GET /api/summary/by-crop"
    expected: "Response groups by registryCropId (e.g., crop_009), not by display name string — cross-module aggregation returns correct bushels"
    why_human: "End-to-end aggregation test requires live DB and registry"
---

# Phase 50: Canonical Crop Registry — Verification Report

**Phase Goal:** A single authoritative crop list lives in farm-registry and all apps fetch from it — no app hardcodes its own crop array
**Verified:** 2026-03-24
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | farm-registry data.json has a crops[] array with canonical records | VERIFIED | `d.crops.length === 38`; all records have id, name, aliases, organic bool, color, category |
| 2 | GET /api/crops endpoint returns crop records with canonical ID, name, and aliases | VERIFIED | Route at line 505 of server.js; 13 `/api/crops` references; GET/autocomplete/id/POST/PUT/DELETE all registered |
| 3 | farm-budget fetches crop dropdown from farm-registry instead of local cropTypes | VERIFIED | `field-editor.js` line 91 fetches `/api/registry/crops`; stores `registryCropId` on field save (line 916) |
| 4 | grain-tickets fetches crop dropdown from farm-registry instead of local cropConfig keys | VERIFIED | `tickets.js` has 15 references to `registry/crops` or `registryCropId`; proxy in `server.js` line 1032 |
| 5 | fsa-acres fetches crop dropdown from farm-registry instead of hardcoded array | VERIFIED | `app.js` line 383 fetches `/api/registry/crops`; stores `registryCropId` via hidden input |
| 6 | portal crop typeahead fetches from farm-registry instead of hardcoded FSA_CROP_LIST | VERIFIED | FSA_CROP_LIST hardcoded array deleted; `fsa-crop-list.ts` exports `fetchCropList()` async function; `crop-typeahead.tsx` fetches `/api/registry/crops-autocomplete` |
| 7 | organic-cert field-enterprises page fetches from farm-registry instead of hardcoded CROPS array | VERIFIED | CROPS hardcoded array deleted; line 90 fetches `http://localhost:3005/api/crops`; error state on failure |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `farm-registry/data/data.json` | crops[] array with 38 canonical records | VERIFIED | 38 records; all have id (crop_NNN), name, category, organic bool, bushelWeight, unit, color, aliases, active |
| `farm-registry/server.js` | CRUD endpoints for /api/crops | VERIFIED | GET, GET/autocomplete, GET/:id, POST, PUT, DELETE — 6 routes, 13 total references |
| `farm-budget/backfill-crop-ids.js` | Backfill registryCropId into farm-budget records | VERIFIED | Exists; targets `fields[].crop` and `cropTypes[].subCrops[].name`; dry-run/commit pattern; fetches `http://localhost:3005/api/crops` |
| `grain-tickets/backfill-crop-ids.js` | Backfill registryCropId into CropConfig and Ticket | VERIFIED | Exists; fetches registry; updates CropConfig and Ticket via Prisma; `--commit` flag |
| `fsa-acres/backfill-crop-ids.js` | Backfill registryCropId into CLU records | VERIFIED | Exists; dry-run/commit pattern |
| `glomalin-portal/scripts/backfill-crop-ids.ts` | Backfill registry_crop_id into portal clu_records | VERIFIED | Exists; Supabase service role; batched groups of 50 |
| `glomalin-portal/supabase/migrations/005-add-registry-crop-id.sql` | registry_crop_id column on clu_records | VERIFIED | `ADD COLUMN IF NOT EXISTS registry_crop_id TEXT` + index |
| `grain-tickets/prisma/schema.prisma` | registryCropId on CropConfig and Ticket | VERIFIED | Lines 20 and 71; `@@index([registryCropId])` on Ticket |
| `glomalin-portal/src/app/api/registry/crops-autocomplete/route.ts` | Portal proxy to farm-registry /api/crops | VERIFIED | Fetches `fetchRegistryService('/api/crops')`; returns 502 on failure (no silent fallback) |
| `farm-budget/public/field-editor.js` | Crop dropdown from registry | VERIFIED | Fetches `/api/registry/crops` on load; stores registryCropId on selection |
| `grain-tickets/public/tickets.js` | Ticket crop dropdown from registry | VERIFIED | 15 registry/crops references including fetch and registryCropId storage |
| `fsa-acres/public/app.js` | CLU crop autocomplete from registry | VERIFIED | Fetches `/api/registry/crops` via proxy; stores via hidden `ed-registryCropId` input |
| `glomalin-portal/src/components/fsa/crop-typeahead.tsx` | Crop typeahead from registry | VERIFIED | Fetches `/api/registry/crops-autocomplete`; passes registryCropId to onChange |
| `organic-cert/src/app/(app)/field-enterprises/page.tsx` | Field enterprise crop dropdown from registry | VERIFIED | Fetches `http://localhost:3005/api/crops`; error state on failure |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `farm-registry/data/data.json` | `farm-registry/server.js` | `data.crops` read/write | WIRED | server.js reads `store.crops` from data.json on startup; CRUD writes back |
| `farm-budget/public/field-editor.js` | `farm-registry /api/crops` | fetch on load | WIRED | `fetch('/api/registry/crops')` at line 91; response assigned to `_registryCrops`; used to build dropdown |
| `grain-tickets/public/tickets.js` | `farm-registry /api/crops` | fetch for autocomplete | WIRED | 15 references; fetch via proxy; registryCropId captured on select and included in form submit |
| `fsa-acres/public/app.js` | `farm-registry /api/crops` | fetch on focus | WIRED | `api.get('/api/registry/crops')` at line 383; crops used to render grouped autocomplete dropdown |
| `glomalin-portal/src/components/fsa/crop-typeahead.tsx` | `farm-registry /api/crops` | fetch via Next.js proxy | WIRED | `fetch('/api/registry/crops-autocomplete')` at line 29; `resolveRegistryCropId()` passes ID to onChange |
| `organic-cert/src/app/(app)/field-enterprises/page.tsx` | `farm-registry /api/crops` | direct cross-app fetch | WIRED | `fetch("http://localhost:3005/api/crops")` at line 90; mapped to `RegistryCrop[]` state; used in Select dropdown |
| `grain-tickets/server.js` `computeCropSummariesByRegistryId()` | `registryCropId` on Ticket | groups by canonical ID | WIRED | Line 406: key is `t.registryCropId` (falls back to `__name__:cropName` for unbackfilled tickets); exposed via `GET /api/summary/by-crop` |
| `farm-budget/backfill-crop-ids.js` | `farm-registry /api/crops` | HTTP fetch | WIRED | `REGISTRY_URL = 'http://localhost:3005/api/crops'` at line 29 |
| `grain-tickets/backfill-crop-ids.js` | `farm-registry /api/crops` | HTTP fetch | WIRED | Fetches crop list from registry for alias matching |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONS-09 | 50-01 | Canonical crop registry in farm-registry with crop ID, canonical name, and per-app name aliases | SATISFIED | 38 records in data.json; each has `id`, `name`, `aliases[]`; `bushelWeight`, `color`, `organic`, `category` also present |
| CONS-10 | 50-03 | All apps fetch crop list from farm-registry instead of hardcoded local arrays | SATISFIED | FSA_CROP_LIST deleted; CROPS array deleted; all 5 consumer apps (farm-budget, grain-tickets, fsa-acres, portal, organic-cert) fetch from registry |
| CONS-11 | 50-02, 50-03 | Cross-module crop aggregation uses canonical crop ID, not display name | SATISFIED | `GET /api/summary/by-crop` in grain-tickets groups by `registryCropId`; Prisma schema has indexed `registryCropId` on Ticket; backfill scripts exist to populate historical records |

All 3 phase requirement IDs accounted for. REQUIREMENTS.md marks all three `[x]` complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `fsa-acres/public/app.js` | 385 | `.catch(function () { _fsaRegistryCrops = []; })` — silent failure, no user-visible error | Warning | When farm-registry is down, fsa-acres crop autocomplete shows an empty dropdown with no error message. The plan specifies "registry down = visible failure." Other consumers (organic-cert, portal, farm-budget) show explicit error states. fsa-acres silently degrades. This does not break the phase goal (registry is still the source — no hardcoded fallback), but fails the "visible failure" contract. |

No blocker anti-patterns found. No hardcoded crop arrays remain. No TODO/PLACEHOLDER stubs detected in key files.

---

### Human Verification Required

#### 1. Crop Dropdown Rendering Across Apps

**Test:** Start all services (`pm2 start`). Open farm-budget field editor, grain-tickets new ticket form, fsa-acres CLU editor, portal FSA-578 page, organic-cert field-enterprises page. Click each crop dropdown/autocomplete.
**Expected:** All dropdowns populate from registry — 38 crops grouped by category (Corn, Soybeans, Wheat, Rye, etc.); organic crops display with "Organic " prefix where `organic: true`.
**Why human:** UI rendering and data display cannot be verified programmatically.

#### 2. Registry-Down Failure Visibility

**Test:** Stop farm-registry (`pm2 stop farm-registry`). Open each consumer app's crop selection UI.
**Expected:** farm-budget, grain-tickets, portal, organic-cert show a visible error or disabled state. fsa-acres shows an empty autocomplete (known deviation — no explicit error message).
**Why human:** Runtime failure behavior requires a live environment.

#### 3. Cross-Module Crop Aggregation (CONS-11 end-to-end)

**Test:** Run grain-tickets backfill with `--commit` to populate `registryCropId` on existing tickets. Then `GET http://localhost:3007/api/summary/by-crop`.
**Expected:** Response contains entries keyed by canonical crop ID (e.g., `registryCropId: "crop_018"` for Hybrid Rye) with `totalNetLbs` and `ticketCount` aggregated across all Hybrid Rye tickets regardless of how the crop name string was entered.
**Why human:** Requires running database with backfilled records.

#### 4. registryCropId Stored on New Records

**Test:** Create a new grain ticket via the UI, selecting "Hybrid Rye" from the registry-backed dropdown. Query the database: `SELECT "ticketNo", "crop", "registryCropId" FROM "Ticket" ORDER BY id DESC LIMIT 1`.
**Expected:** `registryCropId = "crop_018"` (or whichever ID maps to Hybrid Rye) is stored alongside the crop name string.
**Why human:** Requires live form interaction and database inspection.

---

### Gaps Summary

No gaps found. All phase truths are verified against the codebase. The sole deviation — fsa-acres providing no visible error state when farm-registry is down — is a warning-level issue that does not block the phase goal (the registry is still the authoritative source; there is no hardcoded fallback array). CONS-09, CONS-10, and CONS-11 are all satisfied.

---

_Verified: 2026-03-24_
_Verifier: Claude (gsd-verifier)_
