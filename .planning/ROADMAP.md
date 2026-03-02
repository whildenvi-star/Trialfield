# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- 📋 **v2.0 Grain Traceability** — Phases 9-13 (planned)

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

### 📋 v2.0 Grain Traceability (Planned)

**Milestone Goal:** Replace the paper-to-spreadsheet grain ticket workflow with a digital traceability system that tracks every load from combine to settlement, reconciles against buyer payments, and flags discrepancies immediately.

- [x] **Phase 9: Database Foundation** — Prisma 6.19.2 + PostgreSQL grain_tickets database with complete 7-model schema (completed 2026-03-02)
- [ ] **Phase 10: Migration & Cutover** — Move all data from JSON to PostgreSQL and switch server.js to Prisma
- [ ] **Phase 11: Buyer Registry & Ticket Extensions** — Buyer entity, destination FK on tickets, cropYear field
- [ ] **Phase 12: Settlement Import & Manual Entry** — CSV/Excel import with per-buyer column mapping and manual entry path
- [ ] **Phase 13: Reconciliation Engine & Discrepancy UI** — Match tickets to settlement lines, surface unmatched loads and variances

## Phase Details

### Phase 9: Database Foundation
**Goal**: Prisma 6 + PostgreSQL is connected and verified in grain-tickets — schema in place, client singleton working, no existing functionality changed
**Depends on**: Phase 8 (v1.1 complete)
**Requirements**: DB-01 (partial — schema and connection only)
**Success Criteria** (what must be TRUE):
  1. `npx prisma migrate dev` runs without error and creates Ticket, CropConfig, FarmEntry tables in PostgreSQL
  2. Prisma Studio can open and browse the grain-tickets database
  3. All existing ticket entry and farm summary UI continues working unchanged (JSON store still active)
  4. `db.js` singleton exports a connected PrismaClient instance importable by other modules
**Plans**: 1

Plans:
- [x] 09-01: Prisma setup, schema definition, and connection verification (completed 2026-03-02)

### Phase 10: Migration & Cutover
**Goal**: Every existing ticket, farm, and crop config record lives in PostgreSQL — server.js reads and writes Prisma exclusively, JSON is archived read-only
**Depends on**: Phase 9
**Requirements**: DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. All 527+ tickets exist in PostgreSQL with no data loss (row count matches pre-migration JSON count)
  2. Creating, editing, and deleting a ticket through the existing UI persists to PostgreSQL (not JSON)
  3. calc.js produces byte-identical totals on a spot-checked set of 10 tickets before and after migration
  4. The PWA and service worker function normally after the CACHE_NAME bump — offline queue replays correctly
  5. data.json is renamed to data.json.archive and no longer written to
**Plans**: 2 plans

Plans:
- [ ] 10-01: Migration script (migrate-json.js) — data insertion, HBT/truck extraction, calc.js parity verification, archive
- [ ] 10-02: server.js route rewrite — all routes to Prisma, dead JSON code removed, SW cache bump

### Phase 11: Buyer Registry & Ticket Extensions
**Goal**: Buyers are first-class entities in the database — every ticket delivery references a buyer by FK, and tickets carry a cropYear for season scoping
**Depends on**: Phase 10
**Requirements**: BUY-01, BUY-02, BUY-03, TKT-01, TKT-02
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete a buyer record (name, type, shortCode) through a buyers admin page
  2. When entering a new ticket, user selects a destination from a buyer autocomplete dropdown — free-text destination is gone
  3. User can filter the ticket list by buyer/destination and see only that buyer's loads
  4. Each ticket carries a cropYear field visible in the ticket detail and editable at entry time
  5. Buyer column-mapping config is stored per buyer and survives a server restart
**Plans**: TBD

Plans:
- [ ] 11-01: Buyer CRUD API and admin UI
- [ ] 11-02: Schema extension (Buyer, Settlement, SettlementLine models), destinationId FK on tickets, cropYear field, ticket list filter

### Phase 12: Settlement Import & Manual Entry
**Goal**: Settlement data from every buyer path enters the system — CSV/Excel files for digital buyers, a manual entry form for paper-only buyers
**Depends on**: Phase 11
**Requirements**: SET-01, SET-02, SET-03, SET-04
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV or Excel settlement file for a buyer and see a 5-row preview with column mapping controls before committing
  2. After committing an import, each row appears as a SettlementLine record with ticket number, date, net weight, moisture, net bushels, price, deductions, and net payment captured
  3. User can manually enter individual settlement line items through a form — no file required
  4. Per-buyer column mapping is saved after the first import and pre-filled on subsequent imports for the same buyer
  5. Uploaded settlement files are stored server-side outside the public/ directory
**Plans**: TBD

Plans:
- [ ] 12-01: CSV/Excel settlement import endpoint with column mapping UI and preview
- [ ] 12-02: Manual settlement entry form and per-buyer importConfig persistence

### Phase 13: Reconciliation Engine & Discrepancy UI
**Goal**: The system automatically matches farm tickets to settlement lines, surfaces every unmatched load, and lets the farm manager flag and annotate discrepancies
**Depends on**: Phase 12
**Requirements**: REC-01, REC-02, REC-03, REC-04, REC-05
**Success Criteria** (what must be TRUE):
  1. After a settlement import, each matching farm ticket shows status "Matched" with its settlement line linked — ticket number normalization handles H-prefix and leading-zero variants
  2. The unmatched loads view lists farm-only tickets (delivered but not on settlement) and settlement-only lines (paid but no farm ticket) in separate sections
  3. The settlement summary screen shows farm total pounds vs. buyer settled pounds per crop and buyer for a selected season — variances are highlighted
  4. User can flag any matched ticket as "Disputed" and add a free-text note — status persists on page reload
  5. Tickets with reconciliation status (Unreconciled, Matched, Disputed, Manual-Override) display that status on the ticket list and ticket detail screens
**Plans**: TBD

Plans:
- [ ] 13-01: Reconciliation matching engine (ticket number normalization, exact-match, MatchStatus writes)
- [ ] 13-02: Unmatched load dashboard, settlement summary view, disputed ticket flag and notes UI

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
| 10. Migration & Cutover | v2.0 | 0/2 | Planned | - |
| 11. Buyer Registry & Ticket Extensions | v2.0 | 0/TBD | Not started | - |
| 12. Settlement Import & Manual Entry | v2.0 | 0/TBD | Not started | - |
| 13. Reconciliation Engine & Discrepancy UI | v2.0 | 0/TBD | Not started | - |

### Phase 14: Add chat agent for system information and recall

**Goal:** [To be planned]
**Depends on:** Phase 13
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 14 to break down)
