# Requirements: Farm Operations Platform

**Defined:** 2026-03-01
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.

## v2.0 Requirements

Requirements for grain traceability milestone. Each maps to roadmap phases.

### Database

- [ ] **DB-01**: Existing grain ticket data migrates from JSON to PostgreSQL with zero data loss
- [ ] **DB-02**: All existing ticket CRUD operations work against PostgreSQL (not JSON)
- [ ] **DB-03**: Calculation engine (calc.js) produces identical results before and after migration
- [ ] **DB-04**: Existing UI and PWA continue functioning during and after migration

### Buyers

- [ ] **BUY-01**: User can create, edit, and delete buyer/destination records (name, type, shortCode)
- [ ] **BUY-02**: User can select a destination (buyer) when entering a ticket
- [ ] **BUY-03**: User can store per-buyer import column mapping for reuse

### Tickets

- [ ] **TKT-01**: Each ticket has an explicit cropYear field for season scoping
- [ ] **TKT-02**: User can filter and view tickets by buyer/destination

### Settlements

- [ ] **SET-01**: User can import a buyer's settlement statement from CSV or Excel file
- [ ] **SET-02**: User can preview and map columns before committing a settlement import
- [ ] **SET-03**: User can manually enter individual settlement line items for paper-only buyers
- [ ] **SET-04**: Each settlement line captures: ticket number, date, net weight, moisture, net bushels, price, deductions, net payment

### Reconciliation

- [ ] **REC-01**: System matches farm tickets to settlement lines by ticket number within same buyer and cropYear
- [ ] **REC-02**: Each ticket shows reconciliation status: unreconciled, matched, disputed, or manual-override
- [ ] **REC-03**: User can view all unmatched loads — farm-only tickets and settlement-only lines
- [ ] **REC-04**: User can view settlement summary comparing farm totals vs buyer settled totals per crop/buyer/season
- [ ] **REC-05**: User can flag a matched ticket as disputed and add notes

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
| DB-01 | Phase 9 (schema) + Phase 10 (cutover) | Pending |
| DB-02 | Phase 10 | Pending |
| DB-03 | Phase 10 | Pending |
| DB-04 | Phase 10 | Pending |
| BUY-01 | Phase 11 | Pending |
| BUY-02 | Phase 11 | Pending |
| BUY-03 | Phase 11 | Pending |
| TKT-01 | Phase 11 | Pending |
| TKT-02 | Phase 11 | Pending |
| SET-01 | Phase 12 | Pending |
| SET-02 | Phase 12 | Pending |
| SET-03 | Phase 12 | Pending |
| SET-04 | Phase 12 | Pending |
| REC-01 | Phase 13 | Pending |
| REC-02 | Phase 13 | Pending |
| REC-03 | Phase 13 | Pending |
| REC-04 | Phase 13 | Pending |
| REC-05 | Phase 13 | Pending |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 — traceability updated after roadmap creation*
