# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Grain Traceability + Chat Agent** — Phases 9-14 (shipped 2026-03-04) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Organic Cert Transparency + Procurement** — Phases 15-19 (shipped 2026-03-04) — [archive](milestones/v3.0-ROADMAP.md)
- 🚧 **v4.0 Cross-Module Polish & Settlement Closure** — Phases 20-23 (in progress)

## Phases

<details>
<summary>✅ v1.0 Data Ingestion & Reports (Phases 1-4) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Case IH API Integration (3/3 plans) — completed 2026-02-24
- [x] Phase 2: Field Records & History (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Inspection Report Generation (3/3 plans) — completed 2026-02-25
- [x] Phase 4: Synced Harvest CropLot Wiring (2/2 plans) — completed 2026-02-26

</details>

<details>
<summary>✅ v1.1 Split-Field Enterprises (Phases 5-8) — SHIPPED 2026-03-01</summary>

- [x] Phase 5: Split-Field Schema & Acre Reconciliation (2/2 plans) — completed 2026-02-27
- [x] Phase 6: Multi-Enterprise Field Views (2/2 plans) — completed 2026-02-28
- [x] Phase 7: Split-Field PDF Reports (3/3 plans) — completed 2026-02-28
- [x] Phase 8: Fallow Enterprise Edit Fix (1/1 plan) — completed 2026-03-01

</details>

<details>
<summary>✅ v2.0 Grain Traceability + Chat Agent (Phases 9-14) — SHIPPED 2026-03-04</summary>

- [x] Phase 9: Database Foundation (1/1 plan) — completed 2026-03-02
- [x] Phase 10: Migration & Cutover (2/2 plans) — completed 2026-03-02
- [x] Phase 11: Buyer Registry & Ticket Extensions (2/2 plans) — completed 2026-03-02
- [x] Phase 12: Settlement Import & Manual Entry (2/2 plans) — completed 2026-03-02
- [x] Phase 13: Reconciliation Engine & Discrepancy UI (3/3 plans) — completed 2026-03-02
- [x] Phase 14: Chat Agent — Glomalin (3/3 plans) — completed 2026-03-03

</details>

<details>
<summary>✅ v3.0 Organic Cert Transparency + Procurement (Phases 15-19) — SHIPPED 2026-03-04</summary>

- [x] Phase 15: Foundation Fixes & Ecosystem Client Layer (2/2 plans) — completed 2026-03-03
- [x] Phase 16: Field & Enterprise Compilation (2/2 plans) — completed 2026-03-03
- [x] Phase 17: Input & Seed Compilation + NOP Compliance (2/2 plans) — completed 2026-03-03
- [x] Phase 18: Rotation Snapshot & Harvest Compilation & PDF (3/3 plans) — completed 2026-03-03
- [x] Phase 19: Seed & Input Inventory Redesign (3/3 plans) — completed 2026-03-04

</details>

### 🚧 v4.0 Cross-Module Polish & Settlement Closure (In Progress)

**Milestone Goal:** Fix bugs, polish the farm-budget field editor, improve FSA crop sync from macro rollup, and close the settlement reconciliation loop in grain-tickets with configurable tolerances, fuzzy matching, dispute resolution, and multi-buyer summaries.

- [ ] **Phase 20: Farm-Registry Bug Fix** - Fix field save so acres and ownership persist correctly
- [ ] **Phase 21: Farm-Budget Field Editor Polish** - Category totals, red negative profit, Orders and Deliveries tabs live
- [ ] **Phase 22: FSA Crop Sync Improvement** - Pull enterprise data from farm-budget macro rollup with side-by-side preview
- [ ] **Phase 23: Settlement Closure** - Configurable tolerances, fuzzy matching, dispute workflow, multi-buyer summary

## Phase Details

### Phase 20: Farm-Registry Bug Fix
**Goal**: Field edits in farm-registry persist correctly — reportingAcres, organicAcres, and ownership survive a page refresh
**Depends on**: Nothing (independent module)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. User edits reportingAcres, organicAcres, or ownership in the farm-registry field editor and after saving, the values are still correct after a hard page refresh
  2. User edits growerId in farm-registry and the value persists after saving (no silent drop by the API)
  3. No fields silently revert to previous values or go blank after a PUT to /api/fields/:id
**Plans**: TBD

Plans:
- [ ] 20-01: Fix PUT /api/fields/:id to accept and persist all form-submitted fields including growerId, reportingAcres, organicAcres, and ownership

### Phase 21: Farm-Budget Field Editor Polish
**Goal**: The farm-budget field editor shows complete cost information at a glance and the Orders/Deliveries tabs are fully operational
**Depends on**: Nothing (independent module)
**Requirements**: BUD-01, BUD-02, BUD-03, BUD-04
**Success Criteria** (what must be TRUE):
  1. Every budget category row in the field editor preview shows both per-acre cost and total field cost (Rent, Fertilizer, Seed, Machinery, Labor, Overhead, Fuel, Drying, Interest, Insurance)
  2. When Profit/AC or Profit (w/ Payments) is negative, the value is displayed in red
  3. The Orders tab appears in farm-budget navigation and user can create a PO, assign a supplier, and track order status
  4. The Deliveries tab appears in farm-budget navigation and user can log a delivery receipt, link it to an order, and track items received
**Plans**: TBD

Plans:
- [ ] 21-01: Field editor category totals — per-acre and total columns for all 10 budget categories
- [ ] 21-02: Red negative profit display and unhide/activate Orders and Deliveries tabs

### Phase 22: FSA Crop Sync Improvement
**Goal**: The FSA crop sync preview pulls live enterprise data from farm-budget and shows a meaningful side-by-side acres comparison before the user commits any changes
**Depends on**: Nothing (independent module)
**Requirements**: FSA-01, FSA-02, FSA-03, FSA-04
**Success Criteria** (what must be TRUE):
  1. Crop sync preview fetches enterprise-level crop and acres data from the farm-budget dashboard/macro rollup endpoint
  2. Preview displays a side-by-side table comparing FSA CLU acres vs farm-budget enterprise acres for each crop
  3. Grass CLUs and non-crop CLUs are excluded from sync proposals so only tillable, crop-assigned CLUs appear
  4. CLUs already marked as "reported" do not appear in sync proposals
**Plans**: TBD

Plans:
- [ ] 22-01: Pull enterprise data from farm-budget macro rollup and build side-by-side crop sync preview with filtering

### Phase 23: Settlement Closure
**Goal**: The grain-tickets settlement workflow closes the loop — users can configure tolerances, resolve fuzzy matches interactively, work disputed tickets through to resolution, and see a full season summary across all buyers
**Depends on**: Nothing (independent from Phases 20-22; depends on existing reconciliation engine from v2.0)
**Requirements**: REC-01, REC-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):
  1. User can configure a per-crop weight discrepancy tolerance (as a percentage or fixed lbs) and the reconciliation engine uses that threshold to decide when to flag a match as a discrepancy
  2. When ticket number matching fails, the system automatically searches for fuzzy candidates by date (within 2 days) and weight (within tolerance) and presents them to the user for confirmation before linking
  3. User can mark a disputed ticket with a resolution status (Buyer Error, Our Error, Write-off, Pending), add a resolution note, and record the resolution date
  4. A multi-buyer season summary page shows all buyers for a crop year with total ticket count, total weight, settlement payment total, payment status, and variance in a single view
**Plans**: TBD

Plans:
- [ ] 23-01: Configurable per-crop weight tolerance settings and integration with reconciliation engine
- [ ] 23-02: Fuzzy settlement matching — date + weight candidate search with user confirmation flow
- [ ] 23-03: Dispute resolution workflow — status, notes, resolution date; and multi-buyer season summary view

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Case IH API Integration | v1.0 | 3/3 | Complete | 2026-02-24 |
| 2. Field Records & History | v1.0 | 3/3 | Complete | 2026-02-25 |
| 3. Inspection Report Generation | v1.0 | 3/3 | Complete | 2026-02-25 |
| 4. Synced Harvest CropLot Wiring | v1.0 | 2/2 | Complete | 2026-02-26 |
| 5. Split-Field Schema & Acre Reconciliation | v1.1 | 2/2 | Complete | 2026-02-27 |
| 6. Multi-Enterprise Field Views | v1.1 | 2/2 | Complete | 2026-02-28 |
| 7. Split-Field PDF Reports | v1.1 | 3/3 | Complete | 2026-02-28 |
| 8. Fallow Enterprise Edit Fix | v1.1 | 1/1 | Complete | 2026-03-01 |
| 9. Database Foundation | v2.0 | 1/1 | Complete | 2026-03-02 |
| 10. Migration & Cutover | v2.0 | 2/2 | Complete | 2026-03-02 |
| 11. Buyer Registry & Ticket Extensions | v2.0 | 2/2 | Complete | 2026-03-02 |
| 12. Settlement Import & Manual Entry | v2.0 | 2/2 | Complete | 2026-03-02 |
| 13. Reconciliation Engine & Discrepancy UI | v2.0 | 3/3 | Complete | 2026-03-02 |
| 14. Chat Agent (Glomalin) | v2.0 | 3/3 | Complete | 2026-03-03 |
| 15. Foundation Fixes & Ecosystem Client Layer | v3.0 | 2/2 | Complete | 2026-03-03 |
| 16. Field & Enterprise Compilation | v3.0 | 2/2 | Complete | 2026-03-03 |
| 17. Input & Seed Compilation + NOP Compliance | v3.0 | 2/2 | Complete | 2026-03-03 |
| 18. Rotation Snapshot & Harvest Compilation & PDF | v3.0 | 3/3 | Complete | 2026-03-03 |
| 19. Seed & Input Inventory Redesign | v3.0 | 3/3 | Complete | 2026-03-04 |
| 20. Farm-Registry Bug Fix | v4.0 | 0/TBD | Not started | - |
| 21. Farm-Budget Field Editor Polish | v4.0 | 0/TBD | Not started | - |
| 22. FSA Crop Sync Improvement | v4.0 | 0/TBD | Not started | - |
| 23. Settlement Closure | v4.0 | 0/TBD | Not started | - |
