# Roadmap: Organic Audit System

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- **v1.1 Split-Field Enterprises** — Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 Data Ingestion & Reports (Phases 1-4) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Case IH API Integration (3/3 plans) — completed 2026-02-24
- [x] Phase 2: Field Records & History (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Inspection Report Generation (3/3 plans) — completed 2026-02-25
- [x] Phase 4: Synced Harvest CropLot Wiring (2/2 plans) — completed 2026-02-26

</details>

### v1.1 Split-Field Enterprises

- [x] **Phase 5: Split-Field Schema & Acre Reconciliation** - Multi-enterprise data model with acre validation and fallow tracking (completed 2026-02-27)
- [x] **Phase 6: Multi-Enterprise Field Views** - Consolidated field cards, drill-down history, and enterprise creation UI (completed 2026-02-28)
- [x] **Phase 7: Split-Field PDF Reports** - All report sections updated for multi-enterprise fields (completed 2026-02-28)
- [x] **Phase 8: Fallow Enterprise Edit Fix** - Fix fallow edit pre-fill to prevent silent cost data loss (gap closure: INT-01) (completed 2026-03-01)

## Phase Details

### Phase 5: Split-Field Schema & Acre Reconciliation
**Goal**: A field can hold multiple enterprises per season with validated acre totals and fallow tracking -- the data foundation for all split-field features
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, ACRE-01, ACRE-02, ACRE-03
**Success Criteria** (what must be TRUE):
  1. A field can have two or more enterprises for the same crop year (e.g., "Corn" on North 40 and "Soybeans" on South 80 of the same field, same year)
  2. Each enterprise carries a label/position identifier that distinguishes it from siblings in the same field and crop year
  3. An enterprise can be created as fallow/idle with cost amount, cost category, and notes fields
  4. Existing single-enterprise fields load, display, and save without any changes required by the user
  5. Enterprise planted acres are validated against field total acres -- API warns when sum exceeds total, and fallow remainder is calculated as the difference
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Schema migration: add label, isFallow, fallow cost fields; partial index; forward-compatible types
- [x] 05-02-PLAN.md — Lot generator label support + API acre reconciliation (POST/PUT/GET)

### Phase 6: Multi-Enterprise Field Views
**Goal**: Users can see, navigate, and manage split-field enterprises through consolidated views with drill-down to individual enterprise detail
**Depends on**: Phase 5
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05
**Success Criteria** (what must be TRUE):
  1. Field index page shows a single card per field with an enterprise count badge (e.g., "3 enterprises") and acre utilization (e.g., "120 of 160 ac") when multiple enterprises exist
  2. Field detail page defaults to a consolidated view showing all enterprises for that field, not a single enterprise
  3. User can click through from the consolidated view to see a single enterprise's operations, harvest events, and history in isolation
  4. Season cards in field history display multiple enterprise rows when a field was split that year, each with its own crop, acres, and status
  5. User can add multiple enterprises to the same field and crop year through the enterprise creation form without leaving the page
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Field index cards with enterprise count badge + acre utilization; multi-enterprise season cards with enterprise rows and drill-down links
- [x] 06-02-PLAN.md — Enterprise creation form with label/fallow fields, acreWarning toast, label column in table, breadcrumb drill-down on detail page

### Phase 7: Split-Field PDF Reports
**Goal**: Every section of the inspection PDF accurately reflects split-field reality -- enterprises grouped under parent fields, no double-counting, no omissions
**Depends on**: Phase 6
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):
  1. Field List section in the PDF shows each enterprise as an indented sub-row under its parent field, with enterprise label, crop, and acres
  2. Field History section in the PDF groups operations by enterprise within each field, with clear enterprise labels separating the groups
  3. Harvest Log in the PDF includes the enterprise label alongside lot number for any field with multiple enterprises
  4. Mass Balance section in the PDF aggregates inputs and outputs correctly across all enterprises per field -- totals match single-enterprise behavior when only one enterprise exists, and no inputs or harvests are double-counted or omitted when multiple enterprises exist
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Assembler enterprise identity fields + Field List parent/sub-row rendering
- [ ] 07-02-PLAN.md — Field History multi-enterprise year sections with label headers and enterpriseId filtering
- [ ] 07-03-PLAN.md — Harvest Log, Application Log, and Mass Balance enterprise label display

### Phase 8: Fallow Enterprise Edit Fix
**Goal**: Fallow enterprise edits preserve existing cost data — no silent data loss on the edit path
**Depends on**: Phase 6
**Requirements**: SCHEMA-03, VIEW-05
**Gap Closure**: Closes INT-01 from v1.1 milestone audit
**Success Criteria** (what must be TRUE):
  1. The `FieldEnterprise` TypeScript interface includes `fallowCostAmount` and `fallowCostCategory` fields
  2. Opening an existing fallow enterprise for editing pre-fills `fallowCostAmount` and `fallowCostCategory` from the stored record
  3. Saving a fallow enterprise edit preserves cost data that was not changed by the user

**Plans:** 1/1 plans complete

Plans:
- [ ] 08-01-PLAN.md — Fix FieldEnterprise interface, openEdit() fallow cost pre-fill, and handleSave() serialization

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
| 8. Fallow Enterprise Edit Fix | 1/1 | Complete   | 2026-03-01 | - |
