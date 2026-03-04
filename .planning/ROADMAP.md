# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Grain Traceability + Chat Agent** — Phases 9-14 (shipped 2026-03-04) — [archive](milestones/v2.0-ROADMAP.md)
- 📋 **v3.0 Organic Cert Transparency + Procurement** — Phases 15-19 (planned)

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

### 📋 v3.0 Organic Cert Transparency + Procurement (Planned)

**Milestone Goal:** Rewire organic-cert from a manual data-entry app into a live compilation engine that pulls field plans, inputs, seed, rotations, and harvest data from farm-budget, farm-registry, and grain-tickets — then compiles a complete NOP inspection packet with zero double-entry and total transparency. Plus procurement pipeline redesign for farm-budget.

- [x] **Phase 15: Foundation Fixes & Ecosystem Client Layer** — Resolve 3 blocking bugs, build typed HTTP clients for all source apps with timeout and graceful degradation (completed 2026-03-03)
- [x] **Phase 16: Field & Enterprise Compilation** — Preview/commit pipeline that pulls organic enterprises from farm-budget and field identities from farm-registry into organic-cert records (completed 2026-03-03)
- [x] **Phase 17: Input & Seed Compilation + NOP Compliance** — Pull input applications and seed data from farm-budget; resolve unmapped materials; apply NOP compliance rules to compiled data (completed 2026-03-03)
- [x] **Phase 18: Rotation Snapshot & Harvest Compilation & PDF** — Yearly snapshot mechanism for NOP 3-year history, harvest compilation from grain-tickets, PDF null safety for all compiled sections (completed 2026-03-03)
- [x] **Phase 19: Seed & Input Inventory Redesign** — Procurement pipeline (Forecasts, Orders, Deliveries, 5 print reports) with restructured navigation and day/night theme (completed 2026-03-04)

## Phase Details

### Phase 15: Foundation Fixes & Ecosystem Client Layer
**Goal**: All three blocking bugs are resolved and a typed, fault-tolerant HTTP client layer connects organic-cert to farm-budget, farm-registry, and grain-tickets
**Depends on**: Phase 13 (v2.0 grain-tickets DB in place for Phase 18 harvest pull)
**Requirements**: FIX-01, FIX-02, FIX-03, ECO-01, ECO-02, ECO-05
**Plans**: 2 plans

Plans:
- [x] 15-01: Fix FIX-01 (sync-registry crash), FIX-02 (enterprise truncation), FIX-03 (partial unique index) (completed 2026-03-03)
- [x] 15-02: Ecosystem client layer with AbortController timeout, compile page with status bar (completed 2026-03-03)

### Phase 16: Field & Enterprise Compilation
**Goal**: Preview and commit organic enterprise data from farm-budget and field identities from farm-registry into organic-cert
**Depends on**: Phase 15
**Requirements**: ECO-03, ECO-04, CMP-01, CMP-02, CMP-05
**Plans**: 2 plans

Plans:
- [x] 16-01: Compile lib modules, tickets-client, preview route (completed 2026-03-03)
- [x] 16-02: Commit route, compile page UI rebuild with field mapping (completed 2026-03-03)

### Phase 17: Input & Seed Compilation + NOP Compliance
**Goal**: Input and seed data from farm-budget compiled into organic-cert with NOP compliance rules
**Depends on**: Phase 16
**Requirements**: CMP-03, CMP-04
**Plans**: 2 plans

Plans:
- [x] 17-01: Input/seed mappers, compile routes, readiness dashboard (completed 2026-03-03)
- [x] 17-02: NOP compliance engine, batch resolve, Compile All UI (completed 2026-03-03)

### Phase 18: Rotation Snapshot & Harvest Compilation & PDF
**Goal**: NOP 3-year history via yearly snapshots, harvest compilation from grain-tickets, PDF null safety
**Depends on**: Phase 17
**Requirements**: ROT-01, ROT-02, ROT-03, HRV-01, HRV-02, PDF-01, PDF-02
**Plans**: 3 plans

Plans:
- [x] 18-01: Rotation snapshot mechanism (completed 2026-03-03)
- [x] 18-02: Harvest compilation with crop name normalization (completed 2026-03-03)
- [x] 18-03: PDF null-safety and cover page compile checklist (completed 2026-03-03)

### Phase 19: Seed & Input Inventory Redesign
**Goal**: Procurement pipeline replacing standalone CRUD in farm-budget
**Depends on**: Phase 18
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05
**Plans**: 3 plans

Plans:
- [x] 19-01: Server foundation, nav restructure, day/night CSS (completed 2026-03-04)
- [x] 19-02: Forecast Hub + Orders tab (completed 2026-03-04)
- [x] 19-03: Deliveries tab + 5 print reports (completed 2026-03-04)

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
