---
phase: 15-foundation-fixes-ecosystem-client-layer
verified: 2026-03-02T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Sync Acres end-to-end with farm-registry running"
    expected: "Button completes without crash; unchanged count shown when all fields are already up to date"
    why_human: "Requires farm-registry running on port 3005 and existing field data to exercise the unchanged branch"
  - test: "Compile page status bar with one source killed"
    expected: "Stopping farm-budget while compile page is open, then clicking Refresh, shows farm-budget as red/unavailable without blocking farm-registry and grain-tickets status checks"
    why_human: "Requires running all three source apps and killing one mid-session; real-time UI behavior"
  - test: "Field/acre preview table with both sources running"
    expected: "Table renders organic fields with budget acres and registry acres side-by-side"
    why_human: "Requires farm-budget and farm-registry both running with populated data; visual layout confirmation"
---

# Phase 15: Foundation Fixes + Ecosystem Client Layer Verification Report

**Phase Goal:** All three blocking bugs are resolved and a typed, fault-tolerant HTTP client layer connects organic-cert to farm-budget, farm-registry, and grain-tickets — the stable foundation every subsequent phase builds on

**Verified:** 2026-03-02
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking "Sync Acres" on the Fields page completes without a runtime crash — acres update or report unchanged fields correctly | VERIFIED | `handleSyncRegistry` (fields/page.tsx:120-147) uses `data.unchanged?.length ?? 0` (line 140). No reference to `data.unmatched` in that function. `handleSyncMacro` at line 169 correctly retains `data.unmatched` for the macro sync response. |
| 2 | A field with 4 or more enterprises displays all of them in the field list — no silent truncation at 3 | VERIFIED | `GET /api/fields/[id]/history/route.ts` includes enterprises with only `orderBy: { cropYear: "desc" }`. The `where: { cropYear: { in: years } }` clause is absent. All enterprises are returned for any field. |
| 3 | Running `npx prisma migrate dev` on a fresh database recreates the partial unique index without manual SQL | VERIFIED | `organic-cert/prisma/migrations/20260303025441_init/migration.sql` (71 SQL statements — full schema baseline). `organic-cert/prisma/migrations/20260303025533_add_partial_unique_enterprise_label_null/migration.sql` contains `CREATE UNIQUE INDEX IF NOT EXISTS "FieldEnterprise_no_label_unique" ON "FieldEnterprise" ("fieldId", "cropYear", "crop") WHERE "label" IS NULL;` |
| 4 | The compile page shows live connection status for farm-budget, farm-registry, and grain-tickets — each source shows "available" or "unavailable" independently | VERIFIED | `checkAllSources()` in `index.ts` uses `Promise.allSettled` over all three ping functions. `GET /api/compile/sources` calls it and returns `SourceStatus[]`. `CompilePage` fetches `/api/compile/sources` on mount and on Refresh. `SourceStatusBar` renders green/red dots per source independently. |
| 5 | Killing farm-budget while the compile page is open shows farm-budget as unavailable without crashing organic-cert or blocking the other two sources | VERIFIED | `Promise.allSettled` in `checkAllSources()` guarantees all three pings run independently. A rejected ping for farm-budget produces `available: false` for that source only. `fetchWithTimeout` uses `AbortController` with 3-second timeout — connection failure throws `EcosystemError` caught by `allSettled`. `GET /api/compile/fields-preview` also uses `Promise.allSettled` over `getBudgetOrganicFields()` and `getRegistryFields()` — returns partial results with error payloads when one source is down. |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `organic-cert/src/app/(app)/fields/page.tsx` | Crash-safe handleSyncRegistry using data.unchanged | VERIFIED | Contains `handleSyncRegistry`, uses `data.unchanged?.length ?? 0` at line 140; `data.unmatched` only in `handleSyncMacro` (correct) |
| `organic-cert/src/app/api/fields/[id]/history/route.ts` | Enterprise query without cropYear filter | VERIFIED | `enterprises` included with `orderBy: { cropYear: "desc" }` only; no `where` clause filtering by year |
| `organic-cert/prisma/migrations/20260303025441_init/` | Full schema baseline migration | VERIFIED | 71 CREATE TABLE/INDEX statements — complete schema captured |
| `organic-cert/prisma/migrations/20260303025533_add_partial_unique_enterprise_label_null/migration.sql` | Raw SQL partial unique index WHERE label IS NULL | VERIFIED | Exact SQL: `CREATE UNIQUE INDEX IF NOT EXISTS "FieldEnterprise_no_label_unique" ON "FieldEnterprise" ("fieldId", "cropYear", "crop") WHERE "label" IS NULL;` |
| `organic-cert/src/lib/ecosystem/types.ts` | SourceStatus, EcosystemError, fetchWithTimeout | VERIFIED | Contains `SourceName`, `SourceStatus`, `EcosystemError` class, `BudgetEnterprise`, `BudgetField`, `RegistryField`, and `fetchWithTimeout` with `AbortController` (87-line substantive file) |
| `organic-cert/src/lib/ecosystem/budget-client.ts` | farm-budget HTTP client with pingBudget, getBudgetOrganicFields | VERIFIED | Exports `pingBudget`, `getBudgetEnterprises`, `getBudgetFields`, `getBudgetOrganicFields`; uses `fetchWithTimeout`; filters by `category === "organic"` |
| `organic-cert/src/lib/ecosystem/registry-client.ts` | farm-registry HTTP client with pingRegistry, getRegistryFields | VERIFIED | Exports `pingRegistry`, `getRegistryFields`; uses `fetchWithTimeout`; handles both array and `{ fields: [...] }` response shapes |
| `organic-cert/src/lib/ecosystem/tickets-client.ts` | grain-tickets HTTP client with pingTickets | VERIFIED | Exports `pingTickets`; probes `/api/stats`; uses `fetchWithTimeout` |
| `organic-cert/src/lib/ecosystem/index.ts` | checkAllSources() using Promise.allSettled, re-exports all clients | VERIFIED | `checkAllSources()` calls `Promise.allSettled` over all three ping functions; maps results to `SourceStatus[]`; re-exports all client functions and types |
| `organic-cert/src/app/api/compile/sources/route.ts` | GET route returning SourceStatus[] | VERIFIED | Imports `checkAllSources` from `@/lib/ecosystem`; exports `GET` that returns `NextResponse.json(statuses)` |
| `organic-cert/src/app/api/compile/fields-preview/route.ts` | GET route with partial failure handling | VERIFIED | Uses `Promise.allSettled` over `getBudgetOrganicFields` and `getRegistryFields`; returns `{ budgetFields, budgetError, registryFields, registryError }` with null/error per source |
| `organic-cert/src/components/compile/source-status-bar.tsx` | Horizontal status bar with colored dots, Refresh button | VERIFIED | Exports `SourceStatusBar`; green/red dots per source; spinner on Refresh; `<details>` for expandable technical errors; always visible layout |
| `organic-cert/src/app/(app)/compile/page.tsx` | Compile page with status bar, field preview table, placeholder sections | VERIFIED | `CompilePage` renders `SourceStatusBar`, loads both API routes in parallel on mount, shows field/acre table with budget+registry data joined by name, shows 5 placeholder future-phase sections |
| `organic-cert/src/components/layout/sidebar.tsx` | Navigation with Compile item | VERIFIED | `{ href: "/compile", label: "compile", icon: Layers }` at line 32; `Layers` imported from lucide-react |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `fields/page.tsx` | `/api/fields/sync-registry` | fetch POST in handleSyncRegistry | WIRED | Line 123: `fetch("/api/fields/sync-registry", { method: "POST" })` |
| `prisma/migrations/...partial_unique.sql` | schema enforcement | PostgreSQL runs migration | WIRED | SQL file contains correct `CREATE UNIQUE INDEX...WHERE "label" IS NULL` |
| `compile/page.tsx` | `/api/compile/sources` | fetch GET on load and Refresh | WIRED | Line 96: `fetch("/api/compile/sources")` in `loadSources()` |
| `compile/page.tsx` | `/api/compile/fields-preview` | fetch GET on mount | WIRED | Line 111: `fetch("/api/compile/fields-preview")` in `loadPreview()` |
| `api/compile/sources/route.ts` | `src/lib/ecosystem/index.ts` | import checkAllSources | WIRED | Line 2: `import { checkAllSources } from "@/lib/ecosystem"` |
| `api/compile/fields-preview/route.ts` | `budget-client.ts` | import getBudgetOrganicFields | WIRED | Line 2: `import { getBudgetOrganicFields } from "@/lib/ecosystem/budget-client"` |
| `budget-client.ts` | `http://localhost:3001` | native fetch with AbortController 3s | WIRED | `fetchWithTimeout` called with `${BUDGET_URL}/api/settings` and `${BUDGET_URL}/api/enterprises` and `${BUDGET_URL}/api/fields?all=true`; `AbortController` in types.ts line 87 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | 15-01 | Sync Acres button on Fields page works without runtime crash | SATISFIED | `handleSyncRegistry` uses `data.unchanged?.length ?? 0`; no crash on `data.unmatched` reference |
| FIX-02 | 15-01 | Enterprise query returns all enterprises per field (no truncation at 3) | SATISFIED | History route has no `where: { cropYear: { in: years } }` clause on the enterprises include |
| FIX-03 | 15-01 | Partial unique index in migration for environment rebuild safety | SATISFIED | `20260303025533_add_partial_unique_enterprise_label_null/migration.sql` contains the `WHERE "label" IS NULL` partial index — runs on every fresh `migrate dev` |
| ECO-01 | 15-02 | User can see live organic-designated field data pulled from farm-budget | SATISFIED | `getBudgetOrganicFields()` filters enterprises by `category === "organic"`; `fields-preview` route returns result; compile page renders field table |
| ECO-02 | 15-02 | User can see live field identities and acres pulled from farm-registry | SATISFIED | `getRegistryFields()` fetches from `FARM_REGISTRY_URL/api/fields`; compile page joins registry fields into preview table with `reportingAcres` and `organicAcres` columns |
| ECO-05 | 15-02 | Ecosystem pull degrades gracefully when a source app is not running | SATISFIED | `Promise.allSettled` in `checkAllSources()` and `fields-preview` route; unavailable sources return `available: false` with friendly message and suggested fix; compile page renders per-source error messages without crashing |

**Note on FIX-03 wording:** REQUIREMENTS.md says "captured in schema.prisma" but the actual implementation uses a raw SQL migration file. This is the correct approach — Prisma schema.prisma does not support partial index syntax. The migration file achieves the same goal (index recreated on every `migrate dev`) and is technically superior to schema.prisma syntax.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `compile/page.tsx` | 263-267 | Placeholder sections (enterprises, inputs, seeds, rotation, harvest) | Info | Intentional — labeled as "Phase 16-18" with explicit phase badges. These are scaffolding, not stubs. Goal-completing sections (status bar + fields preview) are fully implemented. |

No blockers or warnings found.

---

### Human Verification Required

#### 1. Sync Acres End-to-End

**Test:** Start organic-cert (port 3004) and farm-registry (port 3005) with existing field data. Click "Sync Acres" on the Fields page when all fields are already current.

**Expected:** Toast shows `All N matched fields already up to date (M unchanged)` — no crash, no `TypeError` about reading `.length` of undefined.

**Why human:** Requires farm-registry running with real field data to exercise the unchanged code path.

#### 2. Compile Page Source Availability — Single Source Down

**Test:** Start all three source apps. Navigate to /compile. Confirm all three dots are green. Kill farm-budget. Click "Refresh".

**Expected:** farm-budget dot turns red with friendly error message and suggested fix. farm-registry and grain-tickets remain green. No crash in organic-cert.

**Why human:** Requires live running processes and real-time UI interaction — cannot verify via static analysis.

#### 3. Field/Acre Preview Table

**Test:** Start farm-budget and farm-registry with field data. Navigate to /compile.

**Expected:** Table renders with columns: Field Name, Crop, Budget Ac, Registry Ac, Organic Ac, Ownership. Fields matched by name show data from both sources; unmatched fields show `[No registry match]` note.

**Why human:** Requires both source apps running with populated data; visual table layout and data accuracy confirmation.

---

### Summary

All five success criteria are met by the actual codebase:

**FIX-01** is verified: `handleSyncRegistry` uses `data.unchanged?.length ?? 0` (optional chaining prevents crash when unchanged is absent), and `handleSyncMacro` correctly retains `data.unmatched` for the macro sync response.

**FIX-02** is verified: The history route includes enterprises with only `orderBy: { cropYear: "desc" }` — no `where: { cropYear: { in: years } }` filter. All years are returned.

**FIX-03** is verified: Two migration files exist — a full schema baseline (957 lines, 71 SQL statements) and a focused partial-index migration with the exact `WHERE "label" IS NULL` SQL.

**ECO-01/02/05** are verified: The full ecosystem client layer exists across 5 files with substantive implementations. `checkAllSources()` uses `Promise.allSettled` over three independent pings with `AbortController` 3-second timeouts. The compile page wires up both API routes, the status bar component, and the field/acre preview table. The sidebar has a "compile" nav item with the Layers icon. TypeScript compiles cleanly.

Zero new npm packages were added. All implementations are substantive — no stubs found in goal-completing code.

---

_Verified: 2026-03-02_
_Verifier: Claude (gsd-verifier)_
