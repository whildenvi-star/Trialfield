# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- 📋 **v2.0 Grain Traceability** — Phases 9-13 (planned)
- 📋 **v3.0 Organic Cert Transparency** — Phases 15-18 (planned)

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
- [x] **Phase 10: Migration & Cutover** — Move all data from JSON to PostgreSQL and switch server.js to Prisma (completed 2026-03-02)
- [x] **Phase 11: Buyer Registry & Ticket Extensions** — Buyer entity, destination FK on tickets, cropYear field (completed 2026-03-02)
- [x] **Phase 12: Settlement Import & Manual Entry** — CSV/Excel import with per-buyer column mapping and manual entry path (completed 2026-03-02)
- [x] **Phase 13: Reconciliation Engine & Discrepancy UI** — Match tickets to settlement lines, surface unmatched loads and variances (completed 2026-03-02)

### 📋 v3.0 Organic Cert Transparency (Planned)

**Milestone Goal:** Rewire organic-cert from a manual data-entry app into a live compilation engine that pulls field plans, inputs, seed, rotations, and harvest data from farm-budget, farm-registry, and grain-tickets — then compiles a complete NOP inspection packet with zero double-entry and total transparency.

- [x] **Phase 15: Foundation Fixes & Ecosystem Client Layer** — Resolve 3 blocking bugs, build typed HTTP clients for all source apps with timeout and graceful degradation (completed 2026-03-03)
- [x] **Phase 16: Field & Enterprise Compilation** — Preview/commit pipeline that pulls organic enterprises from farm-budget and field identities from farm-registry into organic-cert records (completed 2026-03-03)
- [x] **Phase 17: Input & Seed Compilation + NOP Compliance** — Pull input applications and seed data from farm-budget; resolve unmapped materials; apply NOP compliance rules to compiled data (completed 2026-03-03)
- [ ] **Phase 18: Rotation Snapshot & Harvest Compilation & PDF** — Yearly snapshot mechanism for NOP 3-year history, harvest compilation from grain-tickets, PDF null safety for all compiled sections

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
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — GrainBin model + CRUD, buyer proxy from farm-budget, destinations endpoint, BuyerColumnMap API, admin UI (bins, buyers read-only, column mapping)
- [ ] 11-02-PLAN.md — Ticket entry destination dropdown (buyers + bins), cropYear auto-derivation, destination/year filters, farm summary buyer breakdown, SW cache bump

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
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Settlement file upload, parse/preview, column mapping UI, commit, and settlement list (SET-01, SET-02, SET-04)
- [ ] 12-02-PLAN.md — Manual settlement entry form, settlement detail view with line CRUD, SW cache bump (SET-03, SET-04)

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
**Plans**: 3 plans

Plans:
- [x] 13-01-PLAN.md — Matching engine: normalizeTicketNo, runMatch, auto-match in commit, rematch/dispute/manual-link/summary/unmatched API routes, ticket _reconciliation enrichment (REC-01, REC-02, REC-03, REC-04, REC-05)
- [x] 13-02-PLAN.md — Reconciliation UI: ticket list/detail badge column, settlement summary table, unmatched two-panel view, manual link, inline dispute, rematch button, SW cache bump (REC-02, REC-03, REC-04, REC-05)
- [ ] 13-03-PLAN.md — Gap closure: fix hint text field path, settlements list buyer/year filtering, and ticketCount field name mismatch (REC-03, REC-04)

---

### Phase 15: Foundation Fixes & Ecosystem Client Layer
**Goal**: All three blocking bugs are resolved and a typed, fault-tolerant HTTP client layer connects organic-cert to farm-budget, farm-registry, and grain-tickets — the stable foundation every subsequent phase builds on
**Depends on**: Phase 13 (v2.0 grain-tickets DB in place for Phase 18 harvest pull)
**Requirements**: FIX-01, FIX-02, FIX-03, ECO-01, ECO-02, ECO-05
**Success Criteria** (what must be TRUE):
  1. Clicking "Sync Acres" on the Fields page completes without a runtime crash — acres update or report unchanged fields correctly
  2. A field with 4 or more enterprises displays all of them in the field list — no silent truncation at 3
  3. Running `npx prisma migrate dev` on a fresh database recreates the partial unique index without manual SQL
  4. The compile page shows live connection status for farm-budget, farm-registry, and grain-tickets — each source shows "available" or "unavailable" independently
  5. Killing farm-budget while the compile page is open shows farm-budget as unavailable without crashing organic-cert or blocking the other two sources
**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md — Fix FIX-01 (sync-registry crash/display), FIX-02 (enterprise year filter truncation), FIX-03 (partial unique index migration) (completed 2026-03-03)
- [x] 15-02-PLAN.md — Build ecosystem client layer (budget-client, registry-client, tickets-client) with AbortController 3s timeout, Promise.allSettled, compile page with status bar and field/acre preview (completed 2026-03-03)

### Phase 16: Field & Enterprise Compilation
**Goal**: Users can preview and commit a full pull of organic enterprise data from farm-budget and authoritative field identities from farm-registry into organic-cert — with an explicit resolution step for any fields that don't match by name
**Depends on**: Phase 15
**Requirements**: ECO-03, ECO-04, CMP-01, CMP-02, CMP-05
**Success Criteria** (what must be TRUE):
  1. User can open the compile page for the current crop year and see a preview diff — every FieldEnterprise record that will be created or updated is listed before any database write occurs
  2. After committing, organic-cert FieldEnterprise records reflect the organic enterprises from farm-budget with acres sourced from farm-registry
  3. Any farm-budget field name that does not automatically match an organic-cert field or farm-registry alias is flagged on the compile page — user can manually map it and the mapping persists for future compiles
  4. The compilation readiness dashboard shows a per-field completeness status (enterprises compiled, inputs pending, seed pending) for the current crop year
  5. User can see grain-tickets delivery records listed for each organic field on the compile page (read-only, source data view)
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md — Prisma migration (farmBudgetFieldName), compile lib modules (types, nop-filter, field-mapper, compile-engine), tickets-client data pull, PATCH route update, GET /api/compile/[year]/preview route (completed 2026-03-03)
- [x] 16-02-PLAN.md — POST /api/compile/[year] commit route (Prisma upsert FieldEnterprise), compile page UI rebuild (year selector, readiness dashboard, preview diff table, inline field mapping, delivery view, saved mappings, commit with confirmation) (completed 2026-03-03)

### Phase 17: Input & Seed Compilation + NOP Compliance
**Goal**: Input application records and seed varieties from farm-budget are compiled into organic-cert — farm managers resolve any unmapped materials once, and NOP compliance rules run only against resolved materials
**Depends on**: Phase 16
**Requirements**: CMP-03, CMP-04
**Success Criteria** (what must be TRUE):
  1. After compiling inputs, MaterialUsage records appear in organic-cert for every farm-budget input application on organic enterprise fields — no manual re-entry required
  2. After compiling seed, SeedLot stubs appear in organic-cert for every seed variety used on organic enterprise fields
  3. The compile page shows an "unresolved materials" list — any farm-budget product not yet mapped to an NOP status; user assigns status once and it persists across seasons
  4. NOP compliance indicators appear only on materials that have been resolved — unresolved materials show "needs review" rather than a compliance verdict
  5. Source badges on every compiled record show whether it originated from farm-budget, grain-tickets, Case IH, or was manually entered
**Plans**: 2 plans

Plans:
- [ ] 17-01-PLAN.md — Prisma migration (nopResolved, dataSource, SeedLot unique), budget-client extensions (getBudgetProducts, getBudgetFieldsWithInputs, getBudgetSeeds), input-mapper.ts + seed-mapper.ts, POST /api/compile/[year]/inputs and /seeds routes (preview + commit), readiness dashboard live status
- [ ] 17-02-PLAN.md — nop-compliance.ts rule engine (checkMaterialCompliance, checkSeedCompliance), batch resolve route, compile page UI (Compile All button, inputs/seeds preview tables, NOP compliance badges, source badges, unresolved materials panel with Save All, compliance summary bar)

### Phase 18: Rotation Snapshot & Harvest Compilation & PDF
**Goal**: The NOP 3-year field history is preserved via yearly snapshots, actual scale weights from grain-tickets are compiled as harvest events, and the 8-section PDF renders correctly from all compiled ecosystem data with no rendering artifacts on missing fields
**Depends on**: Phase 17
**Requirements**: ROT-01, ROT-02, ROT-03, HRV-01, HRV-02, PDF-01, PDF-02
**Success Criteria** (what must be TRUE):
  1. User can take a rotation snapshot for the current crop year with one button click — the snapshot writes all current FieldEnterprise records to FieldHistory and is retrievable after farm-budget is rebuilt for a new season
  2. The field history view in organic-cert shows 3 years of crop rotation data assembled from accumulated snapshots — without requiring any data to still be in farm-budget
  3. The compile page displays a warning banner when no snapshot exists for the current crop year
  4. After compiling harvests, HarvestEvent records appear in organic-cert matching grain-tickets delivery data for organic fields — crop names are normalized between the two systems
  5. The 8-section NOP inspection PDF generates without errors from compiled ecosystem data — empty sections render "No records" placeholders rather than blank or crashed sections
**Plans**: 3 plans

Plans:
- [ ] 18-01-PLAN.md — Rotation snapshot: snapshot-taker.ts + POST /api/rotation-snapshot/[year]/take + GET status route + GET history route + compile page Take Snapshot button + warning banner + Fields page rotation history table (ROT-01, ROT-02, ROT-03)
- [ ] 18-02-PLAN.md — Harvest compilation: harvest-mapper.ts with normalizeCropName crop matching + POST /api/compile/[year]/harvest route + compile page harvest section UI with preview/commit and unmatched review (HRV-01, HRV-02)
- [ ] 18-03-PLAN.md — PDF null-safety + cover page compile checklist: CompileChecklist type in report-assembler, cover page checklist rendering, empty-state guards on field-list/harvest-log/operation-overview (PDF-01, PDF-02)

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
| 11. Buyer Registry & Ticket Extensions | 2/2 | Complete   | 2026-03-02 | - |
| 12. Settlement Import & Manual Entry | 2/2 | Complete    | 2026-03-02 | - |
| 13. Reconciliation Engine & Discrepancy UI | 3/3 | Complete    | 2026-03-02 | - |
| 14. Chat Agent (system info & recall) | 3/3 | Complete    | 2026-03-03 | - |
| 15. Foundation Fixes & Ecosystem Client Layer | 2/2 | Complete    | 2026-03-03 | - |
| 16. Field & Enterprise Compilation | 2/2 | Complete   | 2026-03-03 | - |
| 17. Input & Seed Compilation + NOP Compliance | 2/2 | Complete    | 2026-03-03 | - |
| 18. Rotation Snapshot & Harvest Compilation & PDF | 2/3 | In Progress|  | - |

### Phase 19: Seed & Input Inventory Redesign

**Goal:** [To be planned]
**Depends on:** Phase 18
**Plans:** 2/3 plans executed

Plans:
- [ ] TBD (run /gsd:plan-phase 19 to break down)

---

### Phase 14: Add chat agent for system information and recall

**Goal:** A conversational AI agent ("Glomalin") lives in grain-tickets as a floating chat popup — the farm manager can query, analyze, and annotate grain data through natural language, with streaming responses, inline charts, CSV export, learnable notes, and a full kill switch
**Depends on:** Phase 13
**Requirements:** CHT-01, CHT-02, AGT-01, AGT-02, AGT-03, AGT-04
**Plans:** 2/2 plans complete

Plans:
- [ ] 14-01-PLAN.md — Agent backend: Prisma models (AgentConversation, AgentNote, AgentDailyUsage), agentic tool-use loop with SSE streaming, grain data tools, kill-switch middleware, notes CRUD routes
- [ ] 14-02-PLAN.md — Chat widget UI: floating tractor button, resizable popup, SSE streaming reader, markdown renderer, inline Chart.js charts, CSV export, deep links, ASCII tractor loading animation
- [ ] 14-03-PLAN.md — Notes admin section in admin.html + end-to-end human verification of complete Glomalin agent
