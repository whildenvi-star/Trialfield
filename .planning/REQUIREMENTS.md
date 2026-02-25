# Requirements: Organic Audit System

**Defined:** 2026-02-24
**Core Value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.

## v1.0 Requirements

Requirements for milestone v1.0: Data Ingestion & Reports. Each maps to roadmap phases.

### API Integration

- [x] **API-01**: Farm manager can connect their Case IH FieldOps account via OAuth2
- [x] **API-02**: Farm manager can trigger a data sync to pull field operations from Case IH
- [x] **API-03**: System normalizes Case IH data into structured records (tillage, planting, application, harvest)
- [x] **API-04**: System displays sync status and last-sync timestamp per field
- [x] **API-05**: System detects and alerts if Case IH account returns no data (Linked Account limitation)

### Field Records

- [x] **FIELD-01**: Farm manager can view 3-year field history per parcel (crops, inputs, dates)
- [x] **FIELD-02**: Farm manager can view input application records (material, date, rate, field, approval status)
- [x] **FIELD-03**: Farm manager can view harvest records (yield, date, field, lot number, equipment)
- [x] **FIELD-04**: Farm manager can view tillage operation records per field
- [x] **FIELD-05**: Farm manager can manually enter field records for pre-API or non-synced data
- [x] **FIELD-06**: System auto-generates lot numbers for harvest records (cropYear-crop-fieldName)

### Reports

- [ ] **RPT-01**: Farm manager can generate a print-ready USDA NOP inspection report as PDF
- [ ] **RPT-02**: Report includes operation overview, field list, and 3-year field history
- [ ] **RPT-03**: Report includes input application log and harvest log with lot numbers
- [ ] **RPT-04**: Report includes mass balance summary (harvested vs. sold per crop/lot)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Audit Infrastructure

- **AUDIT-01**: Append-only audit store with SHA-256 tamper-evidence (signed/checksummed entries)
- **AUDIT-02**: Audit viewer with filtering by user/resource/time
- **AUDIT-03**: Audit log export for regulators (CSV/PDF)
- **AUDIT-04**: API middleware that emits audit events on every write
- **AUDIT-05**: Configurable retention/archive policy for compliance (5-year minimum)
- **AUDIT-06**: Background jobs for audit log snapshots and backups

### Field Enhancements

- **FLDENH-01**: Photo evidence attachment for field documentation
- **FLDENH-02**: Field record corrections/annotations by operators (append-only correction model)
- **FLDENH-03**: Prohibited input pre-validation (flags non-approved materials on save)
- **FLDENH-04**: Audit report pre-flight completeness check

### UX

- **UX-01**: Mobile-friendly responsive design (prep for future mobile app)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Web-first; responsive design deferred to v2 |
| Real-time field notifications | Farming environments have poor connectivity; background sync is correct |
| Inspector portal/login | Inspectors work on-site with paper; PDF is the right interface |
| Multi-certifier support (EU, state programs) | USDA NOP only for v1; isolate certifier logic for future |
| Automated compliance scoring | USDA does not delegate certification decisions to software |
| Blockchain audit ledger | SHA-256 hash chains on PostgreSQL provide equivalent tamper evidence |
| Consumer-facing traceability QR codes | Separate product domain; not an audit system feature |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 1 | Complete |
| API-02 | Phase 1 | Complete |
| API-03 | Phase 1 | Complete |
| API-04 | Phase 1 | Complete |
| API-05 | Phase 1 | Complete |
| FIELD-01 | Phase 2 | Complete |
| FIELD-02 | Phase 2 | Complete |
| FIELD-03 | Phase 2 | Complete |
| FIELD-04 | Phase 2 | Complete |
| FIELD-05 | Phase 2 | Complete |
| FIELD-06 | Phase 2 | Complete |
| RPT-01 | Phase 3 | Pending |
| RPT-02 | Phase 3 | Pending |
| RPT-03 | Phase 3 | Pending |
| RPT-04 | Phase 3 | Pending |

**Coverage:**
- v1.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after 01-02 completion (API-02, API-03, API-04, API-05 marked complete)*
