---
phase: 53-seed-inventory-meristem-malt-pipelines
verified: 2026-03-25T21:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "The NOP C9.0 audit section shows OMRI status — omriListed now flows from seed-inventory through compile commit, Prisma SeedLot DB, report assembler, and 10-column PDF table"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Start seed-inventory (port 3006) and organic-cert. POST to /api/compile/[year]/seeds with { preview: true }. Commit, then generate an inspection report PDF."
    expected: "C9.0 — Seed Sources section shows 10 columns including OMRI? with Yes/No values. Rows sourced from seed-inventory show sourceApp: 'seed-inventory' and non-null lotNumber, organicCertNumber, supplierName."
    why_human: "Requires both services running with actual seed data and a live PostgreSQL database (prisma db push could not run locally during execution — P1001 connection refused)."
  - test: "Start grain-tickets (port 3007) with matched settlement lines. Start meristem-malt. Click 'Sync from Grain Tickets' in the pricing table."
    expected: "GT badge appears on synced rows. Manually editing a price shows Manual badge and prevents future sync from overwriting."
    why_human: "Requires running services with actual settlement data in the grain-tickets Prisma database."
---

# Phase 53: Seed Inventory + Meristem-Malt Pipelines Verification Report

**Phase Goal:** Organic-cert reads seed lot data from seed-inventory (eliminating double-entry) and meristem-malt pulls actual grain cost from settled prices in grain-tickets
**Verified:** 2026-03-25T21:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 53-04 closed the PIPE-06 OMRI gap)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Organic-cert compilation reads lot numbers and cert numbers from seed-inventory — a seed entry in farm-budget is no longer needed for NOP compliance | VERIFIED | `seed-mapper.ts` line 71: `getSeedLots()` in `Promise.allSettled` tri-fetch. `siLotByKey` map merges SI data into preview rows with `sourceApp: "seed-inventory"` provenance. Compile commit route upserts `certNumber` and `lotNumber` from seed-inventory data. |
| 2 | The NOP C9.0 audit section is auto-populated from seed-inventory delivery data including lot number, cert number, OMRI status, and supplier name | VERIFIED | `seed-compliance.tsx` COLUMNS array (line 104-115): 10-column table including `OMRI?` at position 5. Data row (line 227-229): `{lot.omriListed ? "Yes" : "No"}`. `report-assembler.ts` line 508: `sl.omriListed ?? false` (DB read, not hardcoded). `schema.prisma` line 413: `omriListed Boolean @default(false)` on SeedLot model. Compile route lines 177/186: stored in both create and seed-inventory update blocks. |
| 3 | Meristem-malt pricing table shows grain cost pulled from actual grain-tickets settlement prices, with a "synced from grain tickets" indicator and manual override flag visible | VERIFIED | `grain-tickets/server.js` line 912: `GET /api/settlement-prices` queries `settlementLine` matched/manual lines. `meristem-malt/server.js` line 201: `fetch(gtUrl('/api/settlement-prices?cropYear=' + cropYear))` in sync handler. `meristem-malt/public/app.js` line 726: `badge-gt` badge with sync date tooltip; `badge-manual` badge on overridden rows; "Sync from Grain Tickets" button; `lastSyncedAt` timestamp display. |

**Score:** 3/3 truths verified

---

## OMRI Gap Closure — Detailed Verification (Plan 53-04)

The single gap from the initial verification was: `omriListed` hardcoded `false` in `report-assembler.ts` and absent from the PDF table. Plan 53-04 addressed all four required changes.

### Artifact-Level Verification

| Artifact | Claim | Verified | Evidence |
|----------|-------|----------|----------|
| `organic-cert/prisma/schema.prisma` | `omriListed Boolean @default(false)` on SeedLot model | YES | Line 413: `omriListed           Boolean  @default(false) // OMRI-listed status from seed-inventory` — inside `model SeedLot { }` block (lines 403-428), between `isUntreated` and `certNumber`. |
| `organic-cert/src/app/api/compile/[year]/seeds/route.ts` | `omriListed` in `uniqueSeeds` Map type, in create block, and in seed-inventory update block | YES | Line 125: Map type includes `omriListed: boolean`. Line 139: `omriListed: row.omriListed ?? false` when populating from preview. Line 177: `omriListed: seedData.omriListed ?? false` in upsert create. Line 186: `omriListed: seedData.omriListed` in seed-inventory update block. |
| `organic-cert/src/lib/report-assembler.ts` | `sl.omriListed ?? false` (not hardcoded false) | YES | Line 508: `omriListed: sl.omriListed ?? false` — reads from Prisma query result. |
| `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` | OMRI? column in COLUMNS array and `{lot.omriListed ? "Yes" : "No"}` in data rows | YES | Line 109: `{ label: "OMRI?", width: "7%" }` in COLUMNS. Line 227-229: `<Text style={[seedStyles.cell, { width: "7%" }]}>{lot.omriListed ? "Yes" : "No"}</Text>` in row cells. 10-column table with adjusted widths confirmed (14%+9%+9%+11%+7%+7%+8%+9%+16%+10% = 100%). |

### Key Link Verification (OMRI Pipeline)

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `seed-compliance.tsx` | `report-assembler.ts` (SeedLotRecord) | `omriListed` field on interface | WIRED | `SeedLotRecord.omriListed: boolean` at line 140 of assembler; consumed at seed-compliance.tsx line 228. |
| `report-assembler.ts` | `schema.prisma` (SeedLot) | Prisma read `sl.omriListed` | WIRED | `omriListed: sl.omriListed ?? false` at line 508 — reads from Prisma model, not hardcoded. |
| `seeds/route.ts` | `schema.prisma` (SeedLot) | Prisma upsert `omriListed` | WIRED | Line 177 (create): `omriListed: seedData.omriListed ?? false`. Line 186 (update, seed-inventory only): `omriListed: seedData.omriListed`. |
| `seeds/route.ts` | `compile/types.ts` (SeedPreviewRow) | `uniqueSeeds` Map type | WIRED | Map type at line 125 includes `omriListed: boolean`; populated from preview rows at line 139. |

---

## Regression Check — Previously Verified Items

| Item | Quick Check | Status |
|------|-------------|--------|
| `seed-mapper.ts` calls `getSeedLots()` | `import { getSeedLots }` line 17, called line 71 in `Promise.allSettled` | STILL WIRED |
| `meristem-malt/server.js` fetches `/api/settlement-prices` | Line 201: `fetch(gtUrl('/api/settlement-prices?cropYear=' + cropYear))` | STILL WIRED |
| `meristem-malt/public/app.js` renders GT badge | Line 726: `badge-gt` in `renderSyncBar()` | STILL WIRED |
| `inspection-report.tsx` imports and renders `SeedCompliance` | Lines 16 + 58: import and `<SeedCompliance seedLots={data.seedLots} ...>` | STILL WIRED |

No regressions found.

---

## Required Artifacts (Full Phase)

### Plan 01 (PIPE-05) — Seed Inventory Pipeline

| Artifact | Status | Details |
|----------|--------|---------|
| `seed-inventory/server.js` | VERIFIED | `/api/organic/seed-lots` returns `omriListed`, `supplierName`, `organicGround` (confirmed in initial verification; unchanged). |
| `organic-cert/src/lib/ecosystem/seed-inventory-client.ts` | VERIFIED | `getSeedLots()` with `SeedLotFromInventory` interface (confirmed; unchanged). |
| `organic-cert/src/lib/compile/seed-mapper.ts` | VERIFIED | `mapSeeds()` with `Promise.allSettled` tri-fetch and `siLotByKey` map (confirmed; unchanged). |
| `organic-cert/src/lib/compile/types.ts` | VERIFIED | `SeedPreviewRow` has `omriListed`, `lotNumber`, `organicCertNumber`, `supplierName`, `sourceApp` (confirmed; unchanged). |
| `organic-cert/src/app/api/compile/[year]/seeds/route.ts` | VERIFIED | Conditional upsert update for certNumber/lotNumber/omriListed; `omriListed` added to Map type and both create/update blocks. |

### Plan 02 (PIPE-07, PIPE-08) — Meristem-Malt Grain Price Sync

| Artifact | Status | Details |
|----------|--------|---------|
| `grain-tickets/server.js` | VERIFIED | `GET /api/settlement-prices` queries matched settlement lines, returns `avgPricePerBushel` (confirmed; unchanged). |
| `meristem-malt/server.js` | VERIFIED | Sync endpoints + `pricingSync` store (confirmed; unchanged). |
| `meristem-malt/public/app.js` | VERIFIED | Sync button, GT badge, Manual badge, override toggle (confirmed; unchanged). |

### Plan 03 + 04 (PIPE-06) — NOP C9.0 PDF Section

| Artifact | Status | Details |
|----------|--------|---------|
| `organic-cert/prisma/schema.prisma` | VERIFIED | `omriListed Boolean @default(false)` on SeedLot model at line 413. |
| `organic-cert/src/app/api/compile/[year]/seeds/route.ts` | VERIFIED | `omriListed` in Map type, create block, and seed-inventory update block. |
| `organic-cert/src/lib/report-assembler.ts` | VERIFIED | `sl.omriListed ?? false` at line 508 (no longer hardcoded). `SeedLotRecord` interface has `omriListed: boolean` at line 140. |
| `organic-cert/src/lib/pdf/sections/seed-compliance.tsx` | VERIFIED | 10-column table with `OMRI?` column in COLUMNS array (line 109) and `{lot.omriListed ? "Yes" : "No"}` in data rows (line 228). |
| `organic-cert/src/lib/pdf/inspection-report.tsx` | VERIFIED | `import { SeedCompliance }` (line 16) and `<SeedCompliance seedLots={data.seedLots} ...>` (line 58). |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PIPE-05 | 53-01 | Organic-cert compilation reads seed lot numbers and cert numbers from seed-inventory | SATISFIED | `mapSeeds()` uses `getSeedLots()` as primary source; `sourceApp` traces provenance; cert/lot numbers stored in SeedLot upsert. |
| PIPE-06 | 53-03, 53-04 | NOP C9.0 audit section auto-populated from seed-inventory (lot, cert, OMRI, supplier) | SATISFIED | OMRI gap closed: schema field, compile persistence, assembler read, and PDF column all verified. All four required data points (lot #, cert #, OMRI status, supplier name) now flow end-to-end to the PDF. |
| PIPE-07 | 53-02 | Meristem-malt grain cost pulls actual settlement prices from grain-tickets | SATISFIED | `GET /api/settlement-prices` queries matched settlement lines; sync endpoint maps crops and updates store. |
| PIPE-08 | 53-02 | Meristem-malt pricing table shows "synced from grain tickets" with manual override flag | SATISFIED | GT badge, Manual badge, lock/unlock toggle, and last-synced timestamp all present and wired. |

**Orphaned requirements:** None.

---

## Anti-Patterns Found

No new TODOs, stubs, placeholder returns, or console.log-only implementations in the four files modified by Plan 53-04.

One structural note (not a blocker): `prisma db push` could not run during execution because the local PostgreSQL database was not running (P1001). `prisma validate` and `prisma generate` did pass. The schema change (`omriListed Boolean @default(false)`) will apply on the next `db push` against the live or dev database. This is a deployment/environment note, not a code defect — the schema syntax is valid and the Prisma client was regenerated with the new field.

---

## Human Verification Required

### 1. Inspect OMRI Data in Generated PDF

**Test:** Start seed-inventory (port 3006) and organic-cert. Run a seed compile for the current crop year and commit. Generate an inspection report PDF.
**Expected:** C9.0 — Seed Sources section has 10 columns: Crop/Variety, Lot #, Cert #, Supplier, OMRI?, Organic?, Untreated?, Status, Fields, Acres. OMRI? column shows "Yes" for OMRI-listed products and "No" for others.
**Why human:** Requires both services running with actual seed data in seed-inventory, a connected PostgreSQL instance (for `prisma db push` to have been applied), and the PDF renderer.

### 2. Seed Compilation End-to-End

**Test:** POST to `/api/compile/[year]/seeds` with `{ preview: true }`. Check response rows.
**Expected:** Rows sourced from seed-inventory have `sourceApp: "seed-inventory"`, non-null `lotNumber`, `organicCertNumber`, `supplierName`, and a boolean `omriListed`.
**Why human:** Requires seed-inventory and organic-cert running with actual data.

### 3. Meristem-Malt Sync Button Behavior

**Test:** Start grain-tickets (port 3007) with settled/matched settlement lines. Start meristem-malt. Click "Sync from Grain Tickets."
**Expected:** GT badge appears on synced rows with date tooltip. Manually editing a price shows Manual badge and prevents future sync from overwriting that row.
**Why human:** Requires running services with actual settlement data in the grain-tickets Prisma database.

---

## Summary

The single gap from the initial verification (PIPE-06 OMRI status missing) is now closed. Plan 53-04 threaded `omriListed` through all four layers of the pipeline:

1. **Schema** — `omriListed Boolean @default(false)` added to the Prisma `SeedLot` model (line 413 of schema.prisma).
2. **Compile commit** — `seeds/route.ts` stores `omriListed` on create (all sources) and on update (seed-inventory only, same guard as `certNumber`/`lotNumber`). The `uniqueSeeds` Map type was extended to carry the field.
3. **Report assembler** — `report-assembler.ts` now reads `sl.omriListed ?? false` from the Prisma query result instead of hardcoding `false`.
4. **PDF** — `seed-compliance.tsx` is a 10-column table with an `OMRI?` column (7% width) rendering "Yes"/"No" per lot.

All four phase requirements (PIPE-05, PIPE-06, PIPE-07, PIPE-08) are satisfied. No regressions in previously verified items. One deployment note: `prisma db push` needs to run against the live database to apply the schema change; the code is correct and the Prisma client was regenerated.

---

_Verified: 2026-03-25T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
