---
phase: 49-canonical-field-ids
verified: 2026-03-24T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 49: Canonical Field IDs Verification Report

**Phase Goal:** Every field record in every app carries a registry_field_id that maps unambiguously to farm-registry — string-name fuzzy matching is eliminated across the platform
**Verified:** 2026-03-24
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | farm-budget fields accept `registryFieldId` on create and update | VERIFIED | `farm-budget/server.js` line 451: `'registryFieldId'` in updatable array; line 662: used in ID-first sync lookup |
| 2  | portal `clu_records` has a `registry_field_id` column | VERIFIED | `004-add-registry-field-id.sql` contains `ALTER TABLE clu_records ADD COLUMN IF NOT EXISTS registry_field_id text` + index |
| 3  | fsa-acres CLU records accept `registryFieldId` | VERIFIED | `fsa-acres/server.js` lines 130, 144, 168: `registryFieldId` in allowlists + documented on Object.assign handlers |
| 4  | grain-tickets `Farm.registryId` is the canonical field ID linkage | VERIFIED | `grain-tickets/prisma/schema.prisma` line 44: `registryId String?` |
| 5  | farm-registry exposes `/api/fields/autocomplete` endpoint | VERIFIED | `farm-registry/server.js` line 204: full implementation with `?q=` filtering, `Cache-Control: public, max-age=300`, returns `{ fields: [...] }` |
| 6  | Backfill script for each app exists with dry-run / `--commit` mode | VERIFIED | All 4 scripts exist: `farm-budget/backfill-field-ids.js`, `fsa-acres/backfill-field-ids.js`, `grain-tickets/backfill-field-ids.js`, `glomalin-portal/scripts/backfill-field-ids.ts` — each contains `process.argv.includes('--commit')` |
| 7  | Backfill scripts normalize and match against registry name + aliases | VERIFIED | All 4 scripts implement identical `normalize()` (trim + collapse whitespace + toLowerCase) and build alias lookup maps from `field.name` and `field.aliases` |
| 8  | Backfill scripts are idempotent (skip already-matched records) | VERIFIED | All 4 scripts skip records where `registryFieldId` / `registryId` / `registry_field_id` is already set |
| 9  | Backfill scripts fetch from farm-registry for matching | VERIFIED | `REGISTRY_URL = 'http://localhost:3005/api/fields'` in farm-budget and fsa-acres scripts; same pattern in grain-tickets and portal scripts |
| 10 | Cross-module sync in farm-budget and grain-tickets uses ID-first lookup | VERIFIED | `farm-budget/server.js` lines 648–673: ID-first via `regById[field.registryFieldId]` with name fallback + auto-upgrade; `grain-tickets/server.js` lines 985–1039: `POST /api/farms/sync-registry` with same ID-first pattern |
| 11 | Field selection UIs in grain-tickets, fsa-acres, and portal use registry-backed dropdowns | VERIFIED | `grain-tickets/public/admin.html` lines 95–542: autocomplete dropdown fetches from `/api/fields/autocomplete`, stores `registryId`; `fsa-acres/public/app.js` lines 262–313: upgraded autocomplete stores `registryFieldId`; `glomalin-portal/src/components/fsa/clu-card.tsx` lines 29–380: select dropdown from `/api/registry/fields-autocomplete` proxy, sets both `field_name` and `registry_field_id` |
| 12 | Old field name columns preserved for display alongside new ID fields | VERIFIED | All apps store ID as additive field alongside existing name; fsa-acres `openEditor` populates both `fieldName` and `registryFieldId`; portal draft stores both `field_name` and `registry_field_id` |

**Score: 12/12 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `farm-budget/server.js` | `registryFieldId` in updatable array + ID-first sync | VERIFIED | Lines 451 (updatable), 648–673 (sync with auto-upgrade) |
| `glomalin-portal/supabase/migrations/004-add-registry-field-id.sql` | `registry_field_id` column on `clu_records` | VERIFIED | Plan specified `003-` naming but 003 was taken; 004 is functionally identical |
| `fsa-acres/server.js` | `registryFieldId` accepted in CLU handlers | VERIFIED | Lines 130, 144, 168 with explicit comments |
| `farm-registry/server.js` | `/api/fields/autocomplete` endpoint | VERIFIED | Line 204, full implementation with sort, filter, Cache-Control |
| `farm-budget/backfill-field-ids.js` | Backfill script with `--commit` | VERIFIED | Exists, processes `fields[]` and `rent[]` arrays |
| `fsa-acres/backfill-field-ids.js` | Backfill script with `--commit` | VERIFIED | Exists, processes `cluRecords[]`, deduplicates unmatched names |
| `grain-tickets/backfill-field-ids.js` | Backfill script with Prisma integration | VERIFIED | Exists, uses PrismaClient, queries `Farm.registryId` |
| `glomalin-portal/scripts/backfill-field-ids.ts` | Backfill script with Supabase integration | VERIFIED | Exists, uses service role key, batches updates in groups of 50 |
| `grain-tickets/server.js` | `registryId` in field map + `POST /api/farms/sync-registry` endpoint | VERIFIED | Lines 758, 949, 985–1039 |
| `grain-tickets/public/admin.html` | Registry autocomplete dropdown for farm creation | VERIFIED | Lines 95–546: autocomplete input, hidden registryId field, fetch from port 3005 |
| `fsa-acres/public/app.js` | Upgraded autocomplete storing `registryFieldId` | VERIFIED | Lines 262–313 |
| `fsa-acres/public/index.html` | Hidden `ed-registryFieldId` input in editor | VERIFIED | Line 391 |
| `glomalin-portal/src/components/fsa/clu-card.tsx` | Registry field select dropdown + `registry_field_id` in draft | VERIFIED | Lines 29–380 |
| `glomalin-portal/src/app/api/registry/fields-autocomplete/route.ts` | Portal proxy for farm-registry autocomplete | VERIFIED | Uses `fetchRegistryService` helper pointing to `localhost:3005` |
| `glomalin-portal/src/lib/fsa/calc.ts` | `CluRecord` interface includes `registry_field_id` | VERIFIED | Line 23: `registry_field_id: string \| null` |
| `glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts` | `EDITABLE_FIELDS` includes `registry_field_id` and `field_name` | VERIFIED | Line 5: both fields in `EDITABLE_FIELDS` Set |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| farm-budget sync-registry | farm-registry `/api/fields/:id` | `registryFieldId` ID-first lookup, name fallback | WIRED | `server.js` line 648–673: `regById[field.registryFieldId]` used before name match; auto-stores ID on name match success |
| grain-tickets sync-registry | farm-registry `/api/fields/:id` | `registryId` ID-first lookup, name fallback | WIRED | `server.js` lines 985–1039: `POST /api/farms/sync-registry` with `regById[farm.registryId]` |
| grain-tickets farm form | farm-registry `/api/fields/autocomplete` | Direct HTTP fetch in `admin.html` | WIRED | Fetches `http://localhost:3005/api/fields/autocomplete` on page load; stores `registryId` on farm create |
| fsa-acres field autocomplete | farm-registry via fsa-acres proxy | Upgraded autocomplete → `/api/registry/fields-autocomplete` proxy → port 3005 | WIRED | `fsa-acres/server.js` line 688 proxies to `localhost:3005/api/fields/autocomplete`; `app.js` stores `registryFieldId` on selection |
| portal CLU card | farm-registry via portal proxy | fetch `/api/registry/fields-autocomplete` → `fetchRegistryService` → port 3005 | WIRED | `clu-card.tsx` fetches `/api/registry/fields-autocomplete`; proxy uses `fetchRegistryService` from `mobile/_lib/proxy.ts` which targets `localhost:3005` |
| all backfill scripts | farm-registry `/api/fields` | HTTP fetch to `localhost:3005/api/fields` | WIRED | All 4 scripts fetch from port 3005 as first step before matching |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONS-06 | 49-01 | Every field record in every app has a `registry_field_id` that maps to farm-registry | SATISFIED | Schema added to farm-budget (`registryFieldId`), fsa-acres (`registryFieldId`), portal (`registry_field_id` via migration 004), grain-tickets (`registryId` confirmed); all accept on create/update |
| CONS-07 | 49-03 | Cross-module data joins use registry field ID, not string name matching | SATISFIED | farm-budget sync uses ID-first; grain-tickets new `POST /api/farms/sync-registry` endpoint uses ID-first; both auto-upgrade name-matched records to store the ID; all 3 field selection UIs use registry-backed dropdowns |
| CONS-08 | 49-02 | Backfill scripts populate `registry_field_id` in farm-budget, grain-tickets, portal clu_records, and fsa-acres | SATISFIED | 4 backfill scripts created; each fetches registry, normalizes names, matches with alias lookup, dry-run by default, `--commit` writes IDs, idempotent on re-run |

All 3 requirement IDs from REQUIREMENTS.md are satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `farm-budget/server.js` | 1420 | `// TODO: derive from order dates if available` | Info | Pre-existing comment about delivery window, unrelated to phase 49 work |

No blockers. No warnings related to phase 49 artifacts.

---

### Noted Deviation (Non-Blocking)

**Plan 01 specified artifact path `glomalin-portal/supabase/migrations/003-add-registry-field-id.sql`** but the actual file is `004-add-registry-field-id.sql`. This is correct: `003-field-observations.sql` already existed and the 004 numbering prevents a collision. The SQL content, functional effect, and must-have truth are all satisfied by the 004 file.

---

### Human Verification Required

#### 1. Backfill coverage against live data

**Test:** With farm-registry running (`npm start` in `farm-registry/`), run `node farm-budget/backfill-field-ids.js` and `node fsa-acres/backfill-field-ids.js`
**Expected:** Match rate reported; `backfill-report.json` written listing matched, unmatched, and ambiguous field names; no script errors
**Why human:** Requires farm-registry service running; actual match rate against real data cannot be verified statically

#### 2. Registry field dropdown usability in fsa-acres editor

**Test:** Open fsa-acres app (port 3002), open a CLU record for edit, click into the Field Name input
**Expected:** Dropdown suggestions appear from farm-registry; selecting a field populates the display name and stores the registry ID; saving the record persists the `registryFieldId`
**Why human:** Browser-side autocomplete interaction and hidden input persistence require live UI testing

#### 3. Portal CLU card registry selector with unavailable registry

**Test:** Open the portal with farm-registry offline; open a CLU card and expand it
**Expected:** A fallback to a free-text input appears with a note that the registry is unavailable (per SUMMARY: "falls back to a free-text input with a note")
**Why human:** Requires controlled environment with farm-registry service down to test the fallback branch

#### 4. Portal Supabase migration applied

**Test:** Check Supabase database schema for `clu_records.registry_field_id` column
**Expected:** Column exists as nullable `text` type; index `idx_clu_records_registry_field_id` present
**Why human:** Migration file exists in codebase but must be applied manually via `supabase db push`; cannot verify database state statically

---

### Gaps Summary

None. All automated checks passed.

---

## Commit Verification

All 7 documented commits confirmed present in git history:

| Commit | Plan | Description |
|--------|------|-------------|
| `b6f1861` | 49-01 Task 1 | Add registryFieldId to farm-budget and fsa-acres data models |
| `501c274` | 49-01 Task 2 | Add registry_field_id to portal clu_records |
| `38f017e` | 49-01 Task 3 | Add /api/fields/autocomplete to farm-registry |
| `d47df52` | 49-02 Task 1 | farm-budget and fsa-acres backfill scripts |
| `b3b24cf` | 49-02 Task 2 | grain-tickets and portal backfill scripts |
| `08c4a7c` | 49-03 Task 1 | Sync-registry endpoints updated to ID-first |
| `e71a2be` | 49-03 Task 2 | Registry field dropdowns in all 3 app UIs |

---

_Verified: 2026-03-24_
_Verifier: Claude (gsd-verifier)_
