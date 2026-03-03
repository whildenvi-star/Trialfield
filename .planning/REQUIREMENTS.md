# Requirements: Farm Operations Platform

**Defined:** 2026-03-01
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.

## v2.0 Requirements

Requirements for grain traceability milestone. Each maps to roadmap phases.

### Database

- [x] **DB-01**: Existing grain ticket data migrates from JSON to PostgreSQL with zero data loss
- [x] **DB-02**: All existing ticket CRUD operations work against PostgreSQL (not JSON)
- [x] **DB-03**: Calculation engine (calc.js) produces identical results before and after migration
- [x] **DB-04**: Existing UI and PWA continue functioning during and after migration

### Buyers

- [x] **BUY-01**: User can create, edit, and delete buyer/destination records (name, type, shortCode)
- [x] **BUY-02**: User can select a destination (buyer) when entering a ticket
- [x] **BUY-03**: User can store per-buyer import column mapping for reuse

### Tickets

- [x] **TKT-01**: Each ticket has an explicit cropYear field for season scoping
- [x] **TKT-02**: User can filter and view tickets by buyer/destination

### Settlements

- [x] **SET-01**: User can import a buyer's settlement statement from CSV or Excel file
- [x] **SET-02**: User can preview and map columns before committing a settlement import
- [x] **SET-03**: User can manually enter individual settlement line items for paper-only buyers
- [x] **SET-04**: Each settlement line captures: ticket number, date, net weight, moisture, net bushels, price, deductions, net payment

### Reconciliation

- [x] **REC-01**: System matches farm tickets to settlement lines by ticket number within same buyer and cropYear
- [x] **REC-02**: Each ticket shows reconciliation status: unreconciled, matched, disputed, or manual-override
- [x] **REC-03**: User can view all unmatched loads — farm-only tickets and settlement-only lines
- [x] **REC-04**: User can view settlement summary comparing farm totals vs buyer settled totals per crop/buyer/season
- [x] **REC-05**: User can flag a matched ticket as disputed and add notes

## v3.0 Requirements

Requirements for organic cert transparency milestone. Each maps to roadmap phases.

### Foundation Fixes

- [x] **FIX-01**: Sync Acres button on Fields page works without runtime crash
- [x] **FIX-02**: Enterprise query returns all enterprises per field (no truncation at 3)
- [x] **FIX-03**: Partial unique index captured in schema.prisma for environment rebuild safety

### Ecosystem Data Pull

- [x] **ECO-01**: User can see live organic-designated field data pulled from farm-budget
- [x] **ECO-02**: User can see live field identities and acres pulled from farm-registry
- [ ] **ECO-03**: User can see live delivery records pulled from grain-tickets for organic fields
- [ ] **ECO-04**: User can map farm-budget field names to organic-cert field records when automatic name matching fails
- [x] **ECO-05**: Ecosystem pull degrades gracefully when a source app is not running (shows which sources are unavailable)

### Compilation Engine

- [ ] **CMP-01**: User can preview compiled data before committing (see exactly what will be written from each source)
- [ ] **CMP-02**: User can compile enterprise/field data from farm-budget into organic-cert field records
- [ ] **CMP-03**: User can compile input application data from farm-budget into organic-cert material usage records
- [ ] **CMP-04**: User can compile seed data from farm-budget into organic-cert seed source records
- [ ] **CMP-05**: User can see a compilation readiness dashboard showing completeness per NOP section

### Rotation History

- [ ] **ROT-01**: User can take a yearly rotation snapshot capturing field-crop-acre assignments from farm-budget
- [ ] **ROT-02**: Rotation snapshots accumulate to provide 3-year NOP field history
- [ ] **ROT-03**: User sees a warning when no snapshot exists for the current crop year

### Harvest Data

- [ ] **HRV-01**: User can compile harvest/delivery records from grain-tickets into organic-cert harvest events
- [ ] **HRV-02**: Harvest compilation normalizes crop names between grain-tickets and organic-cert

### PDF Report Refresh

- [ ] **PDF-01**: 8-section NOP inspection PDF renders correctly from compiled ecosystem data
- [ ] **PDF-02**: PDF handles null/missing compiled data gracefully (no rendering artifacts)

## Phase 14 Requirements

Requirements for the Glomalin chat agent. Maps to Phase 14.

### Chat Interface

- [x] **CHT-01**: Floating chat popup with tractor icon, resizable window, kill switch, conversation persistence across popup open/close
- [x] **CHT-02**: Rich streaming responses with formatted tables, inline charts, deep links to tickets, ASCII tractor loading animation, CSV export

### Agent Backend

- [x] **AGT-01**: Claude-powered agentic tool-use loop querying grain data (tickets, farms, crops, buyers) via Prisma — NO access to settlement/financial data
- [x] **AGT-02**: Learnable notes stored in PostgreSQL with auto-detect teachable moments, admin UI for notes management
- [x] **AGT-03**: Write actions (add ticket notes, flag disputes) require explicit user confirmation before execution
- [x] **AGT-04**: Daily message cap with configurable limit, approaching-limit warning, conversation logging for audit trail

## v2.x Requirements

Deferred to post-launch validation. Tracked but not in current roadmap.

### Reconciliation Enhancements

- **REC-06**: Configurable weight discrepancy tolerance per crop (default 1%) with auto-flagging
- **REC-07**: Multi-buyer season summary — all buyers on one screen with totals and averages
- **REC-08**: Fuzzy settlement matching by date + weight for tickets without matching ticket numbers

### Workflow

- **WRK-01**: Disputed ticket workflow with resolution notes and resolvedAt tracking

## Out of Scope

| Feature | Reason |
|---------|--------|
| Elevator-side software (storage, shrink tables) | Hughes Farm is the seller, not the elevator. Elevator has their own system. |
| Real-time futures price integration | Prices come from contracts already signed; futures API adds complexity without value |
| Full contract management (forward, basis, HTA) | Separate domain with significant complexity; defer to future milestone |
| Automated PDF settlement parsing | PDF formats vary wildly; manual entry is sufficient for paper-only buyers |
| Auto-adjust farm records to match buyer | Destroys traceability evidence; show variance, let farmer decide |
| Push notifications for discrepancies | Internal office tool; dashboard badge is sufficient |
| TypeScript migration | Existing app is vanilla JS; migration adds no user value for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 9 (schema) + Phase 10 (cutover) | Partial (Phase 9 done) |
| DB-02 | Phase 10 | Complete |
| DB-03 | Phase 10 | Complete |
| DB-04 | Phase 10 | Complete |
| BUY-01 | Phase 11 | Complete |
| BUY-02 | Phase 11 | Complete |
| BUY-03 | Phase 11 | Complete |
| TKT-01 | Phase 11 | Complete |
| TKT-02 | Phase 11 | Complete |
| SET-01 | Phase 12 | Complete |
| SET-02 | Phase 12 | Complete |
| SET-03 | Phase 12 | Complete |
| SET-04 | Phase 12 | Complete |
| REC-01 | Phase 13 | Complete |
| REC-02 | Phase 13 | Complete |
| REC-03 | Phase 13 | Complete |
| REC-04 | Phase 13 | Complete |
| REC-05 | Phase 13 | Complete |
| CHT-01 | Phase 14 | Complete |
| CHT-02 | Phase 14 | Complete |
| AGT-01 | Phase 14 | Complete |
| AGT-02 | Phase 14 | Complete |
| AGT-03 | Phase 14 | Complete |
| AGT-04 | Phase 14 | Complete |
| FIX-01 | Phase 15 | Complete |
| FIX-02 | Phase 15 | Complete |
| FIX-03 | Phase 15 | Complete |
| ECO-01 | Phase 15 | Complete |
| ECO-02 | Phase 15 | Complete |
| ECO-05 | Phase 15 | Complete |
| ECO-03 | Phase 16 | Pending |
| ECO-04 | Phase 16 | Pending |
| CMP-01 | Phase 16 | Pending |
| CMP-02 | Phase 16 | Pending |
| CMP-05 | Phase 16 | Pending |
| CMP-03 | Phase 17 | Pending |
| CMP-04 | Phase 17 | Pending |
| ROT-01 | Phase 18 | Pending |
| ROT-02 | Phase 18 | Pending |
| ROT-03 | Phase 18 | Pending |
| HRV-01 | Phase 18 | Pending |
| HRV-02 | Phase 18 | Pending |
| PDF-01 | Phase 18 | Pending |
| PDF-02 | Phase 18 | Pending |

**v2.0 Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

**v3.0 Coverage:**
- v3.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-02 — v3.0 traceability added (phases 15-18)*
