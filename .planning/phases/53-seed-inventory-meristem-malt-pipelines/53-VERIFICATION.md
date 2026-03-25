---
phase: 53-seed-inventory-meristem-malt-pipelines
verified: 2026-03-25T21:00:00Z
status: gaps_found
score: 3/4 must-haves verified
re_verification: false
gaps:
  - truth: "The NOP C9.0 audit section is auto-populated from seed-inventory delivery data including lot number, cert number, OMRI status, and supplier name"
    status: partial
    reason: "omriListed is hardcoded to false in report-assembler.ts and the OMRI column is absent from the seed-compliance.tsx PDF table. Lot number, cert number, and supplier name render correctly. OMRI status — explicitly required by the success criterion — is missing from the output."
    artifacts:
      - path: "organic-cert/src/lib/pdf/sections/seed-compliance.tsx"
        issue: "9-column table has no OMRI column. COLUMNS array contains Crop/Variety, Lot #, Cert #, Supplier, Organic?, Untreated?, Status, Fields, Acres — OMRI absent."
      - path: "organic-cert/src/lib/report-assembler.ts"
        issue: "omriListed hardcoded to false (line 508). The field exists on SeedLotRecord interface but is never populated from the Prisma SeedLot model (which does not store it) and is never forwarded to the PDF renderer."
    missing:
      - "Add 'OMRI?' column to COLUMNS array in seed-compliance.tsx and render lot.omriListed as Yes/No per row"
      - "Either: (a) store omriListed on the Prisma SeedLot model and populate it during seed compile commit, then read it in the assembler — OR (b) accept omriListed=false as a known limitation and document it. If (b), remove OMRI from the success criterion or add a note in the PDF section."
---

# Phase 53: Seed Inventory + Meristem-Malt Pipelines Verification Report

**Phase Goal:** Organic-cert reads seed lot data from seed-inventory (eliminating double-entry) and meristem-malt pulls actual grain cost from settled prices in grain-tickets
**Verified:** 2026-03-25T21:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Organic-cert compilation reads lot numbers and cert numbers from seed-inventory — a seed entry in farm-budget is no longer needed for NOP compliance | VERIFIED | `seed-mapper.ts` uses `Promise.allSettled([getBudgetFieldsWithInputs(), getBudgetSeeds(), getSeedLots()])`. `siLotByKey` is built from seed-inventory lots. `sourceApp: siLot ? "seed-inventory" : "farm-budget"` provenance field present on all preview rows. SeedLot upsert populates `certNumber` and `lotNumber` from seed-inventory on create, with conditional update guarding user edits. |
| 2 | The NOP C9.0 audit section is auto-populated from seed-inventory delivery data including lot number, cert number, OMRI status, and supplier name | PARTIAL | `seed-compliance.tsx` renders lot number, cert number, supplier name, and compliance verdict. OMRI status is absent — not in the 9-column table, and `omriListed` is hardcoded `false` in `report-assembler.ts`. The SeedLotRecord interface has the field but it is never populated from the database or from the compile pipeline. |
| 3 | Meristem-malt pricing table shows grain cost pulled from actual grain-tickets settlement prices, with a "synced from grain tickets" indicator and manual override flag visible | VERIFIED | `grain-tickets/server.js` line 912: `GET /api/settlement-prices` queries `prisma.settlementLine` for matched/manual lines, groups by crop, returns `avgPricePerBushel`. `meristem-malt/server.js`: `POST /api/grain-prices/sync` fetches settlement prices, maps crop names, respects `manualOverrides`. `meristem-malt/public/app.js`: GT badge (`badge-gt`), Manual badge (`badge-manual`), "Sync from Grain Tickets" button, `lastSyncedAt` timestamp display — all present and substantive. |

**Score:** 2.5/3 truths verified (Truth 2 partial)

---

## Required Artifacts

### Plan 01 (PIPE-05) — Seed Inventory Pipeline

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `seed-inventory/server.js` | `/api/organic/seed-lots` returns `omriListed`, `supplierName`, `organicGround` | VERIFIED | Lines 1653-1681: supplier lookup map built, `supplierName: supplierMap[p.supplier]`, `omriListed: p.omriListed \|\| false`, `organicGround: !!p.organicGround` all present. |
| `organic-cert/src/lib/ecosystem/seed-inventory-client.ts` | `getSeedLots()` function with `SeedLotFromInventory` interface | VERIFIED | Full `SeedLotFromInventory` interface (lines 15-30) with all required fields. `getSeedLots()` fetches `/api/organic/seed-lots` with token auth, uses `fetchWithTimeout`, graceful EcosystemError. |
| `organic-cert/src/lib/compile/seed-mapper.ts` | `mapSeeds()` uses seed-inventory as primary source | VERIFIED | `Promise.allSettled` tri-fetch (line 67-72), `siLotByKey` map (lines 101-110), SI data merged into preview rows (lines 269-274), fallback to farm-budget when SI unavailable. |
| `organic-cert/src/lib/compile/types.ts` | `SeedPreviewRow` has 5 new fields | VERIFIED | Lines 100-105: `lotNumber`, `organicCertNumber`, `omriListed`, `supplierName`, `sourceApp` all present with correct types. |
| `organic-cert/src/app/api/compile/[year]/seeds/route.ts` | Conditional upsert update for certNumber/lotNumber | VERIFIED | Lines 178-184: `update: seedData.sourceApp === "seed-inventory" ? { certNumber, lotNumber } : {}` — conditional update block guards user-edited values. |

### Plan 02 (PIPE-07, PIPE-08) — Meristem-Malt Grain Price Sync

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grain-tickets/server.js` | `GET /api/settlement-prices` with avg price per crop | VERIFIED | Lines 912-953: queries `settlementLine` with `matchStatus: { in: ['matched', 'manual'] }`, groups by crop, returns `avgPricePerBushel`, `lineCount`, `buyerName`. Supports `cropYear` and `buyerName` filters. |
| `meristem-malt/server.js` | Sync endpoints + pricingSync store | VERIFIED | Lines 9-10: `GRAIN_TICKETS_URL`/`TOKEN` constants. Lines 128-141: `pricingSync` store field with migration. `POST /api/grain-prices/sync` (line 197), `GET /api/grain-prices/status` (line 192), `PUT /api/grain-prices/override/:key` (line 239) — all present and substantive. |
| `meristem-malt/public/app.js` | Sync button, GT badge, Manual badge, override toggle | VERIFIED | `pricingSync` state (line 110), `renderSyncBar()` renders "Sync from Grain Tickets" button (line 677), `badge-gt` and `badge-manual` badge HTML (lines 724-726), `lastSyncedAt` display (line 674). |

### Plan 03 (PIPE-06) — NOP C9.0 PDF Section

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` | C9.0 section with lot #, cert #, OMRI status, supplier | STUB (OMRI missing) | File exists and is substantive. Renders 9-column table including Lot #, Cert #, Supplier. OMRI column absent — `omriListed` field never referenced in component. |
| `organic-cert/src/lib/report-assembler.ts` | `SeedLotRecord` interface + `seedLots` query | VERIFIED (partial) | `SeedLotRecord` interface at line 130. `seedLots` in `ReportData`. `prisma.seedLot.findMany` with `seedUsages` include at line 465. `checkSeedCompliance` applied per lot. `omriListed` hardcoded `false` (line 508) — field not on Prisma SeedLot model. |
| `organic-cert/src/lib/pdf/inspection-report.tsx` | `SeedCompliance` import + render | VERIFIED | Line 16: `import { SeedCompliance }` from seed-compliance. Lines 58-59: `<SeedCompliance seedLots={data.seedLots} ...>` rendered between ApplicationLog and HarvestLog. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `organic-cert/src/lib/compile/seed-mapper.ts` | `seed-inventory/server.js` | HTTP fetch through seed-inventory-client | WIRED | `getSeedLots()` imported from seed-inventory-client (line 17-19), called in `Promise.allSettled` (line 71). |
| `organic-cert/src/lib/compile/seed-mapper.ts` | `organic-cert/src/lib/ecosystem/seed-inventory-client.ts` | import | WIRED | `import { getSeedLots, type SeedLotFromInventory } from "@/lib/ecosystem/seed-inventory-client"` (lines 17-19). |
| `meristem-malt/server.js` | `grain-tickets/server.js` | HTTP fetch to `/api/settlement-prices` | WIRED | `fetch(gtUrl('/api/settlement-prices?cropYear=' + cropYear))` in `POST /api/grain-prices/sync`. |
| `meristem-malt/public/app.js` | `meristem-malt/server.js` | fetch `/api/grain-prices/sync` | WIRED | `api.post('/api/grain-prices/sync', { cropYear: ... })` in sync button click handler (line 685). |
| `organic-cert/src/lib/pdf/inspection-report.tsx` | `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` | import and render | WIRED | `import { SeedCompliance }` (line 16) and `<SeedCompliance seedLots={data.seedLots} ...>` (line 58). |
| `organic-cert/src/lib/report-assembler.ts` | `organic-cert/prisma/schema.prisma` | `prisma.seedLot` Prisma query | WIRED | `prisma.seedLot.findMany({ where: { farmId }, include: { seedUsages: ... } })` (line 465). |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PIPE-05 | 53-01 | Organic-cert compilation reads seed lot numbers and cert numbers from seed-inventory instead of farm-budget | SATISFIED | `mapSeeds()` uses `Promise.allSettled` with `getSeedLots()` as primary source. `sourceApp` field traces provenance. Cert/lot numbers populated in SeedLot upsert. |
| PIPE-06 | 53-03 | NOP C9.0 audit section auto-populated from seed-inventory delivery data (lot, cert, OMRI, supplier) | PARTIAL | Lot #, cert #, and supplier name render in PDF. OMRI status missing from both the assembler (hardcoded false) and the PDF table (no OMRI column). |
| PIPE-07 | 53-02 | Meristem-malt grain cost pulls actual settlement prices from grain-tickets | SATISFIED | `GET /api/settlement-prices` queries matched settlement lines. `POST /api/grain-prices/sync` maps crops and updates `store.pricing`. |
| PIPE-08 | 53-02 | Meristem-malt pricing table shows "synced from grain tickets" with manual override flag | SATISFIED | GT badge rendered for synced keys. Manual badge for overridden keys. Lock/unlock toggle via `PUT /api/grain-prices/override/:key`. "Last synced from grain tickets" timestamp displayed. |

**Orphaned requirements:** None — all PIPE-05 through PIPE-08 are claimed across the three plans.

---

## Anti-Patterns Found

No stubs, TODOs, placeholder returns, or console.log-only implementations found in the modified files.

One architectural note that is NOT a blocker: `omriListed` defaults to `false` in `report-assembler.ts` because the Prisma `SeedLot` model does not have an `omriListed` field. The field lives only in seed-inventory's JSON store. Plan 03 acknowledged this ("Future enhancement could store it on SeedLot during compile") but the success criterion explicitly required OMRI to appear in the PDF. This creates the gap.

---

## Human Verification Required

### 1. Seed Compilation End-to-End

**Test:** Start seed-inventory (port 3006) and organic-cert. POST to `/api/compile/[year]/seeds` with `{ preview: true }`. Examine the response rows.
**Expected:** Rows sourced from seed-inventory have `sourceApp: "seed-inventory"`, non-null `lotNumber`, `organicCertNumber`, and `supplierName`.
**Why human:** Requires both services running and actual seed data in seed-inventory's data store.

### 2. Meristem-Malt Sync Button Behavior

**Test:** Start grain-tickets (port 3007) with settled/matched settlement lines. Start meristem-malt. Click "Sync from Grain Tickets" in the pricing table.
**Expected:** GT badge appears on synced rows with a date tooltip. Editing a price manually shows Manual badge and prevents future sync from overwriting.
**Why human:** Requires running services with actual settlement data in grain-tickets Prisma database.

### 3. Inspection Report PDF — C9.0 Section (Manual check for what IS present)

**Test:** Generate an inspection report PDF for a crop year where seed compilation has been committed.
**Expected:** C9.0 — Seed Sources section appears in landscape orientation between Application Log and Harvest Log. Lot #, Cert #, Supplier, Organic?, Untreated?, Status, Fields, Acres columns visible. OMRI column is absent (confirmed gap).
**Why human:** Requires running organic-cert with committed seed data and PDF renderer.

---

## Gaps Summary

One gap blocking full goal achievement for PIPE-06:

The success criterion for Truth 2 states the C9.0 section shows "lot number, cert number, **OMRI status**, and supplier name." OMRI status is absent from both the PDF table (`seed-compliance.tsx` has no OMRI column) and the report assembler (`omriListed` hardcoded `false`). The `SeedLotRecord` interface correctly defines the field, and seed-inventory's `/api/organic/seed-lots` endpoint does return `omriListed` per product — but this value is never stored on the Prisma `SeedLot` model during the compile commit, and consequently is never available to the report assembler.

**Root cause:** The Prisma SeedLot model lacks an `omriListed` boolean field. Plan 03 explicitly noted this as a limitation ("Will be true when seed-inventory data populates this via compile") but the plan's own success criterion required it to appear in the PDF without addressing the schema gap.

**Fix path (either acceptable):**
- Add `omriListed Boolean @default(false)` to Prisma SeedLot schema, populate it during seed compile commit when `sourceApp === "seed-inventory"`, query it in the assembler, and add an OMRI? column to the PDF table.
- OR explicitly demote OMRI from the C9.0 section success criterion and add a note in the PDF: "OMRI status available in seed-inventory; not stored in organic-cert compliance records."

The other three requirements (PIPE-05, PIPE-07, PIPE-08) are fully achieved with substantive, wired implementations.

---

_Verified: 2026-03-25T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
