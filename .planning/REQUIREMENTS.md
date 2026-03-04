# Requirements: Farm Operations Platform

**Defined:** 2026-03-04
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## v4.0 Requirements

Requirements for v4.0 Cross-Module Polish & Settlement Closure. Each maps to roadmap phases.

### Bug Fixes

- [x] **FIX-01**: User can save field edits in farm-registry and see reportingAcres, organicAcres, and ownership persist correctly after page refresh
- [x] **FIX-02**: Farm-registry PUT /api/fields/:id accepts all form-submitted fields including growerId

### Farm Budget Polish

- [x] **BUD-01**: Field editor preview shows both per-acre cost and total field cost for every budget category (Rent, Fertilizer, Seed, Machinery, Labor, Overhead, Fuel, Drying, Interest, Insurance)
- [x] **BUD-02**: Negative Profit/AC and Profit (w/ Payments) values display in red in the field editor preview
- [ ] **BUD-03**: Orders tab is visible in navigation and fully functional (PO creation, status tracking, supplier selection)
- [ ] **BUD-04**: Deliveries tab is visible in navigation and fully functional (receipt logging, order linking, item tracking)

### FSA Crop Sync

- [x] **FSA-01**: Crop sync preview pulls enterprise-level data from farm-budget macro rollup (dashboard endpoint) including crop, acres, and enterprise details
- [x] **FSA-02**: Sync preview displays side-by-side comparison of FSA CLU acres vs farm-budget enterprise acres by crop
- [x] **FSA-03**: Only tillable CLUs with actual crop assignments are included in sync proposals (grass/non-crop CLUs excluded)
- [x] **FSA-04**: CLUs already marked as "reported" are excluded from sync proposals

### Settlement Reconciliation

- [ ] **REC-01**: User can configure per-crop weight discrepancy tolerance (% or lbs) that controls when matches are flagged as discrepancies
- [ ] **REC-02**: Multi-buyer season summary view shows all buyers with total tickets, total weight, settlement status, payment totals, and variance for the crop year
- [ ] **REC-03**: When exact ticket number matching fails, system attempts fuzzy matching by date (±2 days) and weight (±tolerance%) and presents candidates for user confirmation
- [ ] **REC-04**: User can mark disputed tickets with resolution status (Buyer Error, Our Error, Write-off, Pending), add resolution notes, and record resolution date

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Audit Infrastructure

- **AUD-01**: Append-only audit store with tamper-evidence (signed/checksummed entries)
- **AUD-02**: Audit viewer with filtering by user/resource/time
- **AUD-03**: Audit log export for regulators

### Mobile & Media

- **MOB-01**: Mobile-friendly responsive design across all modules
- **MOB-02**: Photo evidence attachment for field documentation

### Multi-Certifier

- **CERT-01**: Support for EU and state organic certification programs

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Web-first, responsive design for now |
| Real-time field notifications | Not needed for audit prep workflow |
| Automated compliance scoring | Inspector makes the call, we provide records |
| Inspector portal/login | Inspectors receive print reports, not digital access |
| Elevator-side software | Hughes Farm is the seller, not the elevator |
| Real-time futures price integration | Prices come from contracts already signed |
| Automated PDF settlement parsing | PDF formats vary wildly across buyers |
| Rewriting existing module frameworks | Each module works — no framework migrations |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 20 | Complete |
| FIX-02 | Phase 20 | Complete |
| BUD-01 | Phase 21 | Complete |
| BUD-02 | Phase 21 | Complete |
| BUD-03 | Phase 21 | Pending |
| BUD-04 | Phase 21 | Pending |
| FSA-01 | Phase 22 | Complete |
| FSA-02 | Phase 22 | Complete |
| FSA-03 | Phase 22 | Complete |
| FSA-04 | Phase 22 | Complete |
| REC-01 | Phase 23 | Pending |
| REC-02 | Phase 23 | Pending |
| REC-03 | Phase 23 | Pending |
| REC-04 | Phase 23 | Pending |

**Coverage:**
- v4.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 — traceability complete after roadmap creation*
